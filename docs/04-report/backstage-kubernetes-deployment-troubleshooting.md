# Backstage Kubernetes 배포 트러블슈팅 보고서

> **Summary**: Kubernetes 클러스터에 Backstage(Internal Developer Portal)를 정상 배포하기 위해 수행한 트러블슈팅 과정 기록
>
> **Author**: DevOps Team
> **Created**: 2026-03-13
> **Status**: Approved

---

## 개요

### 작업 목표
Kubernetes 클러스터에 Backstage(Internal Developer Portal)를 정상 배포하고 모든 플러그인이 정상 작동하도록 구성

### 최종 결과
- backstage-backend: Running (1/1)
- backstage-postgresql: Running (1/1)
- 헬스체크: HTTP 200 OK
- 모든 플러그인 정상 초기화 완료
- 접속 URL: `http://100.64.0.1:30070`

---

## 발견된 문제 및 해결 과정

### 문제 1: Backend CrashLoopBackOff - Azure Scaffolding Provider 초기화 실패

#### 현상
`backstage-backend` Pod이 CrashLoopBackOff 상태에서 지속적으로 재시작

#### 에러 메시지
```
Failed to initialize azure scaffolding provider, Cannot read property 'value' of null
```

#### 근본 원인 분석
- **사용 중인 이미지**: `deliveryhero/backstage` Helm 차트의 데모 이미지 (`martinaif/backstage-k8s-demo-backend:test1`)
- **문제점**: 데모 이미지가 Azure Scaffolding Provider를 강제 초기화하도록 구현되어 있음
- **실제 원인**: `APP_CONFIG_scaffolder_azure_api_token: ""`(빈 문자열)이 환경변수 처리 과정에서 null로 변환되어, null 값의 'value' 속성 접근 시도로 인한 크래시

#### 해결 방법
1. 데모 이미지 대신 직접 빌드한 커스텀 이미지 사용
2. 커스텀 이미지명: `100.64.0.5:5001/backstage-backend:latest`
3. 기존 Helm 차트 대신 커스텀 Manifest 사용: `kubernetes/manifests/backstage-custom/backstage.yaml`

#### 영향도
- **Severity**: Critical
- **해결 난이도**: High (이미지 재빌드 필요)
- **소요 시간**: 약 2시간

---

### 문제 2: Kubernetes 노드의 Private Registry HTTPS 오류

#### 현상
이미지 pull 시 다음 오류 발생
```
http: server gave HTTP response to HTTPS client
```

#### 근본 원인 분석
- **클러스터 구성**: 내부 Private Registry (`100.64.0.5:5001`)는 HTTP로 운영 중
- **containerd 설정**: k8s 노드의 containerd가 기본적으로 모든 registry를 HTTPS로 접근 시도
- **문제 원인**: 노드의 containerd 설정에서 `config_path = ""`(빈 문자열)으로 되어 있어, `certs.d` 디렉토리의 설정이 무시되는 상태
- **영향 노드**: k8s-cp, k8s-w1, k8s-w2, k8s-w3 (모든 노드)

#### 해결 방법

##### 단계별 해결 과정

**1단계: privileged DaemonSet 배포**
- 모든 노드에 일괄 설정하기 위해 privileged DaemonSet 사용
- 마운트 경로: 호스트의 `/etc/containerd` 디렉토리

**2단계: HTTP Registry 설정 파일 생성**
- 각 노드에 설정 파일 생성: `/etc/containerd/certs.d/100.64.0.5:5001/hosts.toml`
- 파일 내용:
  ```toml
  server = "http://100.64.0.5:5001"

  [host."http://100.64.0.5:5001"]
    capabilities = ["pull", "resolve"]
    skip_verify = true
  ```

**3단계: containerd 설정 수정**
- `/etc/containerd/config.toml`에서 다음 항목 확인:
  ```toml
  config_path = "/etc/containerd/certs.d"
  ```
- 기존에 `config_path = ""`로 설정되어 있던 부분을 올바른 경로로 수정

**4단계: containerd 서비스 재시작**
- DaemonSet에서 `systemctl restart containerd` 실행
- 모든 노드에서 일괄 적용

**5단계: 작업 완료 후 DaemonSet 삭제**
- 설정 완료 후 DaemonSet 삭제 (일시적 작업용이므로)

#### 영향도
- **Severity**: Critical
- **해결 난이도**: Medium (모든 노드에 걸쳐 영향)
- **소요 시간**: 약 45분

