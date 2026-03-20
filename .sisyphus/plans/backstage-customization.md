# Backstage Self-Service Provisioning Platform

## TL;DR

> **Quick Summary**: Backstage를 개발자 친화적으로 커스터마이징하고, Crossplane 기반 Self-service Infrastructure Provisioning 기능 구현. 개발자가 인프라 지식 없이 원클릭으로 GCP 리소스를 프로비저닝할 수 있는 플랫폼 구축.
> 
> **Deliverables**:
> - 최적화된 Backstage (플러그인 14개 제거)
> - Crossplane XRD/Composition 4종 (VM, GCS, GKE, Cloud SQL)
> - Scaffolder 템플릿 3종 (서비스/인프라/묶음)
> - GitOps 워크플로우 (apps/ 디렉토리 + ArgoCD App 템플릿)
> - 커스텀 홈 페이지 + 한국어 지원
> 
> **Estimated Effort**: XL (Large multi-phase project)
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Phase 2 → Phase 3 → Phase 4 → Phase 5

---

## Context

### Original Request
Backstage에 있는 것들을 개발자 친화적으로 커스터마이징하되, 현재 Docker build가 무거워서 뭘 빼고 뭘 넣을지 결정이 필요. 특히 개발자가 인프라 지식 없이 원클릭으로 cloud 리소스를 프로비저닝할 수 있어야 함. Crossplane과 연계되어 Backstage → Git → ArgoCD → Crossplane → Provisioning까지 seamless하게 연결되어야 함.

### Interview Summary
**Key Discussions**:
- **팀 규모**: 1-10명 (작은 팀, 최소 기능으로 가볍게)
- **주요 사용패턴**: 배포/인프라 상태 확인, 새 프로젝트 생성 (Scaffolder)
- **Search**: 불필요 → 제거
- **실시간/알림**: 불필요 → 제거
- **개발자 친화적**: 한국어 지원, UI 간소화, 운영 가시성, 빠른 접근
- **Crossplane**: 설치만 됨 (provider-gcp:v1.0.0), XRD/Composition 정의 필요
- **프로비저닝 대상**: GCP 리소스 + Kubernetes 리소스
- **GitOps**: Monorepo (github.com/sydk-ktcloud/k8s-idp.git)
- **템플릿 종류**: 서비스 생성, 인프라만, 서비스+인프라 묶음

