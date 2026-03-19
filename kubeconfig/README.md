# 팀별 kubeconfig 파일

이 디렉토리에는 팀원들에게 배포할 kubeconfig 파일들이 있습니다.

## 파일 목록

| 파일 | 팀 | 권한 | ServiceAccount |
|------|-----|------|----------------|
| `kubeconfig-admin` | Admin | cluster-admin | sa-admin |
| `kubeconfig-platform` | Platform | cluster-admin | sa-platform |
| `kubeconfig-gitops` | GitOps | cluster-admin | sa-gitops |
| `kubeconfig-security` | Security | cluster-admin | sa-security |
| `kubeconfig-sre` | SRE | cluster-admin | sa-sre |
| `kubeconfig-finops` | FinOps | view | sa-finops |
| `kubeconfig-ai` | AI | view | sa-ai |

## 권한 설명

- **cluster-admin**: 모든 리소스에 대한 전체 접근 권한
- **view**: 읽기 전용 접근 권한 (파드, 서비스, ConfigMap 등 조회 가능)

## 배포 방법

1. 팀원에게 해당하는 kubeconfig 파일 전달
2. 가이드 문서 (`docs/k8s-access-guide.md`) 함께 전달
3. Headscale 인증 키 별도 전달

## ⚠️ 보안 주의

- 이 파일들은 **Git에 커밋하지 마세요**
- 토큰이 포함되어 있으므로 안전하게 보관
- 팀원이 퇴사하면 해당 ServiceAccount의 토큰을 폐기하고 재생성

## 토큰 재생성

```bash
# k8s-cp 노드에서 실행
kubectl create token sa-<team> -n team-access --duration=87600h > /tmp/token-<team>

# kubeconfig 파일 재생성 (스크립트 실행)
/tmp/create-kubeconfig.sh
```
