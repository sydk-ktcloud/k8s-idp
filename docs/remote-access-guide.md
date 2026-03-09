# Kubernetes 클러스터 원격 접속 가이드

## 개요

이 문서는 Headscale(self-hosted Tailscale)을 사용하여 원격에서 Kubernetes 클러스터에 접속하는 방법을 설명합니다.

Headscale은 Tailscale의 오픈소스 대안으로, **사용자 수 제한 없이 무료**로 사용할 수 있습니다.

---

## 시스템 정보

| 항목 | 값 |
|------|-----|
| Headscale 서버 | `http://192.168.45.245:8080` |
| Pre-auth Key | `hskey-auth-tuwTq69cD8qx-pZvZcMfK1zMYRRAGKkHi4xsQ7lu0rtJLHLqeVBzE9r_3B1OyPO2Ig-UyfLLJYEL2` |
| 클러스터 노드 | k8s-cp, k8s-w1, k8s-w2, k8s-w3 |

---

## Step 1: Tailscale 클라이언트 설치

### macOS

```bash
# Homebrew 사용
brew install tailscale

# 또는 직접 다운로드
# https://tailscale.com/download/mac
```

### Windows

1. **다운로드**: https://tailscale.com/download/windows
2. **설치**: 다운로드한 `.msi` 파일 실행
3. **또는 명령줄 설치**:
   ```powershell
   # Winget 사용
   winget install Tailscale.Tailscale
   
   # 또는 Chocolatey 사용
   choco install tailscale
   ```

### Linux

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

---

## Step 2: 기기 등록 (Headscale 연결)

### macOS / Linux

```bash
sudo tailscale up \
  --login-server=http://192.168.45.245:8080 \
  --authkey=hskey-auth-tuwTq69cD8qx-pZvZcMfK1zMYRRAGKkHi4xsQ7lu0rtJLHLqeVBzE9r_3B1OyPO2Ig-UyfLLJYEL2 \
  --hostname=team-<YOUR-NAME>
```

### Windows (PowerShell 관리자 권한)

```powershell
tailscale up `
  --login-server=http://192.168.45.245:8080 `
  --authkey=hskey-auth-tuwTq69cD8qx-pZvZcMfK1zMYRRAGKkHi4xsQ7lu0rtJLHLqeVBzE9r_3B1OyPO2Ig-UyfLLJYEL2 `
  --hostname=team-<YOUR-NAME>
```

**⚠️ 주의사항:**
- `<YOUR-NAME>`을 본인의 이름으로 변경하세요 (예: `team-alice`, `team-bob`)
- Windows에서는 PowerShell을 **관리자 권한**으로 실행해야 합니다

### 등록 확인

```bash
# 자신의 Tailscale IP 확인
tailscale ip

# 다른 노드에 ping 테스트
tailscale ping k8s-cp

# 연결된 노드 목록 확인
tailscale status
```

---

## Step 3: 연결 테스트

### SSH로 Control Plane 접속

```bash
# Tailscale IP로 직접 접속
ssh k8suser@100.64.0.1

# 또는 호스트명으로 접속
ssh k8suser@k8s-cp
```

### kubectl 명령어 실행

```bash
# 원격에서 kubectl 실행
ssh k8suser@100.64.0.1 'kubectl get nodes'

# 파드 목록 확인
ssh k8suser@100.64.0.1 'kubectl get pods -A'
```

---

## Step 4: 로컬 PC에서 kubectl 직접 사용

### kubeconfig 설정

```bash
# 1. Control Plane에서 kubeconfig 복사
scp k8suser@100.64.0.1:~/.kube/config ~/.kube/config-k8s

# 2. server 주소를 Tailscale IP로 변경
sed -i '' 's/server: https.*:6443/server: https:\/\/100.64.0.1:6443/' ~/.kube/config-k8s

# 3. 사용
kubectl --kubeconfig=~/.kube/config-k8s get nodes
```

### Windows PowerShell

```powershell
# 1. kubeconfig 복사
scp k8suser@100.64.0.1:~/.kube/config $env:USERPROFILE\.kube\config-k8s

# 2. server 주소 변경 (메모장으로 열어서 수정)
# server: https://100.64.0.1:6443

# 3. 사용
kubectl --kubeconfig=$env:USERPROFILE\.kube\config-k8s get nodes
```

---

## Step 5: Headscale UI (관리자용)

Headscale은 기본적으로 CLI 기반이지만, 웹 UI를 통해 노드를 관리할 수 있습니다.

### CLI로 노드 관리 (Headscale 서버에서)

