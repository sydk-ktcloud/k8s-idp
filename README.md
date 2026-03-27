# K8S-IDP: Kubernetes Internal Developer Platform

Kubernetes 기반 내부 개발자 플랫폼 (IDP) 인프라 설정 저장소입니다.

## 개요

이 저장소는 다음 구성요소의 Infrastructure as Code (IaC)를 포함합니다:

### 플랫폼 레이어

| 레이어 | 컴포넌트 | 상태 | 설명 |
|--------|----------|------|------|
| **인프라** | VM (KVM/libvirt) | ✅ 배포됨 | 4VM: 1 CP + 3 Workers |
| **네트워크** | Cilium CNI + Hubble | ✅ 배포됨 | eBPF 기반 네트워킹 + 관찰가능성 |
| **VPN** | Headscale + Headplane | ✅ 배포됨 | Self-hosted Tailscale + Web UI |
| **SSO** | Dex OIDC | ✅ 배포됨 | 7명 사용자, 다중 서비스 연동 |
| **GitOps** | ArgoCD | ✅ 배포됨 | Application of Apps 패턴 |
| **시크릿** | Vault | 🔄 구성됨 | HA Raft 구성, 배포 대기 |
| **저장소** | Longhorn + MinIO | ✅ 배포됨 | 블록 스토리지 + 오브젝트 스토리지 |
| **관찰가능성** | Prometheus + Grafana + LGTM | ✅ 배포됨 | Metrics, Logs, Traces |
| **백업** | Longhorn Backup + Velero | ✅ 배포됨 | PV 백업 + 클러스터 상태 백업 |

### 개발자 플랫폼

| 컴포넌트 | 상태 | 설명 |
|----------|------|------|
| **Backstage** | ✅ 배포됨 | 개발자 포털, 서비스 카탈로그, 셀프서비스 |
| **Crossplane** | ✅ 배포됨 | 클라우드 리소스 프로비저닝 (GCP / AWS / Azure) |
| **GKE Burst** | ✅ 배포됨 | 온프레미스 부하 초과 시 GKE로 자동 확장 |
| **ChatOps** | ✅ 배포됨 | Discord 기반 K8s 관리 봇 |
| **Kubecost** | ✅ 배포됨 | 비용 모니터링 및 최적화 |

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Host Server (32C/128GB/2TB)                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         KVM / libvirt                              │  │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │  │
│  │   │ k8s-cp  │  │ k8s-w1  │  │ k8s-w2  │  │ k8s-w3  │            │  │
│  │   │ 4C/16GB │  │ 8C/32GB │  │ 8C/32GB │  │ 8C/32GB │            │  │
│  │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │  │
│  └────────┼────────────┼────────────┼────────────┼──────────────────┘  │
│           └────────────┴─────┬──────┴────────────┘                      │
│                              │ (3 Worker Nodes = HA 분산 배치)           │
│  ┌───────────────────────────┴───────────────────────────────────────┐  │
│  │                    Kubernetes Cluster (v1.32.0)                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │            Platform Services  [replicas:3, PDB, anti-affinity]│ │  │
│  │  │  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │ │  │
│  │  │  │    ArgoCD    │ │   Dex    │ │Backstage │ │  Crossplane │ │ │  │
│  │  │  │server  ×3    │ │   ×3     │ │backend×3 │ │  (IaC)      │ │ │  │
│  │  │  │controller×3  │ │+redis-ha │ │+HPA      │ │             │ │ │  │
│  │  │  │repoServer×3  │ │  ×3      │ │          │ │             │ │ │  │
│  │  │  └──────────────┘ └──────────┘ └──────────┘ └─────────────┘ │ │  │
│  │  │  PodDisruptionBudgets: argocd-server, argocd-controller,      │ │  │
│  │  │                        argocd-repo-server, dex, backstage-backend│ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                    Observability Stack                        │ │  │
│  │  │  ┌───────────┐ ┌─────────┐ ┌──────┐ ┌───────┐ ┌───────────┐ │ │  │
│  │  │  │ Prometheus│ │ Grafana │ │ Loki │ │ Tempo │ │   Alloy   │ │ │  │
│  │  │  └───────────┘ └─────────┘ └──────┘ └───────┘ └───────────┘ │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │              Storage Layer  [Distributed HA]                  │ │  │
│  │  │  ┌────────────┐         ┌──────────────────────────────────┐  │ │  │
│  │  │  │  Longhorn  │         │  MinIO Distributed (×4 StatefulSet│  │ │  │
│  │  │  │ (Block)    │         │  Erasure Coding, PDB minAvail:2) │  │ │  │
│  │  │  └────────────┘         └──────────────────────────────────┘  │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │           GKE Burst  [KEDA + Tailscale VPN]                   │ │  │
│  │  │  온프레미스 부하 초과 시 GKE 클러스터로 워크로드 자동 확장      │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│  ┌───────────────────────────┴───────────────────────────────────────┐  │
│  │                    Headscale (VPN / Mesh Network)                  │  │
│  │                         + Headplane (Web UI)                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 디렉토리 구조