**Research Findings**:
- **Backstage**: Frontend 16개, Backend 20+개 플러그인 설치됨
- **Dockerfile**: Runtime에 불필요한 빌드 도구 포함 (python3, g++, build-essential)
- **Crossplane**: provider-gcp:v1.0.0 설치됨, project: sydk-ktcloud, credentials secret 존재
- **ArgoCD**: k8s-idp 리포 사용, auto-sync 활성
- **기본 템플릿**: Node.js 템플릿만 존재, Crossplane 미연동

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Backstage UI                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Catalog   │  │  TechDocs   │  │     Scaffolder          │  │
│  │             │  │             │  │  🆕 GCP VM              │  │
│  │ - Services  │  │ - Runbooks  │  │  🆕 GCS Bucket          │  │
│  │ - APIs      │  │ - Guides    │  │  🆕 GKE Cluster         │  │
│  │ - Resources │  │             │  │  🆕 서비스 + 인프라      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                     Scaffolder Backend                            │
│  1. fetch:template  →  Crossplane Claim YAML 생성                │
│  2. publish:github  →  k8s-idp/apps/{service}/ PR 생성           │
│  3. catalog:register →  Backstage Catalog 등록                   │
└───────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                    GitHub (k8s-idp repo)                          │
│  k8s-idp/                                                         │
│  ├── kubernetes/argocd-apps/        ← ArgoCD Application         │
│  ├── kubernetes/manifests/                                       │
│  │   └── crossplane-compositions/  ← XRD/Composition             │
│  └── apps/                         ← 🆕 개발자 리소스            │
│      └── service-a/                                              │
│          ├── claim.yaml            ← Crossplane Claim            │
│          └── kustomization.yaml    ← ArgoCD ApplicationSet       │
└───────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│   ArgoCD → Crossplane → GCP (VM, GCS, GKE, Cloud SQL)            │
└───────────────────────────────────────────────────────────────────┘
```

---

## Work Objectives

### Core Objective
개발자가 인프라 지식 없이 Backstage에서 원클릭으로 GCP 리소스를 프로비저닝할 수 있는 Self-service Platform 구축. 동시에 Docker 이미지 크기를 최적화하고 UI를 개발자 친화적으로 개선.

### Concrete Deliverables
1. **최적화된 Backstage** (플러그인 14개 제거, Docker 이미지 ~50% 감소)
2. **Crossplane XRD/Composition 4종** (XGCPInstance, XBucket, XCluster, XDatabase)
3. **Scaffolder 템플릿 3종** (서비스 생성, 인프라만, 서비스+인프라 묶음)
4. **GitOps 워크플로우** (apps/ 디렉토리 구조, ArgoCD ApplicationSet)
5. **커스텀 홈 페이지** (프로비저닝 바로가기, 내 리소스 목록)
6. **한국어 지원** (UI 라벨, 템플릿 설명)

### Definition of Done
- [ ] `yarn build:backend` 성공
- [ ] Docker 이미지 빌드 성공 (`docker build -t backstage .`)
- [ ] Crossplane XRD 4개가 클러스터에 존재 (`kubectl get xrd`)
- [ ] Scaffolder 템플릿 3개가 Backstage UI에 표시
- [ ] 템플릿 실행 시 PR 생성 → ArgoCD 동기화 → Crossplane 리소스 생성 확인

### Must Have
- Crossplane 기반 GCP 리소스 프로비저닝 (VM, GCS, GKE, Cloud SQL)
- Scaffolder 템플릿 3종
- GitOps 워크플로우 (PR → ArgoCD → Crossplane)
- 플러그인 정리 (Search, Signals, Notifications 제거)

### Must NOT Have (Guardrails)
- **Search 플러그인 유지 금지** - 사용하지 않으므로 제거
- **실시간 기능 (Signals) 추가 금지** - 불필요한 복잡성 증가
- **알림 기능 (Notifications) 추가 금지** - 알림 채널 없음
- **GitHub Auth Provider 유지 금지** - OIDC만 사용
- **Kubernetes 플러그인 제거 금지** - Crossplane 리소스 조회에 필요
- **Runtime 이미지에 빌드 도구 포함 금지** - python3, g++, build-essential 제거
- **별도 리포 생성 금지** - Monorepo (k8s-idp) 내 apps/ 디렉토리 사용

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Backstage 테스트 파일 존재)
- **Automated tests**: Tests-after (구현 후 검증)
- **Framework**: bun test (Backstage 기본)
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **Kubernetes**: Use Bash (kubectl) — Apply manifests, verify resources, check status
- **Backstage**: Use Bash (curl) — API calls, template execution, catalog queries

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 플러그인 정리 + 최적화):
├── Task 1: Frontend 플러그인 제거 [quick]
├── Task 2: Backend 플러그인 제거 [quick]
├── Task 3: Dockerfile 최적화 [quick]
└── Task 4: 빌드 검증 [quick]

Wave 2 (After Wave 1 — Crossplane XRD/Composition):
├── Task 5: XGCPInstance (VM) XRD + Composition [deep]
├── Task 6: XBucket (GCS) XRD + Composition [deep]
├── Task 7: XCluster (GKE) XRD + Composition [deep]
└── Task 8: XDatabase (Cloud SQL) XRD + Composition [deep]

Wave 3 (After Wave 2 — Scaffolder 템플릿):
├── Task 9: 인프라만 템플릿 [quick]
├── Task 10: 서비스 생성 템플릿 [quick]
├── Task 11: 서비스+인프라 묶음 템플릿 [quick]
└── Task 12: 템플릿 등록 및 검증 [quick]

Wave 4 (After Wave 3 — GitOps 워크플로우):
├── Task 13: apps/ 디렉토리 구조 생성 [quick]
├── Task 14: ArgoCD ApplicationSet 템플릿 [quick]
├── Task 15: Kubernetes 플러그인 설정 (Crossplane용) [quick]
└── Task 16: End-to-End 테스트 [deep]

Wave 5 (After Wave 4 — UI 커스터마이징):
├── Task 17: 커스텀 홈 페이지 [visual-engineering]
├── Task 18: 한국어 지원 [quick]
└── Task 19: 메뉴 간소화 [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Blocked By | Blocks |
|------|------------|--------|
| 1-4 | — | 5-19 |
| 5-8 | 1-4 | 9-12, 16 |
| 9-12 | 5-8 | 13-16 |
| 13-16 | 9-12 | 17-19 |
| 17-19 | 13-16 | F1-F4 |
| F1-F4 | 1-19 | — |

### Agent Dispatch Summary

- **Wave 1**: 4 tasks → `quick` (4)
- **Wave 2**: 4 tasks → `deep` (4)
- **Wave 3**: 4 tasks → `quick` (4)
- **Wave 4**: 4 tasks → `quick` (3) + `deep` (1)
- **Wave 5**: 3 tasks → `visual-engineering` (1) + `quick` (2)
- **FINAL**: 4 tasks → `oracle` (1) + `unspecified-high` (2) + `deep` (1)

---

## TODOs

- [ ] 1. Frontend 플러그인 제거

  **What to do**:
  - `packages/app/package.json`에서 불필요한 플러그인 제거:
    - @backstage/plugin-search
    - @backstage/plugin-search-react
    - @backstage/plugin-signals
    - @backstage/plugin-notifications
    - @backstage/plugin-api-docs
    - @backstage/plugin-catalog-graph
  - `packages/app/src/App.tsx`에서 해당 플러그인 import 및 route 제거
  - `yarn install` 실행하여 의존성 정리

  **Must NOT do**:
  - @backstage/plugin-kubernetes 제거 (Crossplane용으로 유지)
  - @backstage/plugin-catalog, techdocs, scaffolder, org 제거

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순한 package.json 수정 및 import 제거
  - **Skills**: []
    - 기본 작업으로 추가 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5-19
  - **Blocked By**: None

  **References**:
  - `backstage-app/packages/app/package.json` - 현재 설치된 플러그인 목록
  - `backstage-app/packages/app/src/App.tsx` - 플러그인 route 및 import

  **Acceptance Criteria**:
  - [ ] package.json에서 6개 플러그인 제거됨
  - [ ] App.tsx에서 해당 플러그인 import/route 제거됨
  - [ ] `yarn install` 성공

  **QA Scenarios**:
  ```
  Scenario: Frontend 빌드 성공
    Tool: Bash
    Steps:
      1. cd backstage-app && yarn install
      2. yarn build
    Expected Result: Build success, no errors
    Evidence: .sisyphus/evidence/task-01-frontend-build.log
  ```

  **Commit**: YES (Wave 1)
  - Message: `refactor(backstage): remove unused frontend plugins`
  - Files: packages/app/package.json, packages/app/src/App.tsx

- [ ] 2. Backend 플러그인 제거

  **What to do**:
  - `packages/backend/package.json`에서 불필요한 플러그인 제거:
    - @backstage/plugin-search-backend
    - plugin-search-backend-module-catalog
    - plugin-search-backend-module-pg
    - plugin-search-backend-module-techdocs
    - plugin-search-backend-node
    - @backstage/plugin-signals-backend
    - @backstage/plugin-notifications-backend
    - plugin-scaffolder-backend-module-notifications
    - @backstage/plugin-auth-backend-module-github-provider
  - `packages/backend/src/index.ts`에서 해당 플러그인 import 및 초기화 코드 제거
  - `yarn install` 실행

  **Must NOT do**:
  - plugin-kubernetes-backend 제거 (Crossplane용)
  - Auth 관련 guest-provider, oidc-provider 제거

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순한 package.json 수정 및 import 제거
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5-19
  - **Blocked By**: None

  **References**:
  - `backstage-app/packages/backend/package.json` - 현재 설치된 백엔드 플러그인
  - `backstage-app/packages/backend/src/index.ts` - 플러그인 초기화 코드

  **Acceptance Criteria**:
  - [ ] package.json에서 9개 플러그인 제거됨
  - [ ] index.ts에서 해당 플러그인 import/초기화 제거됨
  - [ ] `yarn install` 성공

  **QA Scenarios**:
  ```
  Scenario: Backend 빌드 성공
    Tool: Bash
    Steps:
      1. cd backstage-app && yarn install
      2. yarn build:backend
    Expected Result: Build success, no errors
    Evidence: .sisyphus/evidence/task-02-backend-build.log
  ```

  **Commit**: YES (Wave 1)
  - Message: `refactor(backstage): remove unused backend plugins`
  - Files: packages/backend/package.json, packages/backend/src/index.ts

- [ ] 3. Dockerfile 최적화

  **What to do**:
  - `packages/backend/Dockerfile` 최적화:
    - Runtime stage에서 python3, g++, build-essential 제거
    - libsqlite3-dev 제거 (PostgreSQL 사용)
    - 이미지 크기 최소화를 위한 레이어 정리
  - 불필요한 better-sqlite3 의존성 제거 검토

  **Must NOT do**:
  - Build stage 수정 (빌드 도구는 필요)
  - Production database 설정 변경

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Dockerfile 수정은 단순 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 5-19
  - **Blocked By**: None

  **References**:
  - `backstage-app/packages/backend/Dockerfile` - 현재 Dockerfile
  - Backstage Docker best practices: https://backstage.io/docs/deployment/docker

  **Acceptance Criteria**:
  - [ ] Runtime stage에 불필요한 빌드 도구 제거됨
  - [ ] Docker 이미지 빌드 성공
  - [ ] 이미지 크기 감소 확인

  **QA Scenarios**:
  ```
  Scenario: Docker 이미지 빌드 성공
    Tool: Bash
    Steps:
      1. cd backstage-app
      2. docker build -t backstage-optimized -f packages/backend/Dockerfile .
      3. docker images backstage-optimized --format "{{.Size}}"
    Expected Result: Image builds successfully, size reduced
    Evidence: .sisyphus/evidence/task-03-docker-build.log
  ```

  **Commit**: YES (Wave 1)
  - Message: `refactor(backstage): optimize Dockerfile for smaller image`
  - Files: packages/backend/Dockerfile

- [ ] 4. 빌드 검증

  **What to do**:
  - 전체 빌드 테스트: `yarn build:all`
  - TypeScript 컴파일 확인: `yarn tsc`
  - Lint 확인: `yarn lint`
  - 플러그인 제거 후 발생한 에러 수정

  **Must NOT do**:
  - 새로운 기능 추가
  - 설정 파일 구조 변경

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 빌드 검증 및 에러 수정
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 5-19
  - **Blocked By**: None

  **References**:
  - `backstage-app/package.json` - 빌드 스크립트

  **Acceptance Criteria**:
  - [ ] `yarn build:all` 성공
  - [ ] `yarn tsc` 에러 없음
  - [ ] `yarn lint` 통과

  **QA Scenarios**:
  ```
  Scenario: 전체 빌드 성공
    Tool: Bash
    Steps:
      1. cd backstage-app
      2. yarn build:all
      3. yarn tsc
      4. yarn lint
    Expected Result: All commands succeed with exit code 0
    Evidence: .sisyphus/evidence/task-04-full-build.log
  ```

  **Commit**: NO (검증만 수행)

- [ ] 5. XGCPInstance (VM) XRD + Composition

  **What to do**:
  - `kubernetes/manifests/crossplane-compositions/` 디렉토리 생성
  - XGCPInstance XRD (CompositeResourceDefinition) 작성:
    - spec: machineType, region, zone, diskSize, networkTags
  - XGCPInstance Composition 작성:
    - compute.googleapis.com/Instance 리소스 매핑
    - 기본값 및 파라미터 변환 로직
  - 클러스터에 적용 테스트

  **Must NOT do**:
  - ProviderConfig 수정 (이미 존재)
  - 실제 GCP 리소스 생성 (테스트만)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Crossplane XRD/Composition 설계는 복잡한 로직 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Tasks 9-12, 16
  - **Blocked By**: Tasks 1-4

  **References**:
  - `kubernetes/manifests/crossplane-providers/gcp-provider.yaml` - Provider 설정
  - Crossplane docs: https://docs.crossplane.io/latest/concepts/compositions/
  - GCP Provider: https://marketplace.upbound.io/providers/upbound/provider-gcp/

  **Acceptance Criteria**:
  - [ ] XRD 파일 생성됨
  - [ ] Composition 파일 생성됨
  - [ ] `kubectl apply -f xrd.yaml` 성공
  - [ ] `kubectl get xrd`에서 XGCPInstance 표시

  **QA Scenarios**:
  ```
  Scenario: XRD/Composition 적용 성공
    Tool: Bash
    Steps:
      1. kubectl apply -f kubernetes/manifests/crossplane-compositions/xgcpinstance-xrd.yaml
      2. kubectl apply -f kubernetes/manifests/crossplane-compositions/xgcpinstance-composition.yaml
      3. kubectl get xrd xgcpinstances.example.org
      4. kubectl get composition
    Expected Result: XRD and Composition created successfully
    Evidence: .sisyphus/evidence/task-05-xrd-apply.log
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(crossplane): add XGCPInstance XRD and Composition`
  - Files: kubernetes/manifests/crossplane-compositions/xgcpinstance-*.yaml

- [ ] 6. XBucket (GCS) XRD + Composition

  **What to do**:
  - XBucket XRD 작성:
    - spec: name, location, storageClass, versioning
  - XBucket Composition 작성:
    - storage.googleapis.com/Bucket 리소스 매핑
  - 클러스터에 적용 테스트

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Crossplane Composition 설계 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: Tasks 9-12, 16
  - **Blocked By**: Tasks 1-4

  **References**:
  - GCP Storage Provider: https://marketplace.upbound.io/providers/upbound/provider-gcp/storage/

  **Acceptance Criteria**:
  - [ ] XRD 파일 생성됨
  - [ ] Composition 파일 생성됨
  - [ ] `kubectl apply` 성공

  **QA Scenarios**:
  ```
  Scenario: XBucket XRD/Composition 적용
    Tool: Bash
    Steps:
      1. kubectl apply -f kubernetes/manifests/crossplane-compositions/xbucket-xrd.yaml
      2. kubectl apply -f kubernetes/manifests/crossplane-compositions/xbucket-composition.yaml
      3. kubectl get xrd xbuckets.example.org
    Expected Result: XRD and Composition created
    Evidence: .sisyphus/evidence/task-06-xbucket-apply.log
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(crossplane): add XBucket XRD and Composition`

- [ ] 7. XCluster (GKE) XRD + Composition

  **What to do**:
  - XCluster XRD 작성:
    - spec: name, location, nodeCount, machineType, network
  - XCluster Composition 작성:
    - container.googleapis.com/Cluster 리소스 매핑
    - NodePool 구성 포함
  - 클러스터에 적용 테스트

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: GKE Cluster는 복잡한 구성 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Tasks 9-12, 16
  - **Blocked By**: Tasks 1-4

  **References**:
  - GCP Container Provider: https://marketplace.upbound.io/providers/upbound/provider-gcp/container/

  **Acceptance Criteria**:
  - [ ] XRD 파일 생성됨
  - [ ] Composition 파일 생성됨
  - [ ] `kubectl apply` 성공

  **QA Scenarios**:
  ```
  Scenario: XCluster XRD/Composition 적용
    Tool: Bash
    Steps:
      1. kubectl apply -f kubernetes/manifests/crossplane-compositions/xcluster-xrd.yaml
      2. kubectl apply -f kubernetes/manifests/crossplane-compositions/xcluster-composition.yaml
      3. kubectl get xrd xclusters.example.org
    Expected Result: XRD and Composition created
    Evidence: .sisyphus/evidence/task-07-xcluster-apply.log
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(crossplane): add XCluster XRD and Composition`

- [ ] 8. XDatabase (Cloud SQL) XRD + Composition

  **What to do**:
  - XDatabase XRD 작성:
    - spec: name, databaseVersion, tier, region, diskSize
  - XDatabase Composition 작성:
    - sqladmin.googleapis.com/DatabaseInstance 리소스 매핑
    - Database, User 리소스 포함
  - 클러스터에 적용 테스트

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Cloud SQL은 복잡한 구성 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Tasks 9-12, 16
  - **Blocked By**: Tasks 1-4

  **References**:
  - GCP SQL Provider: https://marketplace.upbound.io/providers/upbound/provider-gcp/sql/

  **Acceptance Criteria**:
  - [ ] XRD 파일 생성됨
  - [ ] Composition 파일 생성됨
  - [ ] `kubectl apply` 성공

  **QA Scenarios**:
  ```
  Scenario: XDatabase XRD/Composition 적용
    Tool: Bash
    Steps:
      1. kubectl apply -f kubernetes/manifests/crossplane-compositions/xdatabase-xrd.yaml
      2. kubectl apply -f kubernetes/manifests/crossplane-compositions/xdatabase-composition.yaml
      3. kubectl get xrd xdatabases.example.org
    Expected Result: XRD and Composition created
    Evidence: .sisyphus/evidence/task-08-xdatabase-apply.log
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(crossplane): add XDatabase XRD and Composition`

- [ ] 9. 인프라만 템플릿 (Infrastructure-Only Template)

  **What to do**:
  - `backstage-app/templates/infrastructure-only/template.yaml` 생성
  - 템플릿 파라미터:
    - 리소스 타입 선택 (VM, GCS, GKE, Cloud SQL)
    - 이름, 리전, 사이즈 등
  - Scaffolder steps:
    1. fetch:template - Crossplane Claim YAML 생성
    2. publish:github - apps/{name}/ 디렉토리에 PR 생성
    3. catalog:register - Catalog에 리소스 등록
  - 템플릿 내용 파일 (`content/`) 작성:
    - claim.yaml.tmpl (Crossplane Claim)
    - kustomization.yaml (ArgoCD용)

  **Must NOT do**:
  - 실제 리소스 생성 (PR만 생성)
  - 복잡한 파라미터 검증 (최소한으로)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 템플릿 YAML 작성은 패턴화된 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 12)
  - **Blocks**: Tasks 13-16
  - **Blocked By**: Tasks 5-8

  **References**:
  - `backstage-app/examples/template/template.yaml` - 기존 템플릿 예시
  - Scaffolder docs: https://backstage.io/docs/features/software-templates/writing-templates

  **Acceptance Criteria**:
  - [ ] template.yaml 파일 생성됨
  - [ ] content/ 디렉토리에 Claim 템플릿 존재
  - [ ] app-config.yaml에 location 등록됨

  **QA Scenarios**:
  ```
  Scenario: 템플릿 등록 확인
    Tool: Bash
    Steps:
      1. curl http://localhost:7007/api/scaffolder/v1/templates | jq '.[] | select(.metadata.name=="infrastructure-only")'
    Expected Result: Template exists in API response
    Evidence: .sisyphus/evidence/task-09-template-registered.log
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(backstage): add infrastructure-only scaffolder template`
  - Files: backstage-app/templates/infrastructure-only/*

- [ ] 10. 서비스 생성 템플릿 (Service Template)

  **What to do**:
  - `backstage-app/templates/service/template.yaml` 생성
  - 템플릿 파라미터:
    - 서비스 이름, 설명
    - 언어/프레임워크 선택 (Node.js, Python, Go 등)
    - 필요한 인프라 선택 (선택적)
  - Scaffolder steps:
    1. fetch:template - 서비스 코드 스캐폴딩
    2. publish:github - 서비스 리포 생성
    3. catalog:register - Catalog 등록
  - 기본 서비스 템플릿 (Node.js 예시)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 템플릿 YAML 작성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 11, 12)
  - **Blocks**: Tasks 13-16
  - **Blocked By**: Tasks 5-8

  **References**:
  - 기존 `examples/template/` 참조

  **Acceptance Criteria**:
  - [ ] template.yaml 파일 생성됨
  - [ ] 서비스 코드 템플릿 존재
  - [ ] app-config.yaml에 location 등록됨

  **QA Scenarios**:
  ```
  Scenario: 서비스 템플릿 등록 확인
    Tool: Bash
    Steps:
      1. curl http://localhost:7007/api/scaffolder/v1/templates | jq '.[] | select(.metadata.name=="service-template")'
    Expected Result: Template exists in API response
    Evidence: .sisyphus/evidence/task-10-service-template.log
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(backstage): add service scaffolder template`
  - Files: backstage-app/templates/service/*

- [ ] 11. 서비스+인프라 묶음 템플릿 (Bundle Template)

  **What to do**:
  - `backstage-app/templates/service-with-infra/template.yaml` 생성
  - 템플릿 파라미터:
    - 서비스 정보 (이름, 언어)
    - 인프라 정보 (DB, Storage, 등)
  - Scaffolder steps:
    1. fetch:template - 서비스 코드 + Crossplane Claim 동시 생성
    2. publish:github - apps/{name}/에 PR 생성
    3. catalog:register - 서비스 + 인프라 리소스 등록
  - 통합 템플릿 파일 작성

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 두 템플릿 결합
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 12)
  - **Blocks**: Tasks 13-16
  - **Blocked By**: Tasks 5-8

  **References**:
  - Task 9, 10의 템플릿 참조

  **Acceptance Criteria**:
  - [ ] template.yaml 파일 생성됨
  - [ ] 서비스 + 인프라 Claim 동시 생성 확인
  - [ ] app-config.yaml에 location 등록됨

  **QA Scenarios**:
  ```
  Scenario: 묶음 템플릿 등록 확인
    Tool: Bash
    Steps:
      1. curl http://localhost:7007/api/scaffolder/v1/templates | jq '.[] | select(.metadata.name=="service-with-infra")'
    Expected Result: Template exists in API response
    Evidence: .sisyphus/evidence/task-11-bundle-template.log
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(backstage): add service-with-infra scaffolder template`
  - Files: backstage-app/templates/service-with-infra/*

- [ ] 12. 템플릿 등록 및 검증

  **What to do**:
  - `app-config.yaml`에 모든 템플릿 location 등록:
    ```yaml
    catalog:
      locations:
        - type: file
          target: ../../templates/infrastructure-only/template.yaml
        - type: file
          target: ../../templates/service/template.yaml
        - type: file
          target: ../../templates/service-with-infra/template.yaml
    ```
  - Backstage 재시작 후 템플릿 목록 확인
  - 각 템플릿 UI 렌더링 테스트

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 설정 파일 수정 및 검증
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11)
  - **Blocks**: Tasks 13-16
  - **Blocked By**: Tasks 5-8

  **References**:
  - `backstage-app/app-config.yaml` - 현재 catalog locations

  **Acceptance Criteria**:
  - [ ] 3개 템플릿 모두 app-config.yaml에 등록됨
  - [ ] Backstage 시작 후 템플릿 목록에 표시됨
  - [ ] 각 템플릿 UI에서 파라미터 폼 렌더링됨

  **QA Scenarios**:
  ```
  Scenario: 모든 템플릿 표시 확인
    Tool: Bash
    Steps:
      1. curl http://localhost:7007/api/scaffolder/v1/templates | jq 'length'
      2. curl http://localhost:7007/api/scaffolder/v1/templates | jq '.[].metadata.name'
    Expected Result: 3 templates visible (infrastructure-only, service-template, service-with-infra)
    Evidence: .sisyphus/evidence/task-12-all-templates.log
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(backstage): register all scaffolder templates in app-config`
  - Files: backstage-app/app-config.yaml

- [ ] 13. apps/ 디렉토리 구조 생성

  **What to do**:
  - `k8s-idp/apps/` 디렉토리 생성
  - 디렉토리 구조 설계:
    ```
    apps/
    ├── .argocd/
    │   └── applicationset.yaml    # ApplicationSet for auto-discovery
    ├── {service-name}/
    │   ├── claim.yaml             # Crossplane Claim
    │   └── kustomization.yaml     # Kustomize for ArgoCD
    └── README.md
    ```
  - ApplicationSet 템플릿 작성 (apps/* 자동 감지)

  **Must NOT do**:
  - 기존 kubernetes/ 디렉토리 구조 변경
  - 실제 서비스 디렉토리 생성 (구조만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 디렉토리 및 기본 파일 생성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 14, 15, 16)
  - **Blocks**: Tasks 17-19
  - **Blocked By**: Tasks 9-12

  **References**:
  - ArgoCD ApplicationSet: https://argo-cd.readthedocs.io/en/stable/user-guide/application-set/

  **Acceptance Criteria**:
  - [ ] apps/ 디렉토리 생성됨
  - [ ] ApplicationSet 파일 생성됨
  - [ ] README.md 작성됨

  **QA Scenarios**:
  ```
  Scenario: 디렉토리 구조 확인
    Tool: Bash
    Steps:
      1. ls -la apps/
      2. cat apps/.argocd/applicationset.yaml
    Expected Result: Directory structure exists with ApplicationSet
    Evidence: .sisyphus/evidence/task-13-apps-structure.log
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat(gitops): create apps directory structure with ApplicationSet`
  - Files: apps/.argocd/applicationset.yaml, apps/README.md

- [ ] 14. ArgoCD ApplicationSet 템플릿

  **What to do**:
  - `apps/.argocd/applicationset.yaml` 작성:
    - Git directory generator로 apps/* 자동 감지
    - 각 서비스별 ArgoCD Application 자동 생성
    - Crossplane Claim 동기화 설정
  - ArgoCD에 ApplicationSet 적용
  - 테스트용 샘플 서비스 디렉토리 생성

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: ApplicationSet YAML 작성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 13, 15, 16)
  - **Blocks**: Tasks 17-19
  - **Blocked By**: Tasks 9-12

  **References**:
  - 기존 ArgoCD Apps: `kubernetes/argocd-apps/*.yaml`

  **Acceptance Criteria**:
  - [ ] ApplicationSet 파일 생성됨
  - [ ] `kubectl apply` 성공
  - [ ] ArgoCD UI에서 ApplicationSet 표시

  **QA Scenarios**:
  ```
  Scenario: ApplicationSet 적용
    Tool: Bash
    Steps:
      1. kubectl apply -f apps/.argocd/applicationset.yaml -n gitops
      2. kubectl get applicationset -n gitops
    Expected Result: ApplicationSet created successfully
    Evidence: .sisyphus/evidence/task-14-appset-apply.log
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat(gitops): add ArgoCD ApplicationSet for apps directory`
  - Files: apps/.argocd/applicationset.yaml

- [ ] 15. Kubernetes 플러그인 설정 (Crossplane용)

  **What to do**:
  - `app-config.yaml`에 Kubernetes 설정 추가:
    ```yaml
    kubernetes:
      serviceLocatorMethod:
        type: multiTenant
      clusterLocatorMethods:
        - type: config
          clusters:
            - name: k8s-idp
              url: https://kubernetes.default.svc
              serviceAccountToken: ${K8S_SA_TOKEN}
              authProvider: serviceAccount
    ```
  - Backstage용 ServiceAccount 및 RBAC 생성
  - Crossplane XR/Claim 조회 가능하도록 권한 설정

  **Must NOT do**:
  - Cluster admin 권한 부여
  - 민감한 정보 하드코딩

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 설정 파일 및 RBAC 작성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 13, 14, 16)
  - **Blocks**: Tasks 17-19
  - **Blocked By**: Tasks 9-12

  **References**:
  - Backstage K8s plugin: https://backstage.io/docs/features/kubernetes/configuration
  - 기존 `kubernetes/manifests/backstage-custom/backstage.yaml`

  **Acceptance Criteria**:
  - [ ] app-config.yaml에 kubernetes 섹션 추가됨
  - [ ] ServiceAccount/RBAC 생성됨
  - [ ] Backstage에서 Crossplane 리소스 조회 가능

  **QA Scenarios**:
  ```
  Scenario: K8s 플러그인 연동 확인
    Tool: Bash
    Steps:
      1. kubectl get sa backstage -n backstage
      2. curl http://localhost:7007/api/kubernetes/clusters
    Expected Result: ServiceAccount exists, cluster visible in API
    Evidence: .sisyphus/evidence/task-15-k8s-plugin.log
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat(backstage): configure Kubernetes plugin for Crossplane`
  - Files: app-config.yaml, kubernetes/manifests/backstage-custom/rbac.yaml

- [ ] 16. End-to-End 테스트

  **What to do**:
  - 전체 플로우 테스트:
    1. Backstage UI에서 템플릿 선택
    2. 파라미터 입력 후 실행
    3. PR 생성 확인 (GitHub)
    4. ArgoCD 동기화 확인
    5. Crossplane Claim 생성 확인
    6. (선택) GCP 리소스 생성 확인
  - 테스트 결과 문서화

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 전체 플로우 검증은 복잡한 디버깅 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 13, 14, 15)
  - **Blocks**: Tasks 17-19
  - **Blocked By**: Tasks 9-12

  **References**:
  - 이전 모든 Task의 산출물

  **Acceptance Criteria**:
  - [ ] 템플릿 실행 성공
  - [ ] PR 생성 확인
  - [ ] ArgoCD 동기화 확인
  - [ ] Crossplane Claim 생성 확인

  **QA Scenarios**:
  ```
  Scenario: End-to-End 플로우 테스트
    Tool: Bash
    Steps:
      1. curl -X POST http://localhost:7007/api/scaffolder/v1/templates/infrastructure-only/execute -d '{...}'
      2. gh pr list --repo sydk-ktcloud/k8s-idp
      3. kubectl get claim -n default
    Expected Result: PR created, Claim created
    Evidence: .sisyphus/evidence/task-16-e2e-test.log
  ```

  **Commit**: NO (테스트만 수행)

- [ ] 17. 커스텀 홈 페이지

  **What to do**:
  - `packages/app/src/components/home/HomePage.tsx` 생성
  - 홈 페이지 구성:
    - 빠른 링크 (ArgoCD, Grafana, Kubecost, GitHub)
    - 프로비저닝 바로가기 (템플릿 카드)
    - 내 서비스 목록 (Catalog query)
    - 최근 활동
  - `packages/app/src/App.tsx`에서 홈 라우트 수정

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI/UX 디자인 및 React 컴포넌트 개발
  - **Skills**: [`frontend-design`]
    - frontend-design: 커스텀 홈 페이지 UI 디자인

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 18, 19)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 13-16

  **References**:
  - Backstage home page: https://backstage.io/docs/getting-started/home-page
  - `@backstage/plugin-home` 컴포넌트

  **Acceptance Criteria**:
  - [ ] HomePage 컴포넌트 생성됨
  - [ ] 빠른 링크 작동함
  - [ ] 템플릿 카드 표시됨
  - [ ] yarn build 성공

  **QA Scenarios**:
  ```
  Scenario: 홈 페이지 렌더링
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3000
      2. Verify quick links visible
      3. Verify template cards visible
      4. Screenshot capture
    Expected Result: Home page renders with all components
    Evidence: .sisyphus/evidence/task-17-homepage.png
  ```

  **Commit**: YES (Wave 5)
  - Message: `feat(backstage): add custom home page with quick links`
  - Files: packages/app/src/components/home/HomePage.tsx, packages/app/src/App.tsx

- [ ] 18. 한국어 지원

  **What to do**:
  - `packages/app/src/translations/ko/` 디렉토리 생성
  - 한국어 번역 파일 작성 (`app.ts`, `common.ts`)
  - `packages/app/src/App.tsx`에 i18n 설정 추가
  - 주요 UI 라벨 한국어화:
    - 사이드바 메뉴
    - 템플릿 설명
    - 에러 메시지
  - 언어 전환 기능 (선택)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 번역 파일 작성 및 설정
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 17, 19)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 13-16

  **References**:
  - Backstage i18n: https://backstage.io/docs/core-plugin-api/i18n

  **Acceptance Criteria**:
  - [ ] 한국어 번역 파일 생성됨
  - [ ] 주요 UI 라벨 한국어로 표시됨
  - [ ] yarn build 성공

  **QA Scenarios**:
  ```
  Scenario: 한국어 UI 확인
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3000
      2. Check sidebar menu labels in Korean
      3. Check template descriptions in Korean
    Expected Result: Korean labels visible
    Evidence: .sisyphus/evidence/task-18-korean-ui.png
  ```

  **Commit**: YES (Wave 5)
  - Message: `feat(backstage): add Korean language support`
  - Files: packages/app/src/translations/ko/*.ts, packages/app/src/App.tsx

- [ ] 19. 메뉴 간소화

  **What to do**:
  - `packages/app/src/App.tsx`에서 사이드바 메뉴 정리:
    - 제거: API Docs, Search, Notifications (이미 플러그인 제거됨)
    - 유지: Catalog, TechDocs, Scaffolder, Create
    - 추가: 프로비저닝 메뉴 (템플릿 모음)
  - 불필요한 탭/메뉴 숨기기
  - 메뉴 구조 최적화

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 메뉴 구성 변경
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 17, 18)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 13-16

  **References**:
  - `packages/app/src/App.tsx` - 현재 메뉴 구성

  **Acceptance Criteria**:
  - [ ] 불필요한 메뉴 제거됨
  - [ ] 프로비저닝 메뉴 추가됨
  - [ ] 메뉴 구조 간소화됨

  **QA Scenarios**:
  ```
  Scenario: 메뉴 간소화 확인
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3000
      2. Count sidebar menu items
      3. Verify no removed items visible
    Expected Result: Simplified menu visible
    Evidence: .sisyphus/evidence/task-19-simplified-menu.png
  ```

  **Commit**: YES (Wave 5)
  - Message: `feat(backstage): simplify sidebar menu structure`
  - Files: packages/app/src/App.tsx

---

## Final Verification Wave (MANDATORY)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `yarn build:backend` + `yarn tsc`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, unused imports.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test end-to-end flow: Template → PR → ArgoCD → Crossplane → GCP.
  Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `refactor(backstage): remove unused plugins and optimize Dockerfile`
- **Wave 2**: `feat(crossplane): add XRD and Composition for GCP resources`
- **Wave 3**: `feat(backstage): add self-service scaffolder templates`
- **Wave 4**: `feat(gitops): add apps directory and ArgoCD ApplicationSet`
- **Wave 5**: `feat(backstage): add custom home page and Korean language support`

---

## Success Criteria

### Verification Commands
```bash
# Backstage 빌드
cd backstage-app && yarn build:backend

# Docker 이미지 빌드
docker build -t backstage -f packages/backend/Dockerfile .

# Crossplane XRD 확인
kubectl get xrd

# Scaffolder 템플릿 확인
curl http://localhost:7007/api/scaffolder/v1/templates

# End-to-End 테스트 (템플릿 실행 → PR 생성 → 리소스 생성)
```

### Final Checklist
- [ ] All "Must Have" present (Crossplane XRD 4종, 템플릿 3종, GitOps 워크플로우)
- [ ] All "Must NOT Have" absent (Search, Signals, Notifications, GitHub Auth)
- [ ] Docker 이미지 크기 감소 (~50%)
- [ ] 템플릿 실행 시 GCP 리소스 생성 성공
