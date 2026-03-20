\# ChatOps App



\## 개요

Discord 기반 Kubernetes ChatOps AI 봇입니다.



\## 로컬 실행

```bash

npm install

node bot.js

```



\## Docker 빌드

```bash

docker build -t chatops-app .

```



\## Docker 실행

```bash

docker run -d --env-file .env --name chatops-app chatops-app

```



\## Kubernetes 접근

컨테이너 내부에서 Kubernetes 조회가 필요하므로 kubeconfig 또는 적절한 인증 구성이 필요합니다.



\## 환경변수

`.env.example` 참고

