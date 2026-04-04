#!/usr/bin/env python3
"""Cloud Credit & Cost Monitor - Discord Webhook Alert

Queries AWS, GCP, Azure billing APIs and sends a summary to Discord every hour.
Designed to run as a K8s CronJob.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

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

        # Monthly cost
        try:
            resp = ce.get_cost_and_usage(
                TimePeriod={"Start": MONTH_START, "End": TOMORROW},
                Granularity="MONTHLY",
                Metrics=["UnblendedCost"],
            )
            total = resp["ResultsByTime"][0]["Total"]["UnblendedCost"]
            amount, unit = total["Amount"], total["Unit"]
            lines.append(f"💰 **이번 달 사용량**: {float(amount):.2f} {unit}")
        except ce.exceptions.DataUnavailableException:
            lines.append("⏳ Cost Explorer 데이터 수집 중 (활성화 후 최대 24시간 소요)")

        # Credit usage
        try:
            credit_resp = ce.get_cost_and_usage(
                TimePeriod={"Start": MONTH_START, "End": TOMORROW},
                Granularity="MONTHLY",
                Metrics=["UnblendedCost"],
                Filter={"Dimensions": {"Key": "RECORD_TYPE", "Values": ["Credit"]}},
            )
            credit_amt = credit_resp["ResultsByTime"][0]["Total"]["UnblendedCost"]["Amount"]
            if float(credit_amt) != 0:
                lines.append(f"🎫 **크레딧 적용**: {float(credit_amt):.2f} {unit}")
        except Exception:
            pass

        # Budget check
        try:
            account_id = boto3.client("sts").get_caller_identity()["Account"]
            budgets_resp = boto3.client("budgets").describe_budgets(AccountId=account_id)
            for b in budgets_resp.get("Budgets", []):
                limit = b["BudgetLimit"]["Amount"]
                spent = b.get("CalculatedSpend", {}).get("ActualSpend", {}).get("Amount", "0")
                lines.append(f"📊 **예산**: {spent}/{limit} {b['BudgetLimit']['Unit']}")
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
        lines.append(f"✅ **결제 계정**: {resp.get('displayName', billing_account)}")

        # Project billing info
        req2 = Request(
            f"https://cloudbilling.googleapis.com/v1/projects/{project_id}/billingInfo",
            headers=headers,
        )
        resp2 = json.loads(urlopen(req2).read())
        enabled = resp2.get("billingEnabled", False)
        lines.append(f"📋 **프로젝트**: {project_id} (결제: {'활성' if enabled else '비활성'})")

        # Budget info
        try:
            req3 = Request(
                f"https://billingbudgets.googleapis.com/v1/billingAccounts/{billing_account}/budgets",
                headers=headers,
            )
            budgets = json.loads(urlopen(req3).read())
            for b in budgets.get("budgets", []):
                display = b.get("displayName", "예산")
                amount = b.get("amount", {}).get("specifiedAmount", {})
                units = amount.get("units", "N/A")
                currency = amount.get("currencyCode", "KRW")
                lines.append(f"📊 **{display}**: {units} {currency}")
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

        # Monthly cost
        try:
            cost_client = CostManagementClient(credential)
            scope = f"/subscriptions/{subscription_id}"
            result = cost_client.query.usage(
                scope=scope,
                parameters={
                    "type": "ActualCost",
                    "timeframe": "MonthToDate",
                    "dataset": {
                        "granularity": "None",
                        "aggregation": {
                            "totalCost": {"name": "Cost", "function": "Sum"},
                        },
                    },
                },
            )
            if result.rows:
                total = result.rows[0][0]
                currency = result.columns[1].name if len(result.columns) > 1 else "KRW"
                lines.append(f"💰 **이번 달 사용량**: {total:.2f} {currency}")
        except Exception as e:
            lines.append(f"💰 비용 조회 실패: {e}")

        # Budget check
        try:
            consumption = ConsumptionManagementClient(credential, subscription_id)
            for b in consumption.budgets.list(scope=f"/subscriptions/{subscription_id}"):
                name = b.name
                limit_amount = b.amount
                current = b.current_spend.amount if b.current_spend else 0
                unit = b.current_spend.unit if b.current_spend else "KRW"
                lines.append(f"📊 **{name}**: {current:.2f}/{limit_amount:.2f} {unit}")
        except Exception:
            pass

        return "\n".join(lines) if lines else "ℹ️ 데이터 없음"
    except ImportError:
        return "⚠️ Azure SDK 미설치"
    except Exception as e:
        return f"⚠️ Azure 조회 실패: {e}"


# ── Discord ──────────────────────────────────────────────────────────────
def send_discord(aws: str, gcp: str, azure: str) -> bool:
    payload = json.dumps({
        "embeds": [{
            "title": "☁️ 클라우드 크레딧 & 비용 리포트",
            "description": f"**{TIMESTAMP}** 기준 현황",
            "color": 3447003,
            "fields": [
                {"name": "🟠 AWS", "value": aws or "N/A", "inline": False},
                {"name": "🔵 GCP", "value": gcp or "N/A", "inline": False},
                {"name": "🟣 Azure", "value": azure or "N/A", "inline": False},
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