```bash
# 노드 목록 확인
sudo headscale nodes list

# 특정 노드 삭제
sudo headscale nodes delete -i <NODE_ID>

# 노드 이름 변경
sudo headscale nodes rename -i <NODE_ID> --new-name <NEW_NAME>

# Pre-auth key 목록
sudo headscale preauthkeys list
```

### 웹 UI 접근 (옵션)

Headscale 서버에 Headscale-UI가 설치되어 있는 경우:

```
http://192.168.45.245:8080/web
```

> **참고**: 웹 UI가 활성화되어 있지 않은 경우, CLI 명령어로만 관리 가능합니다.

---

## 네트워크 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                      팀원 PC                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   macOS     │  │   Windows   │  │   Linux     │         │
│  │ tailscale   │  │ tailscale   │  │ tailscale   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    Tailscale Mesh Network
                           │
                           ▼
              ┌────────────────────────┐
              │   Headscale 서버       │
              │  192.168.45.245:8080   │
              └────────────┬───────────┘
                           │
         ┌─────────┬───────┼───────┬─────────┐
         │         │       │       │         │
         ▼         ▼       ▼       ▼         ▼
      ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
      │k8s-cp│ │k8s-w1│ │k8s-w2│ │k8s-w3│
      │  CP  │ │Worker│ │Worker│ │Worker│
      │.0.1  │ │ .0.2 │ │ .0.4 │ │ .0.3 │
      └──────┘ └──────┘ └──────┘ └──────┘
```

---

## 노드 IP 주소

| 노드 | Tailscale IP | 역할 | 용도 |
|------|--------------|------|------|
| k8s-cp | 100.64.0.1 | Control Plane | kubectl, API Server |
| k8s-w1 | 100.64.0.2 | Worker | 워크로드 실행 |
| k8s-w2 | 100.64.0.4 | Worker | 워크로드 실행 |
| k8s-w3 | 100.64.0.3 | Worker | 워크로드 실행 |

---

## 문제 해결

### 연결이 안 되는 경우

#### macOS / Linux
```bash
# 1. Tailscale 서비스 재시작
sudo systemctl restart tailscaled    # Linux
sudo launchctl kickstart -k system/com.tailscale.tailscaled    # macOS

# 2. 연결 상태 확인
tailscale status

# 3. 재연결
sudo tailscale down
sudo tailscale up --login-server=http://192.168.45.245:8080 --authkey=...
```

#### Windows
```powershell
# 1. 서비스 재시작
Restart-Service tailscale

# 2. 연결 상태 확인
tailscale status

# 3. 재연결
tailscale down
tailscale up --login-server=http://192.168.45.245:8080 --authkey=...
```

### 일반적인 오류

| 오류 | 원인 | 해결 방법 |
|------|------|-----------|
| `connection refused` | Headscale 서버 다운 | 관리자에게 문의 |
| `authkey expired` | Pre-auth key 만료 | 관리자에게 새 키 요청 |
| `hostname already exists` | 중복 호스트명 | `--hostname`을 다르게 설정 |

### 키 재발급이 필요한 경우

Headscale 서버 관리자에게 문의하여 새 pre-auth key를 발급받으세요.

---

## 보안 주의사항

- ✅ Pre-auth key는 재사용 가능하므로 안전하게 보관
- ✅ 각 팀원은 고유한 hostname 사용 권장 (예: `team-alice`, `team-bob`)
- ✅ 프로덕션 환경에서는 정기적으로 키 교체 권장
- ✅ 사용하지 않는 기기는 Headscale 서버에서 삭제 권장

---

## 빠른 참조

### 자주 사용하는 명령어

```bash
# 연결 상태 확인
tailscale status

# Control Plane SSH 접속
ssh k8suser@100.64.0.1

# 노드 상태 확인
ssh k8suser@100.64.0.1 'kubectl get nodes'

# 파드 상태 확인
ssh k8suser@100.64.0.1 'kubectl get pods -A'

# 내 Tailscale IP 확인
tailscale ip
```

### 연락처

- **Headscale 서버 관리자**: [관리자 이메일]
- **기술 지원**: [지원 채널]

---

## FAQ

**Q: Windows에서도 접속 가능한가요?**  
A: 네, Tailscale Windows 클라이언트를 설치하면 동일하게 접속 가능합니다.

**Q: 동시에 여러 기기를 등록할 수 있나요?**  
A: 네, 각 기기마다 다른 `--hostname`을 사용하면 여러 기기를 등록할 수 있습니다.

**Q: 모바일에서도 접속 가능한가요?**  
A: 네, iOS/Android용 Tailscale 앱이 있습니다. 하지만 CLI 명령어는 지원되지 않습니다.

**Q: Headscale은 무료인가요?**  
A: 네, Headscale은 오픈소스로 완전 무료이며 사용자 수 제한이 없습니다.
