#!/bin/bash
# =============================================================================
# vault-migration.sh
# K8s Secret → HashiCorp Vault 이관 + ExternalSecret 생성 스크립트
# 보안 강화 버전: stdin 파이프라인, umask 077, set -euo pipefail 적용
# =============================================================================
set -euo pipefail

# =============================================================================
# 1. 환경 설정 및 상수 정의
# =============================================================================
ESO_NS="external-secrets"
VAULT_PATH_PREFIX="k8s"
ESO_SECRETSTORE="vault-secret-store"
TARGET_DIR="my-secrets-yaml"
FAILED_LIST=()
SUCCESS_COUNT=0
SKIP_COUNT=0

export VAULT_ADDR=${VAULT_ADDR:-"https://127.0.0.1:8200"}
export VAULT_SKIP_VERIFY=true

# 파일 생성 권한 제한 (600: 소유자만 읽기/쓰기)
umask 077

# =============================================================================
# 2. 유틸리티 함수
# =============================================================================
log_info()    { echo "ℹ️  $*"; }
log_success() { echo "   ✅ $*"; }
log_warn()    { echo "   ⚠️  $*"; }
log_error()   { echo "   ❌ $*" >&2; }
log_target()  { echo "🎯 처리 중: $*"; }
log_sep()     { echo "----------------------------------------------------------"; }

# =============================================================================
# 3. 필수 도구 확인
# =============================================================================
check_dependencies() {
    local missing=()
    for cmd in kubectl vault jq; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "필수 도구가 없습니다: ${missing[*]}"
        exit 1
    fi

    # VAULT_ADDR가 127.0.0.1인 경우 port-forward 연결 여부 확인
    if [[ "${VAULT_ADDR}" == *"127.0.0.1"* ]]; then
        if ! vault status &>/dev/null; then
            log_error "Vault에 연결할 수 없습니다 (${VAULT_ADDR})"
            log_error "port-forward가 실행 중인지 확인하세요:"
            log_error "  kubectl port-forward svc/vault -n vault 8200:8200"
            exit 1
        fi
    fi
}

# =============================================================================
# 4. Vault 토큰 검증
# [보안] 환경변수 대신 ~/.vault-token 파일 우선 사용
# vault CLI는 ~/.vault-token을 자동으로 읽으므로 VAULT_TOKEN 변수 불필요
# =============================================================================
check_vault_auth() {
    # vault token lookup은 ~/.vault-token 또는 $VAULT_TOKEN을 자동으로 사용
    if ! vault token lookup &>/dev/null; then
        log_error "Vault 인증 실패. 'vault login'을 먼저 수행하세요."
        log_error "또는 ~/.vault-token 파일이 유효한지 확인하세요."
        exit 1
    fi
    log_success "Vault 인증 확인 완료"
}

# =============================================================================
# 5. ClusterSecretStore 확인 및 이관용 제한 토큰 생성
# [수정] Root Token을 ESO에 직접 사용하지 않음.
#        이관 작업용 단기 토큰(allow_secrets 정책)을 생성하여 k8s Secret에 저장.
#        ClusterSecretStore는 기존 Kubernetes 인증 방식을 유지하며 덮어쓰지 않음.
#        (secret-store.yaml 참고 - caBundle, kubernetes auth 방식 사용)
# =============================================================================
setup_cluster_secret_store() {
    log_info "[단계 1] 이관용 제한 토큰 생성 및 ClusterSecretStore 확인"

    kubectl create namespace "$ESO_NS" 2>/dev/null || true

    # [보안] Root Token이 아닌 allow_secrets 정책의 단기 토큰 생성
    # vault token create는 ~/.vault-token 또는 $VAULT_TOKEN을 자동으로 사용
    local migration_token
    migration_token=$(vault token create \
        -policy="allow_secrets" \
        -ttl="2h" \
        -display-name="eso-migration" \
        -format=json \
        | jq -r '.auth.client_token')

    if [ -z "$migration_token" ]; then
        log_error "이관용 토큰 생성 실패. Vault 권한을 확인하세요."
        exit 1
    fi

    # [보안] printf를 사용하여 토큰을 stdin으로 전달 (shell history 노출 방지)
    kubectl create secret generic vault-token \
        -n "$ESO_NS" \
        --from-file=token=<(printf '%s' "$migration_token") \
        --dry-run=client -o yaml | kubectl apply -f - &>/dev/null

    unset migration_token
    log_success "이관용 제한 토큰(TTL 2h) Secret 생성/갱신 완료"

    # ClusterSecretStore가 이미 존재하면 덮어쓰지 않음
    # (secret-store.yaml의 Kubernetes 인증 방식을 유지)
    if kubectl get clustersecretstore "$ESO_SECRETSTORE" &>/dev/null; then
        log_warn "ClusterSecretStore '${ESO_SECRETSTORE}' 가 이미 존재합니다. 덮어쓰지 않습니다."
        log_success "ClusterSecretStore 확인 완료"
        return
    fi

    kubectl apply -f - >/dev/null <<EOF
apiVersion: external-secrets.io/v1
kind: ClusterSecretStore
metadata:
  name: ${ESO_SECRETSTORE}
spec:
  provider:
    vault:
      server: "https://vault.vault.svc.cluster.local:8200"
      path: "secret"
      version: "v2"
      caProvider:
        type: Secret
        name: "vault-tls"
        key: "ca.crt"
        namespace: "vault"
      auth:
        tokenSecretRef:
          name: vault-token
          key: token
          namespace: ${ESO_NS}
EOF

    log_success "ClusterSecretStore 생성 완료"
}

