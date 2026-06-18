# Disaster Recovery Runbook

## 개요

온프레미스 클러스터 장애 시 EKS DR에서 핵심 서비스를 복구하고,
EKS에서도 GKE Burst 클러스터로 overflow 스케일링을 유지하는 절차서.

**복구 대상:** trip-app (frontend + backend + DB), Backstage
**복구하지 않는 것:** monitoring (EKS 경량 Prometheus만 배포), chatops, Longhorn, Crossplane

| 지표 | 목표 |
|---|---|
| RPO | 24시간 (일일 백업 주기) |
| RTO | 30분 |

---

## 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                    Cloud Headscale                         │
│              (GCP e2-micro, 항시 가동)                      │
│                   VPN Control Plane                        │
└────────┬──────────────┬──────────────┬────────────────────┘
         │              │              │
    ┌────▼────┐   ┌─────▼─────┐  ┌─────▼──────┐
    │ On-prem │   │ GKE Burst │  │   EKS DR   │
    │ (primary)│   │ (overflow) │  │(평시 미존재 │
    │ tag:     │   │ tag:       │  │ eksctl로   │
    │ onprem   │   │ gke-burst  │  │ on-demand) │
    └─────────┘   └────────────┘  └────────────┘
   프로비저닝 두뇌(Lambda·GitHub Actions·eksctl)는 모두 on-prem 밖에 위치 →
   on-prem 완전장애에도 DR 생성 가능

평시:  On-prem → [Prometheus] → GKE KEDA → Burst
DR시:  EKS DR → [Prometheus] → GKE KEDA → Burst
```

**핵심 컴포넌트:**
- **Cloud Headscale**: On-prem SPOF 해소, GCP에서 항시 가동
- **Prometheus Proxy (GKE)**: KEDA 메트릭 소스를 ConfigMap으로 전환
- **`active:` recording rules**: On-prem/EKS 동일 메트릭 이름

---

## 사전 조건

- GCP 프로젝트 `sydk-ktcloud` 접근 권한
- `gcloud`, `kubectl`, `velero` CLI 설치
- AWS S3 버킷 `sydk-velero-dr-usw2`, `sydk-longhorn-dr-usw2` 존재 (MinIO 미러링 대상)
- Cloud Headscale 가동 중 (`infrastructure/headscale-cloud/setup.sh`)
- AWS Secrets Manager에 DR 시크릿 미러링 완료
- OIDC + IAM Role 배포 완료 (`cloudformation-oidc-role.yaml`) 및 GitHub repo secret 등록
  - `AWS_DR_ROLE_ARN`, `GKE_KUBECONFIG_B64`(선택), `DISCORD_CLUSTER_WEBHOOK`
- DR 클러스터는 **평시 미존재**(eksctl On-Demand 생성) — 사전 프로비저닝 불필요

---

## DR 활성화 절차 (On-prem 장애 시)

> **핵심 설계:** 완전장애(on-prem 100% 다운)에서도 동작하도록, 프로비저닝 주체를
> on-prem 밖(GitHub-hosted runner + OIDC + eksctl)에 둔다. on-prem의
> kubectl/Crossplane/Vault에 **전혀 의존하지 않는다.**
>
> **자동 경로:** Lambda(장애 감지) → GitHub Actions `dr-activate`(ubuntu-latest) → `dr-activate.sh`

### 동작 흐름

```
on-prem 사망
   │  (heartbeat 끊김)
   ▼
AWS Lambda heartbeat-monitor (S3 LastModified 15분 초과 감지)   ← AWS, 살아있음
   │  workflow_dispatch
   ▼
GitHub Actions: dr-activate.yaml (runs-on: ubuntu-latest)        ← GitHub 인프라
   │  OIDC AssumeRole → AWS_DR_ROLE_ARN
   ▼
scripts/dr-activate.sh
   ├─ eksctl create cluster -f infrastructure/aws-dr/eksctl-cluster.yaml
   ├─ aws eks update-kubeconfig            (on-prem Secret 아님)
   ├─ eksctl create iamserviceaccount      (Velero IRSA)
   ├─ helm install velero                  (static key 없음)
   ├─ velero restore (S3 백업 → trip-app,backstage)
   └─ (선택) GKE Burst 메트릭 소스 → EKS 전환
