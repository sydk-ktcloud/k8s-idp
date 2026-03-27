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

### 개발자 플랫폼

| 컴포넌트 | 상태 | 설명 |
|----------|------|------|
| **Backstage** | ✅ 배포됨 | 개발자 포털, 서비스 카탈로그, 셀프서비스 |
| **Crossplane** | ✅ 배포됨 | 클라우드 리소스 프로비저닝 (GCP) |
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
│                              │                                          │
│  ┌───────────────────────────┴───────────────────────────────────────┐  │
│  │                    Kubernetes Cluster (v1.32.0)                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                      Platform Services                        │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐ │ │  │
│  │  │  │ ArgoCD  │ │  Dex    │ │ Backstage│ │Crossplane│ │Vault  │ │ │  │
│  │  │  │ (GitOps)│ │ (SSO)   │ │ (Portal) │ │ (IaC)   │ │(Secret)│ │ │  │
│  │  │  └─────────┘ └─────────┘ └──────────┘ └─────────┘ └───────┘ │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                    Observability Stack                        │ │  │
│  │  │  ┌───────────┐ ┌─────────┐ ┌──────┐ ┌───────┐ ┌───────────┐ │ │  │
│  │  │  │ Prometheus│ │ Grafana │ │ Loki │ │ Tempo │ │   Alloy   │ │ │  │
│  │  │  └───────────┘ └─────────┘ └──────┘ └───────┘ └───────────┘ │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                      Storage Layer                            │ │  │
│  │  │  ┌────────────┐                    ┌─────────┐               │ │  │
│  │  │  │  Longhorn  │                    │  MinIO  │               │ │  │
│  │  │  │ (Block)    │                    │ (Object)│               │ │  │
│  │  │  └────────────┘                    └─────────┘               │ │  │
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
│   │   ├── crossplane-compositions/  # XRD/Composition (8종, GKE Burst 포함)
│   │   └── crossplane-providers/     # GCP Provider
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
│   └── templates/              # Scaffolder 템플릿
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
| `minio-storage` | 오브젝트 스토리지 |
| `kube-system` | Cilium CNI, Hubble |

## 애플리케이션

### 1. Backstage (개발자 포털)

**목적**: 서비스 카탈로그, 문서화, 셀프서비스 프로비저닝

**주요 기능**:
- 서비스 카탈로그 (Catalog)
- 기술 문서 (TechDocs)
- 셀프서비스 템플릿 (Scaffolder)
- Kubernetes 리소스 조회
- Crossplane 기반 GCP 리소스 프로비저닝

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

### 3. Crossplane Compositions

**목적**: 개발자 셀프서비스 클라우드 리소스 프로비저닝

**지원 리소스**:
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
- [ ] 추가 Crossplane Compositions
- [ ] CI/CD 파이프라인 템플릿
- [x] GKE Burst 클러스터 Crossplane 자동 프로비저닝
- [ ] GKE Burst 자동 트리거 (HPA/KEDA 연동)

## 팀원

- **관리자**: Headscale 서버 관리, Pre-auth key 발급, Dex 사용자 관리

## 라이선스

Private Repository
