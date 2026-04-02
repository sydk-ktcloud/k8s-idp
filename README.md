# K8S-IDP: Kubernetes Internal Developer Platform

Kubernetes 기반 내부 개발자 플랫폼 (IDP) 인프라 설정 저장소입니다.

## 개요

이 저장소는 다음 구성요소의 Infrastructure as Code (IaC)를 포함합니다:

### 플랫폼 레이어

| 레이어 | 컴포넌트 | 상태 | 설명 |
|--------|----------|------|------|
| **인프라** | VM (KVM/libvirt) | ✅ 배포됨 | 4VM: 1 CP + 3 Workers |
| **네트워크** | Cilium CNI + Hubble | ✅ 배포됨 | eBPF 기반 네트워킹 + 관찰가능성 |
| **서비스 메시** | Istio Ambient Mesh | ✅ 배포됨 | mTLS 암호화, Sidecar 없음 |
| **VPN** | Cloud Headscale (GCP) + Headplane | ✅ 배포됨 | GCP 항시 가동, On-prem SPOF 해소 |
| **SSO** | Dex OIDC | ✅ 배포됨 | 7명 사용자, 다중 서비스 연동 |
| **GitOps** | ArgoCD | ✅ 배포됨 | Application of Apps 패턴 |
| **시크릿** | Vault | 🔄 구성됨 | HA Raft 구성, 배포 대기 |
| **저장소** | Longhorn + MinIO | ✅ 배포됨 | 블록 스토리지 + 오브젝트 스토리지 |
| **관찰가능성** | Prometheus + Grafana + LGTM | ✅ 배포됨 | Metrics, Logs, Traces |
| **백업** | Longhorn Backup + Velero | ✅ 배포됨 | PV 백업 + 클러스터 상태 백업 |
| **DR** | EKS Active-Passive + GCS 오프사이트 | ✅ 구성됨 | Dormant EKS → DR 활성화 → GKE Burst 연결 |

### 개발자 플랫폼

| 컴포넌트 | 상태 | 설명 |
|----------|------|------|
| **Backstage** | ✅ 배포됨 | 개발자 포털, 서비스 카탈로그, 셀프서비스 |
| **Crossplane** | ✅ 배포됨 | 클라우드 리소스 프로비저닝 (GCP / AWS / Azure) |
| **GKE Burst** | ✅ 배포됨 | On-prem/EKS 부하 초과 시 trip-app GKE 자동 확장 |
| **ChatOps** | ✅ 배포됨 | Discord 기반 K8s 관리 봇 |
| **Kubecost** | ✅ 배포됨 | 비용 모니터링 및 최적화 |
| **Kyverno** | 🔄 Audit 모드 | 리소스 수명주기 정책 적용 (Hard Enforcement) |
| **Lifecycle Scanner** | 🔄 구성됨 | 만료 리소스 자동 감지·알림·삭제 CronJob |

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Host Server (32C/128GB/2TB)                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                           KVM / libvirt                                  ││
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                   ││
│  │   │ k8s-cp  │  │ k8s-w1  │  │ k8s-w2  │  │ k8s-w3  │                   ││
│  │   │ 4C/16GB │  │ 8C/32GB │  │ 8C/32GB │  │ 8C/32GB │                   ││
│  │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                   ││
│  └────────┼────────────┼────────────┼────────────┼─────────────────────────┘│
│           └────────────┴─────┬──────┴────────────┘                           │
│                              │ (3 Worker Nodes = HA 분산 배치)               │
│  ┌───────────────────────────┴─────────────────────────────────────────────┐│
│  │                    Kubernetes Cluster (v1.32.0)                          ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │              Service Mesh Layer (Istio Ambient Mesh)               │ ││
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐│ ││
│  │  │  │   istiod    │  │   ztunnel   │  │   HBONE mTLS Tunneling      ││ ││
│  │  │  │ (Control    │  │ (Node-level │  │   (Port 15008)              ││ ││
│  │  │  │  Plane)     │  │  L4 Proxy)  │  │   모든 서비스 간 암호화       ││ ││
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘│ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │          Platform Services  [replicas:3, PDB, anti-affinity]       │ ││
│  │  │  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐       │ ││
│  │  │  │    ArgoCD    │ │   Dex    │ │Backstage │ │  Crossplane │       │ ││
│  │  │  │server  ×3    │ │   ×3     │ │backend×3 │ │  (IaC)      │       │ ││
│  │  │  │controller×3  │ │+redis-ha │ │+HPA      │ │             │       │ ││
│  │  │  │repoServer×3  │ │  ×3      │ │          │ │             │       │ ││
│  │  │  └──────────────┘ └──────────┘ └──────────┘ └─────────────┘       │ ││
│  │  │  PodDisruptionBudgets: argocd-server, argocd-controller,           │ ││
│  │  │                        argocd-repo-server, dex, backstage-backend  │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │                    Observability Stack                              │ ││
│  │  │  ┌───────────┐ ┌─────────┐ ┌──────┐ ┌───────┐ ┌───────────┐       │ ││
│  │  │  │ Prometheus│ │ Grafana │ │ Loki │ │ Tempo │ │   Alloy   │       │ ││
│  │  │  └───────────┘ └─────────┘ └──────┘ └───────┘ └───────────┘       │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │              Storage Layer  [Distributed HA]                        │ ││
│  │  │  ┌────────────┐         ┌──────────────────────────────────┐       │ ││
│  │  │  │  Longhorn  │         │  MinIO Distributed (×4 StatefulSet│       │ ││
│  │  │  │ (Block)    │         │  Erasure Coding, PDB minAvail:2) │       │ ││
│  │  │  └────────────┘         └──────────────────────────────────┘       │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  └───────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘

