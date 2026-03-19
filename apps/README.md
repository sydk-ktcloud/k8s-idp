# Apps Directory

이 디렉토리는 Backstage Scaffolder 템플릿을 통해 생성된 개발자 리소스가 저장됩니다.

## 구조

```
apps/
├── .argocd/
│   └── applicationset.yaml    # ApplicationSet for auto-discovery
├── {service-name}/
│   ├── claim.yaml             # Crossplane Claim
│   ├── kustomization.yaml     # Kustomize for ArgoCD
│   └── catalog-info.yaml      # Backstage catalog entity
└── README.md
```

## 워크플로우

1. **Backstage 템플릿 실행** → PR 생성
2. **PR Merge** → ArgoCD 감지
3. **ArgoCD 동기화** → Crossplane Claim 적용
4. **Crossplane** → GCP 리소스 프로비저닝

## 리소스 타입

| 타입 | Crossplane Claim | GCP 리소스 |
|------|------------------|------------|
| gcpinstance | GCPInstance | Compute Engine VM |
| bucket | Bucket | Cloud Storage |
| cluster | Cluster | GKE Cluster |
| database | Database | Cloud SQL |