```

> ⚠️ **기존 결함(수정됨):** 과거에는 self-hosted runner(on-prem) + Crossplane(on-prem)으로
> EKS를 만들었기 때문에, on-prem이 완전히 죽으면 DR을 띄울 손발도 같이 죽었다(순환 의존성).
> 이제는 위 경로 어디에도 on-prem이 없다.

### 사전 준비 (1회)

1. OIDC + IAM Role 배포:
   ```bash
   aws cloudformation deploy \
     --template-file infrastructure/aws-dr/cloudformation-oidc-role.yaml \
     --stack-name k8s-idp-dr-oidc --capabilities CAPABILITY_NAMED_IAM \
     --region us-west-2 --parameter-overrides GitHubRepo=sydk-ktcloud/k8s-idp
   ```
2. 출력값 등록 (GitHub repo secrets):
   - `AWS_DR_ROLE_ARN`        ← 출력 `DRProvisionRoleArn`
   - `GKE_KUBECONFIG_B64`     ← GKE burst kubeconfig base64 (선택, 메트릭 전환용)
   - `DISCORD_CLUSTER_WEBHOOK`← Discord 알림
3. DNS 페일오버 배포 + repo **variables** 등록:
   ```bash
   aws cloudformation deploy \
     --template-file infrastructure/aws-dr/cloudformation-dns-failover.yaml \
     --stack-name k8s-idp-dns-failover --region us-west-2 \
     --parameter-overrides HostedZoneId=<ZONE> DomainName=<도메인> OnPremIP=<노드IP>
   ```
   - repo variables: `ROUTE53_ZONE_ID`, `DR_DOMAIN` (dr-activate가 SECONDARY 자동 등록)
4. 논리 백업 활성화 (EBS 복구 데이터 소스):
   - `kubectl apply -f kubernetes/manifests/trip-app/db-logical-backup-cron.yaml`
   - NetworkPolicy: `minio-storage → trip-app:5432` ingress 허용 추가

### 데이터 복구가 EBS로 떨어지는 원리

on-prem PVC는 Longhorn 포맷이라 EKS(EBS)에서 못 읽는다. 그래서 **2단계**로 복구한다:
- **매니페스트/PVC**: Velero가 복구하되, `change-storage-class` 플러그인이
  `longhorn → gp3`로 리매핑 → PVC가 **EBS gp3**에 바인딩(빈 볼륨).
- **DB 데이터**: on-prem `db-logical-backup-cron`이 매시간 `pg_dump`를 S3에 올리고,
  DR 시 `dr-activate.sh`가 그 덤프를 EBS postgres에 `pg_restore`. (RPO: DB 한정 1시간)

### DNS/LB 자동 전환

- on-prem `OnPremHealthCheck`(Route53) 실패 → PRIMARY(on-prem) 죽고 SECONDARY(EKS NLB) 자동 응답
- SECONDARY는 `dr-activate.sh`가 `trip-frontend-dr-lb`(NLB) 생성 후 동적 등록
- ⚠️ **auto-failback 주의**: on-prem 복구 시 health check가 살아나 자동으로 PRIMARY 복귀한다.
  DB split-brain을 막으려면 health check 경로를 `/dr-health`(앱이 'DR 모드 아님'일 때만 200)로
  바꾸고, failback은 데이터 동기화 후 수동 실행해 SECONDARY를 제거한다(`dr-failback.sh`가 수행).

### Step 1: 장애 감지 (자동)

- Dead Man's Switch: on-prem heartbeat CronJob이 S3에 5분마다 업로드
- AWS Lambda가 5분마다 LastModified 확인 → 15분 초과 시 `dr-activate` 워크플로우 자동 dispatch
- Discord `#클러스터-알림` 채널에서 확인

### Step 2: DR 활성화 (자동 / 수동)

```bash
# 자동: Lambda가 트리거. 수동 실행은 Actions 탭 → "DR Activate" → Run workflow.
# 로컬에서 직접 실행할 경우(AWS 자격증명 + eksctl/kubectl/helm/velero 필요):
./scripts/dr-activate.sh
```

### Step 3: 확인

```bash
# EKS 클러스터/워크로드 정상 동작
eksctl get cluster --name k8s-idp-dr --region us-west-2
kubectl --kubeconfig=kubeconfig/eks-dr get pods -n trip-app
kubectl --kubeconfig=kubeconfig/eks-dr get pods -n backstage

# GKE KEDA가 EKS 메트릭을 읽는지 확인 (GKE 전환을 수행한 경우)
kubectl --kubeconfig=kubeconfig/gke-burst get scaledobject -n burst-workloads
```

---

