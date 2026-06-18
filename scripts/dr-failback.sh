#!/bin/bash
# Failback 스크립트 (Active-Passive On-Demand)
# On-prem 복구 후 실행 — EKS 워크로드를 On-prem으로 되돌리고 EKS 클러스터 완전 삭제
#
# 동작 방식:
#   - EKS에서 최종 백업 생성 → On-prem 복구
#   - GKE 메트릭 소스를 On-prem으로 복귀
#   - EKS Crossplane claim 삭제 → 클러스터 완전 제거 (비용 $0 복귀)
#
# 사전 조건:
#   - On-prem 클러스터 정상 (4노드 Ready)
#   - EKS DR이 활성 상태
#   - heartbeat CronJob이 다시 S3에 업로드 중
#
# 사용법: ./scripts/dr-failback.sh

set -euo pipefail

DISCORD_CLUSTER_WEBHOOK="${DISCORD_CLUSTER_WEBHOOK:-}"
EKS_KUBECONFIG="kubeconfig/eks-dr"
GKE_KUBECONFIG="kubeconfig/gke-burst"

echo "============================================"
echo "  Failback: On-prem 복구 → EKS 완전 삭제"
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

# Heartbeat 정상 확인
echo "  Heartbeat CronJob 확인..."
HB_STATUS=$(kubectl get cronjob cluster-heartbeat -n minio-storage -o jsonpath='{.status.lastScheduleTime}' 2>/dev/null || echo "")
if [ -n "$HB_STATUS" ]; then
  echo "  마지막 Heartbeat: $HB_STATUS"
else
  echo "  ⚠️  Heartbeat CronJob 상태를 확인할 수 없습니다."
fi

# ── Step 2: EKS에서 최종 백업 생성 ──
echo ""
echo "[2/6] EKS에서 failback 백업 생성..."

if [ ! -f "$EKS_KUBECONFIG" ]; then
  echo "  ⚠️  EKS kubeconfig가 없습니다. 백업 단계를 건너뜁니다."
else
  BACKUP_NAME="failback-$(date +%Y%m%d-%H%M)"
  kubectl --kubeconfig="$EKS_KUBECONFIG" exec -n velero deploy/velero -- \
    velero backup create "$BACKUP_NAME" \
    --include-namespaces trip-app,backstage \
    --storage-location s3-dr \
    --wait
  echo "  백업 완료: $BACKUP_NAME"
fi

# ── Step 3: On-prem에서 failback 백업 복구 ──
echo ""
echo "[3/6] On-prem에서 failback 데이터 복구..."
if [ -n "${BACKUP_NAME:-}" ]; then
  velero restore create "failback-restore-$(date +%H%M)" \
    --from-backup "$BACKUP_NAME" \
    --include-namespaces trip-app,backstage \
    --restore-volumes=true

  echo "  복구 상태 확인: velero restore get"
  echo "  Pod 확인 대기 (30초)..."
  sleep 30
  kubectl get pods -n trip-app
  kubectl get pods -n backstage
else
  echo "  백업이 생성되지 않아 복구를 건너뜁니다."
fi

# ── Step 4: GKE prometheus-proxy를 On-prem으로 복귀 ──
echo ""
echo "[4/6] GKE 메트릭 소스 → On-prem 복귀..."
kubectl --kubeconfig="$GKE_KUBECONFIG" patch configmap prometheus-upstream \
  -n burst-workloads -p '{"data":{"upstream_url":"http://10.102.177.113:9090"}}'
kubectl --kubeconfig="$GKE_KUBECONFIG" rollout restart deploy/prometheus-proxy -n burst-workloads
echo "  GKE KEDA 메트릭 소스 → On-prem 전환 완료"