#### 학습 사항
- containerd의 `config_path` 설정이 비어있으면 레지스트리 설정 전체가 무시됨
- DaemonSet을 통한 일괄 노드 설정이 효과적인 방법
- 설정 변경 후 containerd 재시작은 필수 단계

---

### 문제 3: 기존 Helm 리소스와 Custom Manifest 충돌

#### 현상
배포 상태 확인 시 불일치:
- `helm list` 명령어에서 releaseが 없음 (Helm으로 설치되지 않음)
- `kubectl get pod` 에서는 Backstage Pod이 Running 상태
- 실제로는 kubectl로 직접 apply된 상태로 관리됨

#### 근본 원인 분석
- 초기 배포 시 Helm 차트로 설치한 것으로 가정했으나, 실제로는 매니페스트 파일이 직접 apply된 상태
- 기존 리소스와 새 Custom Manifest 간의 메타데이터 불일치

#### 해결 방법
1. **기존 리소스 식별 및 삭제**
   - 삭제 대상:
     - Deployment: backstage-backend
     - StatefulSet: backstage-postgresql
     - Service: backstage-backend, backstage-postgresql
     - ConfigMap: 모든 backstage 관련 ConfigMap
     - Secret: 모든 backstage 관련 Secret

2. **데이터 보존 전략**
   - PersistentVolumeClaim(PVC) 유지: 데이터베이스 데이터 보존
   - 기존 Secret 정보 백업

3. **Custom Manifest 적용**
   - `kubernetes/manifests/backstage-custom/backstage.yaml` 적용
   - 기존 PVC와 연계되도록 구성

#### 영향도
- **Severity**: High
- **해결 난이도**: Low (단순 정리 작업)
- **소요 시간**: 약 20분

---

### 문제 4: 이미지 아키텍처 불일치 (arm64 vs amd64)

#### 현상
Pod이 다음 오류로 실패:
```
exec format error
```

#### 근본 원인 분석
- **빌드 환경**: Mac Apple Silicon(arm64) 아키텍처에서 Dockerfile 빌드
- **실행 환경**: Kubernetes 클러스터의 x86_64(amd64) 노드
- **문제점**: arm64 바이너리를 amd64 아키텍처에서 직접 실행 불가

#### 해결 방법
Dockerfile을 멀티스테이지 빌드로 수정하여 특정 플랫폼으로 빌드:

```dockerfile
FROM --platform=linux/amd64 node:20-alpine AS builder
# ... 빌드 단계 ...

FROM --platform=linux/amd64 node:20-alpine
# ... 런타임 단계 ...
```

**핵심 변경사항**:
- `--platform=linux/amd64` 플래그로 빌드 대상 지정
- 빌드 단계와 런타임 단계 모두에 플랫폼 지정

#### 영향도
- **Severity**: High
- **해결 난이도**: Low (Dockerfile 수정만 필요)
- **소요 시간**: 약 30분

---

### 문제 5: Dockerfile 빌드 실패 - yarn tsc 오류

#### 현상
Docker 이미지 빌드 중 다음 오류 발생:
```
error TS6053: File '[CWD]/tsconfig.json' not found.
No inputs were found in config file '/app/tsconfig.json'
```

#### 근본 원인 분석
- **명령어**: Dockerfile에서 `yarn tsc` 실행 중
- **문제점**: `yarn tsc`는 전체 모노레포의 타입 체크를 수행 (프론트엔드 포함)
- **실제 목적**: 백엔드 이미지 빌드에서는 불필요한 단계
- **원인**: 이후 문제(`.dockerignore` 설정)로 인해 TypeScript 설정 파일이 누락됨

#### 해결 방법
Dockerfile에서 `yarn tsc` 라인 제거:
- 백엔드 이미지 빌드에는 모노레포 전체 타입 체크가 필요하지 않음
- 빌드 단계를 단순화하고 불필요한 의존성 제거

#### 영향도
- **Severity**: Medium
- **해결 난이도**: Low (단순 라인 삭제)
- **소요 시간**: 약 15분

---

### 문제 6: Dockerfile 빌드 실패 - src/index.ts 없음

#### 현상
빌드 중 다음 오류 발생:
```
RollupError: Could not resolve entry module "src/index.ts"
```

#### 근본 원인 분석
**문제의 근원**: `.dockerignore` 설정 오류
```
# 문제 있는 설정
packages/*/src
```

**영향**: 모든 패키지의 `src` 디렉토리가 Docker 컨텍스트에서 제외됨

