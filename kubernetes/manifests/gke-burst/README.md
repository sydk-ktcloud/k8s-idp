# GKE Burst Cluster Manifests

GKE Burst 클러스터의 피크 부하 시 옄 처리하기 위한 Kubernetes 매니페스트 모음입니다.

## 구성 요소

### 1. VPN 연결 (tailscale-gke.yaml)
- Tailscale DaemonSet으로 GKE 노드를 Headscale VPN 메시에 연결
- Headscale 서버: http://100.64.0.1:8080

### 2. ArgoCD Multi-cluster (argocd-multi-cluster.yaml)
- GKE 클러스터를 On-prem ArgoCD에 등록
- ApplicationSet으로 burst 워크로드 배포

### 3. Burst 워크로드 (burst-workload-demo.yaml)
- 데모용 burst 워크로드
- HPA로 CPU/Memory 기반 자동 스케일링
- minReplicas: 1, maxReplicas: 10

### 4. KEDA 자동화 (keda-scaler.yaml)
- Prometheus 메트릭 기반 이벤트 드리븐 스케일링
- minReplicaCount: 0 (scale to zero)
- maxReplicaCount: 10

## 배포 방법

### 1. VPN 연결 설정

```bash
# Headscale에서 pre-auth key 생성
docker exec -it headscale headscale preauthkeys create --reusable --expiration 24h gke-burst

# Secret에 auth key 저장 (GKE 클러스터에 적용)
KUBECONFIG=kubeconfig/gke-burst kubectl apply -f kubernetes/manifests/gke-burst/tailscale-gke.yaml

# VPN 연결 확인
KUBECONFIG=kubeconfig/gke-burst kubectl logs -n kube-system -l app=tailscale
```

### 2. ArgoCD 클러스터 등록

```bash
# GKE kubeconfig에서 CA 인증서와 토큰 추출
KUBECONFIG=kubeconfig/gke-burst kubectl config view --raw -o jsonpath='{.users[0].user.token}' > gke-bearer-token
KUBECONFIG=kubeconfig/gke-burst kubectl get secret -n default gke-burst-kubeconfig -o jsonpath='{.data.kubeconfig}' | base64 -d > gke-kubeconfig-extracted

# On-prem ArgoCD에 클러스터 등록
kubectl apply -f kubernetes/manifests/gke-burst/argocd-multi-cluster.yaml
```

### 3. Burst 워크로드 배포

```bash
# Kustomize로 배포
kubectl apply -k kubernetes/manifests/gke-burst/

# 또는 ArgoCD ApplicationSet으로 배포
kubectl apply -f kubernetes/argocd-apps/gke-burst-cluster.yaml
```

## 자동 스케일링 동작

### HPA 기반 스케일링
- CPU 사용률 > 70% → Pod 추가
- Memory 사용률 > 80% → Pod 추가
- Scale down: 5분 안정화 후 50% 감소

### KEDA 기반 스케일링
- Prometheus 메트릭 (http_requests_total) > 100 → Pod 추가
- 트래픽 없음 → 0 Pod로 스케일 다운

## 모니터링

```bash
# HPA 상태 확인
KUBECONFIG=kubeconfig/gke-burst kubectl get hpa -n burst-workloads

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

- Preemptible/Spot VMs 사용으로 비용 절감
- Scale to zero (KEDA minReplicaCount: 0)로 유휴 시 비용 절감
- Resource limits 설정으로 리소스 과다 사용 방지