```
k8s-idp/
├── infrastructure/               # 인프라 설정
│   ├── libvirt/                 # VM 생성 (vm-setup.sh, cloud-init)
│   ├── kubernetes/              # K8s 초기 설정 (kubeadm, cilium)
│   ├── headscale/               # VPN 서버 설정
│   └── headplane/               # VPN 관리 Web UI
├── security/                    # 보안 구성
│   └── vault/                   # Vault HA 설정 (helm, docs)
├── kubernetes/                  # K8s 매니페스트
│   ├── namespaces/              # Namespace 정의
│   ├── helm-releases/           # Helm 차트 배포
│   │   ├── argocd/             # ArgoCD GitOps
│   │   ├── backstage/          # 개발자 포털
│   │   ├── crossplane/         # 클라우드 프로비저닝
│   │   ├── dex/                # SSO/OIDC
│   │   ├── grafana/            # 시각화
│   │   ├── kubecost/           # 비용 관리
│   │   ├── longhorn/           # 스토리지
│   │   ├── prometheus/         # 메트릭
│   │   └── vault/              # 시크릿 (계획)
│   ├── manifests/               # K8s 매니페스트
│   │   ├── argocd-rbac/        # ArgoCD 권한
│   │   ├── backstage-custom/   # Backstage 커스텀
│   │   ├── cert-manager/       # 인증서 관리
│   │   ├── cilium/             # CNI/Hubble 설정
│   │   ├── pdb/                # PodDisruptionBudget (서비스별 HA 보호)
│   │   ├── gke-burst/          # GKE Burst 클러스터 매니페스트 (KEDA, Tailscale)
│   │   ├── crossplane-compositions/  # XRD/Composition (GCP 8종, AWS 4종, Azure 4종)
│   │   │   ├── aws/            # EC2Instance, S3Bucket, EKSCluster, RDSDatabase
│   │   │   └── azure/          # AzureVM, AzureBlobStorage, AKSCluster, AzureDatabase
│   │   └── crossplane-providers/     # GCP / AWS / Azure Provider
│   ├── argocd-apps/             # ArgoCD Application 정의
│   ├── network-policies/        # Zero Trust 네트워크 정책
│   ├── observability/           # LGTM 스택 (Loki, Grafana, Tempo, Alloy)
│   └── storage/                 # 스토리지 (Longhorn, MinIO)
├── apps/                        # Backstage Scaffolder 생성 리소스
│   ├── .argocd/                 # ApplicationSet (자동 감지)
│   └── gke-burst/               # GKE Burst Cluster Claim
├── backstage-app/               # Backstage 개발자 포털
│   ├── packages/
│   │   ├── app/                # Frontend (React)
│   │   └── backend/            # Backend (Node.js)
│   └── templates/              # Scaffolder 템플릿 (Nunjucks {{ values.* }} 문법)
│       ├── service-wizard/         # GCP 마법사 (초보자용)
│       ├── aws-service-wizard/     # AWS 마법사 (초보자용)
│       ├── azure-service-wizard/   # Azure 마법사 (초보자용)
│       ├── simple-server/          # 멀티 클라우드 VM 빠른 시작
│       ├── infrastructure-only/    # GCP 직접 구성 (숙련자용)
│       ├── aws-infrastructure/     # AWS 직접 구성 (숙련자용)
│       ├── azure-infrastructure/   # Azure 직접 구성 (숙련자용)
│       ├── service/                # 서비스 컴포넌트 생성
│       └── service-with-infra/     # 서비스 + GCP 인프라 묶음
├── chatops-app/                 # Discord ChatOps 봇
│   ├── commands/               # 슬래시 커맨드
│   └── services/               # K8s/OpenAI 연동
├── scripts/                     # 설치 스크립트
│   ├── setup-k8s.sh            # K8s 클러스터 설치
│   ├── setup-headscale.sh      # VPN 서버 설정
│   ├── enable-hubble-ui.sh     # Hubble UI 활성화
│   ├── apply-network-policies.sh # Zero Trust 정책 적용
│   └── setup-github-runner.sh  # GitHub Actions Runner
├── kubeconfig/                  # 팀별 Kubeconfig
├── docs/                        # 문서
│   ├── remote-access-guide.md  # 원격 접속 가이드
│   ├── k8s-access-guide.md     # K8s 접근 가이드
│   └── hubble-install-guide.md # Hubble 설치 가이드
└── README.md
```

