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
│   │   ├── crossplane-compositions/  # XRD/Composition (7종)
│   │   └── crossplane-providers/     # GCP Provider
│   ├── argocd-apps/             # ArgoCD Application 정의
│   ├── network-policies/        # Zero Trust 네트워크 정책
│   ├── observability/           # LGTM 스택 (Loki, Grafana, Tempo, Alloy)
│   └── storage/                 # 스토리지 (Longhorn, MinIO)
├── apps/                        # Backstage Scaffolder 생성 리소스
│   └── .argocd/                 # ApplicationSet (자동 감지)
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

### 네트워크 정책 (Zero Trust)

- 기본 거부 (Default Deny All)
- Namespace 간 통신 제어
- 서비스별 세분화된 정책

### 팀별 접근 권한

| 팀 | Role | 권한 |
|----|------|------|
| Admin, Platform, GitOps, Security, SRE | cluster-admin | 전체 접근 |
| FinOps, AI | view | 읽기 전용 |

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

## 팀원

- **관리자**: Headscale 서버 관리, Pre-auth key 발급, Dex 사용자 관리

## 라이선스

Private Repository
