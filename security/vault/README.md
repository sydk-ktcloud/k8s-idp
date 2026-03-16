# Vault HA Installation on Kubernetes

이 저장소는 Kubernetes 환경에서 **HashiCorp Vault를 HA(High Availability) 구성으로 설치하는 방법**을 정리한 것입니다.

## Architecture

* Kubernetes
* Helm
* HashiCorp Vault
* Raft Storage
* Longhorn Storage

Vault는 **Helm Chart**를 이용하여 설치하며, **Raft 기반 HA 클러스터**로 구성됩니다.

## Repository Structure

```
repo
 ├ docs
 │   └ vault-install.md      # Vault 설치 가이드
 ├ helm
 │   └ vault-values.yaml     # Helm values 설정
 └ README.md
```

## Installation Overview

1. Helm 설치
2. HashiCorp Helm Repository 추가
3. Kubernetes Namespace 생성
4. Vault Helm values 설정
5. Vault HA 설치
6. Vault Initialization
7. Vault Unseal
8. Raft Cluster 확인

자세한 설치 과정은 아래 문서를 참고하세요.

➡ docs/vault-install.md

