# AWS DR 인프라

온프레미스 클러스터 장애 시 EKS에서 핵심 서비스를 복구하기 위한 AWS 인프라 코드.

## 구성 요소

| 파일 | 도구 | 내용 |
|------|------|------|
| `eksctl-cluster.yaml` | eksctl | EKS DR 클러스터 + Spot Nodegroup |
| `cloudformation-heartbeat.yaml` | CloudFormation | S3 버킷, Lambda, EventBridge, IAM |

## 배포 순서

### 1. EKS 클러스터

```bash
eksctl create cluster -f infrastructure/aws-dr/eksctl-cluster.yaml
```

### 2. Heartbeat 모니터링

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws-dr/cloudformation-heartbeat.yaml \
  --stack-name k8s-idp-heartbeat \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-west-2 \
  --parameter-overrides DiscordWebhookUrl=<YOUR_DISCORD_WEBHOOK_URL>
```

### 3. Velero 설치 (EKS)

```bash
aws eks update-kubeconfig --name k8s-idp-dr --region us-west-2 --alias eks-dr

velero install \
  --provider aws \
  --bucket sydk-velero-dr-usw2 \
  --secret-file ./velero-credentials \
  --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --backup-location-config region=us-west-2 \
  --kubecontext eks-dr
```

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
