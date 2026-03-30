#!/bin/bash

REPORT_FILE="vault_debug_report.txt"
NAMESPACE="vault"

echo "=== Vault Deployment Debug Report ($(date)) ===" > $REPORT_FILE

# 1. 오퍼레이터 상태 및 로그 (최근 50줄)
echo -e "\n[1] Operator Pod Status & Recent Logs" >> $REPORT_FILE
kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=vault-operator >> $REPORT_FILE
echo "--- Recent Operator Logs (Error Check) ---" >> $REPORT_FILE
kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=vault-operator --tail=50 >> $REPORT_FILE

# 2. 커스텀 리소스(Vault) 상태 및 이벤트
echo -e "\n[2] Vault Custom Resource Status" >> $REPORT_FILE
kubectl get vault -n $NAMESPACE >> $REPORT_FILE
echo "--- Vault Resource Describe (Events) ---" >> $REPORT_FILE
kubectl describe vault vault -n $NAMESPACE | grep -A 20 "Events:" >> $REPORT_FILE

# 3. StatefulSet 및 Pod 생성 여부 확인
echo -e "\n[3] Workload Status (STS & Pods)" >> $REPORT_FILE
kubectl get sts -n $NAMESPACE >> $REPORT_FILE
kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=vault >> $REPORT_FILE

# 4. 이미지 및 설정 상세 (만약 파드가 있다면)
echo -e "\n[4] Container Image & Env Details" >> $REPORT_FILE
kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=vault -o jsonpath='{range .items[*]}{.metadata.name}{"\n  Image: "}{.spec.containers[*].image}{"\n  Envs: "}{.spec.containers[*].env[*].name}{"\n"}{end}' >> $REPORT_FILE

# 5. 권한 및 볼륨 상태 (PVC/PV)
echo -e "\n[5] Volume & Permission Status" >> $REPORT_FILE
kubectl get pvc -n $NAMESPACE >> $REPORT_FILE
kubectl describe pvc -n $NAMESPACE >> $REPORT_FILE

# 6. RBAC (ServiceAccount) 확인
echo -e "\n[6] ServiceAccount Status" >> $REPORT_FILE
kubectl get sa vault -n $NAMESPACE -o yaml | grep -A 5 "metadata" >> $REPORT_FILE

echo "점검 완료: $REPORT_FILE 파일을 확인하세요."

