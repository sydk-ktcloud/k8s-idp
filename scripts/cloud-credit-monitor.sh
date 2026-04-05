#!/bin/bash
# Cloud Credit & Cost Monitor - Discord Webhook Alert
# Runs hourly via cron to report AWS, Azure, GCP credit balance & monthly costs

set -euo pipefail

DISCORD_WEBHOOK="https://discord.com/api/webhooks/1489844865452871812/Ok15kH_6bqiGeh_gpbGmMP34cI_lnrTYC5OPGuS2EEaRAmhAuRz9JE21K9Gsp7hHgEk1"

# Date calculations
CURRENT_MONTH_START=$(date -u +"%Y-%m-01")
TOMORROW=$(date -u -v+1d +"%Y-%m-%d" 2>/dev/null || date -u -d "+1 day" +"%Y-%m-%d")
TODAY=$(date -u +"%Y-%m-%d")
TIMESTAMP=$(date +"%Y-%m-%d %H:%M KST")

# ─── AWS ────────────────────────────────────────────────────────────────
get_aws_info() {
    local aws_section=""
    local aws_ok=true

    # Monthly cost
    local aws_cost
    aws_cost=$(aws ce get-cost-and-usage \
        --time-period "Start=${CURRENT_MONTH_START},End=${TOMORROW}" \
        --granularity MONTHLY \
        --metrics "UnblendedCost" \
        --output json 2>&1) || aws_ok=false

    if $aws_ok; then
        local amount currency
        amount=$(echo "$aws_cost" | jq -r '.ResultsByTime[0].Total.UnblendedCost.Amount // "0"')
        currency=$(echo "$aws_cost" | jq -r '.ResultsByTime[0].Total.UnblendedCost.Unit // "USD"')
        aws_section="💰 **이번 달 사용량**: ${amount} ${currency}"
    else
        aws_section="⚠️ Cost Explorer 접근 불가 (IAM 액세스 활성화 필요)"
    fi

    # Credits balance
    local aws_credits
    aws_credits=$(aws ce get-cost-and-usage \
        --time-period "Start=${CURRENT_MONTH_START},End=${TOMORROW}" \
        --granularity MONTHLY \
        --metrics "UnblendedCost" \
        --filter '{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit"]}}' \
        --output json 2>&1)

    if [ $? -eq 0 ]; then
        local credit_amount
        credit_amount=$(echo "$aws_credits" | jq -r '.ResultsByTime[0].Total.UnblendedCost.Amount // "0"')
        if [ "$credit_amount" != "0" ]; then
            aws_section="${aws_section}\n🎫 **크레딧 사용**: ${credit_amount}"
        fi
    fi

    echo "$aws_section"
}