## 클러스터 정보

| 노드 | IP (Internal) | Tailscale IP | 역할 |
|------|---------------|--------------|------|
| k8s-cp | 192.168.122.109 | 100.64.0.1 | Control Plane |
| k8s-w1 | 192.168.122.211 | 100.64.0.2 | Worker |
| k8s-w2 | 192.168.122.136 | 100.64.0.4 | Worker |
| k8s-w3 | 192.168.122.194 | 100.64.0.3 | Worker |

### Namespaces

| Namespace | 용도 |
|-----------|------|
| `auth` | Dex OIDC |
| `gitops` | ArgoCD |
| `backstage` | 개발자 포털 |
| `crossplane-system` | 클라우드 프로비저닝 |
| `monitoring` | Prometheus, Grafana, LGTM |
| `kubecost` | 비용 모니터링 |
| `longhorn-system` | 분산 스토리지 |
| `vault` | 시크릿 관리 (계획) |
| `minio-storage` | 오브젝트 스토리지 + 백업 S3 허브 |
| `velero` | 클러스터 상태 백업 |
| `kube-system` | Cilium CNI, Hubble |

## 애플리케이션

### 1. Backstage (개발자 포털)

**목적**: 서비스 카탈로그, 문서화, 셀프서비스 프로비저닝

**주요 기능**:
- 서비스 카탈로그 (Catalog)
- 기술 문서 (TechDocs)
- 셀프서비스 템플릿 (Scaffolder)
- Kubernetes 리소스 조회
- Crossplane 기반 멀티 클라우드 리소스 프로비저닝 (GCP / AWS / Azure)

**Scaffolder 템플릿**:
| 템플릿 | 대상 | 특징 |
|--------|------|------|
| `service-wizard` | GCP VM/GCS/GKE/SQL | 3문항 마법사, GCP 초보자 권장 |
| `aws-service-wizard` | AWS EC2/S3/RDS | 3문항 마법사, AWS 초보자 권장 |
| `azure-service-wizard` | Azure VM/Blob/AKS/PostgreSQL | 3문항 마법사, Azure 초보자 권장 |
| `simple-server-template` | GCP/AWS/Azure 서버 | 3가지 선택만으로 VM 즉시 생성 |
| `infrastructure-only-template` | GCP 직접 구성 | 숙련자용 GCP 세부 설정 |
| `aws-infrastructure-template` | AWS 직접 구성 | 숙련자용 AWS 세부 설정 |
| `azure-infrastructure-template` | Azure 직접 구성 | 숙련자용 Azure 세부 설정 |
| `service-template` | 서비스 컴포넌트 | 코드 저장소 + 카탈로그 등록 |
| `service-with-infra` | 서비스 + GCP 인프라 | 서비스 + 인프라 묶음 |

> **마법사 패턴**: 서비스 유형(web-api/file-service/container-app/data-processing)과 규모(dev/standard/large) 선택만으로 Crossplane Claim이 자동 생성됩니다.

> **템플릿 문법**: 모든 템플릿 파일(`.tmpl`)은 Backstage Scaffolder의 Nunjucks 문법을 사용하며, 파라미터는 `{{ values.paramName }}` 형식으로 참조합니다.

**기술 스택**: Backstage v1.49.0, React, Node.js 22

### 2. ChatOps (Discord 봇)

**목적**: Discord 기반 Kubernetes 운영 자동화

**주요 기능**:
- `/pods` - 문제 파드 조회
- `/allpods` - 전체 파드 조회
- `/logs` - 파드 로그 확인
- `/analyze` - AI 로그 분석 (OpenAI)
- `/status` - 시스템 상태 확인

**기술 스택**: Discord.js, Kubernetes Client, OpenAI API

### 3. Crossplane Compositions (멀티 클라우드)

**목적**: 개발자 셀프서비스 클라우드 리소스 프로비저닝 (GCP / AWS / Azure)

#### GCP
| 타입 | XRD | GCP 리소스 |
|------|-----|------------|
| VM | XGCPInstance | Compute Engine |
| Storage | XBucket | Cloud Storage |
| Database | XDatabase | Cloud SQL |
| Cluster | XCluster | GKE |
| Cache | XCache | Memorystore |
| Messaging | XPubSub | Pub/Sub |
| WebApp | XWebApp | 통합 웹앱 |
| **Burst Cluster** | **XClusterBurst** | **GKE (온프레미스 burst 확장용)** |

