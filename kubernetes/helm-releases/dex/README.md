# Dex OIDC Provider

Kubernetes 플랫폼 SSO를 위한 Dex OIDC Provider 구성

## 개요

- **Namespace**: `auth`
- **Service Type**: NodePort (30556)
- **Users**: 7명 (Static Passwords)

## 사용자 계정

| 사용자 | 이메일 | 비밀번호 | 역할 |
|--------|--------|----------|------|
| admin | admin@k8s.local | 담당자 문의 | 관리자 |
| platform | platform@k8s.local | 담당자 문의 | Platform Lead |
| gitops | gitops@k8s.local | 담당자 문의 | GitOps Engineer |
| finops | finops@k8s.local | 담당자 문의 | FinOps Engineer |
| security | security@k8s.local | 담당자 문의 | Security Engineer |
| sre | sre@k8s.local | 담당자 문의 | SRE / Observability |
| ai | ai@k8s.local | 담당자 문의 | AI / ChatOps Engineer |

## 설치

### 사전 요구사항

```bash
# Helm 설치
brew install helm

# Helmfile 설치 (선택)
brew install helmfile

# auth namespace 생성
kubectl apply -f ../../namespaces/core.yaml
```

### Helm으로 설치

```bash
# Helm repo 추가
helm repo add dex https://charts.dexidp.io
helm repo update

# Dex 설치
helm upgrade --install dex dex/dex \
  --namespace auth \
  --values values.yaml
```

### Helmfile로 설치

```bash
helmfile apply
```

## 접속

### NodePort로 접속

```bash
# Dex 서비스 확인
kubectl get svc -n auth dex

# 포트 포워딩 (로컬 테스트)
kubectl port-forward -n auth svc/dex 5556:5556

# Issuer 확인
curl http://localhost:5556/.well-known/openid-configuration
```

### 클러스터 내부 접속

```
http://dex.auth.svc.cluster.local:5556
```

## 연동 구성

### ArgoCD

```yaml
# argocd-cm ConfigMap
data:
  url: http://argocd.local
  oidc.config: |
    name: Dex
    issuer: http://dex.auth.svc.cluster.local:5556
    clientID: argocd
    clientSecret: argocd-client-secret-12345
```

### Grafana

```yaml
# grafana.ini
[auth.generic_oauth]
enabled = true
name = Dex
client_id = grafana
client_secret = grafana-client-secret-12345
auth_url = http://dex.auth.svc.cluster.local:5556/auth
token_url = http://dex.auth.svc.cluster.local:5556/token
api_url = http://dex.auth.svc.cluster.local:5556/userinfo
```

### kubectl (oidc-login)

```bash
# krew 플러그인 설치
kubectl krew install oidc-login

# kubeconfig 설정
kubectl config set-credentials dex-user \
  --exec-api-version=client.authentication.k8s.io/v1beta1 \
  --exec-command=kubectl \
  --exec-arg=oidc-login \
  --exec-arg=get-token \
  --exec-arg=--oidc-issuer-url=http://dex.auth.svc.cluster.local:5556 \
  --exec-arg=--oidc-client-id=kubectl \
  --exec-arg=--oidc-client-secret=kubectl-secret
```

## DNS 구성 (선택)

### Headscale MagicDNS

Headscale에서 MagicDNS를 활성화하면 내부 도메인 사용 가능:

1. Headscale config에서 `dns_config.magic_dns = true` 설정
2. ACL에서 `dex.k8s.local` 도메인 매핑

### nip.io (공인 IP 있는 경우)

```
dex.192.168.1.100.nip.io
```

### /etc/hosts (로컬)

```
<서버-IP> dex.k8s.local
<서버-IP> argocd.k8s.local
<서버-IP> grafana.k8s.local
```

## 문제 해결

```bash
# Dex 로그 확인
kubectl logs -n auth -l app.kubernetes.io/name=dex

# Config 확인
kubectl get configmap -n auth dex -o yaml

# 이벤트 확인
kubectl get events -n auth
```
