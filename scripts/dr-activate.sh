#!/bin/bash
# DR 활성화 스크립트 (Active-Passive On-Demand)
# On-prem 장애 감지 후 실행 — EKS DR 클러스터를 새로 프로비저닝하고 GKE Burst 연결
#
# 동작 방식:
#   - 평시에는 EKS 클러스터가 존재하지 않음 (비용 $0)
#   - 장애 감지 시 Crossplane claim을 apply하여 EKS를 새로 생성
#   - Lambda가 GitHub Actions workflow_dispatch로 자동 트리거하거나, 운영자가 수동 실행
#
# 사전 조건:
#   - On-prem Crossplane 정상 가동 중 (EKS claim 처리 가능)
#   - Cloud Headscale 가동 중
#   - GCS offsite에 최신 Velero 백업 존재
#   - aws-platform EnvironmentConfig에 IAM Role, Subnet 설정 완료
#
# 사용법: ./scripts/dr-activate.sh
# 자동 트리거: Lambda → GitHub Actions → self-hosted runner → 이 스크립트

set -euo pipefail

DISCORD_CLUSTER_WEBHOOK="${DISCORD_CLUSTER_WEBHOOK:-}"
GKE_KUBECONFIG="kubeconfig/gke-burst"
EKS_CLAIM="kubernetes/manifests/eks-dr/ekscluster-dr-claim.yaml"
MAX_WAIT_MINUTES=15

echo "============================================"
echo "  DR 활성화: On-Demand EKS 프로비저닝"
echo "============================================"

# ── Step 1: EKS 클러스터 Crossplane claim 생성 ──
echo ""
echo "[1/6] EKS DR 클러스터 프로비저닝 시작..."

# 이미 존재하는 경우 확인
if kubectl get ekscluster eks-dr -n default &>/dev/null; then
  EXISTING_STATUS=$(kubectl get ekscluster eks-dr -n default -o jsonpath='{.status.clusterStatus}' 2>/dev/null || echo "Unknown")
  echo "  ⚠️  EKS DR claim이 이미 존재합니다 (상태: $EXISTING_STATUS)"
  if [ "$EXISTING_STATUS" = "ACTIVE" ]; then
    echo "  이미 ACTIVE 상태 — Step 2로 건너뜁니다."
  else
    echo "  프로비저닝 진행 중 — 완료 대기..."
  fi
else
  kubectl apply -f "$EKS_CLAIM"
  echo "  Crossplane이 EKS 클러스터를 새로 프로비저닝합니다. (10-15분 소요)"
fi

echo "  EKS 클러스터 ACTIVE 대기 중..."
WAITED=0
until kubectl get ekscluster eks-dr -n default -o jsonpath='{.status.clusterStatus}' 2>/dev/null | grep -q "ACTIVE"; do
  sleep 30
  WAITED=$((WAITED + 1))
  ELAPSED=$((WAITED / 2))
  echo "    대기 중... (${ELAPSED}분 경과)"
  if [ "$WAITED" -ge "$((MAX_WAIT_MINUTES * 2))" ]; then
    echo "  ❌ 타임아웃: ${MAX_WAIT_MINUTES}분 초과. 수동 확인 필요:"
    echo "     kubectl get ekscluster eks-dr -n default -o yaml"
    exit 1
  fi
done
echo "  ✅ EKS 클러스터 ACTIVE"

# 노드 그룹 ACTIVE 대기
echo "  EKS 노드 그룹 ACTIVE 대기 중..."
until kubectl get ekscluster eks-dr -n default -o jsonpath='{.status.nodeGroupStatus}' 2>/dev/null | grep -q "ACTIVE"; do
  sleep 15
  echo "    노드 그룹 대기 중..."
done
echo "  ✅ EKS 노드 그룹 ACTIVE"

# ── Step 2: EKS kubeconfig 가져오기 ──
echo ""
echo "[2/6] EKS kubeconfig 가져오기..."
mkdir -p kubeconfig

# Crossplane이 생성한 connection secret에서 kubeconfig 추출
EKS_SECRET=$(kubectl get secret -n crossplane-system -o name | grep eks-.*-conn | head -1)
if [ -z "$EKS_SECRET" ]; then
  echo "  ❌ EKS connection secret을 찾을 수 없습니다."
  echo "     kubectl get secrets -n crossplane-system | grep eks"
  exit 1
fi
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
  EKS_ENDPOINT=$(kubectl get ekscluster eks-dr -n default -o jsonpath='{.status.endpoint}' 2>/dev/null || echo "N/A")
  curl -s -H "Content-Type: application/json" \
    -d "{\"content\":\"🚨 **DR 활성화 완료 (On-Demand)**\n- EKS DR 클러스터 신규 프로비저닝 완료\n- Endpoint: ${EKS_ENDPOINT}\n- trip-app, backstage 복구 중\n- GKE Burst → EKS 메트릭 연결됨\n- Failback 시: ./scripts/dr-failback.sh\"}" \
    "$DISCORD_CLUSTER_WEBHOOK"
  echo "  Discord 알림 전송 완료"
else
  echo "  DISCORD_CLUSTER_WEBHOOK 미설정 — 알림 생략"
fi

echo ""
echo "============================================"
echo "  DR 활성화 완료 (On-Demand)"
echo "============================================"
echo ""
echo "확인 사항:"
echo "  1. kubectl --kubeconfig=$EKS_KUBECONFIG get pods -n trip-app"
echo "  2. kubectl --kubeconfig=$EKS_KUBECONFIG get pods -n backstage"
echo "  3. kubectl --kubeconfig=$GKE_KUBECONFIG get scaledobject -n burst-workloads"
echo "  4. kubectl get ekscluster eks-dr -n default"
echo ""
echo "Failback: ./scripts/dr-failback.sh"
