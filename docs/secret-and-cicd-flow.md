# 시크릿 주입 흐름 및 CI/CD 파이프라인

## 1. 시크릿 주입 흐름

### 전체 구조

```
GitHub / 관리자
      │
      │ vault kv put (초기 적재)
      ▼
┌─────────────────────────────────┐
│  HashiCorp Vault (HA Raft)      │
│  namespace: vault               │
│  3 replicas (vault-0/1/2)       │
│                                 │
│  secret/k8s/{namespace}/{name}  │  ← KV v2, plaintext 저장
└────────────────┬────────────────┘
                 │
      Kubernetes auth
      (external-secrets SA)
                 │
                 ▼
┌─────────────────────────────────┐
│  External Secrets Operator      │
│  namespace: external-secrets    │
│                                 │
│  ClusterSecretStore             │
│  └ vault-secret-store           │
│    auth: kubernetes             │
│    role: default-app-role       │
│    policy: allow_secrets        │
└────────────────┬────────────────┘
                 │
      ExternalSecret (refreshInterval: 1h)
                 │
                 ▼
┌─────────────────────────────────┐
│  Kubernetes Secret              │
│  각 namespace에 생성            │
│  creationPolicy: Owner          │  ← ESO가 소유, 자동 갱신
└────────────────┬────────────────┘
                 │
      envFrom.secretRef / volumeMount
                 │
                 ▼
┌─────────────────────────────────┐
│  Application Pod                │
│  (Backstage, Dex, ArgoCD 등)    │
└─────────────────────────────────┘
```

---

### 인증 방식 상세

#### Vault ↔ ESO 인증 (Kubernetes Auth)

```
ESO Pod (external-secrets SA)
  └─ ServiceAccount JWT 토큰 발급
       │
       ▼
  Vault Kubernetes Auth Backend
  └─ Role: default-app-role
       bound_service_account_names: external-secrets
       bound_service_account_namespaces: external-secrets
       policies: allow_secrets
       ttl: 1h
```

#### allow_secrets 정책 (Vault Policy)

```hcl
# 모든 네임스페이스의 k8s 시크릿 읽기 허용
path "secret/data/+/*" {
  capabilities = ["read", "list"]
}
path "secret/metadata/+/*" {
  capabilities = ["read", "list"]
}
path "secret/data/common/*" {
  capabilities = ["read", "list"]
}
```

---

### 시크릿 경로 규칙

| Vault 경로 | K8s Namespace | Secret 이름 | 용도 |
|------------|---------------|-------------|------|
| `secret/k8s/auth/dex-oidc-secrets` | auth | dex-oidc-secrets | Dex OIDC 클라이언트 시크릿 5종 |
| `secret/k8s/auth/dex-github-secret` | auth | dex-github-secret | GitHub OAuth 연동 |
| `secret/k8s/gitops/argocd-secret` | gitops | argocd-secret | ArgoCD TLS, admin 패스워드 |
| `secret/k8s/gitops/argocd-oidc-secret` | gitops | argocd-oidc-secret | ArgoCD OIDC 클라이언트 시크릿 |
| `secret/k8s/gitops/argocd-redis` | gitops | argocd-redis | ArgoCD Redis 패스워드 |
| `secret/k8s/gitops/repo-k8s-idp` | gitops | repo-k8s-idp | ArgoCD SSH repo 자격증명 |
| `secret/k8s/gitops/repo-k8s-idp-github-app` | gitops | repo-k8s-idp-github-app | ArgoCD GitHub App 자격증명 |
| `secret/k8s/backstage/backstage-backend-secrets` | backstage | backstage-backend-secrets | DB, OIDC, GitHub 토큰 |
| `secret/k8s/backstage/backstage-postgresql` | backstage | backstage-postgresql | PostgreSQL 패스워드 |
| `secret/k8s/monitoring/grafana-oauth-secret` | monitoring | grafana-oauth-secret | Grafana OAuth + admin 패스워드 |
| `secret/k8s/monitoring/loki-minio-credentials` | monitoring | loki-minio-credentials | Loki → MinIO 접근키 |
| `secret/k8s/monitoring/tempo-minio-credentials` | monitoring | tempo-minio-credentials | Tempo → MinIO 접근키 |
| `secret/k8s/minio-storage/minio-credentials` | minio-storage | minio-credentials | MinIO root 자격증명 |
| `secret/k8s/kubecost/oauth2-proxy-kubecost` | kubecost | oauth2-proxy-kubecost | Kubecost OAuth2 Proxy |
| `secret/k8s/longhorn-system/oauth2-proxy-longhorn` | longhorn-system | oauth2-proxy-longhorn | Longhorn OAuth2 Proxy |
| `secret/k8s/longhorn-system/longhorn-backup-target-secret` | longhorn-system | longhorn-backup-target-secret | Longhorn → MinIO 백업 |
| `secret/k8s/kube-system/tailscale-auth` | kube-system | tailscale-auth | Tailscale VPN auth key |
| `secret/k8s/chatops/chatops-bot-secret` | chatops | chatops-bot-secret | Discord Bot, Azure OpenAI |