# =============================================================================
# 6. 필터 함수
# =============================================================================

# 시스템 자동 생성 시크릿 제외
is_system_secret() {
    local secret="$1"
    [[ "$secret" == *"cicd-token"* ]] && return 0
    [[ "$secret" == "sh.helm.release"*   ]] && return 0
    [[ "$secret" == *"webhook-"*          ]] && return 0
    [[ "$secret" == "vault-unseal"*       ]] && return 0
    [[ "$secret" == "vault-raw"*          ]] && return 0
    [[ "$secret" == "vault-configurer"*   ]] && return 0
    [[ "$secret" == "default-token"*      ]] && return 0
    return 1
}

# 키워드 매칭 확인
is_keyword_matched() {
    local secret="$1"
    local keywords=(
        "hubble-ca-secret" "hubble-relay-client" "hubble-relay-server"
        "dex" "github" "oauth2" "idp-ca"
        "argocd" "repo-" "credentials"
        "crossplane-tls" "crossplane-root" "postgresql"
        "grafana" "pricing" "kubecost-config" "alertmanager"
        "backstage" "bot-secret"
    )
    for kw in "${keywords[@]}"; do
        [[ "$secret" == *"$kw"* ]] && return 0
    done
    return 1
}

# =============================================================================
# 7. Vault에 시크릿 저장
# [보안 핵심] base64 디코딩된 값을 변수에 저장하지 않고 파이프라인으로 직접 전달
# [수정 1] vault kv put stdin 플래그: @- (대시 단독은 동작 안 함)
# [수정 2] .data 값을 @base64d로 디코딩 후 저장
#          k8s .data는 이미 base64 인코딩된 값임.
#          디코딩 없이 저장하면 ESO가 재생성 시 이중 인코딩되어 앱 장애 발생.
# =============================================================================
store_to_vault() {
    local ns="$1"
    local secret="$2"
    local vault_path="$3"

    # kubectl → jq(base64 디코딩) → vault kv put @- 파이프라인
    # jq: k8s secret의 .data 필드를 디코딩하여 {"key":"plainvalue",...} JSON으로 변환
    if ! kubectl get secret "$secret" -n "$ns" -o json 2>/dev/null \
         | jq -r '.data // {} | to_entries | map({key: .key, value: (.value | @base64d)}) | from_entries' \
         | vault kv put "$vault_path" @- > /dev/null; then
        return 1
    fi
    return 0
}

# =============================================================================
# 8. ExternalSecret YAML 생성 및 배포
# =============================================================================
create_external_secret() {
    local ns="$1"
    local secret="$2"
    local yaml_file="$3"

    # umask 077이 적용되어 생성 파일은 600 권한
    cat > "$yaml_file" <<EOF
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: ${secret}
  namespace: ${ns}
  labels:
    migrated-by: vault-migration
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: ${ESO_SECRETSTORE}
    kind: ClusterSecretStore
  target:
    name: ${secret}
    creationPolicy: Owner
  dataFrom:
    - extract:
        key: ${VAULT_PATH_PREFIX}/${ns}/${secret}
        decodingStrategy: Base64
EOF

    if ! kubectl apply -f "$yaml_file" >/dev/null; then
        return 1
    fi
    return 0
}

