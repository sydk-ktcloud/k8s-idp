# 쿠버네티스 클러스터 접속 가이드

## 📋 개요

이 가이드는 팀원들이 로컬 환경에서 kubectl을 사용하여 쿠버네티스 클러스터에 접속하는 방법을 설명합니다.

---

## 🔧 사전 요구사항

### 1. Headscale 네트워크 연결

클러스터는 Headscale VPN 네트워크(`100.64.0.0/24`)를 통해 접근합니다.

**Headscale 클라이언트 설치:**

```bash
# macOS
brew install headscale

# Linux
wget https://github.com/juanfont/headscale/releases/download/v0.22.3/headscale_0.22.3_linux_amd64.deb
sudo dpkg -i headscale_0.22.3_linux_amd64.deb
```

**네트워크 연결:**

```bash
# Headscale 서버에 연결 (관리자에게 인증 키 요청)
headscale up --login-server http://<headscale-server>:8080 --authkey <your-auth-key>

# 연결 확인
headscale status
```

**연결 확인:**

```bash
ping 100.64.0.1
# 응답이 오면 연결 성공
```

### 2. kubectl 설치

```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Windows (PowerShell)
winget install Kubernetes.kubectl
```

**설치 확인:**

```bash
kubectl version --client
```

---

## 🔑 kubeconfig 설정

### 1. kubeconfig 파일 받기

관리자로부터 본인의 팀에 맞는 kubeconfig 파일을 받으세요:

| 팀 | 파일명 | 권한 |
|----|--------|------|
| Admin | `kubeconfig-admin` | cluster-admin |
| Platform | `kubeconfig-platform` | cluster-admin |
| GitOps | `kubeconfig-gitops` | cluster-admin |
| Security | `kubeconfig-security` | cluster-admin |
| SRE | `kubeconfig-sre` | cluster-admin |
| FinOps | `kubeconfig-finops` | view (읽기 전용) |
| AI | `kubeconfig-ai` | view (읽기 전용) |

### 2. kubeconfig 파일 설치

**방법 A: 기본 kubeconfig로 설정**

```bash
# kubeconfig 파일을 ~/.kube/config로 복사
mkdir -p ~/.kube
cp kubeconfig-<team> ~/.kube/config
chmod 600 ~/.kube/config
```

**방법 B: 환경변수로 지정 (권장)**

```bash
# kubeconfig 파일을 원하는 위치에 저장
mkdir -p ~/.kube
cp kubeconfig-<team> ~/.kube/config-<team>
chmod 600 ~/.kube/config-<team>

# 환경변수 설정 (shell 설정 파일에 추가)
echo 'export KUBECONFIG=~/.kube/config-<team>' >> ~/.zshrc  # 또는 ~/.bashrc
source ~/.zshrc
```

**방법 C: 여러 kubeconfig 사용**

```bash
# 여러 클러스터를 관리하는 경우
export KUBECONFIG=~/.kube/config-<team>:~/.kube/other-config
```

---

## ✅ 연결 테스트

```bash
# 노드 상태 확인
kubectl get nodes

# 파드 목록 확인
kubectl get pods -A

# 현재 권한 확인
kubectl auth can-i --list
```

**예상 출력:**

```
NAME     STATUS   ROLES           AGE   VERSION
k8s-cp   Ready    control-plane   36h   v1.32.13
k8s-w1   Ready    <none>          36h   v1.32.13
k8s-w2   Ready    <none>          36h   v1.32.13
k8s-w3   Ready    <none>          36h   v1.32.13
```

---

## 🌐 서비스 접속

Headscale 네트워크를 통해 다음 서비스에 접근할 수 있습니다:

| 서비스 | URL | 설명 |
|--------|-----|------|
| **ArgoCD** | http://100.64.0.1:30081 | GitOps 대시보드 |
| **Grafana** | http://100.64.0.1:30080 | 모니터링 대시보드 |
| **Dex** | http://100.64.0.1:30556 | SSO 인증 |

---

## 📌 자주 사용하는 명령어

```bash
# 네임스페이스 목록
kubectl get namespaces

# 특정 네임스페이스의 파드 확인
kubectl get pods -n <namespace>

# 파드 상세 정보
kubectl describe pod <pod-name> -n <namespace>

# 로그 확인
kubectl logs <pod-name> -n <namespace>

# 파드 내부 접속
kubectl exec -it <pod-name> -n <namespace> -- /bin/sh

# 리소스 사용량 확인
kubectl top nodes
kubectl top pods -A

# 이벤트 확인
kubectl get events -A --sort-by='.lastTimestamp'
```

---

## ⚠️ 주의사항

### 보안

1. **kubeconfig 파일 보관**: kubeconfig 파일에는 클러스터 접속 토큰이 포함되어 있습니다. 절대 공개 저장소에 커밋하지 마세요.
2. **권한 범위**: 본인의 팀 권한 범위 내에서만 작업하세요. 권한 상승이 필요한 경우 관리자에게 요청하세요.
3. **토큰 갱신**: 토큰은 약 10년간 유효합니다. 만료 전 관리자에게 새 토큰을 요청하세요.

### TLS 경고

kubeconfig 파일에는 `insecure-skip-tls-verify: true` 설정이 포함되어 있습니다. 이는 내부 네트워크 접근을 위한 것이며, 프로덕션 환경에서는 권장되지 않습니다.

---

## 🆘 문제 해결

### 연결 실패

```bash
# Headscale 연결 확인
headscale status
ping 100.64.0.1

# API Server 연결 확인
curl -k https://100.64.0.1:6443/healthz
```

### 권한 오류

```bash
# 현재 권한 확인
kubectl auth can-i --list

# 특정 작업 권한 확인
kubectl auth can-i create deployments -n default
```

### kubeconfig 문제

```bash
# kubeconfig 내용 확인
kubectl config view

# 현재 컨텍스트 확인
kubectl config current-context
```

---

## 📞 문의

문제가 해결되지 않으면 관리자에게 문의하세요.

- **클러스터 관리자**: admin@k8s.local
- **네트워크 문제**: Headscale 담당자
- **권한 요청**: 팀 리더 승인 후 관리자에게 요청