---

### 시크릿 초기 적재 절차

```bash
# 1. Vault port-forward
kubectl port-forward svc/vault -n vault 8200:8200

# 2. Vault 로그인 (admin 정책 필요)
vault login

# 3. 플레이스홀더 적재
bash security/migration/seed-vault-secrets.sh

# 4. 실제 값으로 교체
vault kv put secret/k8s/<namespace>/<name> key=actual-value

# 5. ExternalSecret 적용
kubectl apply -f security/vault-infra/eso/external-secrets/

# 6. 동기화 확인
kubectl get externalsecret -A
```

---

### 주의사항

**Vault 저장 규칙**: 반드시 plaintext로 저장해야 합니다.

```bash
# 올바른 방법 - plaintext 저장
vault kv put secret/k8s/auth/dex-oidc-secrets ARGOCD_CLIENT_SECRET="실제값"

# 잘못된 방법 - base64 저장 (이중 인코딩 발생)
vault kv put secret/k8s/auth/dex-oidc-secrets ARGOCD_CLIENT_SECRET="$(echo -n '실제값' | base64)"
```

ESO ExternalSecret은 `decodingStrategy`를 설정하지 않습니다 (기본값 `None`).
Vault에 plaintext → ESO 추출 → K8s Secret `.data` 자동 base64 인코딩 → 앱 정상 수신.

---

## 2. CI/CD 파이프라인

### 전체 흐름

```
개발자
  │
  │ git push main
  ▼
GitHub (sydk-ktcloud/k8s-idp)
  │
  ├─[backstage-app/** 변경]──────────────────────────────────┐
  │                                                           │
  │  .github/workflows/backstage.yaml                        │
  │  ┌─────────────────────────────────────────────────┐     │
  │  │ Job: ci (self-hosted runner)                    │     │
  │  │  - yarn install / tsc / lint / test             │     │
  │  └──────────────────┬──────────────────────────────┘     │
  │                     │ needs: ci                          │
  │  ┌──────────────────▼──────────────────────────────┐     │
  │  │ Job: build-image (self-hosted runner)           │     │
  │  │  - Docker Buildx                                │     │
  │  │  - Push → docker.io/kylekim1223/backstage-backend│    │
  │  │    tags: main, sha-<short>, latest              │     │
  │  └──────────────────┬──────────────────────────────┘     │
  │                     │ needs: build-image                 │
  │                     └────────────────────────────────────┘
  │
  └─[기타 경로 변경]──────────────────────────────────────────┐
                                                              │
                       .github/workflows/deploy.yaml         │
                       ┌──────────────────────────────────┐  │
                       │ uses: argocd-sync.yaml           │  │
                       └────────────────┬─────────────────┘  │
                                        │                     │
                                        ▼                     ▼
                       ┌──────────────────────────────────────────┐
                       │ Job: sync (self-hosted runner)           │
                       │  .github/workflows/argocd-sync.yaml      │
                       │                                          │
                       │  1. POST /api/v1/session                 │
                       │     → ARGOCD_TOKEN 획득                  │
                       │                                          │
                       │  2. POST /api/v1/applications/k8s-idp/sync│
                       │     → ArgoCD sync 트리거                 │
                       │                                          │
                       │  3. Polling /api/v1/applications/k8s-idp │
                       │     상태 확인 (5초 간격, 최대 150초)      │
                       │     → Synced 확인 시 성공                │
                       └──────────────────────────────────────────┘
                                        │
                                        ▼
                       ┌──────────────────────────────────────────┐
                       │ ArgoCD (namespace: gitops)               │
                       │                                          │
                       │  App of Apps: k8s-idp                   │
                       │  └─ source: kubernetes/argocd-apps/      │
                       │     destination: cluster-local           │
                       │     syncPolicy: automated (selfHeal)     │
                       │                                          │
                       │  하위 Application들 자동 동기화:          │
                       │  backstage, monitoring, vault,           │
                       │  dex, cilium, longhorn, minio, ...       │
                       └──────────────────────────────────────────┘
```

---

### Self-hosted Runner 구성

```
GitHub Actions Runner Controller (ARC)
  namespace: actions-runner-system

  Deployment: actions-runner-controller
  └─ GitHub App 인증
     Secret: controller-manager
     ├─ github_app_id: 3106531
     ├─ github_app_installation_id: 116824106
     └─ github_app_private_key: <RSA PEM>

  RunnerDeployment: k8s-idp-runner-d8gtg
  └─ labels: ["self-hosted", "k8s-idp"]
     repository: sydk-ktcloud/k8s-idp
     replicas: 2
```

**Runner Pod가 사용하는 GitHub Actions secrets** (GitHub Repository Settings에 등록):

