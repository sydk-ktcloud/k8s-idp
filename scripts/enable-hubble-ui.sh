#!/bin/bash
# Enable Hubble UI on existing Cilium installation
# Run on control plane node

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

CILIUM_VERSION="1.16.9"

log_info "Enabling Hubble and Hubble UI on Cilium..."

cilium upgrade --version ${CILIUM_VERSION} \
  --set hubble.enabled=true \
  --set hubble.listenAddress=":4244" \
  --set hubble.metrics.enabled="{dns,drop,tcp,flow,icmp,http}" \
  --set hubble.relay.enabled=true \
  --set hubble.relay.replicas=1 \
  --set hubble.ui.enabled=true \
  --set hubble.ui.replicas=1 \
  --set l7Proxy.enabled=true \
  --set prometheus.enabled=true \
  --set operator.replicas=1

log_info "Waiting for Cilium to be ready..."
cilium status --wait

log_info "Applying Hubble UI NodePort Service..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: hubble-ui-nodeport
  namespace: kube-system
spec:
  type: NodePort
  selector:
    k8s-app: hubble-ui
  ports:
    - name: http
      port: 80
      targetPort: 8081
      nodePort: 30072
EOF

log_info "Hubble UI enabled!"
log_info "Access Hubble UI at: http://<node-ip>:30071"
log_info "Verify with: cilium status"
