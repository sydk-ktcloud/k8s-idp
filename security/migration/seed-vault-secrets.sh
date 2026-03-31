#!/bin/bash
# =============================================================================
# seed-vault-secrets.sh
# Vault 시크릿 초기 적재 스크립트
# ExternalSecret이 참조하는 모든 Vault 경로에 구조를 생성합니다.
#
# 사용법:
#   1. Vault port-forward: kubectl port-forward svc/vault -n vault 8200:8200
#   2. Vault 로그인: vault login
#   3. 스크립트 실행: bash seed-vault-secrets.sh
#   4. 실제 값으로 교체: vault kv put secret/k8s/<ns>/<name> key=real-value
# =============================================================================
set -euo pipefail

export VAULT_ADDR=${VAULT_ADDR:-"https://127.0.0.1:8200"}
export VAULT_SKIP_VERIFY=true

log_info()    { echo "ℹ️  $*"; }
log_success() { echo "   ✅ $*"; }
log_error()   { echo "   ❌ $*" >&2; }
log_sep()     { echo "----------------------------------------------------------"; }

# =============================================================================
# 필수 도구 및 인증 확인
# =============================================================================
check_prerequisites() {
    for cmd in vault; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "필수 도구가 없습니다: $cmd"
            exit 1
        fi
    done

    if ! vault token lookup &>/dev/null; then
        log_error "Vault 인증 실패. 'vault login'을 먼저 수행하세요."
        exit 1
    fi
    log_success "Vault 연결 및 인증 확인 완료"
}

# =============================================================================
# 시크릿 적재 함수
# 이미 존재하는 시크릿은 덮어쓰지 않음
# =============================================================================
seed_secret() {
    local vault_path="$1"
    shift
    # 나머지 인자: key=value 쌍

    # 이미 존재하면 스킵
    if vault kv get "$vault_path" &>/dev/null 2>&1; then
        log_info "[SKIP] $vault_path — 이미 존재합니다"
        return
    fi

    if vault kv put "$vault_path" "$@" > /dev/null; then
        log_success "[SEED] $vault_path"
    else
        log_error "[FAIL] $vault_path"
    fi
}

# =============================================================================
# 메인: 모든 시크릿 경로에 초기값 적재
# ⚠️  아래 값은 플레이스홀더입니다. 반드시 실제 값으로 교체하세요!
# =============================================================================
main() {
    check_prerequisites
    log_sep
    log_info "Vault 시크릿 초기 적재를 시작합니다..."
    log_info "⚠️  플레이스홀더 값이 적재됩니다. 반드시 실제 값으로 교체하세요!"
    log_sep

    # --- backstage ---
    seed_secret "secret/k8s/backstage/backstage-postgresql" \
        postgresql-password="CHANGE_ME" \
        postgresql-postgres-password="CHANGE_ME"

    seed_secret "secret/k8s/backstage/backstage-backend-secrets" \
        POSTGRES_HOST="backstage-postgresql" \
        POSTGRES_PORT="5432" \
        POSTGRES_USER="backstage" \
        POSTGRES_PASSWORD="CHANGE_ME" \
        POSTGRES_DB="backstage" \
        BACKEND_SECRET="CHANGE_ME" \
        GITHUB_TOKEN="" \
        OIDC_CLIENT_SECRET="CHANGE_ME"

    # --- minio ---
    seed_secret "secret/k8s/minio-storage/minio-credentials" \
        MINIO_ROOT_USER="admin" \
        MINIO_ROOT_PASSWORD="CHANGE_ME"

    # --- oauth2-proxy ---
    seed_secret "secret/k8s/longhorn-system/oauth2-proxy-longhorn" \
        COOKIE_SECRET="CHANGE_ME" \
        CLIENT_ID="longhorn" \
        CLIENT_SECRET="CHANGE_ME"

    seed_secret "secret/k8s/kubecost/oauth2-proxy-kubecost" \
        COOKIE_SECRET="CHANGE_ME" \
        CLIENT_ID="kubecost" \
        CLIENT_SECRET="CHANGE_ME"

    # --- observability (loki/tempo) ---
    seed_secret "secret/k8s/monitoring/loki-minio-credentials" \
        secret_access_key="CHANGE_ME"

    seed_secret "secret/k8s/monitoring/tempo-minio-credentials" \
        secret_access_key="CHANGE_ME"

    # --- longhorn backup ---
    seed_secret "secret/k8s/longhorn-system/longhorn-backup-target-secret" \
        AWS_ACCESS_KEY_ID="admin" \
        AWS_SECRET_ACCESS_KEY="CHANGE_ME" \
        AWS_ENDPOINTS="http://minio.minio-storage:9000"

    # --- vpn ---
    seed_secret "secret/k8s/kube-system/tailscale-auth" \
        authkey="CHANGE_ME"

    # --- chatops ---
    seed_secret "secret/k8s/chatops/chatops-bot-secret" \
        AZURE_OPENAI_ENDPOINT="CHANGE_ME" \
        AZURE_OPENAI_KEY="CHANGE_ME" \
        AZURE_OPENAI_MODEL="CHANGE_ME" \
        DISCORD_TOKEN="CHANGE_ME" \
        PROMETHEUS_URL="http://prometheus-kube-prometheus-prometheus.monitoring:9090"

    # --- dex oidc client secrets ---
    seed_secret "secret/k8s/auth/dex-oidc-secrets" \
        ARGOCD_CLIENT_SECRET="CHANGE_ME" \
        GRAFANA_CLIENT_SECRET="CHANGE_ME" \
        KUBECOST_CLIENT_SECRET="CHANGE_ME" \
        LONGHORN_CLIENT_SECRET="CHANGE_ME" \
        BACKSTAGE_CLIENT_SECRET="CHANGE_ME"

    # --- dex github oauth ---
    seed_secret "secret/k8s/auth/dex-github-secret" \
        GITHUB_CLIENT_ID="CHANGE_ME" \
        GITHUB_CLIENT_SECRET="CHANGE_ME"

    # --- argocd oidc ---
    seed_secret "secret/k8s/gitops/argocd-oidc-secret" \
        clientSecret="CHANGE_ME"

    # --- grafana ---
    seed_secret "secret/k8s/monitoring/grafana-oauth-secret" \
        admin-user="admin" \
        admin-password="CHANGE_ME" \
        client-secret="CHANGE_ME"

    log_sep
    echo ""
    echo "✨ 초기 적재 완료!"
    echo ""
    echo "⚠️  다음 단계:"
    echo "   1. 위 경로들의 CHANGE_ME 값을 실제 시크릿으로 교체하세요:"
    echo "      vault kv put secret/k8s/<ns>/<name> key=actual-value"
    echo ""
    echo "   2. ExternalSecret을 클러스터에 적용하세요:"
    echo "      kubectl apply -f security/vault-infra/eso/external-secrets/"
    echo ""
    echo "   3. 동기화 상태를 확인하세요:"
    echo "      kubectl get externalsecrets -A"
    echo ""
}

main "$@"