── 멀티 클러스터 구성 ──

┌───────────────────────────────────────────────────────────────────────────┐
│                    Cloud Headscale (GCP e2-micro, 항시 가동)                │
│                         VPN Control Plane (SPOF 해소)                      │
└───────┬──────────────────────┬──────────────────────┬─────────────────────┘
        │ tag:onprem           │ tag:gke-burst         │ tag:eks-dr
┌───────▼───────────┐  ┌──────▼──────────────┐  ┌─────▼──────────────┐
│  On-prem (Primary) │  │  GKE Burst (GCP)    │  │  EKS DR (AWS)      │
│  4VM, K8s v1.32    │  │  asia-northeast3    │  │  ap-northeast-2    │
│                    │  │  preemptible nodes   │  │  dormant (노드 0)   │
│  ┌──────────────┐  │  │                     │  │                    │
│  │  trip-app    │  │  │  ┌───────────────┐  │  │  DR 활성화 시:      │
│  │  Backstage   │──┼──▶  │ trip-app      │  │  │  ┌──────────────┐  │
│  │  Monitoring  │  │  │  │ overflow Pods │  │  │  │ trip-app     │  │
│  │  ChatOps     │  │  │  └───────────────┘  │  │  │ Backstage    │  │
│  │  Crossplane  │  │  │                     │  │  │ Prometheus   │  │
│  └──────────────┘  │  │  ┌───────────────┐  │  │  │ (경량)       │  │
│                    │  │  │ KEDA          │  │  │  └──────┬───────┘  │
│  ┌──────────────┐  │  │  │ ScaledObject  │  │  │         │         │
│  │ Prometheus   │  │  │  └──────┬────────┘  │  │  부하 초과 시      │
│  │ active:*     │──┼──▶        │            │  │  GKE burst 발동   │
│  │ recording    │  │  │  ┌─────▼─────────┐  │  │         │         │
│  │ rules        │  │  │  │ Prometheus    │  │  │  ┌──────▼───────┐  │
│  └──────────────┘  │  │  │ Proxy (nginx) │◀─┼──┼──│ Prometheus   │  │
│                    │  │  └───────────────┘  │  │  │ active:*     │  │
└────────────────────┘  └─────────────────────┘  └──────────────────┘

평시 흐름:
  On-prem Prometheus ──▶ GKE Prometheus Proxy ──▶ KEDA ──▶ trip-app burst

DR 흐름 (On-prem 장애):
  EKS Prometheus ──▶ GKE Prometheus Proxy ──▶ KEDA ──▶ trip-app burst

Failback (On-prem 복구):
  GKE Proxy upstream → On-prem 복귀, EKS scale-to-zero (dormant)
