#!/bin/bash
# DR 활성화 스크립트 (Active-Passive On-Demand, 완전장애 대응)
# ───────────────────────────────────────────────────────────────
# 기존 설계의 치명적 결함을 제거한 버전:
#   - (기존) self-hosted runner(on-prem) + Crossplane(on-prem)으로 EKS 생성
#            → on-prem이 완전히 죽으면 DR을 띄울 손발도 같이 죽는 순환 의존성.
#   - (현재) GitHub-hosted runner가 OIDC로 AWS에 붙어 eksctl로 EKS를 직접 생성.
#            on-prem(kubectl/Crossplane/Vault)에 전혀 의존하지 않는다.
#
# 동작 방식:
#   - 평시: EKS 클러스터 미존재 (비용 $0)
#   - 장애: eksctl로 EKS를 새로 생성 → Velero가 S3 백업에서 워크로드 복구
#
# 실행 환경: GitHub-hosted runner (ubuntu-latest), AWS 자격증명은 OIDC로 주입됨.
#            로컬 수동 실행 시: aws sso/credentials + eksctl/kubectl/helm/velero 필요.
#
# 사용법: ./scripts/dr-activate.sh

set -euo pipefail

# ── 설정 ──
AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER_NAME="${CLUSTER_NAME:-k8s-idp-dr}"
EKSCTL_CONFIG="infrastructure/aws-dr/eksctl-cluster.yaml"
EKS_KUBECONFIG="kubeconfig/eks-dr"
VELERO_BUCKET="${VELERO_BUCKET:-sydk-velero-dr-usw2}"
VELERO_POLICY_NAME="velero-dr-policy"
RESTORE_NAMESPACES="trip-app,backstage"
DISCORD_CLUSTER_WEBHOOK="${DISCORD_CLUSTER_WEBHOOK:-}"
GKE_KUBECONFIG_B64="${GKE_KUBECONFIG_B64:-}"
GKE_KUBECONFIG="kubeconfig/gke-burst"

mkdir -p kubeconfig

echo "============================================"
echo "  DR 활성화: eksctl On-Demand (on-prem 무관)"
echo "============================================"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "  AWS 계정: $ACCOUNT_ID / 리전: $AWS_REGION"

# ── Step 1: EKS 클러스터 생성 (eksctl, idempotent) ──
echo ""
echo "[1/6] EKS DR 클러스터 프로비저닝 (eksctl)..."
if eksctl get cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" &>/dev/null; then
  echo "  ⚠️  클러스터 '$CLUSTER_NAME'가 이미 존재 — 생성 건너뜀."
else
  echo "  eksctl이 EKS 클러스터 + 노드그룹을 생성합니다. (15-20분 소요)"
  eksctl create cluster -f "$EKSCTL_CONFIG"
fi
echo "  ✅ EKS 클러스터 준비됨"

# ── Step 2: kubeconfig 가져오기 (on-prem Secret이 아니라 AWS API에서 직접) ──
echo ""
echo "[2/6] EKS kubeconfig 가져오기..."
aws eks update-kubeconfig \
  --name "$CLUSTER_NAME" --region "$AWS_REGION" --kubeconfig "$EKS_KUBECONFIG"
echo "  저장: $EKS_KUBECONFIG"

# ── Step 3: Velero 설치 (IRSA 기반, static key 없음) ──
echo ""
echo "[3/6] Velero 설치 (IRSA)..."
# velero ServiceAccount에 velero-dr-policy를 IRSA로 바인딩 (eksctl이 OIDC 신뢰관계 처리)
eksctl create iamserviceaccount \
  --cluster "$CLUSTER_NAME" --region "$AWS_REGION" \
  --namespace velero --name velero \
  --attach-policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${VELERO_POLICY_NAME}" \
  --role-name "velero-dr-irsa-role" \
  --approve --override-existing-serviceaccounts

helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install velero vmware-tanzu/velero \
  --namespace velero --create-namespace \
  -f kubernetes/manifests/eks-dr/velero-values.yaml \
  --kubeconfig "$EKS_KUBECONFIG" \
  --wait --timeout 10m
echo "  ✅ Velero 설치 완료"

