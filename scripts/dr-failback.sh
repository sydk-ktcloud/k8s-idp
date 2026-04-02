#!/bin/bash
# Failback 스크립트
# On-prem 복구 후 실행 — EKS 워크로드를 On-prem으로 되돌리고 EKS 정리
#
# 사전 조건:
#   - On-prem 클러스터 정상 (4노드 Ready)
#   - EKS DR이 활성 상태
#   - heartbeat CronJob이 다시 GCS에 업로드 중
#
# 사용법: ./scripts/dr-failback.sh

set -euo pipefail

DISCORD_CLUSTER_WEBHOOK="${DISCORD_CLUSTER_WEBHOOK:-}"
EKS_KUBECONFIG="kubeconfig/eks-dr"
GKE_KUBECONFIG="kubeconfig/gke-burst"

echo "============================================"
echo "  Failback: On-prem 복구 → EKS 정리"
echo "============================================"

# ── Step 1: On-prem 상태 확인 ──
echo ""
echo "[1/6] On-prem 클러스터 상태 확인..."
NODE_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | grep -c "Ready" || echo "0")
echo "  Ready 노드: ${NODE_COUNT}개"

if [ "$NODE_COUNT" -lt 3 ]; then
  echo "  ⚠️  경고: Ready 노드가 3개 미만입니다. failback을 계속하시겠습니까?"
  read -p "  계속하려면 'yes' 입력: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "  Failback 취소."
    exit 1
  fi
fi

# ── Step 2: EKS에서 최종 백업 생성 ──
echo ""
echo "[2/6] EKS에서 failback 백업 생성..."
BACKUP_NAME="failback-$(date +%Y%m%d-%H%M)"
kubectl --kubeconfig="$EKS_KUBECONFIG" exec -n velero deploy/velero -- \
  velero backup create "$BACKUP_NAME" \
  --include-namespaces trip-app,backstage \
  --storage-location gcs-offsite \
  --wait
echo "  백업 완료: $BACKUP_NAME"

# ── Step 3: On-prem에서 failback 백업 복구 ──
echo ""
echo "[3/6] On-prem에서 failback 데이터 복구..."
velero restore create "failback-restore-$(date +%H%M)" \
  --from-backup "$BACKUP_NAME" \
  --include-namespaces trip-app,backstage \
  --restore-volumes=true

echo "  복구 상태 확인: velero restore get"
echo "  Pod 확인 대기 (30초)..."
sleep 30
kubectl get pods -n trip-app
kubectl get pods -n backstage

# ── Step 4: GKE prometheus-proxy를 On-prem으로 복귀 ──
echo ""
echo "[4/6] GKE 메트릭 소스 → On-prem 복귀..."
kubectl --kubeconfig="$GKE_KUBECONFIG" patch configmap prometheus-upstream \
  -n burst-workloads -p '{"data":{"upstream_url":"http://10.102.177.113:9090"}}'
kubectl --kubeconfig="$GKE_KUBECONFIG" rollout restart deploy/prometheus-proxy -n burst-workloads
echo "  GKE KEDA 메트릭 소스 → On-prem 전환 완료"

# ── Step 5: EKS 워크로드 drain + scale down ──
echo ""
echo "[5/6] EKS 워크로드 정리..."
# 워크로드 namespace 삭제
kubectl --kubeconfig="$EKS_KUBECONFIG" delete namespace trip-app --ignore-not-found --wait=false
kubectl --kubeconfig="$EKS_KUBECONFIG" delete namespace backstage --ignore-not-found --wait=false

# EKS 노드 scale down to 0
kubectl patch ekscluster eks-dr -n default --type merge \
  -p '{"spec":{"nodeCount": 0}}'
echo "  EKS 노드 그룹 scale-to-zero 요청 완료"

# ── Step 6: Discord 알림 ──
echo ""
echo "[6/6] Discord 알림 전송..."
if [ -n "$DISCORD_CLUSTER_WEBHOOK" ]; then
  curl -s -H "Content-Type: application/json" \
    -d '{"content":"✅ **Failback 완료**\n- On-prem 클러스터 복구 확인\n- EKS → On-prem 데이터 동기화 완료\n- GKE Burst 메트릭 소스 → On-prem 복귀\n- EKS 노드 scale-to-zero"}' \
    "$DISCORD_CLUSTER_WEBHOOK"
  echo "  Discord 알림 전송 완료"
else
  echo "  DISCORD_CLUSTER_WEBHOOK 미설정 — 알림 생략"
fi

echo ""
echo "============================================"
echo "  Failback 완료"
echo "============================================"
echo ""
echo "확인 사항:"
echo "  1. kubectl get pods -n trip-app"
echo "  2. kubectl get pods -n backstage"
echo "  3. kubectl --kubeconfig=$GKE_KUBECONFIG get scaledobject -n burst-workloads"
echo "  4. kubectl get ekscluster eks-dr -n default  (nodeGroupStatus 확인)"
echo "  5. heartbeat CronJob 확인: gsutil cat gs://sydk-velero-offsite/heartbeat.json"
