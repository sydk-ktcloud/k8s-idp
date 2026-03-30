# Vault & ESO 인프라 구축 가이드

이 문서는 **Bank-Vaults Operator**를 사용하여 Kubernetes 환경에 **Vault HA 클러스터**를 구축하고, **External Secrets Operator(ESO)**와 연동하는 과정을 정리한 설치 가이드입니다.

---

## Operator의 역할

Bank-Vaults Operator는 Kubernetes 환경에서 Vault 운영을 자동화합니다.

* **자동화**
  Vault Pod 생성, `init`, `unseal` 과정을 자동으로 수행합니다.

* **보안 관리**
  Root Token 및 Unseal Key를 Kubernetes Secret에 안전하게 저장합니다.

* **고가용성(HA)**
  Raft 합의 알고리즘 기반의 Vault 클러스터를 구성하고 장애 복구를 관리합니다.

---

## 1. 기존 Vault 리소스 정리 (Clean Slate)

기존 Vault 설치 흔적이 남아있으면 **Webhook 충돌, Raft 데이터 충돌, Pod 생성 실패** 등이 발생할 수 있습니다.
새로운 설치 전에 관련 리소스를 정리합니다.

### 1.1 핵심 리소스 삭제

```bash
# Vault Agent Injector Webhook 및 권한 제거
kubectl delete mutatingwebhookconfiguration vault-agent-injector-cfg

kubectl delete clusterrolebinding \
  vault-agent-injector-binding \
  vault-server-binding

# 기존 Helm 릴리즈 삭제
helm uninstall vault -n vault

# 네임스페이스 내부 리소스 정리
kubectl delete svc vault-nodeport -n vault

kubectl delete role vault-discovery-role -n vault
kubectl delete rolebinding vault-discovery-rolebinding -n vault
```

### 1.2 저장소(PVC) 삭제

Vault는 **Raft 스토리지**를 사용하기 때문에 이전 데이터가 남아있으면 새로운 클러스터 초기화 시 충돌이 발생할 수 있습니다.

```bash
kubectl delete pvc \
  audit-vault-0 \
  audit-vault-1 \
  audit-vault-2 \
  data-vault-0 \
  data-vault-1 \
  data-vault-2 \
  -n vault
```

주의사항:

* `configmap/kube-root-ca.crt`
* `serviceaccount/default`

위 리소스는 **Kubernetes 시스템 리소스이므로 삭제하지 않습니다.**

---

## 2. Bank-Vaults Operator 설치

Vault Operator를 Helm을 이용하여 배포합니다.

```bash
kubectl create namespace vault
```

```bash
helm upgrade --install --wait vault-operator \
  oci://ghcr.io/bank-vaults/helm-charts/vault-operator \
  -n vault
```

설치 확인:

```bash
kubectl get crd | grep vaults.vault.banzaicloud.com
```

---

## 3. RBAC 권한 설정

Operator가 Vault 초기화 및 Unseal 과정에서 Kubernetes Secret을 관리할 수 있도록 권한을 부여합니다.

```bash
kubectl create serviceaccount vault -n vault
```

```bash
kubectl create rolebinding vault-unseal-binding \
  --clusterrole=edit \
  --serviceaccount=vault:vault \
  -n vault
```

---

## 4. Vault 클러스터 배포

`bank-vault.yaml`을 통해 Vault 클러스터를 생성합니다.

주요 설정:

* **HA 구성**
  `size: 3`
  StatefulSet 기반 Vault Pod 3개 구성

* **스토리지**
  Longhorn 기반 Raft 스토리지
  경로: `/vault/raft`

* **Auto Unseal**
  Kubernetes Secret(`vault-unseal-keys`)에 Unseal Key 저장

* **인증 정책**
  ESO에서 Vault Secret을 읽을 수 있도록 `eso-policy` 사용

배포:

```bash
kubectl apply -f bank-vault.yaml -n vault
```

---

## 5. External Secrets Operator 연동

Vault에 저장된 Secret을 Kubernetes Secret으로 동기화합니다.

### 5.1 Root Token 확인

Vault 초기화 시 생성된 Root Token은 다음 Secret에 저장됩니다.

```bash
kubectl get secret vault-unseal-keys \
  -n vault \
  -o jsonpath='{.data.vault-root-token}' | base64 -d
```

### 5.2 SecretStore 설정

ESO에서 Vault에 접근하기 위해 SecretStore를 설정합니다.

주요 설정 값:

```
server: http://vault.vault.svc.cluster.local:8200
```

Root Token을 사용하여 `vault-token` Secret을 생성하거나 업데이트합니다.

### 5.3 ExternalSecret 동기화 확인

ExternalSecret 리소스를 생성하면 Vault Secret이 Kubernetes Secret으로 자동 동기화됩니다.

동기화 확인:

```bash
kubectl get externalsecret
kubectl get secret
```

---

## 운영 시 참고 사항

### PVC 삭제 누락

PVC가 남아있으면 이전 Raft 상태와 충돌하여 Vault가 정상적으로 초기화되지 않을 수 있습니다.

### Webhook 충돌

Vault Agent Injector Webhook이 남아있으면 새로운 Pod 생성 시 Sidecar 주입 오류가 발생할 수 있습니다.

### Operator 사용 장점

Bank-Vaults Operator를 사용하면 다음 작업이 자동화됩니다.

* Vault 초기화(init)
* Unseal 자동 처리
* Root Token 및 Unseal Key 관리

따라서 Vault 운영 복잡도를 크게 줄일 수 있습니다.

