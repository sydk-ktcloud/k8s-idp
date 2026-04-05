#!/usr/bin/env python3
"""Cloud Credit & Cost Monitor - Discord Webhook Alert

Queries AWS, GCP, Azure billing APIs and sends a summary to Discord every hour.
Designed to run as a K8s CronJob.
"""

import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

# Suppress noisy Azure SDK logs
logging.getLogger("azure").setLevel(logging.ERROR)

DISCORD_WEBHOOK = os.environ.get(
    "DISCORD_WEBHOOK_URL",
    "https://discord.com/api/webhooks/1489844865452871812/Ok15kH_6bqiGeh_gpbGmMP34cI_lnrTYC5OPGuS2EEaRAmhAuRz9JE21K9Gsp7hHgEk1",
)

KST = timezone(timedelta(hours=9))
NOW = datetime.now(KST)
MONTH_START = NOW.replace(day=1).strftime("%Y-%m-%d")
TODAY = NOW.strftime("%Y-%m-%d")
TOMORROW = (NOW + timedelta(days=1)).strftime("%Y-%m-%d")
TIMESTAMP = NOW.strftime("%Y-%m-%d %H:%M KST")


# ── AWS ──────────────────────────────────────────────────────────────────
def get_aws_info() -> str:
    try:
        import boto3

        ce = boto3.client("ce")
        lines = []

        # Gross cost (before credits)
        try:
            gross_resp = ce.get_cost_and_usage(
                TimePeriod={"Start": MONTH_START, "End": TOMORROW},
                Granularity="MONTHLY",
                Metrics=["UnblendedCost"],
                Filter={"Not": {"Dimensions": {"Key": "RECORD_TYPE", "Values": ["Credit"]}}},
            )
            gross_total = gross_resp["ResultsByTime"][0]["Total"]["UnblendedCost"]
            gross_amount = float(gross_total["Amount"])
            unit = gross_total["Unit"]
        except Exception:
            gross_amount = 0.0
            unit = "USD"

        # Net cost (after credits)
        try:
            net_resp = ce.get_cost_and_usage(
                TimePeriod={"Start": MONTH_START, "End": TOMORROW},
                Granularity="MONTHLY",
                Metrics=["UnblendedCost"],
            )
            net_total = net_resp["ResultsByTime"][0]["Total"]["UnblendedCost"]
            net_amount = float(net_total["Amount"])
            unit = net_total["Unit"]
        except ce.exceptions.DataUnavailableException:
            lines.append("⏳ Cost Explorer 데이터 수집 중")
            return "\n".join(lines)
        except Exception:
            net_amount = 0.0

        # Credit applied = gross - net
        credit_applied = gross_amount - net_amount

        lines.append(f"💰 **이번 달 사용량**: {gross_amount:.2f} {unit}")
        if credit_applied > 0:
            lines.append(f"🎫 **크레딧 적용**: -{credit_applied:.2f} {unit}")
        net_display = 0.0 if net_amount <= 0 else net_amount
        lines.append(f"💵 **실 청구액**: {net_display:.2f} {unit}")

        # Remaining credit balance
        credit_total = os.environ.get("AWS_CREDIT_TOTAL", "")
        if credit_total:
            try:
                total_credit = float(credit_total)
                # Query last 12 months (CE max range for MONTHLY)
                twelve_months_ago = (NOW - timedelta(days=365)).replace(day=1).strftime("%Y-%m-%d")
                all_credits_resp = ce.get_cost_and_usage(
                    TimePeriod={"Start": twelve_months_ago, "End": TOMORROW},
                    Granularity="MONTHLY",
                    Metrics=["UnblendedCost"],
                    Filter={"Dimensions": {"Key": "RECORD_TYPE", "Values": ["Credit"]}},
                )
                total_used = sum(
                    abs(float(r["Total"]["UnblendedCost"]["Amount"]))
                    for r in all_credits_resp["ResultsByTime"]
                )
                remaining = total_credit - total_used
                lines.append(f"🎟️ **잔여 크레딧**: {remaining:.2f} / {total_credit:.2f} {unit}")
            except Exception as e:
                lines.append(f"🎟️ **잔여 크레딧**: 조회 실패")

        # Budget check
        try:
            account_id = boto3.client("sts").get_caller_identity()["Account"]
            budgets_resp = boto3.client("budgets").describe_budgets(AccountId=account_id)
            for b in budgets_resp.get("Budgets", []):
                limit = float(b["BudgetLimit"]["Amount"])
                spent = float(b.get("CalculatedSpend", {}).get("ActualSpend", {}).get("Amount", "0"))
                b_unit = b["BudgetLimit"]["Unit"]
                pct = (spent / limit * 100) if limit > 0 else 0
                lines.append(f"📊 **예산**: {spent:.2f} / {limit:.2f} {b_unit} ({pct:.0f}%)")
        except Exception:
            pass

        return "\n".join(lines) if lines else "ℹ️ 데이터 없음"
    except ImportError:
        return "⚠️ boto3 미설치"
    except Exception as e:
        return f"⚠️ AWS 조회 실패: {e}"


