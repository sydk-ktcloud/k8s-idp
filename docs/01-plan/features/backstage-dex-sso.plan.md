# Plan: Backstage Dex SSO 연동

**Feature ID:** backstage-dex-sso
**작성일:** 2026-03-14
**작성자:** Kyle Kim
**Phase:** Plan

---

## 1. 배경 및 목적

### 현재 상태
- Backstage auth: `guest` provider (임시)
- `dangerouslyAllowOutsideDevelopment: true` 로 production 차단 우회 중
- 보안상 모든 사용자가 인증 없이 접근 가능한 상태

### 목표
- 기존에 구축된 **Dex OIDC Provider** (`http://100.64.0.1:30556`) 를 Backstage SSO로 연동
- GitHub OAuth (Dex connector) 를 통한 팀원 인증 구현
- guest provider 제거, 정식 인증 체계 수립

---

## 2. 현재 인프라 현황

| 구성요소 | 위치 | 상태 |
|----------|------|------|
| Dex OIDC | `http://100.64.0.1:30556` (NodePort 30556) | Running |
| Dex connector | GitHub OAuth | 구성 완료 |
| Dex static user | admin@k8s.local | 구성 완료 |
| Backstage | `http://100.64.0.1:30070` (NodePort 30070) | Running |
| Dex 기존 clients | argocd, grafana, kubectl, kubecost, longhorn | 등록됨 |

---

## 3. 작업 범위

### 3-1. Dex 설정 (values.yaml)
- `backstage` OIDC client 추가
- redirectURI: `http://100.64.0.1:30070/api/auth/oidc/handler/frame`

### 3-2. Backstage 패키지 추가
- `@backstage/plugin-auth-backend-module-oidc-provider` 설치

### 3-3. Backstage 설정 변경
- `app-config.production.yaml`: OIDC provider 설정 추가
- `app-config.production.yaml`: guest provider 제거
- `packages/app/src/App.tsx`: SignInPage OIDC 버튼 추가

### 3-4. 이미지 재빌드 및 배포
- Docker image 재빌드 (registry: `100.64.0.5:5001/backstage-backend:latest`)
- Kubernetes Deployment 재배포

---

## 4. 인증 흐름 설계

```
사용자 브라우저
    │
    ▼
Backstage (http://100.64.0.1:30070)
    │  로그인 요청
    ▼
Dex OIDC (http://100.64.0.1:30556)
    │  GitHub 로그인 리다이렉트
    ▼
GitHub OAuth
    │  인증 완료 → callback
    ▼
Dex (token 발급)
    │  Authorization Code → Backstage
    ▼
Backstage /api/auth/oidc/handler/frame
    │  token 검증 및 사용자 세션 생성
    ▼
Backstage 포털 접근
```

---

## 5. 구현 항목 체크리스트

### Dex 측
- [ ] `backstage` static client 추가 (`kubernetes/helm-releases/dex/values.yaml`)
- [ ] Dex helmfile 재배포

### Backstage 측
- [ ] `yarn workspace backend add @backstage/plugin-auth-backend-module-oidc-provider`
- [ ] `packages/backend/src/index.ts`: oidc module import 추가
- [ ] `app-config.production.yaml`: auth.providers.oidc 설정
- [ ] `packages/app/src/App.tsx`: SignInPage 컴포넌트 OIDC 버튼 추가
- [ ] `app-config.production.yaml`: guest provider 제거
- [ ] Docker 이미지 재빌드
- [ ] Kubernetes Deployment 재배포
- [ ] ConfigMap 업데이트 (app-config.production.yaml)

---

## 6. 주요 설정값 (예상)

### Dex values.yaml 추가할 client
```yaml
- id: backstage
  name: Backstage Developer Portal
  secret: backstage-client-secret-12345   # 추후 Secret으로 관리
  redirectURIs:
    - http://100.64.0.1:30070/api/auth/oidc/handler/frame
```

### app-config.production.yaml 추가할 auth 설정
```yaml
auth:
  environment: production
  providers:
    oidc:
      production:
        metadataUrl: http://100.64.0.1:30556/.well-known/openid-configuration
        clientId: backstage
        clientSecret: backstage-client-secret-12345
        scope: 'openid profile email'
        prompt: auto
```

---

## 7. 리스크 및 고려사항

| 리스크 | 대응 방안 |
|--------|-----------|
| Dex issuer가 HTTP라 HTTPS 요구 환경에서 실패 가능 | production.yaml에서 strict HTTPS 설정 비활성화 |
| GitHub OAuth 미설정 시 GitHub 로그인 불가 | Dex static password (admin@k8s.local) 폴백 유지 |
| 이미지 재빌드 시간 (5~10분) | 작업 시간 여유 확보 필요 |
| 기존 guest 세션 만료 | 재배포 후 재로그인 필요 (정상 동작) |

---

## 8. 완료 기준

- [ ] Backstage 접속 시 Dex 로그인 페이지로 리다이렉트
- [ ] GitHub 계정으로 로그인 성공
- [ ] Backstage 포털 정상 렌더링
- [ ] guest provider 완전 제거
- [ ] 팀원 계정으로 로그인 테스트 통과
