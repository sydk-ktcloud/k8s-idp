#!/bin/bash
# Headscale Setup Script
# Installs and configures Headscale server

set -e

HEADSCALE_VERSION="${HEADSCALE_VERSION:-0.28.0}"
SERVER_IP="${SERVER_IP:-192.168.45.245}"
CONFIG_DIR="/etc/headscale"
DATA_DIR="/var/lib/headscale"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Install Headscale
install_headscale() {
    log_info "Installing Headscale v$HEADSCALE_VERSION..."
    
    wget -q "https://github.com/juanfont/headscale/releases/download/v${HEADSCALE_VERSION}/headscale_${HEADSCALE_VERSION}_linux_amd64.deb" \
        -O /tmp/headscale.deb
    
    sudo apt-get update
    sudo apt-get install -y /tmp/headscale.deb
    rm /tmp/headscale.deb
    
    log_info "Headscale installed successfully"
}

# Configure Headscale
configure_headscale() {
    log_info "Configuring Headscale..."
    
    sudo mkdir -p "$CONFIG_DIR" "$DATA_DIR"
    sudo chown -R headscale:headscale "$CONFIG_DIR" "$DATA_DIR"
    
    # Create config from template
    cat << EOF | sudo tee "$CONFIG_DIR/config.yaml"
server_url: http://${SERVER_IP}:8080
listen_addr: 0.0.0.0:8080
metrics_listen_addr: 127.0.0.1:9090
grpc_listen_addr: 0.0.0.0:50443
grpc_allow_insecure: true

database:
  type: sqlite
  sqlite:
    path: ${DATA_DIR}/db.sqlite

policy:
  mode: file
  path: ${CONFIG_DIR}/acl_policy.hujson

log_level: info

prefixes:
  v6: fd7a:115c:a1e0::/64
  v4: 100.64.0.0/10

dns:
  base_domain: k8s.local
  nameservers:
    global:
      - 1.1.1.1
      - 8.8.8.8
  magic_dns: true

noise:
  private_key_path: ${DATA_DIR}/noise_private.key
EOF

    # Create ACL policy
    cat << 'EOF' | sudo tee "$CONFIG_DIR/acl_policy.hujson"
{
  "groups": {
    "group:k8s-team": ["k8s-team"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["*"],
      "dst": ["*:*"]
    }
  ]
}
EOF

    log_info "Configuration created"
}

# Start Headscale service
start_service() {
    log_info "Starting Headscale service..."
    
    sudo systemctl enable headscale
    sudo systemctl start headscale
    
    sleep 5
    
    if sudo systemctl is-active --quiet headscale; then
        log_info "Headscale service is running"
    else
        log_error "Headscale service failed to start"
        sudo journalctl -u headscale -n 20 --no-pager
        exit 1
    fi
}

# Create pre-auth key
create_auth_key() {
    log_info "Creating pre-auth key..."
    
    # Create namespace
    sudo headscale namespaces create k8s-team 2>/dev/null || true
    
    # Create reusable pre-auth key
    AUTH_KEY=$(sudo headscale preauthkeys create --reusable -e 720h 2>/dev/null | grep -o 'hskey-.*')
    
    if [ -n "$AUTH_KEY" ]; then
        echo ""
        log_info "=== PRE-AUTH KEY ==="
        echo "$AUTH_KEY"
        echo ""
        log_info "Use this key to connect clients:"
        echo "  tailscale up --login-server=http://${SERVER_IP}:8080 --authkey=${AUTH_KEY}"
    fi
}

# Main
main() {
    log_info "Starting Headscale setup..."
    
    install_headscale
    configure_headscale
    start_service
    create_auth_key
    
    log_info "Headscale setup complete!"
}

main "$@"