#### AWS
| 타입 | XRD | AWS 리소스 |
|------|-----|------------|
| VM | XEC2Instance | EC2 Instance |
| Storage | XS3Bucket | S3 Bucket + BucketVersioning |
| Database | XRDSDatabase | RDS Instance (postgres/mysql) |
| Cluster | XEKSCluster | EKS Cluster + NodeGroup |

#### Azure
| 타입 | XRD | Azure 리소스 |
|------|-----|--------------|
| VM | XAzureVM | Linux Virtual Machine + NetworkInterface |
| Storage | XAzureBlobStorage | Storage Account + Container |
| Database | XAzureDatabase | PostgreSQL/MySQL Flexible Server |
| Cluster | XAKSCluster | AKS Kubernetes Cluster |

### 4. GKE Burst 확장

**목적**: 온프레미스 클러스터 부하 초과 시 GKE로 워크로드 burst 확장

**동작 방식**:
1. `ClusterBurst` Claim 생성 → Crossplane이 GKE 클러스터 자동 프로비저닝
2. Cluster + NodePool (autoscaling 0~5) 구성
3. 연결 정보(`kubeconfig`)가 `default/gke-burst-kubeconfig` Secret에 자동 저장

**리소스 구성**:
- **XRD**: `xclusterbursts.k8s-idp.example.org`
- **Composition**: `xclusterburst.gcp.k8s-idp.example.org`
- **Claim**: `apps/gke-burst/claim.yaml`
- **GKE 클러스터**: `k8s-idp-burst` (asia-northeast3, e2-standard-2, preemptible)

**kubeconfig 획득**:
```bash
# Crossplane이 자동 생성한 Secret에서 추출
kubectl get secret gke-burst-kubeconfig -n default \
  -o jsonpath='{.data.kubeconfig}' | base64 -d > gke-burst-kubeconfig.yaml

# 또는 gcloud로 직접 획득
KUBECONFIG=kubeconfig/gke-burst \
  gcloud container clusters get-credentials k8s-idp-burst \
  --project=sydk-ktcloud --region=asia-northeast3
```

## SSO 구성 (Dex)

### 사용자 계정

| 사용자 | 이메일 | 역할 |
|--------|--------|------|
| admin | admin@k8s.local | 관리자 |
| platform | platform@k8s.local | Platform Lead |
| gitops | gitops@k8s.local | GitOps Engineer |
| finops | finops@k8s.local | FinOps Engineer |
| security | security@k8s.local | Security Engineer |
| sre | sre@k8s.local | SRE / Observability |
| ai | ai@k8s.local | AI / ChatOps Engineer |

### 연동 서비스

- ArgoCD (GitOps)
- Grafana (관찰가능성)
- Backstage (개발자 포털)
- kubectl (oidc-login)

## 보안

### RBAC 최소 권한 원칙

#### ArgoCD
- `cluster-admin` 대신 전용 `ClusterRole(argocd-application-controller)` 사용
- `escalate` / `impersonate` 권한 명시적 제외 → 권한 상승 공격 차단
- 파일: `kubernetes/manifests/argocd-rbac/`

#### Backstage
- ClusterRole: `namespaces`, Crossplane XRD/Claims 읽기만 허용
- 네임스페이스 리소스(pods, services, deployments 등)는 각 namespace Role로 분리
  - 적용 대상: `trip-app`, `chatops`, `monitoring`, `backstage`
- `secrets` 클러스터 전체 읽기 권한 제거
- `automountServiceAccountToken: false`
- 파일: `kubernetes/manifests/backstage-custom/backstage.yaml`

#### ChatOps 봇
- 클러스터 전체 pod 조회 ClusterRoleBinding 제거
- namespaces 읽기는 ClusterRole 유지 (cluster-scoped 리소스)
- pods/log 접근은 네임스페이스별 RoleBinding으로 제한
  - 적용 대상: `trip-app`, `chatops`, `monitoring`, `backstage`
- `automountServiceAccountToken: false`
- 파일: `kubernetes/manifests/chatops/rbac.yaml`

#### Tailscale
- 클러스터 전체 Secrets 접근 ClusterRole 제거
- `kube-system` 네임스페이스 Role로 축소 + `resourceNames`로 특정 Secret만 허용
- nodes 읽기는 ClusterRole 유지 (cluster-scoped 리소스)
- 파일: `kubernetes/manifests/vpn/tailscale-daemonset.yaml`

---

### NetworkPolicy (Zero Trust)

모든 네임스페이스에 `default-deny-all` 기반으로 필요한 통신만 명시적으로 허용합니다.

