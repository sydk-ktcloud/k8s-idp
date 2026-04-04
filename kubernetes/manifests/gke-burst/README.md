# GKE Burst Cluster Manifests (Autopilot)

GKE Autopilot 클러스터를 활용한 피크 부하 burst 처리 매니페스트입니다.

## 아키텍처

**GKE Autopilot** 기반으로 운영합니다:
- 클러스터 관리비 무료 (Standard 대비 ~$74/월 절감)
- Pod 실행분만 과금, Pod 0개일 때 비용 $0
- 노드 관리 불필요 (GKE가 자동 프로비저닝)
- Spot Pod 스케줄링으로 추가 60-91% 할인

## 구성 요소

### 1. VPN 연결 (tailscale-gke.yaml)
- Tailscale DaemonSet으로 GKE 노드를 Headscale VPN 메시에 연결
- Headscale 서버: http://100.64.0.1:8080

### 2. ArgoCD Multi-cluster (argocd-multi-cluster.yaml)
- GKE 클러스터를 On-prem ArgoCD에 등록
- ApplicationSet으로 burst 워크로드 배포

### 3. Burst 워크로드 (burst-workload-demo.yaml)
- 데모용 burst 워크로드
- Spot Pod 스케줄링 (`cloud.google.com/gke-spot: "true"`)
- KEDA로 scale-to-zero 지원

### 4. KEDA 자동화 (keda-scaler.yaml)
- Prometheus 메트릭 기반 이벤트 드리븐 스케일링
- minReplicaCount: 0 (scale to zero)
- maxReplicaCount: 5

## 배포 방법

### 1. Crossplane으로 클러스터 프로비저닝

```bash
# ClusterBurst claim 적용 (Autopilot 클러스터 생성)
kubectl apply -f apps/gke-burst/claim.yaml

# 클러스터 상태 확인
kubectl get clusterburst gke-burst-asia3
```

### 2. VPN 연결 설정

```bash
# Headscale에서 pre-auth key 생성
docker exec -it headscale headscale preauthkeys create --reusable --expiration 24h gke-burst

# Secret에 auth key 저장 (GKE 클러스터에 적용)
KUBECONFIG=kubeconfig/gke-burst kubectl apply -f kubernetes/manifests/gke-burst/tailscale-gke.yaml

# VPN 연결 확인
KUBECONFIG=kubeconfig/gke-burst kubectl logs -n kube-system -l app=tailscale
```

### 3. ArgoCD 클러스터 등록

```bash
# GKE kubeconfig에서 CA 인증서와 토큰 추출
KUBECONFIG=kubeconfig/gke-burst kubectl config view --raw -o jsonpath='{.users[0].user.token}' > gke-bearer-token
KUBECONFIG=kubeconfig/gke-burst kubectl get secret -n default gke-burst-kubeconfig -o jsonpath='{.data.kubeconfig}' | base64 -d > gke-kubeconfig-extracted

# On-prem ArgoCD에 클러스터 등록
kubectl apply -f kubernetes/manifests/gke-burst/argocd-multi-cluster.yaml
```

### 4. Burst 워크로드 배포

```bash
# Kustomize로 배포
kubectl apply -k kubernetes/manifests/gke-burst/

# 또는 ArgoCD ApplicationSet으로 배포
kubectl apply -f kubernetes/argocd-apps/gke-burst-cluster.yaml
```

## 자동 스케일링 동작

### KEDA 기반 스케일링
- Prometheus 메트릭 (http_requests_total) > 100 → Pod 추가
- 활성 클러스터 CPU > 70% → Pod 추가
- Pending Pod > 3개 → Pod 추가
- 트래픽 없음 → 15분 cooldown 후 0 Pod로 스케일 다운

### Autopilot 노드 관리
- Pod 스케줄 시 GKE가 자동으로 노드 프로비저닝
- Pod 0개 시 노드도 자동 제거 → 비용 $0

## 모니터링

```bash
# KEDA ScaledObject 상태 확인
KUBECONFIG=kubeconfig/gke-burst kubectl get scaledobject -n burst-workloads

# Pod 개수 확인
KUBECONFIG=kubeconfig/gke-burst kubectl get pods -n burst-workloads
```

## 트래픽 분산

On-prem에서 GKE로 트래픽 분산:
1. Cloud Load Balancer (Hybrid NEG) 사용
2. DNS 기반 라운드 로빈
3. Service mesh (Istio) 기반 트래픽 분할

## 비용 최적화

- **Autopilot**: 클러스터 관리비 무료, Pod 실행분만 과금
- **Spot Pod**: `cloud.google.com/gke-spot` nodeSelector로 60-91% 할인
- **Scale to zero**: KEDA minReplicaCount: 0으로 유휴 시 비용 $0
- **Autopilot 리소스 관리**: GKE가 자동으로 bin-packing 최적화
