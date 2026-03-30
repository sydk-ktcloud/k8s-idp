#!/bin/bash
NS="vault"
# 현재 리더인 포드를 자동으로 찾거나, 없으면 vault-0을 기본으로 사용합니다.
VAULT_POD=$(kubectl get pods -n $NS -l vault-active=true -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "vault-0")

# 공통 옵션 설정 (인증서 검증 건너뛰기)
VAULT_OPTS="-tls-skip-verify"

echo "=== [1] Policy: 'allow_secrets' 권한 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault policy read $VAULT_OPTS allow_secrets

echo -e "\n=== [2] Auth: Kubernetes 인증 및 Role 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault auth list $VAULT_OPTS | grep kubernetes
# [수정] external-secrets 대신 실제 존재하는 default-app-role을 조회합니다.
kubectl exec -n $NS $VAULT_POD -- vault read $VAULT_OPTS auth/kubernetes/role/default-app-role

echo -e "\n=== [3] Storage: Raft HA 클러스터 상태 확인 ==="
kubectl exec -n $NS $VAULT_POD -- vault operator raft list-peers $VAULT_OPTS

echo -e "\n=== [4] Unseal: 원본 열쇠(Secret) 존재 확인 ==="
kubectl get secret -n $NS vault-unseal-keys

echo -e "\n=== [5] ESO 연동: ClusterSecretStore 상태 확인 ==="
# 우리가 새로 만든 ClusterSecretStore의 이름을 확인합니다.
kubectl get clustersecretstore vault-secret-store