| 네임스페이스 | 정책 파일 | 주요 허용 트래픽 |
|---|---|---|
| `gitops` | `02-argocd.yaml` | 내부 컴포넌트 통신, Dex OIDC, k8s API, GitHub/Helm |
| `auth` | `01-dex.yaml` | ArgoCD/Backstage/Grafana → Dex, LDAP 등 |
| `backstage` | `04-backstage.yaml` | DB 내부 통신, k8s API, 외부 443 |
| `monitoring` | `03-monitoring.yaml` | 전 네임스페이스 메트릭 scrape, Grafana UI |
| `chatops` | `08-chatops.yaml` | Discord + Azure OpenAI (443 외부), Prometheus, k8s API |
| `trip-app` | `09-trip-app.yaml` | 서비스 간 통신 (frontend→backend→DB), NodePort ingress |
| `kube-system` | `07-cilium-hubble.yaml` | Hubble 관찰가능성 |
| `longhorn-system` | `06-longhorn.yaml` | 스토리지 내부 통신 |

**Cilium 특이사항**: `kube-apiserver` reserved identity는 표준 `ipBlock`으로 매칭 불가.
`CiliumNetworkPolicy + toEntities: kube-apiserver`로 처리 (`02-argocd.yaml`).

---

### Pod Security Admission (PSA)

표준 Kubernetes PSA로 워크로드 보안 수준을 관리합니다.

| 네임스페이스 | enforce | audit | warn |
|---|---|---|---|
| `backstage` | baseline | restricted | restricted |
| `chatops` | baseline | restricted | restricted |
| `trip-app` | baseline | restricted | restricted |
| `gitops`, `auth`, `monitoring` | baseline | baseline | baseline |

- `enforce: baseline` — 기존 워크로드 영향 최소화
- `audit/warn: restricted` — 위반 사항 가시성 확보 (배포는 차단하지 않음)
- 파일: `kubernetes/namespaces/core.yaml`

---

### Resource 제한 (LimitRange)

리소스 무제한 소비 방지를 위한 기본값 설정.

| 네임스페이스 | 파일 | default request | default limit |
|---|---|---|---|
| `trip-app` | `manifests/trip-app/resource-management.yaml` | cpu: 100m / memory: 128Mi | cpu: 500m / memory: 512Mi |

---

### 취약점 스캐닝 (Trivy Operator)

클러스터 내 지속적 보안 감사를 위해 Trivy Operator를 배포합니다.

- **VulnerabilityReport**: 컨테이너 이미지 CVE 스캔
- **ConfigAuditReport**: RBAC 과다 권한, resource limits 미설정, latest 태그 사용 탐지
- **RbacAssessmentReport**: ServiceAccount 권한 과다 리포트
- Grafana 대시보드 연동 가능
- 파일: `kubernetes/argocd-apps/trivy-operator.yaml`

---

### 팀별 접근 권한 (ArgoCD + kubectl)

| 팀 | ArgoCD Role | kubectl 권한 |
|----|------|------|
| Admin, Platform, GitOps, Security, SRE | role:admin | cluster-admin |
| FinOps, AI | role:readonly | view |

## 로깅 전략

클러스터의 모든 관측 신호는 **LGTM 스택**을 통해 단일 Grafana 대시보드로 통합됩니다.

### 로깅 스택 구성

```
애플리케이션 파드
      │ stdout/stderr
      ▼
  Alloy (DaemonSet)  ──── OTLP 트레이스 ────▶  Tempo
      │                                        (분산 추적)
      │ Loki Push API
      ▼
    Loki                  Prometheus  ◀──── 전 네임스페이스 스크레이프
  (로그 집계)             (메트릭 수집)
      │                       │
      └───────────┬───────────┘
                  ▼
               Grafana
           (통합 시각화 + 알림)
```

| 컴포넌트 | 역할 | 보존 기간 | 스토리지 |
|----------|------|-----------|----------|
| **Prometheus** | 메트릭 수집 (30s 간격) | 15일 / 45GiB | 50Gi Longhorn |
| **Loki** | 로그 집계 | 30일 | 10Gi Longhorn + MinIO S3 |
| **Tempo** | 분산 트레이스 | 7일 | 10Gi Longhorn + MinIO S3 |
| **Alloy** | 로그·트레이스 수집 에이전트 | - | DaemonSet (상태 없음) |
| **Grafana** | 시각화 + 알림 | - | 1Gi Longhorn |

### 로그 수집 방식

- **Alloy DaemonSet**: 모든 노드에 배포되어 파드의 `stdout`/`stderr`를 자동 수집
- **JSON 파싱**: `level`, `trace_id` 필드를 자동 추출하여 Loki 레이블로 저장
- **TraceID 연동**: Loki 로그에서 TraceID를 추출해 Grafana에서 Tempo 트레이스로 바로 이동 가능