## Failback 절차 (On-prem 복구 시)

> **자동화 스크립트:** `./scripts/dr-failback.sh`

### Step 1: On-prem 상태 확인

```bash
kubectl get nodes  # 4노드 모두 Ready 확인
kubectl get pods -n monitoring  # Prometheus 정상 확인
```

### Step 2: EKS 최종 백업

```bash
# EKS에서 DR 중 생성된 데이터 백업
kubectl --kubeconfig=kubeconfig/eks-dr exec -n velero deploy/velero -- \
  velero backup create failback-$(date +%Y%m%d) \
  --include-namespaces trip-app,backstage \
  --storage-location s3-dr \
  --wait
```

### Step 3: On-prem 데이터 복구

```bash
# Failback 백업에서 On-prem으로 복구
velero restore create failback-restore \
  --from-backup failback-$(date +%Y%m%d) \
  --include-namespaces trip-app,backstage

# 확인
kubectl get pods -n trip-app
kubectl get pods -n backstage
```

### Step 4: GKE 메트릭 소스 복귀

```bash
# On-prem Prometheus로 복귀
kubectl --kubeconfig=kubeconfig/gke-burst patch configmap prometheus-upstream \
  -n burst-workloads -p '{"data":{"upstream_url":"http://10.102.177.113:9090"}}'
kubectl --kubeconfig=kubeconfig/gke-burst rollout restart deploy/prometheus-proxy -n burst-workloads
```

### Step 5: EKS 정리 (eksctl 완전 삭제)

```bash
# EKS 워크로드 삭제 (PVC → EBS 등 클라우드 리소스 해제)
kubectl --kubeconfig=kubeconfig/eks-dr delete namespace trip-app backstage --ignore-not-found

# 클러스터 완전 삭제 → 비용 $0 복귀 (On-Demand 모델, Crossplane 미사용)
eksctl delete cluster -f infrastructure/aws-dr/eksctl-cluster.yaml --wait
```

### Step 6: 최종 확인

```bash
# On-prem 서비스 정상
kubectl get pods -n trip-app
curl http://localhost:8080/health

# GKE KEDA가 On-prem 메트릭을 읽는지 확인
kubectl --kubeconfig=kubeconfig/gke-burst get scaledobject -n burst-workloads

# Heartbeat CronJob 동작 확인
aws s3 cp s3://sydk-velero-dr-usw2/heartbeat/heartbeat.json - 2>/dev/null | cat

# EKS dormant 상태 확인
kubectl get ekscluster eks-dr -n default
```

---

## Cloud Headscale 관리

### 상태 확인

```bash
# GCE 인스턴스 상태
gcloud compute instances describe headscale-cloud --zone=asia-northeast3-a --project=sydk-ktcloud

# 연결된 노드 확인
gcloud compute ssh headscale-cloud --zone=asia-northeast3-a --project=sydk-ktcloud \
  --command='docker exec headscale headscale nodes list'
```

### Auth Key 갱신 (720시간마다)

```bash
# 기존 키 확인
gcloud compute ssh headscale-cloud --zone=asia-northeast3-a --project=sydk-ktcloud \
  --command='docker exec headscale headscale preauthkeys list --user default'

# 새 키 생성 (tag별)
gcloud compute ssh headscale-cloud --zone=asia-northeast3-a --project=sydk-ktcloud \
  --command='docker exec headscale headscale preauthkeys create --user default --reusable --expiration 720h --tags tag:onprem'
```

---

## S3 DR 백업 사전 확인 (월 1회)

```bash
# 백업 존재 확인
aws s3 ls s3://sydk-velero-dr-usw2/ --region us-west-2 | tail -5
aws s3 ls s3://sydk-longhorn-dr-usw2/ --region us-west-2 | tail -5

# 최신 백업 날짜 확인
aws s3 ls s3://sydk-velero-dr-usw2/ --region us-west-2 --recursive | sort -k1,2 | tail -1

# Heartbeat 확인
aws s3 cp s3://sydk-velero-dr-usw2/heartbeat/heartbeat.json - 2>/dev/null | cat
```

---

## Split-brain 방지

On-prem이 부분 복구되어 EKS와 동시에 서비스하는 상황 방지:

1. Heartbeat CronJob에 `dr-mode` 체크 추가 검토
2. On-prem 서비스 시작 전 GCS에서 DR 모드 플래그 확인
3. Failback은 반드시 수동 실행 (`./scripts/dr-failback.sh`)으로 제어
