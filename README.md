# K8S-IDP: Kubernetes Internal Developer Platform

## 프로젝트 소개

여행 플랫폼 비즈니스 회사의 **인프라팀**이 사내 개발자를 위해 구축한 **Internal Developer Platform (IDP)** 입니다.

개발자가 클라우드 리소스를 셀프서비스로 프로비저닝하고, 인프라팀은 보안·모니터링·비용최적화·오토스케일링·재해복구 등 견고한 운영 체계를 갖추는 것을 목표로 합니다. 여행 플랫폼 자체가 주 목적이 아니므로, trip-app은 간단한 UI 및 결제 시스템만 구현되어 있습니다.

**핵심 목표:**
- Backstage + Crossplane 기반 **셀프서비스 멀티 클라우드 프로비저닝** (GCP / AWS / Azure)
- GitOps(ArgoCD) + Vault + Kyverno 기반 **보안 및 정책 자동화**
- LGTM 스택 기반 **통합 관찰가능성** (Metrics, Logs, Traces)
- GKE Burst + EKS DR 기반 **오토스케일링 및 재해복구**
- Discord ChatOps + AI 분석 기반 **운영 자동화**

---

## 아키텍처 개요

### 플랫폼 레이어

| 레이어 | 컴포넌트 | 설명 |
|--------|----------|------|
| **인프라** | VM (KVM/libvirt) | 4VM: 1 CP (28GB) + 3 Workers (28GB each), Ansible 프로비저닝 |
| **네트워크** | Cilium CNI + Hubble | eBPF 기반 네트워킹 + 관찰가능성 |
| **서비스 메시** | Istio Ambient Mesh | mTLS 암호화, Sidecar 없음 |
| **VPN** | Cloud Headscale (GCP) | GCP 항시 가동, On-prem SPOF 해소 |
| **SSO** | Dex OIDC | 7명 사용자, 다중 서비스 연동 |
| **GitOps** | ArgoCD | Application of Apps 패턴 |
| **시크릿** | Vault + ESO | HA Raft ×3 + External Secrets Operator |
| **저장소** | Longhorn + MinIO | 블록 + 오브젝트 스토리지 (분산 HA) |
| **관찰가능성** | Prometheus + Grafana + LGTM | Metrics, Logs, Traces 통합 |
| **백업** | Longhorn + Velero + MinIO → S3/GCS | PV + 클러스터 상태 + 오프사이트 복제 |
| **DR** | EKS Active-Passive + GKE Burst | Dormant EKS → DR 활성화 → GKE Burst 연결 |

### 개발자 플랫폼

| 컴포넌트 | 설명 |
|----------|------|
| **Backstage** | 개발자 포털, 서비스 카탈로그, 셀프서비스 프로비저닝 |
| **Crossplane** | 멀티 클라우드 리소스 프로비저닝 (GCP 8종 / AWS 4종 / Azure 4종) |
| **GKE Burst** | On-prem/EKS 부하 초과 시 trip-app GKE 자동 확장 |
| **ChatOps** | Discord 기반 K8s 관리 봇 + AI 로그 분석 |
| **Kubecost** | 비용 모니터링 및 최적화 |
| **Kyverno** | 리소스 수명주기·보안 정책 적용 |
| **Cloud Credit Monitor** | AWS/GCP/Azure 크레딧·비용 Discord 알림 CronJob |
| **Lifecycle Scanner** | 만료 리소스 자동 감지·알림·삭제 CronJob |

### 멀티 클러스터 구성