# EBS 기본 StorageClass + Velero SC 리매핑(longhorn→gp3) — restore 전에 준비.
# 이게 없으면 복구된 PVC가 존재하지 않는 longhorn SC를 기다리며 Pending에 빠진다.
kubectl --kubeconfig="$EKS_KUBECONFIG" apply -f kubernetes/manifests/eks-dr/storageclass-gp3.yaml
kubectl --kubeconfig="$EKS_KUBECONFIG" apply -f kubernetes/manifests/eks-dr/velero-change-sc-configmap.yaml
echo "  ✅ gp3 기본 SC + longhorn→gp3 리매핑 적용"

# ── Step 4: Velero로 워크로드 복구 ──
echo ""
echo "[4/6] S3 백업에서 워크로드 복구..."
export KUBECONFIG="$EKS_KUBECONFIG"

# BackupStorageLocation이 Available 될 때까지 잠시 대기
echo "  BackupStorageLocation 동기화 대기..."
for i in $(seq 1 12); do
  PHASE=$(velero backup-location get s3-dr -o json 2>/dev/null | jq -r '.status.phase // "Unknown"' || echo "Unknown")
  [ "$PHASE" = "Available" ] && break
  sleep 10
done

LATEST_BACKUP=$(velero backup get -o json 2>/dev/null \
  | jq -r '[.items[] | select(.status.phase=="Completed")] | sort_by(.metadata.creationTimestamp) | last | .metadata.name' \
  || echo "")

if [ -z "$LATEST_BACKUP" ] || [ "$LATEST_BACKUP" = "null" ]; then
  echo "  ⚠️  복구할 백업을 찾지 못했습니다. 수동 확인 필요:"
  echo "     KUBECONFIG=$EKS_KUBECONFIG velero backup get"
else
  RESTORE_NAME="dr-restore-$(date +%Y%m%d-%H%M)"
  echo "  최신 백업: $LATEST_BACKUP → restore: $RESTORE_NAME"
  velero restore create "$RESTORE_NAME" \
    --from-backup "$LATEST_BACKUP" \
    --include-namespaces "$RESTORE_NAMESPACES" \
    --restore-volumes=true \
    --wait
  echo "  복구 상태: velero restore describe $RESTORE_NAME"
fi
unset KUBECONFIG

