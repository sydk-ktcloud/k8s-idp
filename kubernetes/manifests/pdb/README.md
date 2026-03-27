# PodDisruptionBudget (PDB) Templates

고가용성 구성을 위한 PDB 매니페스트 모음입니다.

## 개요

PDB는 voluntary disruption (노드 드레인, 클러스터 업그레이드 등) 시 최소 파드 수를 보장합니다.

## 적용된 PDB

| 서비스 | Namespace | minAvailable | 목적 |
|--------|-----------|--------------|------|
| Dex | auth | 1 | SSO 인증 서비스 연속성 |
| ArgoCD Server | gitops | 1 | GitOps UI/API 연속성 |
| ArgoCD Controller | gitops | 1 | GitOps 동기화 연속성 |
| ArgoCD Repo Server | gitops | 1 | Git 리포지토리 접근 연속성 |
| Backstage Frontend | backstage | 1 | 개발자 포털 UI 연속성 |
| Backstage Backend | backstage | 1 | 개발자 포털 API 연속성 |
| MinIO | minio-storage | 2 | 오브젝트 스토리지 4노드 중 최소 2개 유지 |

## 적용 방법

```bash
# 전체 PDB 적용
kubectl apply -f kubernetes/manifests/pdb/

# 개별 적용
kubectl apply -f kubernetes/manifests/pdb/dex-pdb.yaml
```

## 검증

```bash
# PDB 상태 확인
kubectl get pdb -A

# 상세 정보
kubectl describe pdb dex-pdb -n auth
```

## 주의사항

- PDB는 voluntary disruption만 방지 (노드 유지보수, 클러스터 업그레이드)
- involuntary disruption (파드 충돌, 노드 장애)은 방지하지 않음
- replicas >= minAvailable + 1 이어야 PDB가 의미 있음
