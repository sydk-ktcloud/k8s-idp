# Headplane Configuration

Headplane은 Headscale의 웹 UI입니다.

## 접속 정보

| 항목 | 값 |
|------|-----|
| **URL** | http://192.168.45.245:3000 |
| **로그인 방식** | Headscale API Key |

## 로그인 방법

1. 브라우저에서 `http://192.168.45.245:3000` 접속
2. Headscale API Key 입력

## API Key 생성

```bash
# 호스트 서버에서 실행
sudo headscale apikeys create --expiration 999d

# API Key 목록 확인
sudo headscale apikeys list
```

## 기능

- 노드 관리 (등록, 삭제, 이름 변경)
- ACL 정책 설정
- DNS 설정
- Pre-auth Key 관리
- 사용자 관리

## 아키텍처

```
┌─────────────────┐
│   Headplane     │
│   (Docker)      │
│   Port: 3000    │
└────────┬────────┘
         │
         │ HTTP API
         ▼
┌─────────────────┐
│   Headscale     │
│   (Systemd)     │
│   Port: 8080    │
└─────────────────┘
```

## 재시작

```bash
# Docker 컨테이너 재시작
docker restart headplane

# 로그 확인
docker logs headplane --tail 50
```

## 문제 해결

### UI 접속 안 됨
```bash
# 컨테이너 상태 확인
docker ps | grep headplane

# 로그 확인
docker logs headplane --tail 20

# 설정 확인
cat ~/headplane/config.yaml
```

### API Key 로그인 실패
- Headscale API Key가 올바른지 확인
- Headscale 서버가 실행 중인지 확인: `curl http://192.168.45.245:8080/health`