# =============================================================================
# 9. 메인 이관 루프
# [수정] 공백 안전한 파싱: while IFS read 사용 (word splitting 방지)
# =============================================================================
run_migration() {
    log_sep
    log_info "[단계 2] 보안 강화된 데이터 이관 및 ExternalSecret 생성 시작"

    mkdir -p "$TARGET_DIR" || {
        log_error "디렉토리 생성 실패: $TARGET_DIR"
        exit 1
    }

    # [수정] jsonpath로 NS/NAME 한 줄씩 출력 → IFS 기반 안전 파싱
    # word splitting, 공백 포함 이름 모두 안전하게 처리
    while IFS='/' read -r NS SECRET; do
        # 빈 값 방어
        [[ -z "$NS" || -z "$SECRET" ]] && continue
        
        # [추가된 한 줄] 시크릿 타입을 확인하여 service-account-token이면 자동 스킵
        SECRET_TYPE=$(kubectl get secret "$SECRET" -n "$NS" -o jsonpath='{.type}' 2>/dev/null || echo "Unknown")
        if [[ "$SECRET_TYPE" == "kubernetes.io/service-account-token" ]]; then
            log_warn "[$NS/$SECRET] 시스템 관리 토큰(service-account-token)이므로 스킵합니다."
            (( SKIP_COUNT++ )) || true
            continue
        fi

        # [필터 1] 시스템 시크릿 제외
        if is_system_secret "$SECRET"; then
            (( SKIP_COUNT++ )) || true
            continue
        fi

        # [필터 2] 키워드 매칭
        if ! is_keyword_matched "$SECRET"; then
            (( SKIP_COUNT++ )) || true
            continue
        fi

        log_target "[$NS] $SECRET"

        VAULT_FULL_PATH="secret/${VAULT_PATH_PREFIX}/${NS}/${SECRET}"
        YAML_FILE="${TARGET_DIR}/${NS}-${SECRET}-es.yaml"

        # Vault 저장
        if ! store_to_vault "$NS" "$SECRET" "$VAULT_FULL_PATH"; then
            log_error "Vault 저장 실패 (네트워크 또는 권한 문제): [$NS/$SECRET]"
            log_error "ExternalSecret 생성을 건너뜁니다."
            FAILED_LIST+=("${NS}/${SECRET}")
            continue
        fi
        log_success "Vault 저장 완료: $VAULT_FULL_PATH"

        # ExternalSecret 생성 및 배포
        if ! create_external_secret "$NS" "$SECRET" "$YAML_FILE"; then
            log_warn "YAML 생성은 성공했으나 kubectl apply 실패: $YAML_FILE"
            FAILED_LIST+=("${NS}/${SECRET} (apply 실패)")
            continue
        fi
        log_success "ExternalSecret 생성 및 배포 성공"
        (( SUCCESS_COUNT++ )) || true

    done < <(kubectl get secrets -A \
        -o jsonpath='{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{"\n"}{end}' \
        2>/dev/null)
}

# =============================================================================
# 10. 결과 요약 출력
# =============================================================================
print_summary() {
    log_sep
    echo "✨ 작업 완료 요약"
    echo "   ✅ 성공: ${SUCCESS_COUNT}개"
    echo "   ⏭️  스킵: ${SKIP_COUNT}개"
    echo "   ❌ 실패: ${#FAILED_LIST[@]}개"

    if [ ${#FAILED_LIST[@]} -gt 0 ]; then
        echo ""
        echo "   실패 목록:"
        for item in "${FAILED_LIST[@]}"; do
            echo "     - $item"
        done
        echo ""
        log_warn "실패한 항목을 수동으로 확인하세요."
        exit 1
    fi
}

# =============================================================================
# 11. 엔트리포인트
# =============================================================================
main() {
    check_dependencies
    check_vault_auth
    setup_cluster_secret_store
    run_migration
    print_summary
}

main "$@"