```

## 디렉토리 구조

```
k8s-idp/
├── infrastructure/               # 인프라 설정
│   ├── libvirt/                 # VM 생성 (vm-setup.sh, cloud-init)
│   ├── kubernetes/              # K8s 초기 설정 (kubeadm, cilium)
│   ├── headscale/               # VPN 서버 설정 (On-prem, 백업용)
│   ├── headscale-cloud/         # Cloud Headscale (GCP 항시 가동, VPN SPOF 해소)
│   ├── headplane/               # VPN 관리 Web UI
│   └── aws-dr/                  # AWS DR 인프라 (EKS, Lambda, S3)
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
│   │   ├── eks-dr/              # EKS DR 매니페스트 (Tailscale, Prometheus, Velero, NetworkPolicy)
│   │   ├── gke-burst/            # GKE Burst 매니페스트 (KEDA, Tailscale, Prometheus Proxy)
│   │   ├── istio-ambient/       # Istio Ambient Mesh (mTLS, NetworkPolicy)
│   │   ├── crossplane-compositions/  # XRD/Composition (GCP 8종, AWS 4종, Azure 4종)
│   │   │   ├── aws/            # EC2Instance, S3Bucket, EKSCluster, RDSDatabase
│   │   │   └── azure/          # AzureVM, AzureBlobStorage, AKSCluster, AzureDatabase
│   │   └── crossplane-providers/     # GCP / AWS / Azure Provider
│   ├── argocd-apps/             # ArgoCD Application 정의
│   │   ├── kyverno.yaml        # Kyverno 설치 (syncWave: 0)
│   │   ├── kyverno-policies.yaml # Kyverno 정책 (syncWave: 1)
│   │   └── lifecycle-scanner.yaml # Lifecycle Scanner CronJob
│   ├── kyverno-policies/        # Kyverno ClusterPolicy 정의
│   │   ├── lifecycle/          # 수명주기 레이블 필수 + TTL 검증
│   │   ├── sizing/             # dev 티어 과대 리소스 차단
│   │   ├── isolation/          # 시스템 네임스페이스 생성 차단
│   │   ├── quotas/             # dev 네임스페이스 ResourceQuota 자동 생성
│   │   ├── rbac/               # escalate/impersonate 차단 (Enforce)
│   │   └── images/             # latest 태그 차단 (Audit)
│   ├── manifests/lifecycle-scanner/ # Scanner CronJob + RBAC
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
├── lifecycle-scanner/           # 만료 리소스 자동 정리
│   ├── scan.js                 # 만료 감지·알림·삭제 스크립트
│   └── Dockerfile              # 스캐너 컨테이너 이미지
├── chatops-app/                 # Discord ChatOps 봇
│   ├── commands/               # 슬래시 커맨드
│   │   ├── resources.js        # /resources — 전체 claim 목록
│   │   ├── expiring.js         # /expiring [days] — 만료 임박 리소스
│   │   ├── extend.js           # /extend — 만료일 연장 (platform/sre)
│   │   ├── delete-resource.js  # /delete-resource — claim 삭제 (platform)
│   │   └── setlifecyclechannel.js # /setlifecyclechannel — 알림 채널 설정
│   └── services/               # K8s/OpenAI 연동
├── scripts/                     # 설치 스크립트
│   ├── setup-k8s.sh            # K8s 클러스터 설치
│   ├── setup-headscale.sh      # VPN 서버 설정
│   ├── enable-hubble-ui.sh     # Hubble UI 활성화
│   ├── apply-network-policies.sh # Zero Trust 정책 적용
│   ├── setup-github-runner.sh  # GitHub Actions Runner
│   ├── dr-activate.sh          # DR 활성화 (EKS scale-up → 복구 → GKE 전환)
│   └── dr-failback.sh          # Failback (On-prem 복구 → EKS 정리)
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
| `istio-system` | Istio Ambient Mesh (istiod, ztunnel) |
| `auth` | Dex OIDC |
| `gitops` | ArgoCD |
| `backstage` | 개발자 포털 |
| `crossplane-system` | 클라우드 프로비저닝 |
| `monitoring` | Prometheus, Grafana, LGTM |
| `kubecost` | 비용 모니터링 |
| `longhorn-system` | 분산 스토리지 |
| `vault` | 시크릿 관리 (계획) |
| `kyverno` | 정책 엔진 (Admission Controller) |
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

모든 템플릿에는 **수명주기 설정 단계**가 포함됩니다. 리소스 생성 전 환경 티어(dev/staging/prod), 만료일, 비용 센터, 담당자를 입력하고 정책에 동의해야 합니다.

> **마법사 패턴**: 서비스 유형(web-api/file-service/container-app/data-processing)과 규모(dev/standard/large) 선택만으로 Crossplane Claim이 자동 생성됩니다.

> **템플릿 문법**: 모든 템플릿 파일(`.tmpl`)은 Backstage Scaffolder의 Nunjucks 문법을 사용하며, 파라미터는 `{{ values.paramName }}` 형식으로 참조합니다.

**기술 스택**: Backstage v1.49.0, React, Node.js 22

### 2. ChatOps (Discord 봇)

**목적**: Discord 기반 Kubernetes 운영 자동화

**주요 기능**:

운영 커맨드 (기존):
- `/pods` - 문제 파드 조회
- `/allpods` - 전체 파드 조회
- `/logs` - 파드 로그 확인
- `/analyze` - AI 로그 분석 (OpenAI)
- `/status` - 시스템 상태 확인

