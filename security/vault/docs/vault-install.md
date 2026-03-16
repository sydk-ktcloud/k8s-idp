# Vault HA Installation Guide

이 문서는 Kubernetes 환경에서 **HashiCorp Vault를 HA 구성으로 설치하는 방법**을 설명합니다.

---

# 1. Helm 설치

Helm이 설치되어 있는지 확인합니다.

```
helm version
```

Helm이 없다면 설치합니다.

```
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

---

# 2. HashiCorp Helm Repository 추가

```
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update
```

---

# 3. Namespace 생성

Vault를 별도의 namespace로 분리합니다.

```
kubectl create namespace vault
```

---

# 4. Helm values.yaml 설정

Vault HA 구성을 위해 values.yaml 파일을 사용합니다.

파일 위치:

```
helm/vault-values.yaml
```

---

# 5. Vault HA 설치

```
helm install vault hashicorp/vault \
  -n vault \
  -f helm/vault-values.yaml
```

설치 확인

```
kubectl get pods -n vault
```

정상이라면 다음과 같이 Pod가 생성됩니다.

```
vault-0
vault-1
vault-2
```

---

# 6. Vault Initialization

Vault는 최초 한 번만 초기화합니다.

```
kubectl exec -it vault-0 -n vault -- vault operator init
```

출력된 **Unseal Key와 Root Token은 반드시 안전하게 저장해야 합니다.**

---

# 7. Leader Pod Unseal

leader pod 먼저 unseal 해야 합니다.

```
kubectl exec -it vault-0 -n vault -- vault operator unseal
```

Unseal Key 3개 입력

상태 확인

```
kubectl exec -it vault-0 -n vault -- vault status
```

정상 상태

```
HA Enabled: true
HA Mode: active
```

---

# 8. Follower Pod Unseal

```
kubectl exec -it vault-1 -n vault -- vault operator unseal
kubectl exec -it vault-2 -n vault -- vault operator unseal
```

Follower 상태

```
HA Mode: standby
```

---

# 9. Raft Cluster 확인

```
kubectl exec -it vault-0 -n vault -- vault operator raft list-peers
```

---

# 10. Vault UI 접속 (Optional)

Port Forward 실행

```
kubectl port-forward --address 0.0.0.0 svc/vault 8200:8200 -n vault
```

브라우저 접속

```
http://<MASTER_NODE_IP>:8200
```

