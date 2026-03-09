#!/bin/bash
# Kubernetes Cluster Setup Script
# Installs Kubernetes on all VMs and creates the cluster

set -e

# Configuration
CONTROL_PLANE="192.168.122.109"
WORKERS=("192.168.122.211" "192.168.122.136" "192.168.122.194")
SSH_USER="k8suser"
K8S_VERSION="1.32"
POD_CIDR="10.244.0.0/16"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Run command on all nodes
run_on_all() {
    local cmd=$1
    for ip in "$CONTROL_PLANE" "${WORKERS[@]}"; do
        log_info "Running on $ip: $cmd"
        ssh -o StrictHostKeyChecking=no "$SSH_USER@$ip" "$cmd"
    done
}

# Install containerd on a node
install_containerd() {
    local ip=$1
    log_info "Installing containerd on $ip..."
    
    ssh -o StrictHostKeyChecking=no "$SSH_USER@$ip" << 'EOF'
        sudo apt-get update
        sudo apt-get install -y containerd
        sudo mkdir -p /etc/containerd
        containerd config default | sudo tee /etc/containerd/config.toml
        sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
        sudo systemctl restart containerd
        sudo systemctl enable containerd
EOF
}

# Install Kubernetes packages on a node
install_k8s() {
    local ip=$1
    log_info "Installing Kubernetes on $ip..."
    
    ssh -o StrictHostKeyChecking=no "$SSH_USER@$ip" << EOF
        # Add Kubernetes repository
        sudo apt-get update
        sudo apt-get install -y apt-transport-https ca-certificates curl gpg
        
        curl -fsSL https://pkgs.k8s.io/core:/stable:/v${K8S_VERSION}/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
        sudo chmod 644 /etc/apt/keyrings/kubernetes-apt-keyring.gpg
        
        echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v${K8S_VERSION}/deb/ /" | sudo tee /etc/apt/sources.list.d/kubernetes.list
        
        sudo apt-get update
        sudo apt-get install -y kubelet kubeadm kubectl
        sudo apt-mark hold kubelet kubeadm kubectl
        sudo systemctl enable --now kubelet
EOF
}

# Initialize control plane
init_control_plane() {
    log_info "Initializing control plane..."
    
    ssh -o StrictHostKeyChecking=no "$SSH_USER@$CONTROL_PLANE" << EOF
        sudo kubeadm init \
            --control-plane-endpoint=k8s-cp:6443 \
            --pod-network-cidr=${POD_CIDR} \
            --upload-certs
        
        # Setup kubeconfig
        mkdir -p \$HOME/.kube
        sudo cp -i /etc/kubernetes/admin.conf \$HOME/.kube/config
        sudo chown \$(id -u):\$(id -g) \$HOME/.kube/config
EOF
}

# Get join command
get_join_command() {
    ssh -o StrictHostKeyChecking=no "$SSH_USER@$CONTROL_PLANE" \
        "kubeadm token create --print-join-command"
}

# Join worker node
join_worker() {
    local ip=$1
    local join_cmd=$2
    
    log_info "Joining worker $ip..."
    ssh -o StrictHostKeyChecking=no "$SSH_USER@$ip" "sudo $join_cmd"
}

# Install Cilium CNI
install_cilium() {
    log_info "Installing Cilium CNI..."
    
    ssh -o StrictHostKeyChecking=no "$SSH_USER@$CONTROL_PLANE" << 'EOF'
        # Install Cilium CLI
        CILIUM_CLI_VERSION=$(curl -s https://raw.githubusercontent.com/cilium/cilium-cli/main/stable.txt)
        CLI_ARCH=amd64
        curl -L --fail --remote-name-all "https://github.com/cilium/cilium-cli/releases/download/${CILIUM_CLI_VERSION}/cilium-linux-${CLI_ARCH}.tar.gz"
        sudo tar xzvfC "cilium-linux-${CLI_ARCH}.tar.gz" /usr/local/bin
        rm "cilium-linux-${CLI_ARCH}.tar.gz"
        
        # Install Cilium
        cilium install --version v1.16.9
        
        # Wait for Cilium to be ready
        cilium status --wait
EOF
}

# Verify cluster
verify_cluster() {
    log_info "Verifying cluster..."
    
    ssh -o StrictHostKeyChecking=no "$SSH_USER@$CONTROL_PLANE" << 'EOF'
        echo "=== Nodes ==="
        kubectl get nodes -o wide
        
        echo ""
        echo "=== Pods ==="
        kubectl get pods -A
EOF
}

# Main
main() {
    log_info "Starting Kubernetes cluster setup..."
    
    # Install containerd on all nodes
    log_info "Step 1: Installing containerd..."
    install_containerd "$CONTROL_PLANE"
    for ip in "${WORKERS[@]}"; do
        install_containerd "$ip"
    done
    
    # Install Kubernetes on all nodes
    log_info "Step 2: Installing Kubernetes packages..."
    install_k8s "$CONTROL_PLANE"
    for ip in "${WORKERS[@]}"; do
        install_k8s "$ip"
    done
    
    # Initialize control plane
    log_info "Step 3: Initializing control plane..."
    init_control_plane
    
    # Join workers
    log_info "Step 4: Joining worker nodes..."
    JOIN_CMD=$(get_join_command)
    for ip in "${WORKERS[@]}"; do
        join_worker "$ip" "$JOIN_CMD"
    done
    
    # Install Cilium
    log_info "Step 5: Installing Cilium CNI..."
    install_cilium
    
    # Verify
    log_info "Step 6: Verifying cluster..."
    verify_cluster
    
    log_info "Kubernetes cluster setup complete!"
}

main "$@"