수명주기 커맨드 (신규):
- `/resources` - 팀별 프로비저닝된 전체 Claim 목록 (네임스페이스, kind, 만료일)
- `/expiring [days]` - N일 이내 만료 리소스 목록 (기본 7일, 🔴🟠🟡 우선순위 표시)
- `/extend <kind> <name> <ns> <date>` - 만료일 연장 (platform/sre 팀 전용)
- `/delete-resource <kind> <name> <ns>` - Claim 삭제 (platform 팀 전용, 확인 버튼 포함)
- `/setlifecyclechannel` - 수명주기 알림 채널 지정 (운영 채널과 분리)

> Discord 채널 분리: 운영 알림(`DISCORD_WEBHOOK_URL`)과 수명주기 알림(`DISCORD_LIFECYCLE_WEBHOOK_URL`)은 별도 채널로 전송됩니다.

**기술 스택**: Discord.js, Kubernetes Client (`CustomObjectsApi`), OpenAI API

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

**목적**: Primary 클러스터(On-prem 또는 EKS DR) 부하 초과 시 trip-app을 GKE로 overflow 확장

**동작 방식**:
1. `ClusterBurst` Claim 생성 → Crossplane이 GKE 클러스터 자동 프로비저닝
2. Cluster + NodePool (autoscaling 0~5) 구성
3. 연결 정보(`kubeconfig`)가 `default/gke-burst-kubeconfig` Secret에 자동 저장

**메트릭 소스 전환** (Prometheus Proxy 패턴):
- KEDA는 항상 `prometheus-proxy.burst-workloads:9090`을 바라봄
- Proxy의 upstream은 ConfigMap으로 관리 — 평시 On-prem, DR시 EKS
- Recording rule prefix `active:*`로 통일 → On-prem/EKS 모두 동일한 query

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

**자동 스케일링 로직**:

Primary 클러스터 부하를 실시간 모니터링하여 GKE burst 클러스터를 자동 확장합니다:

| 트리거 | 임계값 | 동작 |
|--------|--------|------|
| **Primary CPU** | > 70% (2분) | → GKE 노드 scale-out |
| **Primary Memory** | > 80% (2분) | → GKE 노드 scale-out |
| **Pending Pod** | > 3개 (1분) | → GKE 노드 scale-out |
| **HTTP 요청률** | > 100 req/s | → Pod 수평 확장 |
| **유휴 시간** | > 15분 | → scale-to-zero (비용 절감) |

**구현 요소**:
- **메트릭 수집**: Prometheus `active:*` recording rules (On-prem/EKS 동일)
- **Trigger**: KEDA ScaledObject → Prometheus Proxy (upstream 전환 가능)
- **Fallback**: 메트릭 소스 전환 중 scale-down 방지 (`failureThreshold: 5, replicas: 1`)
- **Pod 스케일**: HPA (CPU 70%, Memory 80%)
- **Node 스케일**: GKE Cluster Autoscaler (0~5 preemptible nodes)
- **Graceful Shutdown**: Preemptible VM 중단 시 30초 termination grace period

**모니터링 및 알림**:
```bash
# KEDA ScaledObject 상태 확인
kubectl --kubeconfig=kubeconfig/gke-burst get scaledobject -n burst-workloads

# HPA 상태 확인
kubectl --kubeconfig=kubeconfig/gke-burst get hpa -n burst-workloads

# Burst 트리거 alert (Discord)
# - OnPremCPUHighBurstNeeded
# - OnPremMemoryHighBurstNeeded
# - OnPremPendingPodsHighBurstNeeded
# - GKEBurstIdleNodesCostWaste (비용 낭비 감시)
```

**파일 구성**:
- `kubernetes/helm-releases/prometheus/values.yaml` - `active:*` recording rules
- `kubernetes/helm-releases/prometheus/burst-alerts.yaml` - Burst trigger + cost alerts
- `kubernetes/manifests/gke-burst/keda-scaler.yaml` - KEDA trigger 3개 (CPU, Memory, Pending Pod)
- `kubernetes/manifests/gke-burst/prometheus-proxy.yaml` - nginx proxy + ConfigMap (upstream 전환)
- `kubernetes/manifests/gke-burst/burst-workload-demo.yaml` - Deployment + HPA + PDB

### 5. EKS DR (Disaster Recovery)

**목적**: On-prem 전체 장애 시 핵심 서비스(trip-app, Backstage)를 EKS에서 복구

**평시 상태**: Dormant — Crossplane claim만 존재, `nodeCount: 0`, 비용 $0

**DR 활성화 시 복구 대상**:

| 복구 O | 복구 X (불필요) |
|--------|----------------|
| trip-app (frontend + backend + DB) | Monitoring (경량 Prometheus만 배포) |
| Backstage (개발자 포털) | ChatOps, Longhorn, Crossplane |

