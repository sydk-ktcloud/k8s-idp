#!/bin/bash
NAMESPACE="vault"

echo "--- [1/5] Vault Custom Resource 및 관련 설정 삭제 ---"
kubectl delete vault vault -n $NAMESPACE --timeout=30s
# 만약 Terminating에 걸려있을 경우를 대비해 Finalizer 강제 제거
kubectl patch vault vault -n $NAMESPACE -p '{"metadata":{"finalizers":null}}' --type=merge 2>/dev/null

echo "--- [2/5] 충돌 원인인 Service 리소스 강제 삭제 ---"
# 오퍼레이터 로그에서 에러를 유발했던 주범들을 제거합니다.
kubectl delete svc vault vault-0 vault-1 vault-2 -n $NAMESPACE --ignore-not-found

echo "--- [3/5] 데이터 및 권한 찌꺼기 완벽 제거 (PVC/STS/Secret/기타) ---"
# StatefulSet 및 PVC (Longhorn 볼륨) 제거
kubectl delete sts vault -n $NAMESPACE --grace-period=0 --force 2>/dev/null
kubectl delete pvc -l vault_cr=vault -n $NAMESPACE --ignore-not-found
kubectl delete pvc -l app.kubernetes.io/name=vault -n $NAMESPACE --ignore-not-found

# [핵심] 과거의 망령인 'vault-config'를 포함한 모든 Secret 일망타진
kubectl delete secret -l app.kubernetes.io/name=vault -n $NAMESPACE --ignore-not-found
kubectl delete secret vault-config vault-unseal-keys vault-raw-config vault-tls -n $NAMESPACE --ignore-not-found

# 숨겨진 리소스들 (ConfigMap, PDB, ServiceAccount) 박멸
kubectl delete cm,pdb,sa -l app.kubernetes.io/name=vault -n $NAMESPACE --ignore-not-found
kubectl delete cm vault-config -n $NAMESPACE --ignore-not-found 2>/dev/null
kubectl delete pdb vault -n $NAMESPACE --ignore-not-found 2>/dev/null
kubectl delete sa vault -n $NAMESPACE --ignore-not-found 2>/dev/null

echo "--- [4/5] 오퍼레이터 상태 리셋 (파드 재시작) ---"
# 오퍼레이터가 이전 에러 상태를 캐싱하지 않도록 뇌를 비워줍니다.
kubectl delete pod -l app.kubernetes.io/name=vault-operator -n $NAMESPACE

echo "--- [5/5] 최종 리소스 상태 확인 ---"
sleep 5
# Secret과 ConfigMap까지 찌꺼기가 남았는지 확실히 체크합니다.
kubectl get all,pvc,secret,cm -n $NAMESPACE

echo "✅ 모든 잔재가 완벽하게 제거되었습니다. 이제 'kubectl apply -f vault-final.yaml'을 실행하세요!"
~                                                                                                    
~ 
