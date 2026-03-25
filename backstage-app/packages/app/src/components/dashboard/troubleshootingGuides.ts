export type ErrorCategory =
  | 'QUOTA_EXCEEDED'
  | 'PERMISSION_DENIED'
  | 'BILLING_DISABLED'
  | 'API_NOT_ENABLED'
  | 'TIMEOUT'
  | 'INVALID_CONFIG'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

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

export const GUIDES: Record<ErrorCategory, TroubleshootingGuide> = {
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
        description:
          'Google Cloud Console → IAM 및 관리자 → 할당량 메뉴에서 현재 사용량을 확인합니다.',
        code: '# gcloud CLI로 확인하는 방법\ngcloud compute regions describe us-central1 \\\n  --format="table(quotas.metric,quotas.usage,quotas.limit)"',
        note: '쿼터 유형(CPUS, INSTANCES, DISKS_TOTAL_GB 등)을 구분하여 어느 항목이 초과되었는지 파악하세요.',
      },
      {
        title: '2단계 – 사용하지 않는 리소스 정리',
        description:
          '프로비저닝 현황 대시보드에서 ❌ 또는 오래된 ✅ 리소스를 삭제하여 공간을 확보합니다. ' +
          'Crossplane Claim을 삭제하면 연결된 GCP 리소스도 자동으로 삭제됩니다.',
        code: '# Claim 삭제 예시\nkubectl delete gcpinstance my-old-server -n default\nkubectl delete webapp my-old-app -n default',
        note: '삭제 전 팀원에게 해당 리소스가 사용 중인지 반드시 확인하세요.',
      },
      {
        title: '3단계 – 쿼터 증설 요청 (선택)',
        description:
          '리소스가 지속적으로 필요하다면 Google Cloud Console에서 쿼터 증설을 신청합니다. ' +
          '증설은 보통 1~2 영업일 이내에 처리되며, 일부 쿼터는 즉시 적용됩니다.',
        note: '쿼터 증설은 비용과 직결될 수 있으므로 인프라 담당자와 협의 후 진행하세요.',
      },
    ],
    actions: [
      {
        label: '불필요한 리소스 목록 보기',
        url: '/dashboard',
        variant: 'primary',
      },
      {
        label: 'GCP 할당량 페이지',
        url: 'https://console.cloud.google.com/iam-admin/quotas',
        variant: 'secondary',
      },
      {
        label: '인프라 담당자에게 Slack 문의',
        url: 'https://slack.com',
        variant: 'contact',
      },
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
        description:
          'Crossplane이 사용하는 GCP 서비스 계정과 그 IAM 역할을 확인합니다.',
        code:
          '# Crossplane GCP Provider 설정 확인\nkubectl get providerconfig.gcp.upbound.io -o yaml\n\n# 서비스 계정 역할 목록 확인 (gcloud)\ngcloud projects get-iam-policy YOUR_PROJECT_ID \\\n  --flatten="bindings[].members" \\\n  --filter="bindings.members:crossplane@*"',
      },
      {
        title: '2단계 – 필요한 IAM 역할 추가',
        description:
          '생성하려는 리소스에 따라 아래 IAM 역할 중 하나를 서비스 계정에 추가합니다.',
        code:
          '# VM 인스턴스: roles/compute.admin\n# Cloud SQL: roles/cloudsql.admin\n# GKE: roles/container.admin\n# GCS Bucket: roles/storage.admin\n# PubSub: roles/pubsub.admin\n\n# 역할 추가 예시\ngcloud projects add-iam-policy-binding YOUR_PROJECT_ID \\\n  --member="serviceAccount:crossplane@YOUR_PROJECT_ID.iam.gserviceaccount.com" \\\n  --role="roles/compute.admin"',
        note: '최소 권한 원칙(Principle of Least Privilege)에 따라 필요한 역할만 부여하세요.',
      },
      {
        title: '3단계 – Crossplane Provider 재시작',
        description:
          '권한을 추가한 후 Crossplane이 새 자격증명을 인식하도록 Provider를 재시작합니다.',
        code:
          '# GCP Provider Pod 재시작\nkubectl rollout restart deployment \\\n  -n crossplane-system \\\n  -l pkg.crossplane.io/revision',
      },
    ],
    actions: [
      {
        label: 'GCP IAM 권한 관리',
        url: 'https://console.cloud.google.com/iam-admin/iam',
        variant: 'primary',
      },
      {
        label: 'IAM 역할 레퍼런스',
        url: 'https://cloud.google.com/iam/docs/understanding-roles',
        variant: 'secondary',
      },
      {
        label: '인프라 담당자에게 Slack 문의',
        url: 'https://slack.com',
        variant: 'contact',
      },
    ],
  },

  BILLING_DISABLED: {
    category: 'BILLING_DISABLED',
    title: 'GCP 결제 계정 비활성화',
    summary: 'GCP 프로젝트에 결제 계정이 연결되지 않았거나 비활성화 상태입니다.',
    cause:
      'Google Cloud 리소스를 생성하려면 프로젝트에 활성화된 결제 계정이 연결되어 있어야 합니다. ' +
      '결제 계정이 없거나 정지된 경우 모든 리소스 생성이 차단됩니다.',
    steps: [
      {
        title: '1단계 – 결제 계정 상태 확인',
        description:
          'Google Cloud Console → 결제 메뉴에서 프로젝트의 결제 계정 연결 상태를 확인합니다.',
        code:
          '# gcloud CLI로 확인\ngcloud billing projects describe YOUR_PROJECT_ID',
      },
      {
        title: '2단계 – 결제 계정 연결',
        description:
          '결제 계정이 없거나 연결이 해제된 경우, 결제 계정을 프로젝트에 연결합니다. ' +
          '이 작업은 GCP 결제 관리자(roles/billing.admin) 권한이 필요합니다.',
        note:
          '결제 계정 연결은 조직 정책에 따라 제한될 수 있습니다. 인프라 담당자에게 문의하세요.',
      },
    ],
    actions: [
      {
        label: 'GCP 결제 설정',
        url: 'https://console.cloud.google.com/billing',
        variant: 'primary',
      },
      {
        label: '인프라 담당자에게 Slack 문의',
        url: 'https://slack.com',
        variant: 'contact',
      },
    ],
  },

  API_NOT_ENABLED: {
    category: 'API_NOT_ENABLED',
    title: 'GCP API 미활성화',
    summary: '이 리소스를 생성하는 데 필요한 Google Cloud API가 활성화되지 않았습니다.',
    cause:
      'Google Cloud 리소스 유형마다 대응되는 API(예: Compute Engine API, Cloud SQL Admin API)가 있으며, ' +
      '해당 API를 프로젝트에서 먼저 활성화해야 리소스를 생성할 수 있습니다.',
    steps: [
      {
        title: '1단계 – 필요한 API 식별',
        description:
          '에러 메시지에서 활성화해야 할 API 이름을 확인합니다. 리소스 유형별 필수 API는 다음과 같습니다.',
        code:
          '# VM 인스턴스     → compute.googleapis.com\n# Cloud SQL       → sqladmin.googleapis.com\n# GKE 클러스터    → container.googleapis.com\n# GCS Bucket      → storage.googleapis.com\n# Cloud PubSub    → pubsub.googleapis.com\n# Cloud Memorystore → redis.googleapis.com',
      },
      {
        title: '2단계 – API 활성화',
        description:
          '식별된 API를 활성화합니다. API 활성화는 보통 수 초에서 수 분이 소요됩니다.',
        code:
          '# gcloud CLI로 API 활성화\ngcloud services enable compute.googleapis.com\ngcloud services enable sqladmin.googleapis.com\ngcloud services enable container.googleapis.com\n\n# 현재 활성화된 API 목록\ngcloud services list --enabled',
      },
      {
        title: '3단계 – 프로비저닝 재시도',
        description:
          'API 활성화 후 Crossplane이 자동으로 재시도합니다. 1~2분 후 이 대시보드를 새로고침하여 상태를 확인하세요.',
        note:
          '여전히 실패하는 경우, Crossplane Provider를 재시작하면 즉시 재시도됩니다: kubectl rollout restart deployment -n crossplane-system',
      },
    ],
    actions: [
      {
        label: 'GCP API 라이브러리',
        url: 'https://console.cloud.google.com/apis/library',
        variant: 'primary',
      },
      {
        label: '인프라 담당자에게 Slack 문의',
        url: 'https://slack.com',
        variant: 'contact',
      },
    ],
  },

  TIMEOUT: {
    category: 'TIMEOUT',
    title: '프로비저닝 시간 초과',
    summary: '리소스 프로비저닝이 예상보다 오래 걸려 타임아웃이 발생했습니다.',
    cause:
      'GCP 리소스 생성은 보통 수 분이 소요되지만, GKE 클러스터나 Cloud SQL 고가용성 인스턴스의 경우 ' +
      '최대 15~20분이 걸릴 수 있습니다. Crossplane이 설정된 대기 시간을 초과했습니다.',
    steps: [
      {
        title: '1단계 – GCP Console에서 실제 상태 확인',
        description:
          'GCP Console에서 리소스가 실제로 생성되고 있는지 직접 확인합니다. ' +
          '생성 중인 경우, Crossplane이 자동으로 상태를 동기화합니다.',
        code: '# Crossplane 이벤트 로그 확인\nkubectl describe gcpinstance RESOURCE_NAME -n default\nkubectl describe webapp RESOURCE_NAME -n default',
      },
      {
        title: '2단계 – Crossplane 재동기화 유도',
        description:
          'Crossplane Provider를 재시작하면 모든 리소스 상태를 즉시 재확인하고 타임아웃을 초기화합니다.',
        code:
          'kubectl rollout restart deployment \\\n  -n crossplane-system \\\n  -l pkg.crossplane.io/revision',
      },
      {
        title: '3단계 – 리소스 재생성 (최후 수단)',
        description:
          'GCP Console에서도 리소스가 보이지 않고 재동기화 후에도 계속 실패하는 경우, ' +
          '기존 Claim을 삭제하고 다시 생성합니다.',
        code:
          '# 기존 Claim 삭제 (GCP 리소스도 함께 삭제됨)\nkubectl delete gcpinstance RESOURCE_NAME -n default\n\n# 새로운 프로비저닝은 /create 페이지에서 진행',
        note: '삭제 후 재생성은 비용이 발생할 수 있습니다.',
      },
    ],
    actions: [
      {
        label: 'GCP Console에서 확인',
        url: 'https://console.cloud.google.com',
        variant: 'primary',
      },
      {
        label: '인프라 담당자에게 Slack 문의',
        url: 'https://slack.com',
        variant: 'contact',
      },
    ],
  },

  INVALID_CONFIG: {
    category: 'INVALID_CONFIG',
    title: '잘못된 리소스 설정값',
    summary: '입력한 설정값(머신 타입, 리전, 디스크 크기 등)이 GCP에서 허용되지 않습니다.',
    cause:
      '선택한 머신 타입이 해당 리전/존에서 지원되지 않거나, 디스크 크기가 최소 요구량 미만이거나, ' +
      '리소스 이름 형식이 GCP 명명 규칙에 맞지 않을 수 있습니다.',
    steps: [
      {
        title: '1단계 – 에러 메시지 상세 확인',
        description:
          '아래 명령어로 정확한 에러 원인을 확인합니다.',
        code:
          '# 리소스 이벤트 확인\nkubectl describe gcpinstance RESOURCE_NAME -n default\n\n# status.conditions 직접 확인\nkubectl get gcpinstance RESOURCE_NAME -n default \\\n  -o jsonpath=\'{.status.conditions[*]}\'',
      },
      {
        title: '2단계 – 설정 수정 방법',
        description:
          '잘못된 설정값을 수정하려면 기존 Claim을 삭제 후 올바른 값으로 다시 생성해야 합니다. ' +
          '아래는 GCP 리소스별 유효한 값 범위입니다.',
        code:
          '# 유효한 머신 타입 (us-central1 기준)\n# e2-small, e2-medium, e2-standard-2/4/8/16\n# n2-standard-2/4/8/16, n2-highmem-2/4/8\n\n# 유효한 디스크 크기: 10GB ~ 65536GB\n\n# 리소스 이름 규칙: 소문자, 숫자, 하이픈만 허용\n# 최대 63자, 첫 글자는 소문자\n\n# 유효한 리전 목록\ngcloud compute regions list --filter="status=UP"',
        note: '리전에 따라 지원되는 머신 타입이 다를 수 있습니다.',
      },
      {
        title: '3단계 – 올바른 값으로 재생성',
        description:
          '/create 페이지에서 템플릿을 다시 실행하여 올바른 설정값으로 리소스를 재생성합니다.',
      },
    ],
    actions: [
      {
        label: '새 리소스 생성하기',
        url: '/create',
        variant: 'primary',
      },
      {
        label: 'GCP 머신 타입 목록',
        url: 'https://cloud.google.com/compute/docs/machine-resource',
        variant: 'secondary',
      },
      {
        label: '인프라 담당자에게 Slack 문의',
        url: 'https://slack.com',
        variant: 'contact',
      },
    ],
  },

  NETWORK_ERROR: {
    category: 'NETWORK_ERROR',
    title: 'GCP 네트워크/VPC 설정 오류',
    summary: '리소스가 사용할 VPC 네트워크 설정에 문제가 있습니다.',
    cause:
      'GCP 리소스는 VPC 네트워크 안에서 생성됩니다. 지정한 네트워크나 서브넷이 존재하지 않거나, ' +
      '방화벽 규칙이 누락되었을 수 있습니다.',
    steps: [
      {
        title: '1단계 – VPC 네트워크 상태 확인',
        description:
          'default VPC 네트워크가 존재하는지, 또는 커스텀 VPC를 사용하는 경우 올바르게 설정되었는지 확인합니다.',
        code:
          '# VPC 목록 확인\ngcloud compute networks list\n\n# 서브넷 목록 확인\ngcloud compute networks subnets list --network=default',
      },
      {
        title: '2단계 – default VPC 생성 (필요한 경우)',
        description:
          'default VPC 네트워크가 삭제된 경우 재생성합니다.',
        code:
          'gcloud compute networks create default \\\n  --subnet-mode=auto \\\n  --bgp-routing-mode=regional',
        note: 'default VPC를 재생성하면 기존 방화벽 규칙도 함께 재생성됩니다.',
      },
    ],
    actions: [
      {
        label: 'GCP VPC 네트워크 설정',
        url: 'https://console.cloud.google.com/networking/networks/list',
        variant: 'primary',
      },
      {
        label: '인프라 담당자에게 Slack 문의',
        url: 'https://slack.com',
        variant: 'contact',
      },
    ],
  },

  UNKNOWN: {
    category: 'UNKNOWN',
    title: '알 수 없는 오류',
    summary: '예상치 못한 오류가 발생했습니다. 상세 로그를 확인해주세요.',
    cause:
      'Crossplane 또는 GCP에서 반환한 에러 메시지를 자동으로 분류하지 못했습니다. ' +
      '아래 방법으로 직접 원인을 파악하거나 인프라 담당자에게 문의하세요.',
    steps: [
      {
        title: '1단계 – Crossplane 이벤트 로그 확인',
        description:
          '아래 명령어로 리소스의 상세 에러 메시지를 확인합니다.',
        code:
          '# 리소스 상세 정보 (에러 메시지 포함)\nkubectl describe gcpinstance RESOURCE_NAME -n default\n\n# Crossplane 컨트롤러 로그\nkubectl logs -n crossplane-system \\\n  -l pkg.crossplane.io/revision \\\n  --tail=100 | grep -i error',
      },
      {
        title: '2단계 – GCP 오퍼레이션 로그 확인',
        description:
          'GCP Console의 Cloud Logging에서 관련 오퍼레이션 로그를 확인합니다.',
        code:
          '# gcloud CLI로 최근 오퍼레이션 오류 확인\ngcloud logging read \\\n  "severity=ERROR AND timestamp>\\"-1h\\"" \\\n  --limit=20 --format=json',
      },
    ],
    actions: [
      {
        label: 'GCP Cloud Logging',
        url: 'https://console.cloud.google.com/logs',
        variant: 'primary',
      },
      {
        label: '인프라 담당자에게 Slack 문의',
        url: 'https://slack.com',
        variant: 'contact',
      },
    ],
  },
};