```
┌──────────────────────────────────────────────────────────────────┐
│              Cloud Headscale (GCP, VPN Control Plane)             │
└──────┬──────────────────────┬──────────────────────┬─────────────┘
       │ tag:onprem           │ tag:gke-burst         │ tag:eks-dr
┌──────▼──────────┐   ┌──────▼──────────────┐   ┌────▼────────────┐
│ On-prem (Primary)│   │ GKE Burst (GCP)     │   │ EKS DR (AWS)    │
│ 4VM, K8s v1.32   │   │ asia-northeast3     │   │ ap-northeast-2  │
│                  │   │ preemptible nodes   │   │ dormant (노드 0) │
│ trip-app         │   │                     │   │                  │
│ Backstage        │──▶│ trip-app overflow   │   │ DR 활성화 시:    │
│ Monitoring       │   │ KEDA ScaledObject   │   │ trip-app         │
│ ChatOps          │   │                     │   │ Backstage (경량)  │
│ Crossplane       │   │ Prometheus Proxy    │◀──│ Prometheus       │
└──────────────────┘   └─────────────────────┘   └─────────────────┘

평시: On-prem Prometheus → GKE Proxy → KEDA → trip-app burst
DR:   EKS Prometheus → GKE Proxy → KEDA → trip-app burst
```

---

## 주요 기능

### Backstage 셀프서비스 프로비저닝

개발자가 Backstage Scaffolder 템플릿을 통해 클라우드 리소스를 직접 프로비저닝합니다.

| 템플릿 | 대상 | 특징 |
|--------|------|------|
| `service-wizard` | GCP VM/GCS/GKE/SQL | 3문항 마법사, 초보자 권장 |
| `aws-service-wizard` | AWS EC2/S3/RDS | 3문항 마법사, 초보자 권장 |
| `azure-service-wizard` | Azure VM/Blob/AKS/DB | 3문항 마법사, 초보자 권장 |
| `simple-server-template` | GCP/AWS/Azure VM | 3가지 선택만으로 즉시 생성 |
| `infrastructure-only` | GCP 직접 구성 | 숙련자용 세부 설정 |
| `aws-infrastructure` | AWS 직접 구성 | 숙련자용 세부 설정 |
| `azure-infrastructure` | Azure 직접 구성 | 숙련자용 세부 설정 |
| `service` / `service-with-infra` | 서비스 컴포넌트 | 코드 저장소 + 카탈로그 등록 |

모든 템플릿에 **수명주기 설정 단계** 포함 — 환경 티어(dev/staging/prod), 만료일, 비용 센터, 담당자 입력 및 정책 동의 필수.

### Crossplane Compositions

| 클라우드 | 리소스 타입 |
|----------|------------|
| **GCP** | VM, Storage, Database, GKE, Cache, PubSub, WebApp, **Burst Cluster** |
| **AWS** | EC2, S3, RDS, EKS |
| **Azure** | VM, Blob Storage, PostgreSQL/MySQL, AKS |

### ChatOps (Discord 봇)

| 카테고리 | 커맨드 |
|----------|--------|
| **운영** | `/pods`, `/allpods`, `/logs`, `/analyze` (AI), `/status` |
| **수명주기** | `/resources`, `/expiring [days]`, `/extend`, `/delete-resource`, `/setlifecyclechannel` |

---

## 리소스 수명주기 정책

무분별한 클라우드 리소스 프로비저닝 방지를 위한 3계층 구조:

```
[Layer 1: Backstage Template]  ← 요청 시점 soft gate (필수 필드 + 정책 동의)
         ↓ GitHub PR
[Layer 2: Kyverno Admission]   ← 클러스터 입장 hard gate (필수 레이블 · 사이즈 제한)
         ↓ ArgoCD Deploy
[Layer 3: Lifecycle Scanner]   ← 운영 중 자동 감지/알림/삭제 (CronJob + ChatOps)
```

| 티어 | 기본 TTL | 최대 TTL |
|------|----------|----------|
| `dev` | 7일 | 30일 |
| `staging` | 30일 | 90일 |
| `prod` | 무제한 | 무제한 (플랫폼팀 PR 승인 필요) |

**Kyverno 정책:**