| 지표 | 목표 |
|------|------|
| RPO | 24시간 (일일 Velero 백업) |
| RTO | 30분 |

**DR 흐름**:
1. Heartbeat CronJob 15분 무응답 → GCP Cloud Monitoring → Discord 알림
2. `./scripts/dr-activate.sh` 실행
3. EKS 노드 3대 scale-up (Crossplane) → Velero로 GCS 백업 복구
4. GKE Prometheus Proxy upstream → EKS Prometheus로 전환
5. EKS 부하 초과 시 GKE burst 자동 발동

**Failback 흐름** (On-prem 복구 시):
1. `./scripts/dr-failback.sh` 실행
2. EKS에서 최종 백업 → On-prem에서 복구
3. GKE Proxy upstream → On-prem Prometheus로 복귀
4. EKS 워크로드 삭제 → `nodeCount: 0` (dormant)

**파일 구성**:
- `kubernetes/manifests/eks-dr/` - EKS DR 매니페스트 (Tailscale, Prometheus, Velero, NetworkPolicy)
- `kubernetes/argocd-apps/eks-dr.yaml` - ArgoCD App (sync disabled, DR시 수동 sync)
- `infrastructure/headscale-cloud/` - Cloud Headscale (GCP, VPN SPOF 해소)
- `scripts/dr-activate.sh` - DR 활성화 자동화 스크립트
- `scripts/dr-failback.sh` - Failback 자동화 스크립트
- `docs/dr-runbook.md` - DR/Failback 절차서

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

## 리소스 수명주기 정책

무분별한 클라우드 리소스 프로비저닝 방지 및 자동 만료/정리 체계를 3계층으로 구현합니다.

```
[Layer 1: Backstage Template]  ← 요청 시점 soft gate (필수 필드 + 정책 동의)
         ↓ GitHub PR
[Layer 2: Kyverno Admission]   ← 클러스터 입장 hard gate (필수 레이블 · 사이즈 제한)
         ↓ ArgoCD Deploy
[Layer 3: Lifecycle Scanner]   ← 운영 중 자동 감지/알림/삭제 (CronJob + ChatOps)
```

### Layer 1: 레이블 스키마 + Backstage 템플릿

모든 Crossplane Claim에 아래 레이블이 자동 삽입됩니다:

```yaml
metadata:
  labels:
    team: <team>
    owner: <github-username>
    cost-center: platform | developer | sre | finops | security
    lifecycle-tier: dev | staging | prod
    expires-at: "YYYY-MM-DD"
```

| 티어 | 기본 TTL | 최대 TTL | 비고 |
|------|----------|----------|------|
| `dev` | 7일 | 30일 | 개발·테스트 |
| `staging` | 30일 | 90일 | 스테이징 |
| `prod` | 무제한 | 무제한 | 플랫폼팀 PR 승인 필요 |

Backstage 템플릿(9개 전체)의 수명주기 설정 단계에서 담당자, 비용 센터, 만료일 입력 및 정책 동의(`acknowledge`)를 받습니다. `acknowledge` 미체크 시 "Next" 버튼이 비활성화됩니다(`enum: [true]` JSON Schema 검증).

GitHub Actions `approval-gate.yaml`이 Cluster/EKSCluster/AKSCluster 또는 `lifecycle-tier: prod` 리소스를 포함한 PR 생성 시 `@sydk-ktcloud/platform` 팀 리뷰를 자동 요청합니다.

### Layer 2: Kyverno 정책

| 정책 파일 | 모드 | 내용 |
|-----------|------|------|
| `lifecycle/require-lifecycle-labels.yaml` | Audit | 5개 레이블 필수 |
| `lifecycle/validate-expiry-window.yaml` | Audit | 티어별 최대 TTL 초과 차단 |
| `sizing/deny-oversized-dev.yaml` | Audit | dev 티어 과대 VM/클러스터 차단 |
| `isolation/restrict-claim-namespace.yaml` | **Enforce** | 시스템 네임스페이스 생성 차단 |
| `quotas/dev-namespace-quota.yaml` | Generate | dev 네임스페이스 ResourceQuota 자동 생성 |
| `rbac/deny-privilege-escalation-verbs.yaml` | **Enforce** | Role/ClusterRole에 escalate/impersonate 차단 |
| `images/disallow-latest-tag.yaml` | **Enforce** | `:latest` 태그 이미지 차단 (전체 워크로드 태그 고정 완료) |

> Audit 모드 정책은 2주 운영 후 위반 건수 확인(`kubectl get policyreport -A`) → Enforce 전환 예정.
> `rbac/deny-privilege-escalation-verbs`, `isolation/restrict-claim-namespace`, `images/disallow-latest-tag`는 즉시 Enforce.

