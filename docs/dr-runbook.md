# Disaster Recovery Runbook

## 개요

온프레미스 클러스터 장애 시 EKS(AWS)에서 핵심 서비스를 복구하는 절차서.

**복구 대상:** trip-app (frontend + backend + DB), Backstage  
**복구하지 않는 것:** monitoring, chatops, Longhorn, Crossplane (온프레미스 복구 후)

| 지표 | 목표 |
|---|---|
| RPO | 24시간 (일일 백업 주기) |
| RTO | 30분 |

---

## 인프라 구성

```
[On-Prem K8s] → [MinIO] ──CronJob 04:00──→ [GCS (오프사이트 백업)]
                         ──CronJob 04:30──→ [S3 (DR 복구용)]
       │
       └── Heartbeat (5분) ──→ [GCS] ──→ GCP Cloud Monitoring Alert
                                          (15분 미수신 시 알림)

DR 발동 시:
  [EKS k8s-idp-dr (us-west-2)] ← Velero restore ← S3 sydk-velero-dr-usw2
```

---

## 사전 조건

- AWS CLI 설치 및 인증 완료 (`aws configure`)
- S3 버킷 존재: `sydk-velero-dr-usw2`, `sydk-longhorn-dr-usw2`
- EKS 클러스터 `k8s-idp-dr` 존재 (us-west-2)
- GCS 버킷 `sydk-velero-offsite` 존재 (오프사이트 백업)

---

## 장애 판단 기준

온프레미스 클러스터는 5분마다 GCS에 heartbeat를 전송합니다.
GCP Cloud Monitoring에서 15분 이상 heartbeat가 갱신되지 않으면 알림이 발송됩니다.

**확인 방법:**
```bash
# GCS heartbeat 파일 확인
gsutil cat gs://sydk-velero-offsite/heartbeat.json
# timestamp가 15분 이상 경과 → 장애로 판단

# 직접 클러스터 접근 시도
kubectl --context platform-context get nodes
```

---

## DR 복구 절차

### Step 1: EKS 클러스터 접속

```bash
aws eks update-kubeconfig --name k8s-idp-dr \
  --region us-west-2 \
  --alias eks-dr

kubectl --context eks-dr get nodes
```

### Step 2: Nodegroup 스케일업 (평시 0대)

```bash
# 평시 0대 → DR 시 2대로 스케일업
eksctl scale nodegroup --cluster k8s-idp-dr \
  --region us-west-2 \
  --name dr-spot \
  --nodes 2

# 노드 Ready 대기
kubectl --context eks-dr get nodes -w
```

### Step 3: Velero 설치

```bash
kubectl --context eks-dr create namespace velero

# AWS credentials Secret
kubectl --context eks-dr create secret generic velero-credentials -n velero \
  --from-literal=cloud="[default]
aws_access_key_id=<AWS_ACCESS_KEY_ID>
aws_secret_access_key=<AWS_SECRET_ACCESS_KEY>"

# Velero 설치 (S3 백업에서 복구)
velero install \
  --provider aws \
  --bucket sydk-velero-dr-usw2 \
  --secret-file ./velero-credentials \
  --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --backup-location-config region=us-west-2 \
  --kubeconfig ~/.kube/config \
  --kubecontext eks-dr
```

### Step 4: 백업 목록 확인

```bash
velero backup get --kubecontext eks-dr
# 가장 최근 백업 확인
```

### Step 5: 핵심 네임스페이스만 복구

```bash
velero restore create dr-restore \
  --from-backup <가장-최근-백업-이름> \
  --include-namespaces trip-app,backstage \
  --restore-volumes=true \
  --kubecontext eks-dr

# 복구 상태 확인
velero restore describe dr-restore --kubecontext eks-dr
```

### Step 6: 서비스 동작 확인

```bash
kubectl --context eks-dr get pods -n trip-app
kubectl --context eks-dr get pods -n backstage

# trip-app 접근 테스트
kubectl --context eks-dr port-forward svc/trip-backend-service -n trip-app 8080:8080
curl http://localhost:8080/health
```

### Step 7: 외부 접근 설정 (선택)

EKS에서 LoadBalancer 사용:

```bash
kubectl --context eks-dr patch svc trip-backend-service -n trip-app \
  -p '{"spec":{"type":"LoadBalancer"}}'
```

---

## 온프레미스 복구 후 되돌리기

```bash
# EKS 워크로드 정리
kubectl --context eks-dr delete namespace trip-app
kubectl --context eks-dr delete namespace backstage

# Nodegroup 스케일다운 (비용 $0)
eksctl scale nodegroup --cluster k8s-idp-dr \
  --region us-west-2 \
  --name dr-spot \
  --nodes 0
```

---

## 백업 파이프라인 사전 확인 (월 1회)

```bash
# S3 백업 존재 확인 (DR 복구용)
aws s3 ls s3://sydk-velero-dr-usw2/ --recursive | tail -5
aws s3 ls s3://sydk-longhorn-dr-usw2/ --recursive | tail -5

# GCS 백업 존재 확인 (오프사이트)
gsutil ls gs://sydk-velero-offsite/ | tail -5
gsutil ls gs://sydk-longhorn-offsite/ | tail -5

# Heartbeat 정상 동작 확인
gsutil cat gs://sydk-velero-offsite/heartbeat.json

# 온프레미스 CronJob 상태 확인
kubectl get cronjob -n minio-storage
```

---

## 비용 요약

| 항목 | 평시 | DR 발동 시 |
|---|---|---|
| EKS Control Plane | $73/월 | $73/월 |
| Nodegroup (Spot t3.small) | $0 (0대) | ~$30/월 (2대) |
| S3 저장 비용 | ~$1-3/월 | ~$1-3/월 |
| GCS 저장 비용 | ~$1-3/월 | ~$1-3/월 |
| **합계** | **~$75/월** | **~$107/월** |