# ── Step 4.5: trip-db 논리 복구 (pg_restore → EBS postgres) ──
# Velero는 매니페스트/빈 PVC만 복구한다. 실제 DB 데이터는 S3의 pg_dump로 적재.
# (on-prem Longhorn 백업은 EBS에서 못 읽으므로 스토리지 무관한 논리 백업을 사용)
echo ""
echo "[4.5] trip-db 논리 백업(pg_dump) 복구..."
if aws s3 cp "s3://${VELERO_BUCKET}/db-dumps/trip_db-latest.dump" /tmp/trip_db-latest.dump 2>/dev/null; then
  echo "  trip-db Pod Ready 대기..."
  kubectl --kubeconfig="$EKS_KUBECONFIG" -n trip-app rollout status deploy/trip-db --timeout=300s || true
  TRIP_DB_POD=$(kubectl --kubeconfig="$EKS_KUBECONFIG" -n trip-app get pod -l app=trip-db \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
  if [ -n "$TRIP_DB_POD" ]; then
    kubectl --kubeconfig="$EKS_KUBECONFIG" -n trip-app cp /tmp/trip_db-latest.dump "$TRIP_DB_POD:/tmp/trip_db-latest.dump"
    kubectl --kubeconfig="$EKS_KUBECONFIG" -n trip-app exec "$TRIP_DB_POD" -- \
      pg_restore -U postgres -d trip_db --clean --if-exists /tmp/trip_db-latest.dump || true
    echo "  ✅ trip_db 데이터 복구 완료 (S3 논리 백업)"
  else
    echo "  ⚠️  trip-db Pod를 찾지 못함 — 데이터 복구 건너뜀."
  fi
else
  echo "  ⚠️  S3 db-dumps에서 덤프를 찾지 못함 — Velero가 복구한 (init.sql 시드) 상태로 진행."
fi

# ── Step 5: GKE Burst 메트릭 소스 전환 (선택) ──
# DR 중에는 GKE Burst가 EKS 부하를 기준으로 스케일링하도록 prometheus-proxy를 전환.
# GKE_KUBECONFIG_B64 secret이 있을 때만 수행 (없으면 건너뜀 — DR 핵심 경로엔 영향 없음).
echo ""
echo "[5/6] GKE Burst 메트릭 소스 전환..."
if [ -n "$GKE_KUBECONFIG_B64" ]; then
  echo "$GKE_KUBECONFIG_B64" | base64 -d > "$GKE_KUBECONFIG"
  EKS_PROM_IP=$(kubectl --kubeconfig="$EKS_KUBECONFIG" get svc -n monitoring \
    prometheus-kube-prometheus-prometheus -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
  if [ -n "$EKS_PROM_IP" ]; then
    kubectl --kubeconfig="$GKE_KUBECONFIG" patch configmap prometheus-upstream \
      -n burst-workloads -p "{\"data\":{\"upstream_url\":\"http://${EKS_PROM_IP}:9090\"}}"
    kubectl --kubeconfig="$GKE_KUBECONFIG" rollout restart deploy/prometheus-proxy -n burst-workloads
    echo "  ✅ GKE KEDA 메트릭 소스 → EKS 전환 완료"
  else
    echo "  ⚠️  EKS Prometheus가 아직 없습니다(경량 모니터링 미설치). GKE 전환 건너뜀."
    echo "     필요 시 EKS에 kube-prometheus-stack 설치 후 수동 전환하세요."
  fi
else
  echo "  GKE_KUBECONFIG_B64 미설정 — GKE 메트릭 전환 건너뜀."
fi

# ── Step 5.5: 외부 노출(NLB) + Route53 SECONDARY 자동 등록 ──
# on-prem 실패 시 Route53 Health Check가 PRIMARY를 죽이고 이 SECONDARY로 자동 전환.
echo ""
echo "[5.5] trip-frontend NLB 노출 + Route53 페일오버 전환..."
kubectl --kubeconfig="$EKS_KUBECONFIG" apply -f kubernetes/manifests/eks-dr/trip-frontend-lb.yaml
echo "  NLB 프로비저닝 대기..."
LB_HOST=""
for i in $(seq 1 30); do
  LB_HOST=$(kubectl --kubeconfig="$EKS_KUBECONFIG" -n trip-app get svc trip-frontend-dr-lb \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
  [ -n "$LB_HOST" ] && break
  sleep 10
done

if [ -n "$LB_HOST" ] && [ -n "${ROUTE53_ZONE_ID:-}" ] && [ -n "${DR_DOMAIN:-}" ]; then
  LB_ZONE=$(aws elbv2 describe-load-balancers --region "$AWS_REGION" \
    --query "LoadBalancers[?DNSName=='${LB_HOST}'].CanonicalHostedZoneId | [0]" --output text)
  cat > /tmp/r53-secondary.json <<EOF
{ "Changes": [ { "Action": "UPSERT", "ResourceRecordSet": {
  "Name": "${DR_DOMAIN}", "Type": "A", "SetIdentifier": "eks-dr-secondary", "Failover": "SECONDARY",
  "AliasTarget": { "HostedZoneId": "${LB_ZONE}", "DNSName": "${LB_HOST}", "EvaluateTargetHealth": true } } } ] }
EOF
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$ROUTE53_ZONE_ID" --change-batch file:///tmp/r53-secondary.json
  echo "  ✅ Route53 SECONDARY → ${LB_HOST} 등록 (on-prem 실패 시 자동 전환)"
else
  echo "  ⚠️  LB_HOST/ROUTE53_ZONE_ID/DR_DOMAIN 미설정 — Route53 자동 등록 생략."
  echo "     수동: trip-frontend-dr-lb 의 EXTERNAL-IP를 SECONDARY 레코드로 등록하세요."
fi

# ── Step 6: Discord 알림 ──
echo ""
echo "[6/6] Discord 알림 전송..."
if [ -n "$DISCORD_CLUSTER_WEBHOOK" ]; then
  EKS_ENDPOINT=$(aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" \
    --query 'cluster.endpoint' --output text 2>/dev/null || echo "N/A")
  curl -s -H "Content-Type: application/json" \
    -d "{\"content\":\"🚨 **DR 활성화 완료 (완전장애 대응)**\n- GitHub-hosted runner + eksctl로 EKS 신규 생성 (on-prem 무관)\n- Endpoint: ${EKS_ENDPOINT}\n- trip-app, backstage 복구 진행\n- Failback 시: ./scripts/dr-failback.sh\"}" \
    "$DISCORD_CLUSTER_WEBHOOK" >/dev/null || true
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
echo "  3. eksctl get cluster --name $CLUSTER_NAME --region $AWS_REGION"
echo ""
echo "Failback: ./scripts/dr-failback.sh"
