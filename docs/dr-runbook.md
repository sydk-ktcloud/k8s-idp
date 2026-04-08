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
    ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
    │ On-prem │   │ GKE Burst │  │ EKS DR  │
    │ (primary)│   │ (overflow) │  │(dormant)│
    │ tag:     │   │ tag:       │  │ tag:    │
    │ onprem   │   │ gke-burst  │  │ eks-dr  │
    └─────────┘   └────────────┘  └─────────┘

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
- EKS Crossplane claim 배포 완료 (nodeCount: 0, dormant)

---

## DR 활성화 절차 (On-prem 장애 시)

> **자동화 스크립트:** `./scripts/dr-activate.sh`

### Step 1: 장애 감지

- Dead Man's Switch: heartbeat CronJob이 GCS에 5분마다 업로드
- GCP Cloud Monitoring: 15분 이상 업데이트 없으면 알림 발생
- Discord `#클러스터-알림` 채널에서 확인

### Step 2: EKS 노드 활성화

```bash
# EKS 노드 그룹 scale up (3-5분 소요)
kubectl patch ekscluster eks-dr -n default --type merge \
  -p '{"spec":{"nodeCount": 3}}'

# 상태 확인
kubectl get ekscluster eks-dr -n default -w
```

### Step 3: EKS kubeconfig 가져오기

```bash
# Crossplane이 생성한 kubeconfig Secret
EKS_SECRET=$(kubectl get secret -n crossplane-system -o name | grep eks-cluster-conn | head -1)
kubectl get "$EKS_SECRET" -n crossplane-system -o jsonpath='{.data.kubeconfig}' | base64 -d > kubeconfig/eks-dr
export KUBECONFIG=kubeconfig/eks-dr
```

### Step 4: EKS 인프라 배포

```bash
# Tailscale VPN + NetworkPolicy + SecretStore
kubectl apply -k kubernetes/manifests/eks-dr/

# Prometheus (경량)
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring -f kubernetes/manifests/eks-dr/prometheus-values.yaml

# Velero (GCS offsite 복구용)
helm install velero vmware-tanzu/velero \
  -n velero -f kubernetes/manifests/eks-dr/velero-values.yaml
```

### Step 5: 워크로드 복구

```bash
# 최신 백업에서 복구
velero backup get
velero restore create dr-restore \
  --from-backup <최신-백업-이름> \
  --include-namespaces trip-app,backstage \
  --restore-volumes=true

# 확인
kubectl get pods -n trip-app
kubectl get pods -n backstage
```

### Step 6: GKE Burst 메트릭 소스 전환

```bash
# EKS Prometheus ClusterIP 확인
EKS_PROM_IP=$(kubectl get svc -n monitoring prometheus-kube-prometheus-prometheus -o jsonpath='{.spec.clusterIP}')

# GKE prometheus-proxy upstream을 EKS로 전환
kubectl --kubeconfig=kubeconfig/gke-burst patch configmap prometheus-upstream \
  -n burst-workloads -p "{\"data\":{\"upstream_url\":\"http://${EKS_PROM_IP}:9090\"}}"
kubectl --kubeconfig=kubeconfig/gke-burst rollout restart deploy/prometheus-proxy -n burst-workloads
```

### Step 7: 확인

```bash
# EKS 서비스 정상 동작
kubectl get pods -n trip-app
curl http://localhost:8080/health  # port-forward 후

# GKE KEDA가 EKS 메트릭을 읽는지 확인
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

### Step 5: EKS 정리

```bash
# EKS 워크로드 삭제
kubectl --kubeconfig=kubeconfig/eks-dr delete namespace trip-app --ignore-not-found
kubectl --kubeconfig=kubeconfig/eks-dr delete namespace backstage --ignore-not-found

# EKS 노드 scale-to-zero (dormant로 복귀)
kubectl patch ekscluster eks-dr -n default --type merge \
  -p '{"spec":{"nodeCount": 0}}'
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
