#!/bin/bash
# Usage: sudo GITHUB_TOKEN=<token> ./setup-github-runner.sh
# Prerequisites: GITHUB_TOKEN with repo admin permissions

set -euo pipefail

REPO_URL="https://github.com/sydk-ktcloud/k8s-idp"
REPO_OWNER="sydk-ktcloud"
REPO_NAME="k8s-idp"
RUNNER_VERSION="2.332.0"
RUNNER_NAME="k8s-idp-runner"
RUNNER_LABELS="k8s-idp,self-hosted"
RUNNER_USER="github-runner"
RUNNER_DIR="/home/${RUNNER_USER}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prerequisites() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root or with sudo"
        exit 1
    fi

    if [ -z "${GITHUB_TOKEN:-}" ]; then
        log_error "GITHUB_TOKEN environment variable is required"
        exit 1
    fi
}

install_dependencies() {
    log_info "Installing system dependencies..."
    apt-get update -qq
    apt-get install -y -qq curl jq wget unzip ca-certificates gnupg
}

install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker already installed: $(docker --version)"
        return 0
    fi

    log_info "Installing Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker "${RUNNER_USER}"
    log_info "Docker installed successfully"
}

create_runner_user() {
    if id "${RUNNER_USER}" &>/dev/null; then
        log_info "User ${RUNNER_USER} already exists"
        return 0
    fi
    useradd -m -s /bin/bash "${RUNNER_USER}"
    log_info "User ${RUNNER_USER} created"
}

check_existing_runner() {
    local service_name="actions.runner.${REPO_OWNER}-${REPO_NAME}.${RUNNER_NAME}.service"
    if systemctl is-active --quiet "${service_name}" 2>/dev/null; then
        return 0
    fi
    return 1
}

download_runner() {
    log_info "Downloading GitHub Actions Runner ${RUNNER_VERSION}..."
    local download_url="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
    local archive_path="${RUNNER_DIR}/actions-runner.tar.gz"

    curl -o "${archive_path}" -L "${download_url}"
    tar xzf "${archive_path}" -C "${RUNNER_DIR}"
    rm "${archive_path}"
    chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}"
}

get_registration_token() {
    log_info "Getting registration token from GitHub..."
    local api_url="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runners/registration-token"

    local response
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "${api_url}")

    local http_code
    http_code=$(echo "$response" | tail -n1)
    local body
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" != "201" ]; then
        log_error "Failed to get registration token (HTTP $http_code)"
        exit 1
    fi

    REGISTRATION_TOKEN=$(echo "$body" | jq -r '.token')

    if [ -z "$REGISTRATION_TOKEN" ] || [ "$REGISTRATION_TOKEN" = "null" ]; then
        log_error "Invalid registration token received"
        exit 1
    fi
}

configure_runner() {
    log_info "Configuring runner..."
    su - "${RUNNER_USER}" -c "cd ${RUNNER_DIR} && ./config.sh \
        --url ${REPO_URL} \
        --token ${REGISTRATION_TOKEN} \
        --name ${RUNNER_NAME} \
        --labels ${RUNNER_LABELS} \
        --unattended \
        --replace"
}

install_service() {
    log_info "Installing runner as systemd service..."
    su - "${RUNNER_USER}" -c "cd ${RUNNER_DIR} && sudo ./svc.sh install ${RUNNER_USER}"

    local service_name="actions.runner.${REPO_OWNER}-${REPO_NAME}.${RUNNER_NAME}.service"
    systemctl daemon-reload
    systemctl enable "${service_name}"
    systemctl start "${service_name}"
}

verify_installation() {
    log_info "Verifying installation..."
    local service_name="actions.runner.${REPO_OWNER}-${REPO_NAME}.${RUNNER_NAME}.service"
    sleep 3

    if ! systemctl is-active --quiet "${service_name}"; then
        log_error "Runner service failed to start"
        systemctl status "${service_name}" --no-pager
        exit 1
    fi
}

print_summary() {
    local service_name="actions.runner.${REPO_OWNER}-${REPO_NAME}.${RUNNER_NAME}.service"
    echo ""
    echo "=========================================="
    echo "GitHub Actions Runner Installation Complete"
    echo "=========================================="
    echo "  Runner Name:    ${RUNNER_NAME}"
    echo "  Runner Labels:  ${RUNNER_LABELS}"
    echo "  Runner Version: ${RUNNER_VERSION}"
    echo "  Service:        ${service_name}"
    echo ""
    echo "Commands: status | logs | stop | restart"
    echo "  systemctl ${service_name}"
    echo "=========================================="
}

cleanup() {
    unset GITHUB_TOKEN
    unset REGISTRATION_TOKEN
}

main() {
    trap cleanup EXIT
    log_info "Starting GitHub Actions Runner setup..."

    check_prerequisites
    install_dependencies
    create_runner_user
    install_docker

    if check_existing_runner; then
        log_info "Runner already running. Nothing to do."
        print_summary
        exit 0
    fi

    if [ ! -f "${RUNNER_DIR}/config.sh" ]; then
        download_runner
    else
        log_info "Runner files present, skipping download"
        chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}"
    fi

    get_registration_token
    configure_runner
    install_service
    verify_installation
    print_summary
    log_info "Setup completed successfully!"
}

main "$@"