# ── GCP ──────────────────────────────────────────────────────────────────
def get_gcp_info() -> str:
    try:
        from google.auth.transport.requests import Request as GRequest
        from google.oauth2 import service_account

        lines = []
        sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        project_id = os.environ.get("GCP_PROJECT_ID", "sydk-ktcloud")
        billing_account = os.environ.get("GCP_BILLING_ACCOUNT", "01B26E-30705E-19E209")

        scopes = ["https://www.googleapis.com/auth/cloud-billing.readonly",
                   "https://www.googleapis.com/auth/cloud-platform"]

        if sa_path and os.path.exists(sa_path):
            creds = service_account.Credentials.from_service_account_file(sa_path, scopes=scopes)
        else:
            import google.auth
            creds, _ = google.auth.default(scopes=scopes)

        creds.refresh(GRequest())
        token = creds.token

        # Billing account info
        headers = {"Authorization": f"Bearer {token}"}
        req = Request(
            f"https://cloudbilling.googleapis.com/v1/billingAccounts/{billing_account}",
            headers=headers,
        )
        resp = json.loads(urlopen(req).read())
        acct_currency = resp.get("currencyCode", "KRW")

        # Monthly cost via BigQuery billing export
        bq_table = os.environ.get("GCP_BILLING_BQ_TABLE", "")
        if bq_table:
            try:
                from google.cloud import bigquery
                bq_client = bigquery.Client(project=project_id, credentials=creds)
                month_str = NOW.strftime("%Y%m")
                query = f"""
                    SELECT
                        SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS net_cost,
                        SUM(cost) AS gross_cost,
                        SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS credit_amount,
                        currency
                    FROM `{bq_table}`
                    WHERE invoice.month = '{month_str}'
                    GROUP BY currency
                """
                result = bq_client.query(query).result()
                for row in result:
                    gross = row.gross_cost or 0
                    credit = row.credit_amount or 0
                    net = row.net_cost or 0
                    cur = row.currency or acct_currency
                    lines.append(f"💰 **이번 달 사용량**: {gross:.0f} {cur}")
                    if credit < 0:
                        lines.append(f"🎫 **크레딧 적용**: {credit:.0f} {cur}")
                    net_display = 0 if net <= 0 else net
                    lines.append(f"💵 **실 청구액**: {net_display:.0f} {cur}")
            except Exception as e:
                lines.append(f"💰 BigQuery 조회 실패: {str(e)[:80]}")
        else:
            lines.append("💰 **비용 조회**: BigQuery 익스포트 테이블 미설정 (GCP_BILLING_BQ_TABLE)")

        # Budget info (requires roles/billing.costsManager)
        try:
            budget_url = (
                f"https://billingbudgets.googleapis.com/v1/"
                f"billingAccounts/{billing_account}/budgets"
            )
            budget_req = Request(budget_url, headers=headers)
            budget_resp = json.loads(urlopen(budget_req).read())
            for b in budget_resp.get("budgets", []):
                display = b.get("displayName", "예산")
                amount = b.get("amount", {}).get("specifiedAmount", {})
                budget_units = amount.get("units", "N/A")
                budget_currency = amount.get("currencyCode", acct_currency)
                lines.append(f"📊 **{display}**: {budget_units} {budget_currency}")
        except Exception:
            pass

        return "\n".join(lines) if lines else "ℹ️ 데이터 없음"
    except ImportError as e:
        return f"⚠️ GCP 라이브러리 미설치: {e}"
    except Exception as e:
        return f"⚠️ GCP 조회 실패: {e}"