| 정책 | 모드 | 내용 |
|------|------|------|
| 수명주기 레이블 필수 | Audit | 5개 레이블(team, owner, cost-center, tier, expires-at) 필수 |
| TTL 초과 차단 | Audit | 티어별 최대 TTL 초과 차단 |
| dev 과대 리소스 차단 | Audit | dev 티어 과대 VM/클러스터 차단 |
| 시스템 NS 생성 차단 | **Enforce** | 시스템 네임스페이스에 Claim 생성 차단 |
| 권한 상승 차단 | **Enforce** | escalate/impersonate verb 차단 |
| latest 태그 차단 | **Enforce** | `:latest` 태그 이미지 차단 |
| dev NS 쿼터 자동 생성 | Generate | dev 네임스페이스 ResourceQuota 자동 생성 |

---

## 보안

### RBAC 최소 권한 원칙

- **ArgoCD**: 전용 ClusterRole 사용, `escalate`/`impersonate` 제외
- **Backstage**: 클러스터 레벨 읽기 최소화, 네임스페이스별 Role 분리
- **ChatOps**: 네임스페이스별 RoleBinding으로 pods/log 접근 제한
- **Tailscale**: `kube-system` 네임스페이스 Role + `resourceNames` 특정 Secret만 허용

### 네트워크 보안

- **NetworkPolicy (Zero Trust)**: 모든 네임스페이스 `default-deny-all` 기반, 필요한 통신만 명시적 허용
- **Istio Ambient Mesh**: 서비스 간 mTLS 암호화 (STRICT 모드, monitoring만 PERMISSIVE)
- **Pod Security Admission**: `enforce: baseline` + `audit/warn: restricted`

### 시크릿 관리 (Vault + ESO)

```
관리자 (vault kv put) → Vault (HA Raft ×3) → ESO (K8s Auth) → K8s Secret → Pod
```

- Vault 경로 규칙: `secret/k8s/{namespace}/{secret-name}`
- 12종 ExternalSecret으로 자동 동기화 (auth, gitops, backstage, monitoring 등)
- **주의**: Vault에는 반드시 plaintext로 저장 (base64 이중 인코딩 방지)

### 취약점 스캐닝

- **Trivy Operator**: 컨테이너 CVE, RBAC 과다 권한, ConfigAudit 지속 스캔

---

## 관찰가능성 (LGTM 스택)

```
App Pod (stdout/stderr) → Alloy (DaemonSet) → Loki (로그) + Tempo (트레이스)
                          Prometheus (메트릭 스크레이프) → Grafana (통합 시각화 + 알림)
```

| 컴포넌트 | 역할 | 보존 기간 |
|----------|------|-----------|
| Prometheus | 메트릭 수집 (30s 간격) | 15일 |
| Loki | 로그 집계 | 30일 |
| Tempo | 분산 트레이스 | 7일 |
| Alloy | 로그·트레이스 수집 에이전트 | - |
| Grafana | 시각화 + 알림 | - |

---

## 고가용성 (HA)

플랫폼 핵심 서비스는 **replicas:3 + PDB + Anti-Affinity** 기본 구성:

| 서비스 | Replicas | PDB (minAvailable) | Anti-Affinity |
|--------|----------|--------------------|---------------|
| ArgoCD (Server/Controller/RepoServer) | 3 | 1 | preferred |
| ArgoCD Redis-HA | 3 | - | **required** |
| Dex (SSO) | 3 | 1 | preferred |
| Backstage Backend | 3 + HPA | 1 | preferred |
| MinIO Distributed | 4 (StatefulSet) | 2 | required |

---

## GKE Burst 오토스케일링

Primary 클러스터(On-prem 또는 EKS DR) 부하 초과 시 trip-app을 GKE로 overflow 확장합니다.

**동작 방식:**
1. `ClusterBurst` Claim 생성 → Crossplane이 GKE 자동 프로비저닝
2. KEDA ScaledObject가 Prometheus Proxy를 통해 Primary 메트릭 모니터링
3. 임계값 초과 시 GKE 노드 scale-out + Pod 수평 확장

