#!/bin/bash
# VM Setup Script for Kubernetes Cluster
# Creates 4 VMs: 1 Control Plane + 3 Workers

set -e

# Configuration
VM_DIR="${VM_DIR:-$HOME/k8s-vms}"
UBUNTU_IMAGE="ubuntu-24.04-cloud.img"
SSH_PUB_KEY="${SSH_PUB_KEY:-$HOME/.ssh/id_rsa.pub}"

# VM Specifications
declare -A VMS=(
    ["k8s-cp"]="4 16384 100G"      # CPU RAM Disk
    ["k8s-w1"]="8 32768 400G"
    ["k8s-w2"]="8 32768 400G"
    ["k8s-w3"]="8 32768 400G"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check for KVM
    if ! lsmod | grep -q kvm; then
        log_error "KVM not loaded. Please enable virtualization in BIOS."
        exit 1
    fi
    
    # Check for libvirt
    if ! command -v virsh &> /dev/null; then
        log_error "libvirt not installed. Run: sudo apt install qemu-kvm libvirt-daemon-system"
        exit 1
    fi
    
    # Check SSH key
    if [ ! -f "$SSH_PUB_KEY" ]; then
        log_warn "SSH key not found. Generating..."
        ssh-keygen -t rsa -b 4096 -f "${SSH_PUB_KEY%.pub}" -N ''
    fi
}

# Download Ubuntu cloud image
download_image() {
    mkdir -p "$VM_DIR"
    cd "$VM_DIR"
    
    if [ ! -f "$UBUNTU_IMAGE" ]; then
        log_info "Downloading Ubuntu 24.04 cloud image..."
        wget -q --show-progress -O "$UBUNTU_IMAGE" \
            https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
    fi
    
    log_info "Cloud image ready: $UBUNTU_IMAGE"
}

# Create cloud-init config
create_cloud_init() {
    local hostname=$1
    local cloud_init_dir="$VM_DIR/cloud-init"
    mkdir -p "$cloud_init_dir"
    
    # User data
    cat > "$cloud_init_dir/${hostname}-user-data.yaml" << EOF
#cloud-config
hostname: $hostname
manage_etc_hosts: true
users:
  - name: k8suser
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - $(cat "$SSH_PUB_KEY")
package_update: true
packages:
  - curl
  - wget
  - apt-transport-https
  - ca-certificates
  - gnupg
  - lsb-release
  - nfs-common
write_files:
  - path: /etc/modules-load.d/k8s.conf
    content: |
      overlay
      br_netfilter
  - path: /etc/sysctl.d/k8s.conf
    content: |
      net.bridge.bridge-nf-call-iptables  = 1
      net.bridge.bridge-nf-call-ip6tables = 1
      net.ipv4.ip_forward                 = 1
runcmd:
  - modprobe overlay
  - modprobe br_netfilter
  - sysctl --system
EOF

    # Meta data
    cat > "$cloud_init_dir/${hostname}-meta-data" << EOF
instance-id: $hostname
local-hostname: $hostname
EOF

    # Create seed ISO
    cloud-localds "$VM_DIR/${hostname}-seed.iso" \
        "$cloud_init_dir/${hostname}-user-data.yaml" \
        "$cloud_init_dir/${hostname}-meta-data"
    
    log_info "Created cloud-init for $hostname"
}

# Create VM disk
create_disk() {
    local name=$1
    local size=$2
    
    if [ ! -f "$VM_DIR/${name}.qcow2" ]; then
        log_info "Creating disk for $name ($size)..."
        qemu-img create -f qcow2 -b "$VM_DIR/$UBUNTU_IMAGE" -F qcow2 \
            "$VM_DIR/${name}.qcow2" "$size"
    fi
}

# Create VM
create_vm() {
    local name=$1
    local cpu=$2
    local memory=$3
    local disk=$4
    
    # Check if VM already exists
    if virsh dominfo "$name" &> /dev/null; then
        log_warn "VM $name already exists, skipping..."
        return
    fi
    
    log_info "Creating VM: $name (CPU: $cpu, RAM: ${memory}MB, Disk: $disk)"
    
    create_cloud_init "$name"
    create_disk "$name" "$disk"
    
    virt-install \
        --name "$name" \
        --vcpus "$cpu" \
        --memory "$memory" \
        --disk path="$VM_DIR/${name}.qcow2,bus=virtio" \
        --disk path="$VM_DIR/${name}-seed.iso,device=cdrom" \
        --os-variant ubuntu24.04 \
        --network network=default,model=virtio \
        --graphics none \
        --console pty,target_type=serial \
        --import \
        --noautoconsole
    
    log_info "VM $name created successfully"
}

# Get VM IP
get_vm_ip() {
    local name=$1
    virsh net-dhcp-leases default | grep "$name" | awk '{print $5}' | cut -d'/' -f1
}

# Main
main() {
    log_info "Starting VM setup..."
    
    check_prerequisites
    download_image
    
    # Create VMs
    for vm in "${!VMS[@]}"; do
        read -r cpu memory disk <<< "${VMS[$vm]}"
        create_vm "$vm" "$cpu" "$memory" "$disk"
    done
    
    # Wait for VMs to boot
    log_info "Waiting 60 seconds for VMs to boot..."
    sleep 60
    
    # Display IPs
    log_info "VM IP Addresses:"
    for vm in "${!VMS[@]}"; do
        ip=$(get_vm_ip "$vm")
        echo "  $vm: $ip"
    done
    
    log_info "VM setup complete!"
}

main "$@"