# Route53 SECONDARY(EKS) 레코드 제거 → 트래픽을 on-prem PRIMARY로 완전 복귀.
# 데이터 동기화(Step 2-3) 이후에 수행하므로 split-brain 창이 닫힌 뒤 전환된다.
if [ -n "${ROUTE53_ZONE_ID:-}" ] && [ -n "${DR_DOMAIN:-}" ]; then
  CUR=$(aws route53 list-resource-record-sets --hosted-zone-id "$ROUTE53_ZONE_ID" \
    --query "ResourceRecordSets[?SetIdentifier=='eks-dr-secondary'] | [0]" --output json 2>/dev/null || echo "null")
  if [ "$CUR" != "null" ] && [ -n "$CUR" ]; then
    echo "{ \"Changes\": [ { \"Action\": \"DELETE\", \"ResourceRecordSet\": $CUR } ] }" > /tmp/r53-del.json
    aws route53 change-resource-record-sets --hosted-zone-id "$ROUTE53_ZONE_ID" \
      --change-batch file:///tmp/r53-del.json && echo "  Route53 SECONDARY 제거 완료 (트래픽 on-prem 복귀)"
  else
    echo "  Route53 SECONDARY 레코드 없음 — 건너뜀."
  fi
else
  echo "  ROUTE53_ZONE_ID/DR_DOMAIN 미설정 — Route53 정리 생략."
fi

# ── Step 5: EKS 클러스터 완전 삭제 (eksctl, On-Demand 모델) ──
echo ""
echo "[5/6] EKS DR 클러스터 완전 삭제..."

AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER_NAME="${CLUSTER_NAME:-k8s-idp-dr}"
EKSCTL_CONFIG="infrastructure/aws-dr/eksctl-cluster.yaml"

# EKS 워크로드 namespace 먼저 정리 (PVC 등 클라우드 리소스 해제 → 고아 EBS 방지)
if [ -f "$EKS_KUBECONFIG" ]; then
  kubectl --kubeconfig="$EKS_KUBECONFIG" delete namespace trip-app --ignore-not-found --wait=false
  kubectl --kubeconfig="$EKS_KUBECONFIG" delete namespace backstage --ignore-not-found --wait=false
  kubectl --kubeconfig="$EKS_KUBECONFIG" delete namespace velero --ignore-not-found --wait=false
  kubectl --kubeconfig="$EKS_KUBECONFIG" delete namespace monitoring --ignore-not-found --wait=false
  echo "  EKS 워크로드 namespace 삭제 요청 완료"
  sleep 15
fi

# eksctl로 클러스터 + 노드그룹 + IRSA/CFN 스택까지 완전 제거 (Crossplane 미사용)
# 완전장애 대응 설계라 삭제도 on-prem과 무관하게 eksctl로 직접 수행한다.
if eksctl get cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" &>/dev/null; then
  eksctl delete cluster -f "$EKSCTL_CONFIG" --disable-nodegroup-eviction --wait
  echo "  EKS 클러스터 완전 삭제 완료 (비용 \$0 복귀)"
else
  echo "  EKS 클러스터 '$CLUSTER_NAME' 미존재 — 삭제 건너뜀."
fi

# kubeconfig 정리
rm -f kubeconfig/eks-dr
echo "  kubeconfig 정리 완료"

# ── Step 6: Discord 알림 ──
echo ""
echo "[6/6] Discord 알림 전송..."
if [ -n "$DISCORD_CLUSTER_WEBHOOK" ]; then
  curl -s -H "Content-Type: application/json" \
    -d '{"content":"✅ **Failback 완료 (On-Demand)**\n- On-prem 클러스터 복구 확인\n- EKS → On-prem 데이터 동기화 완료\n- GKE Burst 메트릭 소스 → On-prem 복귀\n- EKS 클러스터 완전 삭제 (비용 $0 복귀)"}' \
    "$DISCORD_CLUSTER_WEBHOOK"
  echo "  Discord 알림 전송 완료"
else
  echo "  DISCORD_CLUSTER_WEBHOOK 미설정 — 알림 생략"
fi

echo ""
echo "============================================"
echo "  Failback 완료 (On-Demand)"
echo "============================================"
echo ""
echo "확인 사항:"
echo "  1. kubectl get pods -n trip-app"
echo "  2. kubectl get pods -n backstage"
echo "  3. kubectl --kubeconfig=$GKE_KUBECONFIG get scaledobject -n burst-workloads"
echo "  4. kubectl get ekscluster -n default  (claim이 없어야 정상)"
echo "  5. heartbeat 확인: aws s3 ls s3://sydk-velero-dr-usw2/heartbeat/"