### Loki S3 이중 스키마 (마이그레이션)

Loki는 기존 `filesystem` 스키마와 신규 `S3` 스키마를 병행 운영합니다.

| 기간 | 스토리지 | 비고 |
|------|----------|------|
| 2024-01-01 ~ 2026-04-06 | Longhorn PVC (filesystem) | 기존 데이터, 자연 만료 대기 |
| 2026-04-07 ~ | MinIO S3 (`loki-chunks` 버킷) | 신규 데이터 |

---

## 고가용성 (HA) 및 오토스케일링

플랫폼 핵심 서비스는 단일 장애점(SPOF) 제거를 목표로 **replicas:3 + PodDisruptionBudget + Anti-Affinity**를 기본으로 구성합니다.

### 서비스별 HA 구성

| 서비스 | Replicas | PDB (minAvailable) | Anti-Affinity | TopologySpread |
|--------|----------|--------------------|---------------|----------------|
| ArgoCD Server | 3 | 1 | preferred / hostname | ✅ |
| ArgoCD Controller | 3 | 1 | preferred / hostname | - |
| ArgoCD Repo Server | 3 | 1 | preferred / hostname | ✅ |
| ArgoCD Redis-HA | 3 | - | **required** / hostname | - |
| Dex (SSO) | 3 | 1 | preferred / hostname | ✅ |
| Backstage Backend | 3 + HPA | 1 | preferred / hostname | - |
| MinIO Distributed | 4 (StatefulSet) | 2 | required / hostname | - |

> **MinIO PDB minAvailable:2**: 4-node Erasure Coding 구성에서 quorum(최소 2노드) 보장을 위해 2로 설정.
> **Redis-HA required anti-affinity**: 3개 Worker 노드 각각에 1개씩 강제 분산. 노드 수가 3 미만이면 스케줄 불가.

### PodDisruptionBudget

노드 드레인(`kubectl drain`) 또는 클러스터 업그레이드 시 서비스 연속성을 보장합니다.

```
kubernetes/manifests/pdb/
├── argocd-server-pdb.yaml          # minAvailable: 1
├── argocd-application-controller-pdb.yaml  # minAvailable: 1
├── argocd-repo-server-pdb.yaml     # minAvailable: 1
├── dex-pdb.yaml                    # minAvailable: 1
├── backstage-backend-pdb.yaml      # minAvailable: 1
└── minio-pdb.yaml                  # minAvailable: 2
```

PDB는 `kubectl drain` 시 최소 파드 수 이하로 종료되는 것을 차단합니다.
```bash
# PDB 상태 확인
kubectl get pdb -A

# 드레인 시 PDB 적용 확인
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
```

### Anti-Affinity / TopologySpreadConstraints

모든 HA 서비스에 `podAntiAffinity`를 적용하여 동일 노드에 같은 서비스의 파드가 집중되지 않도록 합니다.

| 정책 | 대상 | 동작 |
|------|------|------|
| `preferredDuringScheduling` | ArgoCD, Dex, Backstage | 가능하면 분산, 불가시 같은 노드도 허용 |
| `requiredDuringScheduling` | ArgoCD Redis-HA, MinIO | 반드시 다른 노드에 배치 (불가시 Pending) |

`topologySpreadConstraints`(`maxSkew:1`)는 ArgoCD Server, Repo Server, Dex에 추가 적용되어 노드 간 파드 수 편차를 1 이내로 유지합니다.

### HPA (Horizontal Pod Autoscaler)

Backstage Backend는 CPU/Memory 기반 HPA로 부하에 따라 자동 스케일링됩니다.

```yaml
# backstage-backend HPA (예정)
minReplicas: 3
maxReplicas: 6
metrics:
  - CPU utilization: 70%
  - Memory utilization: 80%
```

> HPA 적용 파일: `kubernetes/manifests/backstage-custom/backstage.yaml` (파일 끝 섹션)

### MinIO Distributed Mode

4-node StatefulSet + Erasure Coding으로 구성됩니다.

```
minio-0 (k8s-w1)  minio-1 (k8s-w2)  minio-2 (k8s-w3)  minio-3 (k8s-w1)
    └─────────────────── Erasure Coding (N/2 내구성) ──────────────────┘
```

- **required anti-affinity**: 각 파드가 서로 다른 노드에 배치
- **PDB minAvailable:2**: 최소 2노드 유지 (quorum 보장)
- **volumeClaimTemplates**: 파드별 독립 20Gi Longhorn PVC 자동 생성
- **헬스체크**: `/minio/health/live`, `/minio/health/ready` 엔드포인트

