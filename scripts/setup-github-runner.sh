#!/bin/bash
# GitHub Self-hosted Runner Setup Script
# Run this on your on-premise server (k8s-cp recommended)

set -e

REPO_URL="https://github.com/sydk-ktcloud/k8s-idp"
RUNNER_VERSION="2.321.0"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Create runner user (if not exists)
if ! id "github-runner" &>/dev/null; then
    useradd -m -s /bin/bash github-runner
    echo "Created github-runner user"
fi

# Install dependencies
apt-get update
apt-get install -y curl jq wget unzip

# Create runner directory
mkdir -p /home/github-runner/actions-runner
cd /home/github-runner/actions-runner

# Download runner
echo "Downloading GitHub Runner ${RUNNER_VERSION}..."
curl -o actions-runner.tar.gz -L \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

# Extract
tar xzf actions-runner.tar.gz
rm actions-runner.tar.gz

# Set ownership
chown -R github-runner:github-runner /home/github-runner/actions-runner

# Get registration token
echo "Getting registration token..."
REGISTRATION_TOKEN=$(curl -s -X POST \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/sydk-ktcloud/k8s-idp/actions/runners/registration-token" | jq -r '.token')

if [ -z "$REGISTRATION_TOKEN" ] || [ "$REGISTRATION_TOKEN" = "null" ]; then
    echo "Error: Failed to get registration token"
    echo "Set GITHUB_TOKEN environment variable with repo admin permissions"
    exit 1
fi

# Configure runner
echo "Configuring runner..."
su - github-runner -c "cd /home/github-runner/actions-runner && ./config.sh \
    --url ${REPO_URL} \
    --token ${REGISTRATION_TOKEN} \
    --name k8s-idp-runner \
    --labels k8s-idp \
    --unattended \
    --replace"

# Install as systemd service
./svc.sh install github-runner
systemctl enable actions.runner.sydk-ktcloud.k8s-idp.github-runner
systemctl start actions.runner.sydk-ktcloud.k8s-idp.github-runner

echo "=========================================="
echo "GitHub Runner installed and started!"
echo "Runner name: k8s-idp-runner"
echo "Labels: k8s-idp"
echo "=========================================="
