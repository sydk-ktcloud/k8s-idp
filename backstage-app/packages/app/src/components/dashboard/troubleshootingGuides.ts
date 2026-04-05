export type ErrorCategory =
  | 'QUOTA_EXCEEDED'
  | 'PERMISSION_DENIED'
  | 'BILLING_DISABLED'
  | 'API_NOT_ENABLED'
  | 'TIMEOUT'
  | 'INVALID_CONFIG'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export type CloudProvider = 'GCP' | 'AWS' | 'Azure';

export interface TroubleshootingStep {
  title: string;
  description: string;
  code?: string;
  note?: string;
}

export interface TroubleshootingAction {
  label: string;
  url: string;
  variant: 'primary' | 'secondary' | 'contact';
}

export interface TroubleshootingGuide {
  category: ErrorCategory;
  title: string;
  summary: string;
  cause: string;
  steps: TroubleshootingStep[];
  actions: TroubleshootingAction[];
}

// ─── 공통 액션 ──────────────────────────────────────────────
const DISCORD_CONTACT: TroubleshootingAction = {
  label: '인프라 담당자에게 Discord 문의',
  url: '/dashboard',
  variant: 'contact',
};

// ─── GCP 가이드 ─────────────────────────────────────────────
const GCP_GUIDES: Record<ErrorCategory, TroubleshootingGuide> = {
  QUOTA_EXCEEDED: {
    category: 'QUOTA_EXCEEDED',
    title: 'GCP 리소스 쿼터 초과',
    summary: 'GCP 프로젝트의 리소스 한도에 도달하여 새 리소스를 생성할 수 없습니다.',
    cause:
      'Google Cloud는 프로젝트별로 VM 인스턴스 수, vCPU 수, 디스크 용량, IP 주소 등에 제한을 둡니다. ' +
      '현재 프로젝트가 해당 한도에 도달했습니다.',
    steps: [
      {
        title: '1단계 – 현재 쿼터 사용량 확인',
        description: 'Google Cloud Console → IAM 및 관리자 → 할당량 메뉴에서 현재 사용량을 확인합니다.',
        code: 'gcloud compute regions describe us-central1 \\\n  --format="table(quotas.metric,quotas.usage,quotas.limit)"',
        note: '쿼터 유형(CPUS, INSTANCES, DISKS_TOTAL_GB 등)을 구분하여 어느 항목이 초과되었는지 파악하세요.',
      },
      {
        title: '2단계 – 사용하지 않는 리소스 정리',
        description:
          '프로비저닝 현황 대시보드에서 오래된 리소스를 삭제하여 공간을 확보합니다. ' +
          'Crossplane Claim을 삭제하면 연결된 GCP 리소스도 자동으로 삭제됩니다.',
        code: 'kubectl delete gcpinstance my-old-server -n default',
        note: '삭제 전 팀원에게 해당 리소스가 사용 중인지 반드시 확인하세요.',
      },
      {
        title: '3단계 – 쿼터 증설 요청 (선택)',
        description: 'Google Cloud Console에서 쿼터 증설을 신청합니다. 보통 1~2 영업일 이내 처리됩니다.',
        note: '쿼터 증설은 비용과 직결될 수 있으므로 인프라 담당자와 협의 후 진행하세요.',
      },
    ],
    actions: [
      { label: '불필요한 리소스 목록 보기', url: '/dashboard', variant: 'primary' },
      { label: 'GCP 할당량 페이지', url: 'https://console.cloud.google.com/iam-admin/quotas', variant: 'secondary' },
      DISCORD_CONTACT,
    ],
  },

  PERMISSION_DENIED: {
    category: 'PERMISSION_DENIED',
    title: 'GCP IAM 권한 부족',
    summary: 'Crossplane 서비스 계정에 이 리소스를 생성할 권한이 없습니다.',
    cause:
      'Crossplane이 GCP 리소스를 관리하려면 적절한 IAM 역할이 부여된 서비스 계정이 필요합니다. ' +
      '해당 리소스 유형에 대한 권한(예: compute.instances.create)이 누락되었을 가능성이 높습니다.',
    steps: [
      {
        title: '1단계 – 현재 서비스 계정 권한 확인',
        description: 'Crossplane이 사용하는 GCP 서비스 계정과 그 IAM 역할을 확인합니다.',
        code:
          'kubectl get providerconfig.gcp.upbound.io -o yaml\n\n' +
          'gcloud projects get-iam-policy YOUR_PROJECT_ID \\\n' +
          '  --flatten="bindings[].members" \\\n' +
          '  --filter="bindings.members:crossplane@*"',
      },
      {
        title: '2단계 – 필요한 IAM 역할 추가',
        description: '생성하려는 리소스에 따라 필요한 IAM 역할을 서비스 계정에 추가합니다.',
        code:
          '# VM: roles/compute.admin\n# Cloud SQL: roles/cloudsql.admin\n# GKE: roles/container.admin\n\n' +
          'gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \\\n' +
          '  --member="serviceAccount:crossplane@YOUR_PROJECT_ID.iam.gserviceaccount.com" \\\n' +
          '  --role="roles/compute.admin"',
        note: '최소 권한 원칙에 따라 필요한 역할만 부여하세요.',
      },
      {
        title: '3단계 – Crossplane Provider 재시작',
        description: '권한 추가 후 Provider를 재시작합니다.',
        code: 'kubectl rollout restart deployment -n crossplane-system -l pkg.crossplane.io/revision',
      },
    ],
    actions: [
      { label: 'GCP IAM 권한 관리', url: 'https://console.cloud.google.com/iam-admin/iam', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  BILLING_DISABLED: {
    category: 'BILLING_DISABLED',
    title: 'GCP 결제 계정 비활성화',
    summary: 'GCP 프로젝트에 결제 계정이 연결되지 않았거나 비활성화 상태입니다.',
    cause: '결제 계정이 없거나 정지된 경우 모든 리소스 생성이 차단됩니다.',
    steps: [
      {
        title: '1단계 – 결제 계정 상태 확인',
        description: 'Google Cloud Console → 결제 메뉴에서 결제 계정 연결 상태를 확인합니다.',
        code: 'gcloud billing projects describe YOUR_PROJECT_ID',
      },
      {
        title: '2단계 – 결제 계정 연결',
        description: '결제 관리자(roles/billing.admin) 권한으로 결제 계정을 연결합니다.',
        note: '조직 정책에 따라 제한될 수 있습니다. 인프라 담당자에게 문의하세요.',
      },
    ],
    actions: [
      { label: 'GCP 결제 설정', url: 'https://console.cloud.google.com/billing', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  API_NOT_ENABLED: {
    category: 'API_NOT_ENABLED',
    title: 'GCP API 미활성화',
    summary: '이 리소스를 생성하는 데 필요한 Google Cloud API가 활성화되지 않았습니다.',
    cause: '리소스 유형마다 대응되는 API가 있으며, 해당 API를 프로젝트에서 먼저 활성화해야 합니다.',
    steps: [
      {
        title: '1단계 – 필요한 API 식별 및 활성화',
        description: '에러 메시지에서 활성화해야 할 API를 확인하고 활성화합니다.',
        code:
          '# VM → compute.googleapis.com\n# Cloud SQL → sqladmin.googleapis.com\n# GKE → container.googleapis.com\n\n' +
          'gcloud services enable compute.googleapis.com',
      },
      {
        title: '2단계 – 프로비저닝 재시도',
        description: 'API 활성화 후 Crossplane이 자동으로 재시도합니다. 1~2분 후 대시보드를 새로고침하세요.',
      },
    ],
    actions: [
      { label: 'GCP API 라이브러리', url: 'https://console.cloud.google.com/apis/library', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  TIMEOUT: {
    category: 'TIMEOUT',
    title: '프로비저닝 시간 초과',
    summary: '리소스 프로비저닝이 예상보다 오래 걸려 타임아웃이 발생했습니다.',
    cause: 'GKE 클러스터나 Cloud SQL 고가용성 인스턴스의 경우 최대 15~20분이 걸릴 수 있습니다.',
    steps: [
      {
        title: '1단계 – GCP Console에서 실제 상태 확인',
        description: 'GCP Console에서 리소스가 실제로 생성되고 있는지 직접 확인합니다.',
        code: 'kubectl describe gcpinstance RESOURCE_NAME -n default',
      },
      {
        title: '2단계 – Crossplane 재동기화',
        description: 'Provider를 재시작하면 모든 리소스 상태를 즉시 재확인합니다.',
        code: 'kubectl rollout restart deployment -n crossplane-system -l pkg.crossplane.io/revision',
      },
    ],
    actions: [
      { label: 'GCP Console에서 확인', url: 'https://console.cloud.google.com', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  INVALID_CONFIG: {
    category: 'INVALID_CONFIG',
    title: '잘못된 리소스 설정값',
    summary: '입력한 설정값(머신 타입, 리전, 디스크 크기 등)이 GCP에서 허용되지 않습니다.',
    cause: '선택한 머신 타입이 해당 리전에서 지원되지 않거나 리소스 이름 형식이 맞지 않을 수 있습니다.',
    steps: [
      {
        title: '1단계 – 에러 메시지 상세 확인',
        description: '정확한 에러 원인을 확인합니다.',
        code: 'kubectl describe gcpinstance RESOURCE_NAME -n default',
      },
      {
        title: '2단계 – 올바른 값으로 재생성',
        description: '기존 Claim을 삭제 후 /create 페이지에서 올바른 설정값으로 다시 생성합니다.',
        code: 'kubectl delete gcpinstance RESOURCE_NAME -n default',
      },
    ],
    actions: [
      { label: '새 리소스 생성하기', url: '/create', variant: 'primary' },
      { label: 'GCP 머신 타입 목록', url: 'https://cloud.google.com/compute/docs/machine-resource', variant: 'secondary' },
      DISCORD_CONTACT,
    ],
  },

  NETWORK_ERROR: {
    category: 'NETWORK_ERROR',
    title: 'GCP 네트워크/VPC 설정 오류',
    summary: '리소스가 사용할 VPC 네트워크 설정에 문제가 있습니다.',
    cause: '지정한 네트워크나 서브넷이 존재하지 않거나, 방화벽 규칙이 누락되었을 수 있습니다.',
    steps: [
      {
        title: '1단계 – VPC 네트워크 상태 확인',
        description: 'default VPC 네트워크가 존재하는지 확인합니다.',
        code: 'gcloud compute networks list\ngcloud compute networks subnets list --network=default',
      },
      {
        title: '2단계 – default VPC 생성 (필요한 경우)',
        description: 'default VPC가 삭제된 경우 재생성합니다.',
        code: 'gcloud compute networks create default --subnet-mode=auto',
      },
    ],
    actions: [
      { label: 'GCP VPC 네트워크 설정', url: 'https://console.cloud.google.com/networking/networks/list', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  UNKNOWN: {
    category: 'UNKNOWN',
    title: '알 수 없는 오류',
    summary: '예상치 못한 오류가 발생했습니다.',
    cause: 'Crossplane 또는 GCP에서 반환한 에러 메시지를 자동으로 분류하지 못했습니다. 아래 방법으로 직접 원인을 파악하거나 인프라 담당자에게 문의하세요.',
    steps: [
      {
        title: '1단계 – Crossplane 이벤트 로그 확인',
        description: '리소스의 상세 에러 메시지를 확인합니다.',
        code:
          'kubectl describe gcpinstance RESOURCE_NAME -n default\n\n' +
          'kubectl logs -n crossplane-system -l pkg.crossplane.io/revision --tail=100 | grep -i error',
      },
      {
        title: '2단계 – GCP Cloud Logging 확인',
        description: 'GCP Console의 Cloud Logging에서 관련 오퍼레이션 로그를 확인합니다.',
        code: 'gcloud logging read "severity=ERROR AND timestamp>\\"-1h\\"" --limit=20 --format=json',
      },
    ],
    actions: [
      { label: 'GCP Cloud Logging', url: 'https://console.cloud.google.com/logs', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },
};

// ─── AWS 가이드 ─────────────────────────────────────────────
const AWS_GUIDES: Record<ErrorCategory, TroubleshootingGuide> = {
  QUOTA_EXCEEDED: {
    category: 'QUOTA_EXCEEDED',
    title: 'AWS 서비스 쿼터 초과',
    summary: 'AWS 계정의 서비스 한도에 도달하여 새 리소스를 생성할 수 없습니다.',
    cause:
      'AWS는 계정·리전별로 EC2 인스턴스 수, vCPU 수, EBS 볼륨 등에 제한을 둡니다. ' +
      '현재 계정이 해당 한도에 도달했습니다.',
    steps: [
      {
        title: '1단계 – 현재 쿼터 사용량 확인',
        description: 'AWS Console → Service Quotas에서 현재 사용량을 확인합니다.',
        code: 'aws service-quotas list-service-quotas \\\n  --service-code ec2 \\\n  --query "Quotas[?UsageMetric].[QuotaName,Value]" \\\n  --output table',
        note: 'EC2 vCPU 제한은 인스턴스 패밀리별로 다릅니다.',
      },
      {
        title: '2단계 – 사용하지 않는 리소스 정리',
        description: '대시보드에서 오래된 리소스를 삭제하여 공간을 확보합니다.',
        code: 'kubectl delete ec2instance my-old-server -n default',
      },
      {
        title: '3단계 – 쿼터 증설 요청 (선택)',
        description: 'AWS Console → Service Quotas에서 한도 증설을 요청합니다.',
        note: '일부 쿼터는 자동 승인되며, 일부는 AWS Support 검토가 필요합니다.',
      },
    ],
    actions: [
      { label: '불필요한 리소스 목록 보기', url: '/dashboard', variant: 'primary' },
      { label: 'AWS Service Quotas', url: 'https://console.aws.amazon.com/servicequotas', variant: 'secondary' },
      DISCORD_CONTACT,
    ],
  },

  PERMISSION_DENIED: {
    category: 'PERMISSION_DENIED',
    title: 'AWS IAM 권한 부족',
    summary: 'Crossplane IAM 사용자/역할에 이 리소스를 생성할 권한이 없습니다.',
    cause:
      'Crossplane이 AWS 리소스를 관리하려면 적절한 IAM 정책이 필요합니다. ' +
      '해당 리소스에 대한 Action(예: ec2:RunInstances)이 누락되었을 가능성이 높습니다.',
    steps: [
      {
        title: '1단계 – Crossplane IAM 정책 확인',
        description: 'Crossplane이 사용하는 IAM 사용자/역할의 정책을 확인합니다.',
        code:
          'kubectl get providerconfig.aws.upbound.io -o yaml\n\n' +
          'aws iam list-attached-user-policies --user-name crossplane-user',
      },
      {
        title: '2단계 – 필요한 IAM 정책 추가',
        description: '리소스 유형에 따라 필요한 정책을 추가합니다.',
        code:
          '# EC2: AmazonEC2FullAccess\n# S3: AmazonS3FullAccess\n# EKS: AmazonEKSClusterPolicy\n# RDS: AmazonRDSFullAccess\n\n' +
          'aws iam attach-user-policy \\\n  --user-name crossplane-user \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess',
        note: '최소 권한 원칙에 따라 필요한 정책만 부여하세요.',
      },
      {
        title: '3단계 – Crossplane Provider 재시작',
        description: '권한 추가 후 Provider를 재시작합니다.',
        code: 'kubectl rollout restart deployment -n crossplane-system -l pkg.crossplane.io/revision',
      },
    ],
    actions: [
      { label: 'AWS IAM Console', url: 'https://console.aws.amazon.com/iam', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  BILLING_DISABLED: {
    category: 'BILLING_DISABLED',
    title: 'AWS 계정 결제 문제',
    summary: 'AWS 계정이 일시 정지되었거나 결제 정보에 문제가 있습니다.',
    cause: 'AWS 계정의 결제 수단이 만료되었거나, 계정이 정지 상태일 수 있습니다.',
    steps: [
      {
        title: '1단계 – AWS 계정 상태 확인',
        description: 'AWS Console → Billing에서 결제 상태를 확인합니다.',
      },
      {
        title: '2단계 – 결제 수단 업데이트',
        description: '결제 수단이 만료된 경우 새로운 결제 수단을 등록합니다.',
        note: '계정 정지 해제는 AWS Support에 문의해야 할 수 있습니다.',
      },
    ],
    actions: [
      { label: 'AWS Billing', url: 'https://console.aws.amazon.com/billing', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  API_NOT_ENABLED: {
    category: 'API_NOT_ENABLED',
    title: 'AWS 서비스 미활성화',
    summary: '해당 리전에서 AWS 서비스가 사용 불가능하거나 서비스 이용 동의가 필요합니다.',
    cause: '일부 AWS 서비스는 특정 리전에서 사용할 수 없거나, 사전 이용 동의가 필요합니다.',
    steps: [
      {
        title: '1단계 – 리전별 서비스 가용성 확인',
        description: '선택한 리전에서 해당 서비스가 지원되는지 확인합니다.',
        code: 'aws ec2 describe-regions --output table',
      },
      {
        title: '2단계 – 다른 리전에서 재생성',
        description: '서비스가 지원되는 리전으로 변경하여 다시 생성합니다.',
      },
    ],
    actions: [
      { label: 'AWS 리전별 서비스 목록', url: 'https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  TIMEOUT: {
    category: 'TIMEOUT',
    title: '프로비저닝 시간 초과',
    summary: '리소스 프로비저닝이 예상보다 오래 걸려 타임아웃이 발생했습니다.',
    cause: 'EKS 클러스터는 최대 15~20분, RDS 멀티 AZ는 최대 30분이 소요될 수 있습니다.',
    steps: [
      {
        title: '1단계 – AWS Console에서 실제 상태 확인',
        description: 'AWS Console에서 리소스가 생성되고 있는지 직접 확인합니다.',
        code: 'kubectl describe ec2instance RESOURCE_NAME -n default',
      },
      {
        title: '2단계 – Crossplane 재동기화',
        description: 'Provider를 재시작하면 모든 리소스 상태를 재확인합니다.',
        code: 'kubectl rollout restart deployment -n crossplane-system -l pkg.crossplane.io/revision',
      },
    ],
    actions: [
      { label: 'AWS Console', url: 'https://console.aws.amazon.com', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  INVALID_CONFIG: {
    category: 'INVALID_CONFIG',
    title: '잘못된 리소스 설정값',
    summary: '입력한 설정값(인스턴스 타입, 리전 등)이 AWS에서 허용되지 않습니다.',
    cause: '선택한 인스턴스 타입이 해당 리전/AZ에서 지원되지 않거나 설정값이 유효하지 않을 수 있습니다.',
    steps: [
      {
        title: '1단계 – 에러 메시지 상세 확인',
        description: '정확한 에러 원인을 확인합니다.',
        code: 'kubectl describe ec2instance RESOURCE_NAME -n default',
      },
      {
        title: '2단계 – 올바른 값으로 재생성',
        description: '기존 Claim을 삭제 후 /create 페이지에서 올바른 설정값으로 다시 생성합니다.',
      },
    ],
    actions: [
      { label: '새 리소스 생성하기', url: '/create', variant: 'primary' },
      { label: 'AWS 인스턴스 타입 목록', url: 'https://aws.amazon.com/ec2/instance-types/', variant: 'secondary' },
      DISCORD_CONTACT,
    ],
  },

  NETWORK_ERROR: {
    category: 'NETWORK_ERROR',
    title: 'AWS VPC/네트워크 설정 오류',
    summary: '리소스가 사용할 VPC 네트워크 설정에 문제가 있습니다.',
    cause: '지정한 VPC, 서브넷, 보안 그룹이 존재하지 않거나 설정이 올바르지 않을 수 있습니다.',
    steps: [
      {
        title: '1단계 – VPC 상태 확인',
        description: 'default VPC가 존재하는지 확인합니다.',
        code: 'aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --output table',
      },
      {
        title: '2단계 – default VPC 생성 (필요한 경우)',
        description: 'default VPC가 삭제된 경우 재생성합니다.',
        code: 'aws ec2 create-default-vpc',
      },
    ],
    actions: [
      { label: 'AWS VPC Console', url: 'https://console.aws.amazon.com/vpc', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  UNKNOWN: {
    category: 'UNKNOWN',
    title: '알 수 없는 오류',
    summary: '예상치 못한 오류가 발생했습니다.',
    cause: 'Crossplane 또는 AWS에서 반환한 에러 메시지를 자동으로 분류하지 못했습니다. 아래 방법으로 직접 원인을 파악하거나 인프라 담당자에게 문의하세요.',
    steps: [
      {
        title: '1단계 – Crossplane 이벤트 로그 확인',
        description: '리소스의 상세 에러 메시지를 확인합니다.',
        code:
          'kubectl describe ec2instance RESOURCE_NAME -n default\n\n' +
          'kubectl logs -n crossplane-system -l pkg.crossplane.io/revision --tail=100 | grep -i error',
      },
      {
        title: '2단계 – AWS CloudTrail 로그 확인',
        description: 'AWS Console의 CloudTrail에서 API 호출 실패 이벤트를 확인합니다.',
        code: 'aws cloudtrail lookup-events \\\n  --lookup-attributes AttributeKey=EventName,AttributeValue=RunInstances \\\n  --max-results 10',
      },
    ],
    actions: [
      { label: 'AWS CloudTrail', url: 'https://console.aws.amazon.com/cloudtrail', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },
};

// ─── Azure 가이드 ───────────────────────────────────────────
const AZURE_GUIDES: Record<ErrorCategory, TroubleshootingGuide> = {
  QUOTA_EXCEEDED: {
    category: 'QUOTA_EXCEEDED',
    title: 'Azure 구독 쿼터 초과',
    summary: 'Azure 구독의 리소스 한도에 도달하여 새 리소스를 생성할 수 없습니다.',
    cause:
      'Azure는 구독·리전별로 VM 코어 수, 공용 IP 주소 수, 스토리지 계정 수 등에 제한을 둡니다. ' +
      '현재 구독이 해당 한도에 도달했습니다.',
    steps: [
      {
        title: '1단계 – 현재 쿼터 사용량 확인',
        description: 'Azure Portal → 구독 → 사용량 + 할당량에서 현재 사용량을 확인합니다.',
        code: 'az vm list-usage --location koreacentral --output table',
        note: 'VM 코어 쿼터는 VM 시리즈별(예: Standard BS Series)로 다릅니다.',
      },
      {
        title: '2단계 – 사용하지 않는 리소스 정리',
        description: '대시보드에서 오래된 리소스를 삭제하여 공간을 확보합니다.',
        code: 'kubectl delete azurevm my-old-server -n default',
      },
      {
        title: '3단계 – 쿼터 증설 요청 (선택)',
        description: 'Azure Portal → 도움말 + 지원 → 할당량 증가 요청을 통해 한도 증설을 신청합니다.',
        note: '학생/무료 구독은 쿼터 증설이 제한될 수 있습니다.',
      },
    ],
    actions: [
      { label: '불필요한 리소스 목록 보기', url: '/dashboard', variant: 'primary' },
      { label: 'Azure 할당량 페이지', url: 'https://portal.azure.com/#view/Microsoft_Azure_Capacity/QuotaMenuBlade', variant: 'secondary' },
      DISCORD_CONTACT,
    ],
  },

  PERMISSION_DENIED: {
    category: 'PERMISSION_DENIED',
    title: 'Azure RBAC 권한 부족',
    summary: 'Crossplane 서비스 주체에 이 리소스를 생성할 권한이 없습니다.',
    cause:
      'Crossplane이 Azure 리소스를 관리하려면 서비스 주체(Service Principal)에 적절한 RBAC 역할이 필요합니다. ' +
      '해당 리소스에 대한 권한(예: Microsoft.Compute/virtualMachines/write)이 누락되었을 가능성이 높습니다.',
    steps: [
      {
        title: '1단계 – 서비스 주체 역할 할당 확인',
        description: 'Crossplane이 사용하는 서비스 주체의 역할 할당을 확인합니다.',
        code:
          'kubectl get providerconfig.azure.upbound.io -o yaml\n\n' +
          'az role assignment list \\\n  --assignee <서비스주체-ID> \\\n  --output table',
      },
      {
        title: '2단계 – 필요한 역할 추가',
        description: '리소스 유형에 따라 필요한 역할을 서비스 주체에 추가합니다.',
        code:
          '# VM: Contributor 또는 Virtual Machine Contributor\n' +
          '# Storage: Storage Account Contributor\n' +
          '# AKS: Azure Kubernetes Service Contributor\n\n' +
          'az role assignment create \\\n  --assignee <서비스주체-ID> \\\n  --role "Contributor" \\\n  --scope /subscriptions/<구독-ID>',
        note: '최소 권한 원칙에 따라 필요한 역할만 부여하세요. 구독 수준 Contributor는 강력한 권한입니다.',
      },
      {
        title: '3단계 – Crossplane Provider 재시작',
        description: '권한 추가 후 Provider를 재시작합니다.',
        code: 'kubectl rollout restart deployment -n crossplane-system -l pkg.crossplane.io/revision',
      },
    ],
    actions: [
      { label: 'Azure 역할 할당 관리', url: 'https://portal.azure.com/#view/Microsoft_AAD_IAM/RolesManagementMenuBlade', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  BILLING_DISABLED: {
    category: 'BILLING_DISABLED',
    title: 'Azure 구독 비활성화',
    summary: 'Azure 구독이 비활성화되었거나 일시 정지 상태입니다.',
    cause:
      'Azure 구독이 만료되었거나, 지출 한도에 도달했거나, 관리자가 구독을 비활성화했을 수 있습니다. ' +
      '학생/무료 구독의 경우 크레딧 소진 시 자동으로 비활성화됩니다.',
    steps: [
      {
        title: '1단계 – 구독 상태 확인',
        description: 'Azure Portal → 구독에서 구독 상태를 확인합니다.',
        code: 'az account show --query "{name:name, state:state, id:id}" --output table',
      },
      {
        title: '2단계 – 구독 재활성화',
        description: '지출 한도 도달인 경우 한도를 제거하거나 결제 수단을 업데이트합니다.',
        note: '구독 재활성화 후 리소스 프로바이더가 다시 등록되기까지 몇 분이 소요될 수 있습니다.',
      },
    ],
    actions: [
      { label: 'Azure 구독 관리', url: 'https://portal.azure.com/#view/Microsoft_Azure_GTM/ModernBillingMenuBlade', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  API_NOT_ENABLED: {
    category: 'API_NOT_ENABLED',
    title: 'Azure 리소스 프로바이더 미등록',
    summary: '이 리소스를 생성하는 데 필요한 Azure 리소스 프로바이더가 구독에 등록되지 않았습니다.',
    cause:
      'Azure는 리소스 유형마다 대응하는 리소스 프로바이더(예: Microsoft.Compute, Microsoft.Network)가 있으며, ' +
      '구독에서 해당 프로바이더를 먼저 등록해야 리소스를 생성할 수 있습니다.',
    steps: [
      {
        title: '1단계 – 필요한 리소스 프로바이더 확인 및 등록',
        description: '에러 메시지에서 필요한 프로바이더를 확인하고 등록합니다.',
        code:
          '# VM → Microsoft.Compute, Microsoft.Network\n' +
          '# Storage → Microsoft.Storage\n' +
          '# AKS → Microsoft.ContainerService\n' +
          '# Database → Microsoft.DBforPostgreSQL / Microsoft.DBforMySQL\n\n' +
          'az provider register --namespace Microsoft.Compute\n' +
          'az provider register --namespace Microsoft.Network\n\n' +
          '# 등록 상태 확인\n' +
          'az provider show -n Microsoft.Compute --query "registrationState"',
        note: '리소스 프로바이더 등록에는 보통 1~2분이 소요됩니다.',
      },
      {
        title: '2단계 – 프로비저닝 재시도',
        description: '프로바이더 등록 후 Crossplane이 자동으로 재시도합니다. 1~2분 후 대시보드를 새로고침하세요.',
      },
    ],
    actions: [
      { label: 'Azure 리소스 프로바이더', url: 'https://portal.azure.com/#view/Microsoft_Azure_Resources/ResourceProvidersBlade', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  TIMEOUT: {
    category: 'TIMEOUT',
    title: '프로비저닝 시간 초과',
    summary: '리소스 프로비저닝이 예상보다 오래 걸려 타임아웃이 발생했습니다.',
    cause: 'AKS 클러스터는 최대 15~20분, Azure Database 고가용성은 최대 30분이 소요될 수 있습니다.',
    steps: [
      {
        title: '1단계 – Azure Portal에서 실제 상태 확인',
        description: 'Azure Portal에서 리소스가 생성되고 있는지 직접 확인합니다.',
        code: 'kubectl describe azurevm RESOURCE_NAME -n default',
      },
      {
        title: '2단계 – Crossplane 재동기화',
        description: 'Provider를 재시작하면 모든 리소스 상태를 재확인합니다.',
        code: 'kubectl rollout restart deployment -n crossplane-system -l pkg.crossplane.io/revision',
      },
    ],
    actions: [
      { label: 'Azure Portal', url: 'https://portal.azure.com', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  INVALID_CONFIG: {
    category: 'INVALID_CONFIG',
    title: '잘못된 리소스 설정값',
    summary: '입력한 설정값(VM 크기, 리전, 디스크 크기 등)이 Azure에서 허용되지 않습니다.',
    cause:
      '선택한 VM 크기가 해당 리전에서 지원되지 않거나, 리소스 그룹이 존재하지 않거나, ' +
      '리소스 이름 형식이 Azure 명명 규칙에 맞지 않을 수 있습니다.',
    steps: [
      {
        title: '1단계 – 에러 메시지 상세 확인',
        description: '정확한 에러 원인을 확인합니다.',
        code: 'kubectl describe azurevm RESOURCE_NAME -n default',
      },
      {
        title: '2단계 – 올바른 값으로 재생성',
        description: '기존 Claim을 삭제 후 /create 페이지에서 올바른 설정값으로 다시 생성합니다.',
        code:
          '# 리전별 사용 가능한 VM 크기 확인\naz vm list-sizes --location koreacentral --output table\n\n' +
          'kubectl delete azurevm RESOURCE_NAME -n default',
      },
    ],
    actions: [
      { label: '새 리소스 생성하기', url: '/create', variant: 'primary' },
      { label: 'Azure VM 크기 목록', url: 'https://learn.microsoft.com/azure/virtual-machines/sizes', variant: 'secondary' },
      DISCORD_CONTACT,
    ],
  },

  NETWORK_ERROR: {
    category: 'NETWORK_ERROR',
    title: 'Azure VNet/네트워크 설정 오류',
    summary: '리소스가 사용할 가상 네트워크 설정에 문제가 있습니다.',
    cause: '지정한 VNet, 서브넷, NSG가 존재하지 않거나, 주소 공간이 충돌할 수 있습니다.',
    steps: [
      {
        title: '1단계 – VNet 상태 확인',
        description: '리소스 그룹 내 VNet이 정상적으로 존재하는지 확인합니다.',
        code: 'az network vnet list --resource-group RESOURCE_GROUP --output table',
      },
      {
        title: '2단계 – 서브넷 주소 공간 확인',
        description: '서브넷 주소가 기존 VNet과 충돌하지 않는지 확인합니다.',
        code: 'az network vnet subnet list \\\n  --resource-group RESOURCE_GROUP \\\n  --vnet-name VNET_NAME \\\n  --output table',
      },
    ],
    actions: [
      { label: 'Azure VNet 관리', url: 'https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FvirtualNetworks', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },

  UNKNOWN: {
    category: 'UNKNOWN',
    title: '알 수 없는 오류',
    summary: '예상치 못한 오류가 발생했습니다.',
    cause: 'Crossplane 또는 Azure에서 반환한 에러 메시지를 자동으로 분류하지 못했습니다. 아래 방법으로 직접 원인을 파악하거나 인프라 담당자에게 문의하세요.',
    steps: [
      {
        title: '1단계 – Crossplane 이벤트 로그 확인',
        description: '리소스의 상세 에러 메시지를 확인합니다.',
        code:
          'kubectl describe azurevm RESOURCE_NAME -n default\n\n' +
          'kubectl logs -n crossplane-system -l pkg.crossplane.io/revision --tail=100 | grep -i error',
      },
      {
        title: '2단계 – Azure Activity Log 확인',
        description: 'Azure Portal → Monitor → Activity Log에서 실패한 작업을 확인합니다.',
        code: 'az monitor activity-log list \\\n  --resource-group RESOURCE_GROUP \\\n  --status Failed \\\n  --offset 1h \\\n  --output table',
      },
    ],
    actions: [
      { label: 'Azure Activity Log', url: 'https://portal.azure.com/#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/activityLog', variant: 'primary' },
      DISCORD_CONTACT,
    ],
  },
};

// ─── 가이드 조회 ────────────────────────────────────────────
const ALL_GUIDES: Record<CloudProvider, Record<ErrorCategory, TroubleshootingGuide>> = {
  GCP: GCP_GUIDES,
  AWS: AWS_GUIDES,
  Azure: AZURE_GUIDES,
};

export function getGuide(
  category: ErrorCategory | null,
  cloud: CloudProvider = 'GCP',
): TroubleshootingGuide {
  const cat = category ?? 'UNKNOWN';
  return ALL_GUIDES[cloud]?.[cat] ?? ALL_GUIDES[cloud]?.UNKNOWN ?? GCP_GUIDES.UNKNOWN;
}

/** @deprecated getGuide(category, cloud) 사용 권장 */
export const GUIDES = GCP_GUIDES;

// ─── 에러 분류 ──────────────────────────────────────────────
export function categorizeError(
  conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>,
): ErrorCategory | null {
  if (!conditions) return null;
  const failed = conditions.find(c => c.type === 'Ready' && c.status === 'False');
  if (!failed) return null;

  const msg = (failed.message || '').toLowerCase();
  const reason = (failed.reason || '').toLowerCase();

  // 쿼터 초과
  if (msg.includes('quota') || msg.includes('quotaexceeded') || msg.includes('limit exceeded') || msg.includes('skuquotaexceeded')) {
    return 'QUOTA_EXCEEDED';
  }
  // 결제/구독 비활성화
  if (msg.includes('billing') || msg.includes('billing disabled') || msg.includes('subscriptionnotfound') || msg.includes('subscription is disabled')) {
    return 'BILLING_DISABLED';
  }
  // API/리소스 프로바이더 미활성화 (GCP: API not enabled, Azure: MissingSubscriptionRegistration)
  if (
    msg.includes('api not enabled') ||
    msg.includes('api has not been used') ||
    msg.includes('it is disabled') ||
    msg.includes('missingsubscriptionregistration') ||
    msg.includes('not registered to use namespace') ||
    msg.includes('resource provider') ||
    msg.includes('optinrequired')
  ) {
    return 'API_NOT_ENABLED';
  }
  // 권한 부족
  if (
    msg.includes('permission') ||
    msg.includes('iam') ||
    msg.includes('403') ||
    msg.includes('authorizationfailed') ||
    msg.includes('accessdenied') ||
    msg.includes('unauthorized') ||
    reason.includes('unauthorized')
  ) {
    return 'PERMISSION_DENIED';
  }
  // 네트워크 오류
  if (msg.includes('network') || msg.includes('vpc') || msg.includes('vnet') || msg.includes('subnet') || msg.includes('firewall') || msg.includes('nsg')) {
    return 'NETWORK_ERROR';
  }
  // 타임아웃
  if (msg.includes('timeout') || msg.includes('deadline') || reason.includes('timeout')) {
    return 'TIMEOUT';
  }
  // 잘못된 설정
  if (
    msg.includes('invalid') ||
    msg.includes('invalid value') ||
    msg.includes('badrequest') ||
    msg.includes('resourcegroupnotfound') ||
    msg.includes('resourcenotfound') ||
    msg.includes('validationerror') ||
    reason.includes('invalidconfig') ||
    reason.includes('invalid')
  ) {
    return 'INVALID_CONFIG';
  }
  return 'UNKNOWN';
}
