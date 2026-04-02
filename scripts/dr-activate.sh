#!/bin/bash
# DR 활성화 스크립트
# On-prem 장애 감지 후 실행 — EKS DR 활성화 + GKE Burst 연결
#
# 사전 조건:
#   - EKS Crossplane claim 배포 완료 (nodeCount: 0, dormant)
#   - Cloud Headscale 가동 중
#   - AWS Secrets Manager에 시크릿 미러링 완료
#   - GCS offsite에 최신 Velero 백업 존재
#
# 사용법: ./scripts/dr-activate.sh

set -euo pipefail

DISCORD_CLUSTER_WEBHOOK="${DISCORD_CLUSTER_WEBHOOK:-}"
GKE_KUBECONFIG="kubeconfig/gke-burst"

echo "============================================"
echo "  DR 활성화: EKS → GKE Burst 연결"
echo "============================================"

# ── Step 1: EKS 노드 그룹 scale up ──
echo ""
echo "[1/6] EKS 노드 그룹 scale up (3노드)..."
kubectl patch ekscluster eks-dr -n default --type merge \
  -p '{"spec":{"nodeCount": 3}}'
echo "  Crossplane이 EKS 노드를 프로비저닝합니다. (3-5분 소요)"
echo "  상태 확인: kubectl get ekscluster eks-dr -n default"

echo "  EKS 노드 Ready 대기 중..."
until kubectl get ekscluster eks-dr -n default -o jsonpath='{.status.nodeGroupStatus}' 2>/dev/null | grep -q "ACTIVE"; do
  sleep 15
  echo "    대기 중..."
done
echo "  EKS 노드 그룹 ACTIVE"

# ── Step 2: EKS kubeconfig 가져오기 ──
echo ""
echo "[2/6] EKS kubeconfig 가져오기..."
EKS_SECRET=$(kubectl get secret -n crossplane-system -o name | grep eks-cluster-conn | head -1)
kubectl get "$EKS_SECRET" -n crossplane-system -o jsonpath='{.data.kubeconfig}' | base64 -d > kubeconfig/eks-dr
export EKS_KUBECONFIG="kubeconfig/eks-dr"
echo "  저장: $EKS_KUBECONFIG"

# ── Step 3: EKS에 기본 인프라 배포 ──
echo ""
echo "[3/6] EKS에 Tailscale + Prometheus + Velero 배포..."
kubectl --kubeconfig="$EKS_KUBECONFIG" apply -k kubernetes/manifests/eks-dr/

# Velero 설치
echo "  Velero 설치 중..."
kubectl --kubeconfig="$EKS_KUBECONFIG" create namespace velero --dry-run=client -o yaml | kubectl --kubeconfig="$EKS_KUBECONFIG" apply -f -
# helmfile 또는 직접 설치로 Velero 배포
# helm install velero vmware-tanzu/velero -n velero -f kubernetes/manifests/eks-dr/velero-values.yaml --kubeconfig="$EKS_KUBECONFIG"

# Prometheus 설치
echo "  Prometheus 설치 중..."
kubectl --kubeconfig="$EKS_KUBECONFIG" create namespace monitoring --dry-run=client -o yaml | kubectl --kubeconfig="$EKS_KUBECONFIG" apply -f -
# helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring -f kubernetes/manifests/eks-dr/prometheus-values.yaml --kubeconfig="$EKS_KUBECONFIG"

# ── Step 4: Velero로 워크로드 복구 ──
echo ""
echo "[4/6] GCS 백업에서 워크로드 복구..."
LATEST_BACKUP=$(kubectl --kubeconfig="$EKS_KUBECONFIG" exec -n velero deploy/velero -- \
  velero backup get -o json 2>/dev/null | jq -r '.items | sort_by(.metadata.creationTimestamp) | last | .metadata.name' || echo "")

if [ -z "$LATEST_BACKUP" ] || [ "$LATEST_BACKUP" = "null" ]; then
  echo "  경고: 자동 백업 목록 조회 실패. 수동으로 확인하세요:"
  echo "  kubectl --kubeconfig=$EKS_KUBECONFIG exec -n velero deploy/velero -- velero backup get"
else
  echo "  최신 백업: $LATEST_BACKUP"
  kubectl --kubeconfig="$EKS_KUBECONFIG" exec -n velero deploy/velero -- \
    velero restore create dr-restore \
    --from-backup "$LATEST_BACKUP" \
    --include-namespaces trip-app,backstage \
    --restore-volumes=true
  echo "  복구 상태 확인: kubectl --kubeconfig=$EKS_KUBECONFIG exec -n velero deploy/velero -- velero restore describe dr-restore"
fi

# ── Step 5: GKE prometheus-proxy upstream 전환 ──
echo ""
echo "[5/6] GKE prometheus-proxy를 EKS Prometheus로 전환..."
echo "  EKS Tailscale IP 확인 대기 (30초)..."
sleep 30

# EKS Prometheus Service ClusterIP 확인
EKS_PROM_IP=$(kubectl --kubeconfig="$EKS_KUBECONFIG" get svc -n monitoring prometheus-kube-prometheus-prometheus -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

if [ -n "$EKS_PROM_IP" ]; then
  echo "  EKS Prometheus ClusterIP: $EKS_PROM_IP"
  kubectl --kubeconfig="$GKE_KUBECONFIG" patch configmap prometheus-upstream \
    -n burst-workloads -p "{\"data\":{\"upstream_url\":\"http://${EKS_PROM_IP}:9090\"}}"
  kubectl --kubeconfig="$GKE_KUBECONFIG" rollout restart deploy/prometheus-proxy -n burst-workloads
  echo "  GKE KEDA 메트릭 소스 → EKS 전환 완료"
else
  echo "  경고: EKS Prometheus IP를 가져올 수 없습니다. 수동 전환이 필요합니다."
fi

# ── Step 6: Discord 알림 ──
echo ""
echo "[6/6] Discord 알림 전송..."
if [ -n "$DISCORD_CLUSTER_WEBHOOK" ]; then
  curl -s -H "Content-Type: application/json" \
    -d '{"content":"🚨 **DR 활성화 완료**\n- EKS DR 클러스터 활성\n- trip-app, backstage 복구 중\n- GKE Burst → EKS 메트릭 연결됨"}' \
    "$DISCORD_CLUSTER_WEBHOOK"
  echo "  Discord 알림 전송 완료"
else
  echo "  DISCORD_CLUSTER_WEBHOOK 미설정 — 알림 생략"
fi

echo ""
echo "============================================"
echo "  DR 활성화 완료"
echo "============================================"
echo ""
echo "확인 사항:"
echo "  1. kubectl --kubeconfig=$EKS_KUBECONFIG get pods -n trip-app"
echo "  2. kubectl --kubeconfig=$EKS_KUBECONFIG get pods -n backstage"
echo "  3. kubectl --kubeconfig=$GKE_KUBECONFIG get scaledobject -n burst-workloads"
