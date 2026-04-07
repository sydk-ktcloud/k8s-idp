#!/bin/bash
# =============================================================================
# fix-vault-base64.sh
# Vault에 base64로 잘못 저장된 시크릿 값을 평문으로 정규화하는 스크립트
#
# Root Cause:
#   초기 migrate-k8s.sh가 K8s Secret .data(base64)를 디코딩 없이 Vault에 저장.
#   이후 스크립트에 @base64d를 추가했지만 기존 Vault 데이터는 미수정.
#   ESO가 base64 값을 그대로 K8s Secret에 넣으면 K8s가 다시 base64 인코딩 → 이중 인코딩.
#
# 사용법:
#   ./fix-vault-base64.sh              # dry-run (변경 없음, 확인만)
#   ./fix-vault-base64.sh --apply      # 실제 Vault 데이터 수정
#   ./fix-vault-base64.sh --apply --remove-patch   # Vault 수정 + 클러스터 ExternalSecret 패치 제거
# =============================================================================
set -eo pipefail

export VAULT_ADDR=${VAULT_ADDR:-"https://127.0.0.1:8200"}
export VAULT_SKIP_VERIFY=true

DRY_RUN=true
REMOVE_PATCH=false
FIXED=0
SKIPPED=0
FAILED=0

for arg in "$@"; do
  case "$arg" in
    --apply) DRY_RUN=false ;;
    --remove-patch) REMOVE_PATCH=true ;;
  esac
done

# ExternalSecret YAML 파일에서 추출한 Vault 경로 목록
VAULT_PATHS=(
  "secret/k8s/auth/dex-github-secret"
  "secret/k8s/auth/dex-oidc-secrets"
  "secret/k8s/backstage/backstage-backend-secrets"
  "secret/k8s/backstage/backstage-postgresql"
  "secret/k8s/chatops/chatops-bot-secret"
  "secret/k8s/monitoring/grafana-oauth-secret"
  "secret/k8s/monitoring/loki-minio-credentials"
  "secret/k8s/monitoring/tempo-minio-credentials"
  "secret/k8s/longhorn-system/longhorn-backup-target-secret"
  "secret/k8s/longhorn-system/oauth2-proxy-longhorn"
  "secret/k8s/minio-storage/minio-credentials"
  "secret/k8s/kubecost/oauth2-proxy-kubecost"
  "secret/k8s/kube-system/tailscale-auth"
  "secret/k8s/gitops/argocd-oidc-secret"
)

# Vault 경로에서 ExternalSecret ns/name 추출 (secret/k8s/ns/name → ns/name)
get_es_ns_name() {
  echo "$1" | sed 's|^secret/k8s/||'
}

# ---------------------------------------------------------------------------
# base64 여부 판별: 디코딩 후 재인코딩 결과가 원본과 같으면 base64
# ---------------------------------------------------------------------------
is_base64() {
  local val="$1"
  # 빈 값은 스킵
  [[ -z "$val" ]] && return 1
  # base64 문자셋 체크 (A-Z, a-z, 0-9, +, /, =)
  if ! echo "$val" | grep -qE '^[A-Za-z0-9+/=]+$'; then
    return 1
  fi
  # 디코딩 후 재인코딩이 원본과 일치하는지 확인
  local decoded re_encoded
  decoded=$(echo "$val" | base64 -d 2>/dev/null) || return 1
  re_encoded=$(printf '%s' "$decoded" | base64 2>/dev/null) || return 1
  # base64 줄바꿈 제거 후 비교
  local original_clean re_encoded_clean
  original_clean=$(echo "$val" | tr -d '\n')
  re_encoded_clean=$(echo "$re_encoded" | tr -d '\n')
  [[ "$original_clean" == "$re_encoded_clean" ]]
}

# ---------------------------------------------------------------------------
echo "============================================================"
if $DRY_RUN; then
  echo "  Vault base64 정규화 (DRY-RUN: 변경 없음)"
else
  echo "  Vault base64 정규화 (APPLY: 실제 수정)"
fi
echo "============================================================"
echo ""