# ── Azure ────────────────────────────────────────────────────────────────
def get_azure_info() -> str:
    try:
        from azure.identity import DefaultAzureCredential
        from azure.mgmt.consumption import ConsumptionManagementClient
        from azure.mgmt.costmanagement import CostManagementClient

        lines = []
        subscription_id = os.environ.get("AZURE_SUBSCRIPTION_ID", "")
        if not subscription_id:
            return "⚠️ AZURE_SUBSCRIPTION_ID 미설정"

        credential = DefaultAzureCredential()
        # Verify credentials early
        try:
            token_resp = credential.get_token("https://management.azure.com/.default")
        except Exception:
            return "⚠️ Azure 인증 실패 (TENANT_ID/CLIENT_ID/CLIENT_SECRET 확인 필요)"

        scope = f"/subscriptions/{subscription_id}"
        cost_client = CostManagementClient(credential)

        # Monthly cost
        try:
            result = cost_client.query.usage(
                scope=scope,
                parameters={
                    "type": "ActualCost",
                    "timeframe": "MonthToDate",
                    "dataset": {
                        "granularity": "None",
                        "aggregation": {
                            "totalCost": {"name": "Cost", "function": "Sum"},
                            "totalCostUSD": {"name": "CostUSD", "function": "Sum"},
                        },
                    },
                },
            )
            if result.rows:
                total = result.rows[0][0]
                currency_idx = next(
                    (i for i, c in enumerate(result.columns) if c.name == "Currency"), -1
                )
                currency = result.rows[0][currency_idx] if currency_idx >= 0 else "USD"
                lines.append(f"💰 **이번 달 사용량**: {total:.2f} {currency}")
        except Exception as e:
            lines.append(f"💰 비용 조회 실패: {str(e)[:80]}")

        # Remaining credit (Free Trial / Sponsorship)
        try:
            headers = {"Authorization": f"Bearer {token_resp.token}"}
            sub_url = f"https://management.azure.com/subscriptions/{subscription_id}?api-version=2022-12-01"
            sub_req = Request(sub_url, headers=headers)
            sub_resp = json.loads(urlopen(sub_req).read())
            quota_id = sub_resp.get("subscriptionPolicies", {}).get("quotaId", "")
            promotions = sub_resp.get("promotions", [])

            # Detect free trial credit total (default $200 USD)
            credit_total_usd = float(os.environ.get("AZURE_CREDIT_TOTAL", "200"))

            if "FreeTrial" in quota_id or any(p.get("category") == "freetier" for p in promotions):
                # Query total cost in USD (max 364 days, Azure 1-year limit)
                from datetime import timezone as tz
                cost_start = NOW - timedelta(days=364)
                total_result = cost_client.query.usage(
                    scope=scope,
                    parameters={
                        "type": "ActualCost",
                        "timeframe": "Custom",
                        "timePeriod": {
                            "from": cost_start.astimezone(tz.utc),
                            "to": NOW.astimezone(tz.utc),
                        },
                        "dataset": {
                            "granularity": "None",
                            "aggregation": {
                                "totalCostUSD": {"name": "CostUSD", "function": "Sum"},
                            },
                        },
                    },
                )
                total_used_usd = 0.0
                if total_result.rows:
                    usd_idx = next(
                        (i for i, c in enumerate(total_result.columns) if c.name == "CostUSD"), 0
                    )
                    total_used_usd = total_result.rows[0][usd_idx]

                remaining = credit_total_usd - total_used_usd
                lines.append(f"🎟️ **잔여 크레딧**: {remaining:.2f} / {credit_total_usd:.2f} USD")

                # Expiry date
                for p in promotions:
                    if p.get("category") == "freetier" and p.get("endDateTime"):
                        expiry = p["endDateTime"][:10]
                        lines.append(f"📅 **크레딧 만료**: {expiry}")
                        break
        except Exception:
            pass

        # Budget check
        try:
            consumption = ConsumptionManagementClient(credential, subscription_id)
            for b in consumption.budgets.list(scope=scope):
                name = b.name
                limit_amount = b.amount
                current = b.current_spend.amount if b.current_spend else 0
                b_unit = b.current_spend.unit if b.current_spend else "USD"
                pct = (current / limit_amount * 100) if limit_amount > 0 else 0
                lines.append(f"📊 **{name}**: {current:.2f} / {limit_amount:.2f} {b_unit} ({pct:.0f}%)")
        except Exception:
            pass

        return "\n".join(lines) if lines else "ℹ️ 데이터 없음"
    except ImportError:
        return "⚠️ Azure SDK 미설치"
    except Exception as e:
        return f"⚠️ Azure 인증 실패 (크레덴셜 확인 필요)"


# ── Discord ──────────────────────────────────────────────────────────────
def send_discord(aws: str, gcp: str, azure: str) -> bool:
    # Discord embed field value max 1024 chars
    def trim(s: str, limit: int = 1024) -> str:
        return s[:limit] if s else "N/A"

    payload = json.dumps({
        "embeds": [{
            "title": "☁️ 클라우드 크레딧 & 비용 리포트",
            "description": f"**{TIMESTAMP}** 기준 현황",
            "color": 3447003,
            "fields": [
                {"name": "🟠 AWS", "value": trim(aws), "inline": False},
                {"name": "🔵 GCP", "value": trim(gcp), "inline": False},
                {"name": "🟣 Azure", "value": trim(azure), "inline": False},
            ],
            "footer": {"text": "k8s-idp cloud-credit-monitor | 1시간 간격"},
        }],
    }).encode()

    req = Request(
        DISCORD_WEBHOOK,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "CloudCreditMonitor/1.0"},
        method="POST",
    )
    try:
        resp = urlopen(req)
        print(f"✅ Discord 전송 성공 (HTTP {resp.status})")
        return True
    except URLError as e:
        print(f"❌ Discord 전송 실패: {e}")
        return False


# ── Main ─────────────────────────────────────────────────────────────────
def main():
    print(f"=== Cloud Credit Monitor - {TIMESTAMP} ===")

    print("☁️ AWS 조회 중...")
    aws = get_aws_info()
    print(f"  → {aws[:80]}")

    print("☁️ GCP 조회 중...")
    gcp = get_gcp_info()
    print(f"  → {gcp[:80]}")

    print("☁️ Azure 조회 중...")
    azure = get_azure_info()
    print(f"  → {azure[:80]}")

    ok = send_discord(aws, gcp, azure)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