```bash
# MinIO 분산 상태 확인
kubectl exec -n minio-storage minio-0 -- mc admin info local
```

### GKE Burst 오토스케일링

온프레미스 클러스터 용량 초과 시 GKE로 워크로드를 자동 확장합니다.

```
온프레미스 클러스터           GKE Burst Cluster
       │                            │
  KEDA ScaledObject ────────▶  GKE NodePool (0~5)
  (부하 감지)                   Tailscale VPN 연결
       │
  burst-workload-demo (Job)
```

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| KEDA ScaledObject | `manifests/gke-burst/keda-scaler.yaml` | 메트릭 기반 GKE 워크로드 트리거 |
| Tailscale DaemonSet | `manifests/gke-burst/tailscale-gke.yaml` | GKE ↔ 온프레미스 VPN 터널 |
| ArgoCD MultiCluster | `manifests/gke-burst/argocd-multi-cluster.yaml` | GKE 클러스터 GitOps 등록 |
| Burst Job | `manifests/gke-burst/burst-workload-demo.yaml` | 실제 burst 워크로드 샘플 |

---

## 백업 전략

### 아키텍처

MinIO를 내부 S3 허브로 활용하여 외부 클라우드 의존 없이 모든 백업을 단일 오브젝트 스토리지로 집중합니다.

```
┌───────────────────────────────────────────────────────────┐
│            MinIO (minio-storage, S3 Hub)                   │
│  longhorn-backups │ velero │ loki-chunks │ tempo-traces    │
└──────────┬────────────────────────────────────────────────┘
           │ S3 API (minio.minio-storage:9000)
   ┌───────┼──────────────────────┬─────────────┐
   │       │                      │             │
Longhorn  Velero                Loki         Tempo
(PV 백업) (클러스터 상태 백업)  (로그 청크)  (트레이스)
```

### Longhorn PV 백업

Longhorn은 MinIO를 S3 백업 타겟으로 사용하여 클러스터 내 모든 PV를 자동 백업합니다.

| 작업 | 스케줄 | 보존 개수 | 설명 |
|------|--------|-----------|------|
| **스냅샷** | 매일 02:00 | 7개 | 로컬 스냅샷 (MinIO 독립적) |
| **백업** | 매일 03:00 | 14개 | MinIO `longhorn-backups` 버킷으로 전송 |

**백업 대상 PV 목록 (총 ~295Gi)**

| 컴포넌트 | 크기 | 네임스페이스 |
|----------|------|-------------|
| Prometheus | 50Gi | monitoring |
| Kubecost (aggregator DB) | 128Gi | kubecost |
| Kubecost (localStore) | 32Gi | kubecost |
| MinIO | 50Gi | minio-storage |
| Loki | 10Gi | monitoring |
| Tempo | 10Gi | monitoring |
| AlertManager | 5Gi | monitoring |
| Kubecost (finops agent) | 8Gi | kubecost |
| Kubecost (cloudCost) | 1Gi | kubecost |
| Grafana | 1Gi | monitoring |

관련 파일:
- `kubernetes/helm-releases/longhorn/values.yaml` — `backupTarget`, `snapshotDataIntegrity` 설정
- `kubernetes/storage/longhorn-backup-secret.yaml` — S3 자격증명 (longhorn-system)
- `kubernetes/storage/longhorn-recurringjobs.yaml` — RecurringJob 스케줄 정의

### Velero 클러스터 상태 백업

Velero는 Kubernetes 리소스(Deployment, ConfigMap, Secret, PV 등)를 MinIO에 백업합니다.

| 항목 | 값 |
|------|----|
| 스케줄 | 매일 01:00 |
| 보존 기간 | 14일 (336h) |
| 백업 범위 | 전체 네임스페이스 (`velero` 제외) |
| 저장 위치 | MinIO `velero` 버킷 |

```bash
# 백업 상태 확인
kubectl get backups -n velero

# 수동 백업 실행
velero backup create manual-$(date +%Y%m%d) --include-namespaces='*'

# 복구
velero restore create --from-backup <backup-name>
```

관련 파일:
- `kubernetes/argocd-apps/velero.yaml` — ArgoCD Application
- `kubernetes/helm-releases/velero/values.yaml` — 스케줄, 백업 대상, MinIO 설정

### MinIO 내구성

MinIO의 데이터 자체는 Longhorn PVC(2-replica) 위에 저장됩니다. Longhorn 로컬 스냅샷은 MinIO와 독립적으로 동작하므로 MinIO 장애 시에도 스냅샷을 통한 복구가 가능합니다.