# Vault 인증 확인
if ! vault token lookup &>/dev/null; then
  echo "❌ Vault 인증 실패. 'vault login'을 먼저 수행하세요."
  exit 1
fi
echo "✅ Vault 인증 확인"
echo ""

for vault_path in "${VAULT_PATHS[@]}"; do
  echo "🔍 $vault_path"

  # Vault에서 현재 값 읽기
  json=$(vault kv get -format=json "$vault_path" 2>/dev/null | jq -r '.data.data // empty') || true
  if [[ -z "$json" || "$json" == "null" ]]; then
    echo "   ⚠️  경로 없음 또는 빈 데이터 → 스킵"
    (( SKIPPED++ )) || true
    echo ""
    continue
  fi

  # 각 키-값 쌍 검사
  needs_fix=false
  fixed_json="$json"
  while IFS= read -r key; do
    val=$(echo "$json" | jq -r --arg k "$key" '.[$k]')

    if is_base64 "$val"; then
      decoded=$(echo "$val" | base64 -d 2>/dev/null)
      echo "   🔴 $key: base64 감지 → 디코딩 필요"
      echo "      현재: ${val:0:60}..."
      echo "      변환: ${decoded:0:60}..."
      fixed_json=$(echo "$fixed_json" | jq --arg k "$key" --arg v "$decoded" '.[$k] = $v')
      needs_fix=true
    else
      echo "   🟢 $key: 이미 평문"
    fi
  done < <(echo "$json" | jq -r 'keys[]')

  if $needs_fix; then
    if $DRY_RUN; then
      echo "   📋 [DRY-RUN] 수정이 필요합니다 (--apply로 실행하세요)"
    else
      if echo "$fixed_json" | vault kv put "$vault_path" @- > /dev/null; then
        echo "   ✅ Vault 데이터 정규화 완료"
        (( FIXED++ )) || true

        # --remove-patch: 클러스터 ExternalSecret에서 decodingStrategy 제거
        if $REMOVE_PATCH; then
          ns_name=$(get_es_ns_name "$vault_path")
          ns="${ns_name%%/*}"
          name="${ns_name##*/}"
          echo "   🔧 ExternalSecret $ns/$name에서 decodingStrategy 패치 제거 중..."
          # Git YAML 파일을 기준으로 재적용 (decodingStrategy 없음)
          yaml_file="security/vault-infra/eso/external-secrets/${name}.yaml"
          if [[ -f "$yaml_file" ]]; then
            kubectl apply -f "$yaml_file" > /dev/null && echo "   ✅ ExternalSecret 재적용 완료" || echo "   ⚠️  ExternalSecret 재적용 실패"
          else
            echo "   ⚠️  YAML 파일 없음: $yaml_file"
          fi
        fi
      else
        echo "   ❌ Vault 저장 실패"
        (( FAILED++ )) || true
      fi
    fi
  else
    echo "   ✅ 모든 값이 이미 평문 → 스킵"
    (( SKIPPED++ )) || true
  fi
  echo ""
done

# ---------------------------------------------------------------------------
echo "============================================================"
echo "  결과 요약"
echo "============================================================"
if $DRY_RUN; then
  echo "  모드: DRY-RUN (실제 변경 없음)"
fi
echo "  수정: ${FIXED}개  |  스킵: ${SKIPPED}개  |  실패: ${FAILED}개"
echo ""

if $DRY_RUN && (( FIXED == 0 && FAILED == 0 )); then
  echo "ℹ️  수정이 필요한 경로를 확인하려면 위 출력을 검토하세요."
  echo "   실제 수정: ./fix-vault-base64.sh --apply"
  echo "   수정 + 패치 제거: ./fix-vault-base64.sh --apply --remove-patch"
fi

if ! $DRY_RUN && (( FIXED > 0 )); then
  echo ""
  echo "📌 다음 단계:"
  echo "   1. kubectl get externalsecret -A  → READY=True 확인"
  echo "   2. 각 네임스페이스의 pod 정상 동작 확인"
  if ! $REMOVE_PATCH; then
    echo "   3. ExternalSecret YAML 재적용:"
    echo "      kubectl apply -f security/vault-infra/eso/external-secrets/"
  fi
fi