#### 이미지 태그 고정 현황

`disallow-latest-tag` 정책 Enforce를 위해 모든 클러스터 내 워크로드 이미지를 명시적 버전 태그로 고정했습니다.

| 워크로드 | 이미지 | 태그 | 태깅 방식 |
|---------|--------|------|----------|
| trip-backend | `kylekim1223/trip-backend` | `2026-04-02` | 수동 빌드 날짜 태그 |
| trip-front (×3) | `kylekim1223/trip-front` | `v1.0.0` | Docker Hub retag |
| chatops-bot | `kylekim1223/chatops-bot` | `sha-43a56b2` | CI 자동 빌드 (GitHub Actions) |
| backstage-backend (×2) | `kylekim1223/backstage-backend` | `sha-5535754` | CI 자동 빌드 (GitHub Actions) |
| actions-runner | `summerwind/actions-runner` | `v2.333.1-ubuntu-24.04` | 업스트림 릴리스 |
| lifecycle-scanner | `ghcr.io/sydk-ktcloud/lifecycle-scanner` | `v1.0.0` | 첫 빌드 시 태그 예약 |
| minio-mc (Job) | `minio/mc` | `RELEASE.2025-08-13T08-35-41Z` | 업스트림 릴리스 |

> **CI 이미지 업데이트**: `backstage`와 `chatops`는 CI에서 `sha-<commit>` 태그를 자동 push하지만 deployment YAML은 수동 업데이트 필요. ArgoCD Image Updater 도입으로 자동화 가능.

#### Prometheus 메트릭 연동

Kyverno 4개 컨트롤러(admission/background/cleanup/reports)에 ServiceMonitor가 활성화되어 있습니다.
`release: prometheus` 레이블로 기존 Prometheus가 자동 수집합니다.

주요 메트릭:
- `kyverno_policy_results_total` — 정책별 pass/fail/warn 카운트
- `kyverno_admission_requests_total` — Admission 요청 수
- `kyverno_controller_reconcile_total` — Background 컨트롤러 reconcile 횟수

### Layer 3: Lifecycle Scanner

`lifecycle-scanner/scan.js`가 매일 08:00 UTC CronJob으로 실행됩니다:

| 상태 | 동작 |
|------|------|
| 만료 3일 전 | Discord `#lifecycle-alerts` 경고 메시지 |
| 만료 당일 | 최종 경고 메시지 |
| 만료 1일 경과 | `deleteNamespacedCustomObject()` → Crossplane이 클라우드 리소스 삭제 |

환경 변수 `DISCORD_LIFECYCLE_WEBHOOK_URL`로 운영 알림 채널과 분리됩니다.

---

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

### Istio Ambient Mesh (mTLS)

모든 서비스 간 트래픽은 Istio Ambient Mesh를 통해 mTLS로 암호화됩니다.

#### 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Istio Ambient Mesh                                │
│                                                                          │
│  ┌─────────────┐     ┌─────────────────────────────────────────────┐    │
│  │   istiod    │     │              ztunnel (per-node)               │    │
│  │ (Control    │────▶│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  │    │
│  │  Plane)     │     │  │Node 1 │  │Node 2 │  │Node 3 │  │Node 4 │  │    │
│  └─────────────┘     │  └───┬───┘  └───┬───┘  └───┬───┘  └───┬───┘  │    │
│                       │      │          │          │          │      │    │
│                       └──────┼──────────┼──────────┼──────────┼──────┘    │
│                              │          │          │          │           │
│  ┌───────────────────────────┴──────────┴──────────┴──────────┴──────┐    │
│  │                    HBONE mTLS Tunnel (Port 15008)                  │    │
│  │         모든 서비스 간 트래픽 자동 암호화 (Sidecar 없음)            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Pod A ──▶ ztunnel ──▶ HBONE Tunnel ──▶ ztunnel ──▶ Pod B               │
│         (L4 mTLS)         (암호화)         (L4 mTLS)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

#### mTLS 상태 (네임스페이스별)

| 네임스페이스 | mTLS 모드 | 비고 |
|-------------|-----------|------|
| `trip-app` | STRICT | 완전 mTLS 강제 |
| `backstage` | STRICT | 완전 mTLS 강제 |
| `chatops` | STRICT | 완전 mTLS 강제 |
| `gitops` | STRICT | ArgoCD 포함 |
| `auth` | STRICT | Dex 포함 |
| `monitoring` | PERMISSIVE | 메트릭 수집 호환성 |

#### 설정 파일