export function categorizeError(conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>): ErrorCategory | null {
  if (!conditions) return null;
  const failed = conditions.find(c => c.type === 'Ready' && c.status === 'False');
  if (!failed) return null;

  const msg = (failed.message || '').toLowerCase();
  const reason = (failed.reason || '').toLowerCase();

  if (msg.includes('quota') || msg.includes('quotaexceeded') || msg.includes('limit exceeded')) {
    return 'QUOTA_EXCEEDED';
  }
  if (msg.includes('billing') || msg.includes('billing disabled')) {
    return 'BILLING_DISABLED';
  }
  if (msg.includes('api not enabled') || msg.includes('api has not been used') || msg.includes('it is disabled')) {
    return 'API_NOT_ENABLED';
  }
  if (msg.includes('permission') || msg.includes('iam') || msg.includes('403') || reason.includes('unauthorized')) {
    return 'PERMISSION_DENIED';
  }
  if (msg.includes('network') || msg.includes('vpc') || msg.includes('subnet') || msg.includes('firewall')) {
    return 'NETWORK_ERROR';
  }
  if (msg.includes('timeout') || msg.includes('deadline') || reason.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (msg.includes('invalid') || msg.includes('invalid value') || reason.includes('invalidconfig') || reason.includes('invalid')) {
    return 'INVALID_CONFIG';
  }
  return 'UNKNOWN';
}
