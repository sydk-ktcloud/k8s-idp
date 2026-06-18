# AWS DR 인프라

온프레미스 클러스터 **완전장애** 시에도 EKS에서 핵심 서비스를 복구하기 위한 AWS 인프라 코드.

> **핵심 설계:** 프로비저닝 주체(GitHub Actions + OIDC + eksctl)를 on-prem 밖에 둔다.
> 따라서 on-prem이 100% 죽어도 DR을 띄울 수 있다. (과거 Crossplane/self-hosted runner
> 기반은 on-prem과 함께 죽는 순환 의존성이 있어 폐기)

## 구성 요소

| 파일 | 도구 | 내용 |
|------|------|------|
| `cloudformation-oidc-role.yaml` | CloudFormation | GitHub OIDC provider + eksctl 권한 IAM Role + Velero IRSA 정책 |
| `eksctl-cluster.yaml` | eksctl | EKS DR 클러스터 + Spot Nodegroup (IRSA/EBS CSI 포함) |
| `cloudformation-heartbeat.yaml` | CloudFormation | S3 버킷, Lambda, EventBridge, IAM (장애 감지 + DR 자동 트리거) |

DR 활성화 자체는 `.github/workflows/dr-activate.yaml`(ubuntu-latest) → `scripts/dr-activate.sh`가
자동 수행한다. 아래는 **1회 사전 준비** 절차다.

## 배포 순서 (1회 사전 준비)

### 1. OIDC + IAM Role

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws-dr/cloudformation-oidc-role.yaml \
  --stack-name k8s-idp-dr-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-west-2 \
  --parameter-overrides GitHubRepo=sydk-ktcloud/k8s-idp

# 출력 DRProvisionRoleArn → GitHub repo secret  AWS_DR_ROLE_ARN  로 등록
```

> 계정에 GitHub OIDC provider가 이미 있으면
> `--parameter-overrides CreateOIDCProvider=false ExistingOIDCProviderArn=<arn>` 추가.

### 2. Heartbeat 모니터링

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws-dr/cloudformation-heartbeat.yaml \
  --stack-name k8s-idp-heartbeat \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-west-2 \
  --parameter-overrides DiscordWebhookUrl=<YOUR_DISCORD_WEBHOOK_URL> GitHubToken=<PAT>
```

### 3. EKS 클러스터 / Velero

> 평시에는 만들지 않는다(비용 $0). DR 활성화 시 `dr-activate.sh`가
> `eksctl create cluster` + IRSA 기반 Velero(helm, static key 없음)를 자동 설치한다.
> 사전 검증이 필요하면 수동으로 한 번 띄워보고 `eksctl delete cluster`로 정리한다.

### 4. 온프레미스 CronJob/Secret 적용

```bash
# AWS 자격증명 Secret (온프레미스 클러스터)
kubectl create secret generic aws-replicator-credentials -n minio-storage \
  --from-literal=aws-access-key=<AWS_ACCESS_KEY_ID> \
  --from-literal=aws-secret-key=<AWS_SECRET_ACCESS_KEY>

# Heartbeat + S3 복제 CronJob
kubectl apply -f kubernetes/storage/heartbeat-cronjob.yaml
kubectl apply -f kubernetes/storage/minio-s3-replication.yaml
```

## 삭제

```bash
# Heartbeat 인프라
aws cloudformation delete-stack --stack-name k8s-idp-heartbeat --region us-west-2

# EKS 클러스터
eksctl delete cluster -f infrastructure/aws-dr/eksctl-cluster.yaml
```