| 파일 | 설명 |
|------|------|
| `kubernetes/manifests/istio-ambient/allow-ambient-hostprobes.yaml` | kubelet health probe 허용 |
| `kubernetes/manifests/istio-ambient/peer-authentication.yaml` | STRICT mTLS 정책 |
| `kubernetes/manifests/istio-ambient/istio-ambient-hbone.yaml` | HBONE 터널 (Port 15008) 허용 |
| `infrastructure/kubernetes/cilium-istio-patch.yaml` | Cilium Istio 호환성 설정 |

#### 주요 설정값

```yaml
# Cilium Istio 호환성 (infrastructure/kubernetes/cilium-istio-patch.yaml)
cni-exclusive: "false"
bpf-lb-sock-hostns-only: "true"
```

#### 해결한 이슈들

| 이슈 | 원인 | 해결 방안 |
|------|------|----------|
| **클러스터 DNS 전체 불능** | 잘못된 CiliumClusterwideNetworkPolicy | namespace-scoped 정책으로 교체 |
| **HBONE mTLS 터널 차단** | Port 15088 미허용 | 각 namespace에 `istio-ambient-hbone` NetworkPolicy 추가 |
| **kubelet health probe 인터셉션** | Istio 1.29 INPOD 모드 이슈 | 특정 파드에 `istio.io/dataplane-mode: none` 적용 |

#### Health Probe 예외 파드

Istio 1.29 INPOD 모드의 알려진 이슈로 인해 다음 파드들은 ambient mesh에서 제외:

| 네임스페이스 | 파드 |
|-------------|------|
| `monitoring` | prometheus-kube-state-metrics, alertmanager |
| `monitoring` | loki-chunks-cache, loki-results-cache |
| `auth` | dex |
| `gitops` | argocd-notifications-controller |

#### 검증 명령어

```bash
# mTLS 상태 확인
istioctl authn tls-check

# ztunnel 로그에서 mTLS 확인
kubectl logs -n istio-system -l app=ztunnel | grep "connection_security_policy"

# 특정 네임스페이스 mTLS 활성화
kubectl label namespace <namespace> istio.io/dataplane-mode=ambient

# mTLS 비활성화 (롤백)
kubectl label namespace <namespace> istio.io/dataplane-mode-
```

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
4-node StatefulSet + Erasure Coding + HA 구성:
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

MinIO를 내부 S3 허브로 활용하며, **오프사이트 복제**를 통해 클라우드에 DR 백업을 유지합니다.

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

── 오프사이트 복제 (CronJob) ──────────────────────────────
   MinIO ──04:30 UTC──→ S3  (sydk-velero-dr-usw2, sydk-longhorn-dr-usw2)
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

> MinIO 데이터는 CronJob(`mc mirror`)으로 GCS 및 AWS S3에 매일 오프사이트 복제됩니다. 클러스터 전체 소실 시에도 클라우드 백업에서 DR 복구가 가능합니다.

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

> Vault + ESO(External Secrets Operator) 구성 완료. 모든 Secret은 `ExternalSecret`으로 Vault에서 자동 동기화됩니다.

### 오프사이트 복제 (MinIO → Cloud)

온프레미스 MinIO 백업을 GCS 및 AWS S3로 매일 복제하여 클러스터 전체 소실에 대비합니다.

| CronJob | 스케줄 | 소스 (MinIO) | 대상 | 용도 |
|---------|--------|-------------|------|------|
| `minio-s3-replication` | 04:30 UTC | velero, longhorn-backups | S3 (sydk-velero-dr-usw2, sydk-longhorn-dr-usw2) | EKS DR 복구용 |

관련 파일:
- `kubernetes/storage/minio-s3-replication.yaml` — S3 복제 CronJob

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

## Disaster Recovery (DR)

온프레미스 클러스터 장애 시 **EKS(AWS)**에서 핵심 서비스를 최소 복구하는 Active-Passive DR 구성입니다.

### 아키텍처

```
[On-Prem K8s] ── Heartbeat (5분) ──→ [S3] ──→ AWS Lambda (5분 체크)
     │                                              │
     │                                         15분 미수신 시
     │                                              ↓
     │                                     Discord 장애 알림
     │
     └── MinIO → S3 복제 (04:30 UTC) ──→ DR 복구용 백업
                                              │
                                    장애 시 Velero restore
                                              ↓
                                   [EKS k8s-idp-dr (us-west-2)]
                                    Spot t3.small, 평시 노드 0대
```

### 장애 감지 (Dead Man's Switch)

