#!/bin/bash
NS="vault"
VAULT_POD="vault-0"

echo "=== [1] Policy: 'allow_secrets' 권한 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault policy read allow_secrets

echo -e "\n=== [2] Auth: Kub#!/bin/bash
NS="vault"
VAULT_POD="vault-0"

echo "=== [1] Policy: 'allow_secrets' 권한 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault policy read allow_secrets

echo -e "\n=== [2] Auth: Kubernetes 인증 활성화 및 Role 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault auth list | grep kubernetes
kubectl exec -n $NS $VAULT_POD -- vault read auth/kubernetes/role/external-secrets

echo -e "\n=== [3] Storage: Raft HA 클러스터 상태 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault operator raft list-peers

echo -e "\n=== [4] Unseal: 자동 해제용 Secret 생성 확인 ==="
kubectl get secret -n $NS vault-unseal-keys

echo -e "\n=== [5] ESO 연동: SecretStore 상태 확인 ==="
kubectl get secretstore -n $NS vault-backendernetes 인증 활성화 및 Role 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault auth list | grep kubernetes
kubectl exec -n $NS $VAULT_POD -- vault read auth/kubernetes/role/external-secrets

echo -e "\n=== [3] Storage: Raft HA 클러스터 상태 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault operator raft list-peers

echo -e "\n=== [4] Unseal: 자동 해제용 Secret 생성 확인 ==="
kubectl get secret -n $NS vault-unseal-keys

echo -e "\n=== [5] ESO 연동: SecretStore 상태 확인 ==="
kubectl get secretstore -n $NS vault-backend