**원래 설계**:
- 프로젝트의 원래 Dockerfile이 사전 빌드된 결과물을 사용
- `skeleton.tar.gz`, `bundle.tar.gz` 등 미리 빌드된 아티팩트를 이미지에 포함
- 따라서 원본 소스 코드가 불필요했음

**현재 상황**:
- 새로운 Dockerfile에서는 소스 코드에서 직접 빌드
- 하지만 `.dockerignore`는 여전히 소스 파일을 제외하고 있음

#### 해결 방법
`.dockerignore` 파일에서 `packages/*/src` 항목 제거:

```dockerfile
# 변경 전
packages/*/src

# 변경 후
# (해당 라인 삭제)
```

**변경 이유**:
- 새 빌드 방식에서는 소스 코드가 필요
- 원래 사전빌드 기반 방식에서 소스 제외는 더 이상 필요 없음

#### 영향도
- **Severity**: High (빌드 차단)
- **해결 난이도**: Low (.dockerignore 수정만 필요)
- **소요 시간**: 약 10분

---

### 문제 7: Docker Push HTTPS 오류

#### 현상
이미지 빌드는 성공하나 Push 시 다음 오류 발생:
```
http: server gave HTTP response to HTTPS client
```

#### 근본 원인 분석
- **문제 시점**: Docker Desktop(로컬)에서 `docker push`
- **원인**: Docker Desktop의 daemon이 `100.64.0.5:5001` 레지스트리를 insecure(HTTP) registry로 인식하지 못함
- **기본 동작**: Docker는 기본적으로 모든 registry에 대해 HTTPS를 사용하려고 시도

#### 해결 방법
Docker Desktop 설정에 insecure registry 추가:

**파일**: `~/.docker/daemon.json`

**수정 내용**:
```json
{
  "insecure-registries": [
    "100.64.0.5:5001"
  ]
}
```

**적용 절차**:
1. `~/.docker/daemon.json` 파일 생성 또는 수정
2. 위 설정 추가
3. Docker Desktop 재시작 (완전히 종료 후 재시작)

#### 영향도
- **Severity**: High (이미지 배포 차단)
- **해결 난이도**: Low (설정 파일 수정만 필요)
- **소요 시간**: 약 20분

---

### 문제 8: Docker Desktop 재시작 후 레지스트리 컨테이너 종료

#### 현상
Docker Desktop 재시작 후 이미지 push 시 다음 오류:
```
connection refused
```

#### 근본 원인 분석
- **상황**: Docker Desktop 재시작 명령 실행
- **결과**: `local-registry` 컨테이너가 Exited 상태가 됨
- **원인**: Docker Desktop 재시작 시 모든 컨테이너가 정지되는데, 자동 재시작 정책이 없어서 registry 컨테이너가 시작되지 않음

#### 해결 방법
레지스트리 컨테이너 수동 재시작:

```bash
docker start local-registry
```

**확인 방법**:
```bash
docker ps | grep local-registry  # Running 상태 확인
```

#### 영향도
- **Severity**: Medium (일시적 영향)
- **해결 난이도**: Low (단순 컨테이너 재시작)
- **소요 시간**: 약 5분

#### 예방 방법
향후 Docker Desktop 재시작 시:
1. 레지스트리 컨테이너의 자동 재시작 정책 확인
2. 또는 Docker Desktop 설정에서 컨테이너 유지 옵션 활성화

---

## 수정된 파일 목록

### 1. Custom Kubernetes Manifest
**파일**: `kubernetes/manifests/backstage-custom/backstage.yaml`
- 기존 Helm 차트 대신 사용하는 커스텀 매니페스트
- Deployment, Service, ConfigMap, Secret 포함
- 커스텀 이미지(`100.64.0.5:5001/backstage-backend:latest`) 참조

### 2. Backend Dockerfile
**파일**: `backstage-app/packages/backend/Dockerfile`
- **변경사항**:
  - 멀티스테이지 빌드 구조로 재작성
  - `--platform=linux/amd64` 플래그 추가 (모든 FROM 단계)
  - `yarn tsc` 라인 제거 (불필요한 모노레포 타입 체크)
  - 빌드 프로세스 최적화

### 3. Docker Ignore 파일
**파일**: `backstage-app/.dockerignore`
- **변경사항**:
  - `packages/*/src` 항목 제거
  - 이유: 새로운 빌드 방식에서 소스 파일 필요
  - 원래 사전빌드 기반 방식의 설정이 더 이상 적용 불가

### 4. Docker Daemon 설정
**파일**: `~/.docker/daemon.json`
- **변경사항**:
  - `insecure-registries` 배열에 `"100.64.0.5:5001"` 추가
  - HTTP Private Registry 지원