온프레미스 클러스터가 5분마다 S3에 heartbeat JSON을 업로드합니다.
AWS EventBridge가 5분마다 Lambda를 실행하여 heartbeat 파일의 LastModified를 확인하고,
**15분 이상 미갱신 시 Discord로 장애 알림**을 발송합니다.

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| `cluster-heartbeat` CronJob | 온프레미스 (minio-storage) | 5분마다 S3에 heartbeat 업로드 |
| `heartbeat-monitor` Lambda | AWS (us-west-2) | S3 heartbeat 확인 + Discord 알림 |
| `heartbeat-check` EventBridge Rule | AWS (us-west-2) | 5분마다 Lambda 트리거 |

관련 파일:
- `kubernetes/storage/heartbeat-cronjob.yaml` — Heartbeat CronJob

### EKS DR 클러스터

| 항목 | 값 |
|------|----|
| 클러스터 | `k8s-idp-dr` (us-west-2) |
| 노드 | Spot t3.small, 평시 0대 → DR 시 2대 |
| Velero BSL | S3 `sydk-velero-dr-usw2` |
| 복구 대상 | trip-app, backstage |
| 복구하지 않는 것 | monitoring, chatops, Longhorn, Crossplane |

### RPO / RTO

| 지표 | 목표 |
|------|------|
| RPO | 24시간 (일일 백업 주기) |
| RTO | 30분 (노드 스케일업 + Velero restore) |

### 비용

| 항목 | 평시 | DR 발동 시 |
|------|------|-----------|
| EKS Control Plane | $73/월 | $73/월 |
| Nodegroup (Spot t3.small) | $0 (0대) | ~$30/월 (2대) |
| S3 저장 | ~$1-3/월 | ~$1-3/월 |
| Lambda + EventBridge | ~$0 (프리티어) | ~$0 |
| **합계** | **~$74-76/월** | **~$104-106/월** |

> DR 복구 상세 절차는 [`docs/dr-runbook.md`](docs/dr-runbook.md)를 참조하세요.

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

## CI/CD 파이프라인

Self-hosted runner (Actions Runner Controller) + ArgoCD GitOps 기반 파이프라인입니다.

### 인프라

| 컴포넌트 | 설명 |
|----------|------|
| **Actions Runner Controller** | k8s 클러스터 내 self-hosted runner 운영 (`actions-runner-system`) |
| **Runner** | `sydk-ktcloud/k8s-idp` 레포 전용 2 replicas, GitHub App 인증 |
| **ArgoCD** | GitOps sync 엔드포인트 (`gitops` 네임스페이스) |

### Workflows

| 워크플로우 | 트리거 | 동작 |
|------------|--------|------|
| **Deploy to K8s** | `main` push (backstage 제외) | ArgoCD `k8s-idp` app sync |
| **Backstage CI/CD** | `backstage-app/**` push/PR | TypeCheck → Lint → Test → Docker 빌드/푸시 → ArgoCD sync |
| **Chatops CI/CD** | `chatops-app/**` push | Docker 빌드/푸시 → ArgoCD sync |

### 배포 흐름

```
git push → GitHub Actions (self-hosted runner)
               │
               ├─ backstage-app/** → Build & Push (kylekim1223/backstage-backend)
               ├─ chatops-app/**   → Build & Push (kylekim1223/chatops-bot)
               │
               └─ ArgoCD Sync (argocd-sync.yaml reusable workflow)
                      │
                      └─ ArgoCD pulls from Git → k8s 클러스터 반영
```

### 필요한 GitHub Secrets

| Secret | 용도 |
|--------|------|
| `ARGOCD_SERVER` | ArgoCD API 엔드포인트 |
| `ARGOCD_USERNAME` | ArgoCD 로그인 계정 |
| `ARGOCD_PASSWORD` | ArgoCD 로그인 비밀번호 |
| `DOCKERHUB_USERNAME` | Docker Hub 푸시 계정 |
| `DOCKER_PASSWORD` | Docker Hub 토큰 |

## 문서

- [원격 접속 가이드](docs/remote-access-guide.md)
- [Kubernetes 접근 가이드](docs/k8s-access-guide.md)
- [Hubble 설치 가이드](docs/hubble-install-guide.md)
- [Vault 설치 가이드](security/vault/docs/vault-install.md)
- [Dex README](kubernetes/helm-releases/dex/README.md)
- [네트워크 정책 통신 매트릭스](kubernetes/network-policies/COMMUNICATION-MATRIX.md)
- [DR 복구 절차서](docs/dr-runbook.md)

## 로드맵

- [x] Vault HA 배포 + ESO(External Secrets Operator) 연동
- [x] DR 구성 (EKS Active-Passive + S3/GCS 오프사이트 복제 + Dead Man's Switch)
- [ ] Backstage 한국어 UI 완성
- [x] CI/CD 파이프라인 (ARC self-hosted runner + ArgoCD GitOps)
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