| 트리거 | 임계값 | 동작 |
|--------|--------|------|
| Primary CPU > 70% (2분) | GKE 노드 scale-out |
| Primary Memory > 80% (2분) | GKE 노드 scale-out |
| Pending Pod > 3개 (1분) | GKE 노드 scale-out |
| HTTP 요청률 > 100 req/s | Pod 수평 확장 |
| 유휴 > 15분 | scale-to-zero (비용 절감) |

**메트릭 소스 전환** (Prometheus Proxy 패턴): KEDA는 항상 `prometheus-proxy`를 바라보고, Proxy upstream을 ConfigMap으로 전환하여 평시(On-prem) / DR시(EKS) 자동 대응.

---

## Disaster Recovery (DR)

온프레미스 장애 시 **EKS(AWS)**에서 핵심 서비스를 최소 복구하는 Active-Passive 구성입니다.

| 지표 | 목표 |
|------|------|
| RPO | 24시간 (일일 Velero 백업) |
| RTO | 30분 (노드 scale-up + Velero restore) |

**장애 감지 (Dead Man's Switch):**
- On-prem CronJob이 5분마다 S3에 heartbeat 업로드
- AWS Lambda가 15분 미갱신 시 Discord 장애 알림

**DR 흐름:**
1. `./scripts/dr-activate.sh` → EKS 노드 scale-up → Velero 복구
2. GKE Proxy upstream → EKS Prometheus로 전환 → burst 자동 발동

**Failback 흐름:**
1. `./scripts/dr-failback.sh` → On-prem 복구 확인 → EKS 백업 후 정리
2. GKE Proxy → On-prem 복귀, EKS `nodeCount: 0` (dormant)

| 항목 | 평시 | DR 발동 시 |
|------|------|-----------|
| EKS + S3 + Lambda | ~$74-76/월 | ~$104-106/월 |

> DR 복구 상세 절차는 [`docs/dr-runbook.md`](docs/dr-runbook.md) 참조.

---

## 백업 전략

MinIO를 내부 S3 허브로 활용하며, 오프사이트 복제로 클라우드에 DR 백업을 유지합니다.

```
Longhorn (PV 스냅샷/백업) ─┐
Velero (클러스터 상태)     ─┤── MinIO (S3 Hub) ── CronJob 04:30 UTC ──→ AWS S3
Loki (로그 청크)           ─┤                                          GCS
Tempo (트레이스 블록)      ─┘
```

| 백업 유형 | 스케줄 | 보존 |
|-----------|--------|------|
| Longhorn 스냅샷 | 매일 02:00 | 7개 |
| Longhorn → MinIO 백업 | 매일 03:00 | 14개 |
| Velero 클러스터 백업 | 매일 01:00 | 14일 |
| MinIO → S3 오프사이트 복제 | 매일 04:30 | DR용 |

---

## CI/CD 파이프라인

Self-hosted Runner (Actions Runner Controller) + ArgoCD GitOps 기반:

```
git push main → GitHub Actions (self-hosted) → Docker build/push → ArgoCD sync
```

| Workflow | 트리거 | 동작 |
|----------|--------|------|
| `deploy.yaml` | `main` push (backstage 제외) | ArgoCD sync |
| `backstage.yaml` | `backstage-app/**` push/PR | TypeCheck → Lint → Test → Docker push → sync |
| `chatops.yaml` | `chatops-app/**` push | Docker push → sync |
| `approval-gate.yaml` | PR (Cluster/prod 리소스) | 플랫폼팀 리뷰 자동 요청 |

---

## 빠른 시작

```bash
# 1. VM 생성
./infrastructure/libvirt/vm-setup.sh

# 2. 노드 OS 설정 (로그 관리, multipath, CP 리소스 제한)
cd ansible && ansible-playbook site.yml

# 3. Kubernetes 설치
./scripts/setup-k8s.sh

# 4. VPN 연결
./scripts/setup-headscale.sh

# 5. 플랫폼 배포 (ArgoCD)
kubectl apply -f kubernetes/argocd-apps/k8s-idp.yaml
```

### Ansible Roles

| Role | 대상 | 설명 |
|------|------|------|
| `common` | 전체 노드 | rsyslog 필터링, logrotate, journald 제한, multipath 블랙리스트 |
| `k8s-prereq` | 전체 노드 | 커널 모듈, containerd, kubelet 로그 제한 |
| `cp-resource-limits` | Control Plane | Static pod 메모리 제한 (apiserver 10Gi, etcd 2Gi, CM 1Gi, scheduler 512Mi) |
| `tailscale` | 전체 노드 | Tailscale 설치 및 Headscale 등록 |
| `headscale` | KVM 호스트 | Headscale 컨테이너 + DERP 설정 |

> 시크릿은 Ansible Vault로 암호화 (`ansible/inventory/group_vars/all/vault.yml`)

---

## 디렉토리 구조

```
k8s-idp/
├── infrastructure/          # VM, K8s 초기 설정, VPN, AWS DR 인프라
├── security/                # Vault HA + ESO 구성
├── kubernetes/
│   ├── namespaces/          # Namespace 정의
│   ├── helm-releases/       # Helm 차트 (ArgoCD, Backstage, Prometheus 등)
│   ├── manifests/           # K8s 매니페스트 (PDB, NetworkPolicy, Istio, GKE Burst, EKS DR 등)
│   ├── argocd-apps/         # ArgoCD Application 정의 (App of Apps)
│   ├── kyverno-policies/    # 수명주기, 보안, 격리 정책
│   ├── network-policies/    # Zero Trust 네트워크 정책
│   ├── observability/       # LGTM 스택 (Loki, Grafana, Tempo, Alloy)
│   └── storage/             # Longhorn, MinIO, 백업 설정
├── ansible/                 # 노드 OS 설정 Ansible (Vault 암호화, 로그/스토리지/CP 리소스 제한)
├── apps/                    # Backstage Scaffolder 생성 리소스 + GKE Burst Claim
├── backstage-app/           # Backstage 개발자 포털 (React + Node.js)
│   └── templates/           # Scaffolder 템플릿 9종 (GCP/AWS/Azure 마법사 + 직접 구성)
├── lifecycle-scanner/       # 만료 리소스 자동 정리 CronJob
├── chatops-app/             # Discord ChatOps 봇 (운영 + 수명주기 커맨드)
├── scripts/                 # 설치, DR 활성화/복귀, 모니터링 스크립트
├── kubeconfig/              # 팀별 Kubeconfig
└── docs/                    # 운영 가이드 문서
```

---

## 문서

- [원격 접속 가이드](docs/remote-access-guide.md)
- [Kubernetes 접근 가이드](docs/k8s-access-guide.md)
- [DR 복구 절차서](docs/dr-runbook.md)
- [시크릿 주입 흐름 및 CI/CD 상세](docs/secret-and-cicd-flow.md)
- [네트워크 정책 통신 매트릭스](kubernetes/network-policies/COMMUNICATION-MATRIX.md)
- [Vault 설치 가이드](security/vault/docs/vault-install.md)
- [Hubble 설치 가이드](docs/hubble-install-guide.md)

## 로드맵

- [x] Vault HA + ESO 연동
- [x] DR 구성 (EKS Active-Passive + Dead Man's Switch)
- [x] CI/CD 파이프라인 (ARC self-hosted + ArgoCD GitOps)
- [x] GKE Burst 자동 프로비저닝 + KEDA 트리거
- [x] 멀티 클라우드 Crossplane (GCP/AWS/Azure) + Backstage 마법사
- [x] 플랫폼 서비스 HA (replicas:3 + PDB + Anti-Affinity)
- [x] MinIO Distributed Mode (4-node Erasure Coding)
- [x] Ansible 기반 노드 프로비저닝 (Vault 암호화, 로그/스토리지/CP 리소스 제한)
- [ ] Backstage 한국어 UI 완성
- [ ] Backstage HPA 활성화