> **한계**: 현재 구성은 클러스터 전체 소실에 대한 완전한 보호를 제공하지 않습니다. 완전한 DR(Disaster Recovery)을 위해서는 MinIO → 외부 S3(AWS/GCS)로의 `rclone sync` 추가가 권장됩니다.

### MinIO 버킷 구성

| 버킷 | 사용처 | 버전 관리 |
|------|--------|-----------|
| `longhorn-backups` | Longhorn PV 백업 | ✅ 활성화 |
| `velero` | Velero 클러스터 백업 | - |
| `loki-chunks` | Loki 로그 청크 | ✅ 활성화 |
| `tempo-traces` | Tempo 트레이스 블록 | - |

### 자격증명 관리

모든 백업 자격증명은 Kubernetes Secret으로 관리되며, Git에는 `REPLACE_ME` 플레이스홀더만 저장됩니다.

| Secret | 네임스페이스 | 용도 |
|--------|-------------|------|
| `minio-credentials` | minio-storage | MinIO 루트 계정 |
| `longhorn-backup-target-secret` | longhorn-system | Longhorn → MinIO S3 |
| `velero-credentials` | velero | Velero → MinIO S3 |
| `loki-minio-credentials` | monitoring | Loki → MinIO S3 |
| `tempo-minio-credentials` | monitoring | Tempo → MinIO S3 |

> Vault 구성 완료 후 각 Secret을 `ExternalSecret`으로 교체할 예정입니다.

### 백업 모니터링 및 알림

Grafana에서 **"Backup & Storage"** 폴더 아래 통합 대시보드를 제공합니다.

**알림 규칙** (`kubernetes/helm-releases/prometheus/backup-alerts.yaml`):

| 알림 | 심각도 | 조건 |
|------|--------|------|
| `LonghornVolumeBackupFailed` | critical | Longhorn 백업 Error 상태 5분 지속 |
| `LonghornBackupTargetUnreachable` | critical | MinIO 백업 타겟 2분 이상 응답 없음 |
| `LonghornNodeStorageLow` | warning | 노드 스토리지 사용률 80% 초과 |
| `LonghornVolumeActualSizeHigh` | warning | 볼륨 용량 사용률 85% 초과 |
| `VeleroBackupFailed` | critical | Velero 백업 실패 |
| `VeleroBackupMissing` | warning | 25시간 이상 성공한 백업 없음 |
| `LokiIngestionRateHigh` | warning | Loki 로그 수집 속도 비정상 |

---

## 빠른 시작

### 1. VM 생성
```bash
./infrastructure/libvirt/vm-setup.sh
```

### 2. Kubernetes 설치
```bash
./scripts/setup-k8s.sh
```

### 3. VPN 연결
```bash
./scripts/setup-headscale.sh
```

### 4. 플랫폼 배포 (ArgoCD)
```bash
kubectl apply -f kubernetes/argocd-apps/k8s-idp.yaml
```

## 문서

- [원격 접속 가이드](docs/remote-access-guide.md)
- [Kubernetes 접근 가이드](docs/k8s-access-guide.md)
- [Hubble 설치 가이드](docs/hubble-install-guide.md)
- [Vault 설치 가이드](security/vault/docs/vault-install.md)
- [Dex README](kubernetes/helm-releases/dex/README.md)
- [네트워크 정책 통신 매트릭스](kubernetes/network-policies/COMMUNICATION-MATRIX.md)

## 로드맵

- [ ] Vault HA 배포
- [ ] Backstage 한국어 UI 완성
- [ ] CI/CD 파이프라인 템플릿
- [x] GKE Burst 클러스터 Crossplane 자동 프로비저닝
- [x] GKE Burst 자동 트리거 (KEDA 연동)
- [x] AWS Crossplane Provider 연동 (EC2/S3/EKS/RDS)
- [x] Azure Crossplane Provider 연동 (VM/Blob/AKS/PostgreSQL)
- [x] 멀티 클라우드 Backstage 마법사 템플릿 (GCP/AWS/Azure)
- [x] Backstage Scaffolder 템플릿 일관성 정비 (values.* prefix 통일, tags 추가)
- [x] 플랫폼 서비스 HA 구성 (replicas:3 + PDB + Anti-Affinity)
- [x] MinIO Distributed Mode (4-node Erasure Coding)
- [ ] Backstage HPA 활성화 (CPU/Memory 기반 자동 스케일링)

## 팀원

- **관리자**: Headscale 서버 관리, Pre-auth key 발급, Dex 사용자 관리

## 라이선스

Private Repository