| Secret 이름 | 용도 |
|-------------|------|
| `ARGOCD_SERVER` | ArgoCD API 엔드포인트 |
| `ARGOCD_USERNAME` | ArgoCD 로그인 계정 |
| `ARGOCD_PASSWORD` | ArgoCD 로그인 패스워드 |
| `DOCKERHUB_USERNAME` | Docker Hub 푸시 계정 |
| `DOCKER_PASSWORD` | Docker Hub 패스워드 |

---

### Backstage 이미지 빌드 흐름 상세

```
backstage-app/** 변경 감지
        │
        ▼
[ci job] self-hosted runner
  1. checkout
  2. Node.js 22 setup (Corepack)
  3. yarn install --immutable
  4. yarn tsc          (타입 검사)
  5. yarn lint:all     (린트)
  6. yarn test:all     (테스트, continue-on-error)
        │
        ▼ needs: ci
[build-image job] self-hosted runner
  1. Docker Buildx 설정
  2. Docker Hub 로그인
  3. 태그 생성:
     - main
     - sha-<7자리 커밋해시>
     - latest
  4. Build & Push
     context: ./backstage-app
     Dockerfile: backstage-app/packages/backend/Dockerfile
     platform: linux/amd64
     cache: GitHub Actions Cache
        │
        ▼ needs: build-image
[deploy job]
  → argocd-sync.yaml 호출 (k8s-idp Application sync)
```

---

### ArgoCD App of Apps 구조

```
k8s-idp (App of Apps)
  └─ source: kubernetes/argocd-apps/
     ├─ argocd.yaml           → ArgoCD 자체
     ├─ vault.yaml            → Vault + Bank-Vaults Operator
     ├─ backstage.yaml        → Backstage
     ├─ dex.yaml              → Dex OIDC
     ├─ monitoring.yaml       → Prometheus + Grafana + Loki + Tempo
     ├─ cilium.yaml           → Cilium CNI + Hubble
     ├─ longhorn.yaml         → Longhorn 스토리지
     ├─ minio-distributed.yaml→ MinIO
     ├─ kubecost.yaml         → Kubecost
     ├─ crossplane.yaml       → Crossplane
     ├─ velero.yaml           → Velero 백업
     ├─ trip-app.yaml         → trip-app (GKE Burst 대상)
     ├─ eks-dr.yaml           → EKS DR 구성
     └─ ...
```

**selfHeal + prune 활성화**: 클러스터 상태가 Git과 달라지면 ArgoCD가 자동으로 Git 기준으로 복원.

---

### PR 생명주기 정책 검사 (approval-gate)

`apps/*/claim.yaml` 파일이 변경된 PR에서 자동 실행:

```
PR 열림
  │
  ▼
[check-lifecycle job] ubuntu-latest
  ├─ 변경된 claim.yaml 분석
  │
  ├─ Cluster/EKSCluster/AKSCluster kind 포함?
  │   └─ YES → @sydk-ktcloud/platform 팀 리뷰 요청
  │
  ├─ lifecycle-tier: prod 포함?
  │   └─ YES → @sydk-ktcloud/platform 팀 리뷰 요청
  │
  └─ 해당 없음 → PR에 자동 승인 코멘트
```

---

### 트러블슈팅 참조

#### ESO 동기화 수동 강제 실행

```bash
kubectl annotate externalsecret <name> -n <namespace> \
  force-sync=$(date +%s) --overwrite
```

#### Runner 상태 확인

```bash
kubectl get runners -n actions-runner-system
kubectl logs -n actions-runner-system deploy/actions-runner-controller --tail=30
```

#### GitHub App private key 갱신 후 controller-manager 업데이트

```bash
kubectl create secret generic controller-manager \
  -n actions-runner-system \
  --from-literal=github_app_id=3106531 \
  --from-literal=github_app_installation_id=116824106 \
  --from-file=github_app_private_key=/path/to/new-key.pem \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment actions-runner-controller -n actions-runner-system
```

#### Vault policy 드리프트 확인

```bash
# 실제 적용된 정책 조회
kubectl exec -n vault vault-1 -- vault policy read -tls-skip-verify allow_secrets

# 정책 업데이트
kubectl exec -n vault vault-1 -- sh -c "
  cat > /tmp/policy.hcl << 'EOF'
path \"secret/data/+/*\" { capabilities = [\"read\", \"list\"] }
path \"secret/metadata/+/*\" { capabilities = [\"read\", \"list\"] }
path \"secret/data/common/*\" { capabilities = [\"read\", \"list\"] }
path \"auth/token/lookup-self\" { capabilities = [\"read\"] }
path \"auth/token/renew-self\" { capabilities = [\"update\"] }
path \"sys/capabilities-self\" { capabilities = [\"update\"] }
EOF
  vault policy write -tls-skip-verify allow_secrets /tmp/policy.hcl
"
```
