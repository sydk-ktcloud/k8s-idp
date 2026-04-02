#!/bin/bash
# Cloud Headscale 프로비저닝 스크립트
# GCP e2-micro에 Headscale을 배포하여 On-prem SPOF를 해소
#
# 사용법: ./setup.sh
# 사전 조건: gcloud CLI 인증 완료, 프로젝트 sydk-ktcloud 설정

set -euo pipefail

PROJECT="sydk-ktcloud"
REGION="asia-northeast3"
ZONE="${REGION}-a"
INSTANCE_NAME="headscale-cloud"
MACHINE_TYPE="e2-micro"

echo "=== Cloud Headscale 프로비저닝 ==="

# 1. Static IP 생성
echo "[1/5] Static IP 할당..."
if ! gcloud compute addresses describe $INSTANCE_NAME --region=$REGION --project=$PROJECT &>/dev/null; then
  gcloud compute addresses create $INSTANCE_NAME \
    --region=$REGION \
    --project=$PROJECT
fi

STATIC_IP=$(gcloud compute addresses describe $INSTANCE_NAME \
  --region=$REGION \
  --project=$PROJECT \
  --format='value(address)')
echo "  Static IP: $STATIC_IP"

# 2. 방화벽 규칙
echo "[2/5] 방화벽 규칙 생성..."
if ! gcloud compute firewall-rules describe allow-headscale --project=$PROJECT &>/dev/null; then
  gcloud compute firewall-rules create allow-headscale \
    --project=$PROJECT \
    --allow=tcp:8080,tcp:50443,udp:41641 \
    --target-tags=headscale \
    --description="Headscale control plane + DERP relay"
fi

# 3. config.yaml에 실제 IP 반영
echo "[3/5] config.yaml 업데이트..."
sed "s|CLOUD_HEADSCALE_STATIC_IP|${STATIC_IP}|g" config.yaml > /tmp/headscale-config.yaml

# 4. GCE 인스턴스 생성 (Container-Optimized OS)
echo "[4/5] GCE 인스턴스 생성..."
if ! gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --project=$PROJECT &>/dev/null; then
  gcloud compute instances create $INSTANCE_NAME \
    --project=$PROJECT \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --image-family=cos-stable \
    --image-project=cos-cloud \
    --address=$STATIC_IP \
    --tags=headscale \
    --metadata=startup-script='#!/bin/bash
      mkdir -p /etc/headscale /var/lib/headscale
      docker pull headscale/headscale:0.22
      docker run -d --name headscale --restart=always \
        -v /etc/headscale:/etc/headscale \
        -v /var/lib/headscale:/var/lib/headscale \
        -p 8080:8080 -p 50443:50443 -p 41641:41641/udp \
        headscale/headscale:0.22 serve
    '
  echo "  인스턴스 부팅 대기 (30초)..."
  sleep 30

  # config + ACL 복사
  gcloud compute scp /tmp/headscale-config.yaml $INSTANCE_NAME:/etc/headscale/config.yaml --zone=$ZONE --project=$PROJECT
  gcloud compute scp acl_policy.hujson $INSTANCE_NAME:/etc/headscale/acl_policy.hujson --zone=$ZONE --project=$PROJECT
  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT --command="docker restart headscale"
fi

# 5. Auth Key 생성
echo "[5/5] Tailscale auth key 생성..."
echo ""
echo "아래 명령으로 각 클러스터용 auth key를 생성하세요:"
echo ""
echo "  # On-prem"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT \\"
echo "    --command='docker exec headscale headscale preauthkeys create --user default --reusable --expiration 720h --tags tag:onprem'"
echo ""
echo "  # GKE Burst"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT \\"
echo "    --command='docker exec headscale headscale preauthkeys create --user default --reusable --expiration 720h --tags tag:gke-burst'"
echo ""
echo "  # EKS DR"
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT \\"
echo "    --command='docker exec headscale headscale preauthkeys create --user default --reusable --expiration 720h --tags tag:eks-dr'"
echo ""
echo "=== 완료 ==="
echo "Cloud Headscale: http://${STATIC_IP}:8080"
echo ""
echo "다음 단계:"
echo "  1. 생성된 auth key를 Vault에 저장"
echo "  2. tailscale-gke.yaml의 login-server를 http://${STATIC_IP}:8080 으로 변경"
echo "  3. On-prem Tailscale DaemonSet도 동일하게 변경"
