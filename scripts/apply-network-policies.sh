#!/bin/bash
# Apply Zero Trust Network Policies
# Run AFTER verifying Hubble UI is working

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info "Applying Zero Trust Network Policies..."
log_warn "This will BLOCK all traffic by default and only allow explicit rules"
log_warn "Make sure services are running before applying"

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Aborted"
    exit 1
fi

kubectl apply -f "${SCRIPT_DIR}/network-policies/"

log_info "Network Policies applied!"
log_info "Verify with: kubectl get networkpolicies -A"
log_info "Check Hubble UI at: http://<node-ip>:30071"
