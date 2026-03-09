# K8S-IDP: Kubernetes Internal Developer Platform

Kubernetes 기반 내부 개발자 플랫폼 인프라 설정 저장소입니다.

## 개요

이 저장소는 다음 구성요소의 Infrastructure as Code (IaC)를 포함합니다:

- **VM 인프라**: KVM/libvirt 기반 가상머신
- **Kubernetes 클러스터**: kubeadm + Cilium CNI
- **VPN**: Headscale (self-hosted Tailscale)
- **SSO**: Dex (예정)
- **시크릿 관리**: Vault (예정)
- **GitOps**: ArgoCD (예정)

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Server                               │
│                   (32C / 128GB / 2TB)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    KVM / libvirt                     │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │    │
│  │  │ k8s-cp  │ │ k8s-w1  │ │ k8s-w2  │ │ k8s-w3  │   │    │
│  │  │ 4C/16GB │ │ 8C/32GB │ │ 8C/32GB │ │ 8C/32GB │   │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │    │
│  └───────┼───────────┼───────────┼───────────┼─────────┘    │
│          │           │           │           │               │
│          └───────────┴─────┬─────┴───────────┘               │
│                            │                                 │
│                    Kubernetes Cluster                        │
│                            │                                 │
│  ┌─────────────────────────┴─────────────────────────────┐  │
│  │                    Headscale                           │  │
│  │              (VPN / Mesh Network)                      │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 디렉토리 구조

```
k8s-idp/
├── infrastructure/           # 인프라 설정
│   ├── libvirt/             # VM 생성 스크립트
│   │   ├── vm-setup.sh
│   │   └── cloud-init/
│   ├── headscale/           # VPN 설정
│   │   ├── config.yaml
│   │   └── acl_policy.hujson
│   └── kubernetes/          # K8s 초기 설정
│       ├── kubeadm-config.yaml
│       └── cilium-values.yaml
├── kubernetes/              # K8s 매니페스트
│   ├── namespaces/
│   ├── helm-releases/
│   │   ├── dex/
│   │   ├── vault/
│   │   └── argocd/
│   └── kustomize/
├── scripts/                 # 설치 스크립트
│   ├── setup-vm.sh
│   ├── setup-k8s.sh
│   └── setup-headscale.sh
├── docs/                    # 문서
│   └── remote-access-guide.md
└── README.md
```

## 클러스터 정보

| 노드 | IP (Internal) | Tailscale IP | 역할 |
|------|---------------|--------------|------|
| k8s-cp | 192.168.122.109 | 100.64.0.1 | Control Plane |
| k8s-w1 | 192.168.122.211 | 100.64.0.2 | Worker |
| k8s-w2 | 192.168.122.136 | 100.64.0.4 | Worker |
| k8s-w3 | 192.168.122.194 | 100.64.0.3 | Worker |

## 빠른 시작

### 1. VM 생성
```bash
./scripts/setup-vm.sh
```

### 2. Kubernetes 설치
```bash
./scripts/setup-k8s.sh
```

### 3. Headscale 연결
```bash
./scripts/setup-headscale.sh
```

## 문서

- [원격 접속 가이드](docs/remote-access-guide.md)

## 팀원

- **관리자**: Headscale 서버 관리, Pre-auth key 발급

## 라이선스

Private Repository