# ─── GCP ────────────────────────────────────────────────────────────────
get_gcp_info() {
    local gcp_section=""
    local project_id="sydk-ktcloud"
    local billing_account="01B26E-30705E-19E209"
    local bq_dataset="billing_export"
    local bq_table="${project_id}.${bq_dataset}.gcp_billing_export_v1_01B26E_30705E_19E209"

    # Monthly cost via BigQuery billing export
    local bq_result bq_exit
    bq_result=$(bq query --project_id="$project_id" --use_legacy_sql=false --format=json --location=asia-northeast3 \
        "SELECT
           ROUND(SUM(cost), 2) AS total_cost,
           currency
         FROM \`${bq_table}\`
         WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
         GROUP BY currency" 2>&1)
    bq_exit=$?

    if [ $bq_exit -ne 0 ]; then
        gcp_section="⚠️ BigQuery 비용 조회 실패"
    elif echo "$bq_result" | jq -e '.[0]' &>/dev/null; then
        local total_cost currency
        total_cost=$(echo "$bq_result" | jq -r '.[0].total_cost // "0"')
        currency=$(echo "$bq_result" | jq -r '.[0].currency // "KRW"')
        gcp_section="💰 **이번 달 사용량**: ${total_cost} ${currency}"
    else
        gcp_section="💰 **이번 달 사용량**: 0 (빌링 데이터 수집 대기 중)"
    fi

    # Credit usage via BigQuery
    local bq_credits
    bq_credits=$(bq query --project_id="$project_id" --use_legacy_sql=false --format=json --location=asia-northeast3 \
        "SELECT
           ROUND(SUM(credits.amount), 2) AS total_credits
         FROM \`${bq_table}\`,
           UNNEST(credits) AS credits
         WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())" 2>&1)

    if [ $? -eq 0 ] && echo "$bq_credits" | jq -e '.[0]' &>/dev/null; then
        local credit_amount
        credit_amount=$(echo "$bq_credits" | jq -r '.[0].total_credits // "0"')
        if [ "$credit_amount" != "0" ] && [ "$credit_amount" != "null" ]; then
            gcp_section="${gcp_section}\n🎫 **크레딧 적용**: ${credit_amount}"
        fi
    fi

    # Budgets
    local budgets
    budgets=$(gcloud billing budgets list --billing-account="$billing_account" --format=json 2>&1) || true

    if echo "$budgets" | jq -e '.[0]' &>/dev/null; then
        local budget_amount
        budget_amount=$(echo "$budgets" | jq -r '.[0].amount.specifiedAmount.units // "N/A"')
        gcp_section="${gcp_section}\n📊 **예산**: ${budget_amount} KRW"
    fi

    echo "$gcp_section"
}

# ─── Azure ──────────────────────────────────────────────────────────────
get_azure_info() {
    local azure_section=""

    if ! command -v az &>/dev/null; then
        echo "⚠️ Azure CLI 미설치 (\`brew install azure-cli\`)"
        return
    fi

    # Check login
    if ! az account show &>/dev/null; then
        echo "⚠️ Azure 로그인 필요 (\`az login\`)"
        return
    fi

    local subscription_id
    subscription_id=$(az account show --query id -o tsv 2>&1)

    # Monthly cost
    local azure_cost
    azure_cost=$(az consumption usage list \
        --start-date "$CURRENT_MONTH_START" \
        --end-date "$TODAY" \
        --query "[].{cost:pretaxCost, currency:currency}" \
        -o json 2>&1)

    if [ $? -eq 0 ]; then
        local total_cost currency
        total_cost=$(echo "$azure_cost" | jq '[.[].cost] | add // 0')
        currency=$(echo "$azure_cost" | jq -r '.[0].currency // "KRW"')
        azure_section="💰 **이번 달 사용량**: ${total_cost} ${currency}"
    else
        azure_section="⚠️ 비용 조회 실패"
    fi

    # Credits / Sponsorship balance
    local credits
    credits=$(az consumption marketplace list --start-date "$CURRENT_MONTH_START" --end-date "$TODAY" -o json 2>&1) || true

    # Budget check
    local budgets
    budgets=$(az consumption budget list -o json 2>&1) || true

    if echo "$budgets" | jq -e '.[0]' &>/dev/null; then
        local budget_amount budget_spent
        budget_amount=$(echo "$budgets" | jq -r '.[0].amount')
        budget_spent=$(echo "$budgets" | jq -r '.[0].currentSpend.amount // "0"')
        azure_section="${azure_section}\n📊 **예산**: ${budget_amount} / 사용: ${budget_spent}"
    fi

    echo "$azure_section"
}

# ─── Send Discord Notification ──────────────────────────────────────────
send_discord() {
    local aws_info gcp_info azure_info

    echo "☁️ Collecting AWS info..."
    aws_info=$(get_aws_info 2>&1) || aws_info="⚠️ AWS 조회 실패"

    echo "☁️ Collecting GCP info..."
    gcp_info=$(get_gcp_info 2>&1) || gcp_info="⚠️ GCP 조회 실패"

    echo "☁️ Collecting Azure info..."
    azure_info=$(get_azure_info 2>&1) || azure_info="⚠️ Azure 조회 실패"

    local payload
    payload=$(cat <<EOJSON
{
  "embeds": [{
    "title": "☁️ 클라우드 크레딧 & 비용 리포트",
    "description": "**${TIMESTAMP}** 기준 현황",
    "color": 3447003,
    "fields": [
      {
        "name": "🟠 AWS",
        "value": $(echo -e "$aws_info" | jq -Rs .),
        "inline": false
      },
      {
        "name": "🔵 GCP",
        "value": $(echo -e "$gcp_info" | jq -Rs .),
        "inline": false
      },
      {
        "name": "🟣 Azure",
        "value": $(echo -e "$azure_info" | jq -Rs .),
        "inline": false
      }
    ],
    "footer": {
      "text": "k8s-idp cloud-credit-monitor | 1시간 간격"
    }
  }]
}
EOJSON
)

    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$DISCORD_WEBHOOK")

    if [ "$response" = "204" ] || [ "$response" = "200" ]; then
        echo "✅ Discord 알림 전송 성공 (HTTP ${response})"
    else
        echo "❌ Discord 알림 전송 실패 (HTTP ${response})"
        # Debug: print payload
        echo "$payload" | jq . 2>/dev/null || echo "$payload"
        exit 1
    fi
}

# ─── Main ───────────────────────────────────────────────────────────────
echo "=== Cloud Credit Monitor - ${TIMESTAMP} ==="
send_discord
echo "=== Done ==="