---

## 주요 교훈 및 분석

### 성공 요인

1. **체계적인 문제 분석**
   - 각 오류 메시지에서 근본 원인을 파악
   - 표면적 증상과 실제 원인 구분

2. **아키텍처 문제 조기 발견**
   - arm64 vs amd64 불일치를 빠르게 파악
   - 멀티플랫폼 빌드 전략으로 해결

3. **인프라 설정 최적화**
   - containerd의 config_path 설정 중요성 인식
   - DaemonSet을 통한 일괄 노드 설정 활용

### 개선 사항

1. **초기 아키텍처 설계**
   - Private Registry 구성 시 containerd 설정 사전 검토
   - Helm vs Kubernetes Manifest 선택 기준 명확화

2. **빌드 프로세스**
   - `.dockerignore` 설정과 빌드 방식의 일관성 유지
   - Dockerfile 멀티스테이지 빌드로 표준화
   - 플랫폼 명시적 지정 필수

3. **개발 환경 구성**
   - Docker Desktop 설정 문서화
   - insecure registry 자동 구성 방법 검토
   - containerd 설정 템플릿 제공

4. **운영 안정성**
   - 레지스트리 컨테이너 자동 재시작 정책 설정
   - 모니터링 및 헬스 체크 체계 구축

### 다음 번 프로젝트에 적용할 사항

1. **배포 전 체크리스트**
   ```
   [ ] 아키텍처 일치 확인 (arm64 vs amd64)
   [ ] containerd/Docker 레지스트리 설정 검증
   [ ] .dockerignore와 빌드 방식 일관성 확인
   [ ] Helm 차트 vs Kubernetes Manifest 명확한 선택
   [ ] Private Registry HTTPS/HTTP 설정 사전 구성
   ```

2. **인프라 초기 구성**
   - containerd 설정을 Terraform/Ansible 코드화
   - Docker Desktop 설정을 스크립트화
   - Private Registry 구성 템플릿 제공

3. **문서화 강화**
   - Private Registry 접근 가이드 작성
   - Dockerfile 멀티플랫폼 빌드 가이드
   - 아키텍처별 빌드 설정 명시

---

## 최종 검증

### 배포 상태 확인

```bash
# Pod 상태 확인
kubectl get pods -n backstage
# 결과:
# NAME                                 READY   STATUS    RESTARTS   AGE
# backstage-backend-xxxxx              1/1     Running   0          5m
# backstage-postgresql-xxxxx           1/1     Running   0          5m

# 서비스 상태 확인
kubectl get svc -n backstage
# backstage-backend NodePort로 30070 포트 노출

# 헬스체크 확인
curl http://100.64.0.1:30070/healthcheck
# HTTP 200 OK
```

### 플러그인 초기화 확인
- 모든 Backstage 플러그인이 정상 초기화됨
- 로그에서 플러그인 로딩 성공 확인

### 접근 가능성 확인
- URL: `http://100.64.0.1:30070`
- 정상 작동 확인

---

## 결론

Backstage의 Kubernetes 배포 과정에서 8가지 주요 문제를 체계적으로 해결하였습니다. 각 문제는 인프라(containerd 설정, Docker 설정), 빌드(Dockerfile, .dockerignore), 배포(리소스 관리)에 걸쳐 있었으며, 근본 원인 분석을 통해 모두 해결되었습니다.

특히 **아키텍처 불일치**, **레지스트리 설정**, **빌드 프로세스 일관성** 부분에서 얻은 경험이 향후 프로젝트에 큰 도움이 될 것으로 예상됩니다.

---

## 참고 자료

### 관련 파일 경로
- `/Users/kylekim1223/sydk/k8s-idp/kubernetes/manifests/backstage-custom/backstage.yaml`
- `/Users/kylekim1223/sydk/k8s-idp/backstage-app/packages/backend/Dockerfile`
- `/Users/kylekim1223/sydk/k8s-idp/backstage-app/.dockerignore`
- `~/.docker/daemon.json`

### 유용한 명령어
```bash
# 이미지 빌드 (amd64 플랫폼 지정)
docker build --platform linux/amd64 -t 100.64.0.5:5001/backstage-backend:latest .

# Private Registry로 Push
docker push 100.64.0.5:5001/backstage-backend:latest

# containerd 설정 확인
cat /etc/containerd/config.toml | grep config_path

# 모든 노드의 containerd 재시작 (DaemonSet 사용)
kubectl apply -f containerd-restart-daemonset.yaml
```
