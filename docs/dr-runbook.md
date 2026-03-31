# Disaster Recovery Runbook

## 개요

온프레미스 클러스터 장애 시 GKE에서 핵심 서비스를 복구하는 절차서.

**복구 대상:** trip-app (frontend + backend + DB), Backstage  
**복구하지 않는 것:** monitoring, chatops, Longhorn, Crossplane (온프레미스 복구 후)

| 지표 | 목표 |
|---|---|
| RPO | 24시간 (일일 백업 주기) |
| RTO | 30분 |

---

## 사전 조건

- GCP 프로젝트 `sydk-ktcloud` 접근 권한
- `gcloud` CLI 설치 및 인증 완료
- GCS 버킷 `sydk-velero-offsite`, `sydk-longhorn-offsite` 존재
- GKE Autopilot 클러스터 `k8s-idp-dr` 존재 (asia-northeast3)

---

## DR 복구 절차

### Step 1: GKE 클러스터 접속

```bash
gcloud container clusters get-credentials k8s-idp-dr \
  --region asia-northeast3 \
  --project sydk-ktcloud

kubectl get nodes
```

### Step 2: Velero 설치

```bash
# GCS 자격증명 Secret
kubectl create namespace velero
kubectl create secret generic velero-gcs-credentials -n velero \
  --from-file=gcp=gcs-key.json

# Velero 설치 (GCS 백업에서 복구)
velero install \
  --provider gcp \
  --bucket sydk-velero-offsite \
  --secret-file gcs-key.json \
  --plugins velero/velero-plugin-for-gcp:v1.9.0
```

### Step 3: 백업 목록 확인

```bash
velero backup get
# 가장 최근 백업 확인
```

### Step 4: 핵심 네임스페이스만 복구

```bash
velero restore create dr-restore \
  --from-backup <가장-최근-백업-이름> \
  --include-namespaces trip-app,backstage \
  --restore-volumes=true

# 복구 상태 확인
velero restore describe dr-restore
```

### Step 5: 서비스 동작 확인

```bash
kubectl get pods -n trip-app
kubectl get pods -n backstage

# trip-app 접근 테스트
kubectl port-forward svc/trip-backend-service -n trip-app 8080:8080
curl http://localhost:8080/health
```

### Step 6: 외부 접근 설정 (선택)

GKE에서 NodePort 대신 LoadBalancer 사용:

```bash
kubectl patch svc trip-backend-service -n trip-app \
  -p '{"spec":{"type":"LoadBalancer"}}'
```

---

## 온프레미스 복구 후 되돌리기

```bash
# GKE 워크로드 정리
kubectl delete namespace trip-app --kubeconfig kubeconfig/gke-burst
kubectl delete namespace backstage --kubeconfig kubeconfig/gke-burst

# GKE 클러스터는 파드 없으면 비용 $0이므로 삭제하지 않아도 됨
```

---

## GCS 백업 사전 확인 (월 1회)

```bash
# 백업 존재 확인
gsutil ls gs://sydk-velero-offsite/ | tail -5
gsutil ls gs://sydk-longhorn-offsite/ | tail -5

# 최신 백업 날짜 확인
gsutil ls -l gs://sydk-velero-offsite/ | sort -k2 | tail -1
```
