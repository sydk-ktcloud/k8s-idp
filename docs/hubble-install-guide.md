# Hubble UI 설치 가이드

> Cilium 기반 Kubernetes 클러스터에서 Hubble (네트워크 관측성) 설치 시 발생하는 문제들과 올바른 설정 정리

## 전제 조건

- Cilium CNI 설치 완료 (v1.16.x)
- `cilium-config` ConfigMap에 Hubble 활성화 설정 필요

```bash
kubectl get configmap cilium-config -n kube-system -o jsonpath='{.data.enable-hubble}'
# 출력: true 확인 필요
kubectl get configmap cilium-config -n kube-system -o jsonpath='{.data.hubble-listen-address}'
# 출력: :4244 확인 필요
```

Hubble이 비활성화된 경우:
```bash
kubectl patch configmap cilium-config -n kube-system \
  --type merge \
  -p '{"data":{"enable-hubble":"true","hubble-listen-address":":4244"}}'
# Cilium DaemonSet 재시작 필요
kubectl rollout restart daemonset/cilium -n kube-system
```

---

## 파일 구조

```
kubernetes/
├── manifests/cilium/
│   ├── hubble-deployment.yaml   # SA, RBAC, Service, ConfigMap, Deployment
│   └── hubble-ui-service.yaml   # NodePort Service (외부 노출)
└── network-policies/
    └── 07-cilium-hubble.yaml    # hubble-relay NetworkPolicy
```

---

## 1. hubble-deployment.yaml

ServiceAccount, RBAC, Service, nginx ConfigMap, Deployment 전체 포함

### 핵심 주의사항

#### ① nginx가 `/app` 디렉토리를 서빙하도록 ConfigMap 필요

`quay.io/cilium/hubble-ui:v0.13.1` 이미지의 nginx는 기본 `default.conf`가 `/usr/share/nginx/html`을 서빙하지만,
실제 Hubble UI 정적 파일은 `/app/`에 위치한다. ConfigMap으로 nginx 설정을 덮어써야 함.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hubble-ui-nginx
  namespace: kube-system
data:
  nginx.conf: |
    server {
        listen       8081;
        server_name  localhost;

        location / {
            root   /app;
            index  index.html;
            try_files $uri $uri/ /index.html;
        }

        location /api {
            proxy_pass http://localhost:8090;
            proxy_http_version 1.1;
        }
    }
```

Deployment의 frontend 컨테이너에 마운트:
```yaml
volumeMounts:
- name: nginx-conf
  mountPath: /etc/nginx/conf.d/default.conf
  subPath: nginx.conf
volumes:
- name: nginx-conf
  configMap:
    name: hubble-ui-nginx
```

#### ② backend 환경변수: `HUBBLE_RELAY_SERVICE` ❌ → `FLOWS_API_ADDR` ✅

```yaml
# 잘못된 설정 (기본값 localhost:50051로 연결 시도)
env:
- name: HUBBLE_RELAY_SERVICE
  value: "hubble-relay.kube-system.svc.cluster.local:4245"

# 올바른 설정
env:
- name: EVENTS_SERVER_PORT
  value: "8090"
- name: FLOWS_API_ADDR
  value: "hubble-relay.kube-system.svc.cluster.local:4245"
```

#### ③ ClusterRole에 `namespaces` 권한 필수

hubble-ui-backend가 namespace 목록을 k8s API로 조회하므로 반드시 포함해야 함.

```yaml
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list", "watch"]
```

### 전체 파일

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hubble-relay
  namespace: kube-system
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hubble-ui
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: hubble-relay
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["networking.k8s.io"]
  resources: ["networkpolicies"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: hubble-relay
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: hubble-relay
subjects:
- kind: ServiceAccount
  name: hubble-relay
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: hubble-ui
rules:
- apiGroups: ["networking.k8s.io"]
  resources: ["networkpolicies"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods", "services", "namespaces"]  # namespaces 필수!
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: hubble-ui
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: hubble-ui
subjects:
- kind: ServiceAccount
  name: hubble-ui
  namespace: kube-system
---
apiVersion: v1
kind: Service
metadata:
  name: hubble-relay
  namespace: kube-system
spec:
  ports:
  - name: grpc
    port: 4245
    targetPort: 4245
  selector:
    k8s-app: hubble-relay
---
apiVersion: v1
kind: Service
metadata:
  name: hubble-ui
  namespace: kube-system
spec:
  ports:
  - name: http
    port: 80
    targetPort: 8081
  selector:
    k8s-app: hubble-ui
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hubble-relay
  namespace: kube-system
  labels:
    k8s-app: hubble-relay
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: hubble-relay
  template:
    metadata:
      labels:
        k8s-app: hubble-relay
    spec:
      serviceAccountName: hubble-relay
      containers:
      - name: hubble-relay
        image: quay.io/cilium/hubble-relay:v1.16.9
        imagePullPolicy: IfNotPresent
        command: [hubble-relay]
        args:
        - serve
        - --dial-timeout=5s
        - --peer-service=hubble-peer.kube-system.svc.cluster.local:443
        - --disable-server-tls
        - --disable-client-tls
        ports:
        - containerPort: 4245
          name: grpc
        resources:
          requests: {cpu: 100m, memory: 128Mi}
          limits: {cpu: 500m, memory: 512Mi}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: hubble-ui-nginx
  namespace: kube-system
data:
  nginx.conf: |
    server {
        listen       8081;
        server_name  localhost;
        location / {
            root   /app;
            index  index.html;
            try_files $uri $uri/ /index.html;
        }
        location /api {
            proxy_pass http://localhost:8090;
            proxy_http_version 1.1;
        }
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hubble-ui
  namespace: kube-system
  labels:
    k8s-app: hubble-ui
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: hubble-ui
  template:
    metadata:
      labels:
        k8s-app: hubble-ui
    spec:
      serviceAccountName: hubble-ui
      containers:
      - name: frontend
        image: quay.io/cilium/hubble-ui:v0.13.1
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8081
          name: http
        env:
        - name: HUBBLE_UI_ENABLE_INGRESS
          value: "false"
        volumeMounts:
        - name: nginx-conf
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: nginx.conf
        resources:
          requests: {cpu: 50m, memory: 64Mi}
          limits: {cpu: 200m, memory: 256Mi}
      - name: backend
        image: quay.io/cilium/hubble-ui-backend:v0.13.1
        imagePullPolicy: IfNotPresent
        env:
        - name: EVENTS_SERVER_PORT
          value: "8090"
        - name: FLOWS_API_ADDR
          value: "hubble-relay.kube-system.svc.cluster.local:4245"
        ports:
        - containerPort: 8090
          name: grpc
        resources:
          requests: {cpu: 50m, memory: 64Mi}
          limits: {cpu: 200m, memory: 256Mi}
      volumes:
      - name: nginx-conf
        configMap:
          name: hubble-ui-nginx
```

---

## 2. hubble-ui-service.yaml (NodePort)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hubble-ui-nodeport
  namespace: kube-system
  labels:
    app.kubernetes.io/name: hubble-ui
    app.kubernetes.io/part-of: cilium
spec:
  type: NodePort
  selector:
    k8s-app: hubble-ui
  ports:
    - name: http
      port: 80
      targetPort: 8081
      nodePort: 30072
```

---

## 3. NetworkPolicy (hubble-relay 전용)

> **hubble-ui에는 NetworkPolicy를 적용하지 않는다.**

### 이유

Cilium에서 표준 Kubernetes NetworkPolicy의 `to: []` (empty)는
**pod endpoint만 허용**하는 것으로 처리되어, ClusterIP 서비스(`kubernetes` svc, 10.96.0.1:443)에
접근이 차단된다. `CiliumNetworkPolicy`의 `toEntities: kube-apiserver`로 우회 가능하지만
복잡성이 증가하고, kube-system 내부 pod이므로 격리 필요성이 낮다.

### hubble-relay NetworkPolicy만 적용

```yaml
# 07-cilium-hubble.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: cilium-allow
  namespace: kube-system
spec:
  podSelector:
    matchLabels:
      k8s-app: hubble-relay
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from: []
      ports:
        - protocol: TCP
          port: 4245
  egress:
    # Cilium agent는 hostNetwork: true 이므로 podSelector가 아닌 port만 허용
    - ports:
        - protocol: TCP
          port: 4244
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

---

## 4. 적용 순서

```bash
# 1. 배포
kubectl apply -f kubernetes/manifests/cilium/hubble-deployment.yaml
kubectl apply -f kubernetes/manifests/cilium/hubble-ui-service.yaml
kubectl apply -f kubernetes/network-policies/07-cilium-hubble.yaml

# 2. 상태 확인
kubectl get pods -n kube-system -l 'k8s-app in (hubble-relay,hubble-ui)'
kubectl rollout status deployment/hubble-relay -n kube-system
kubectl rollout status deployment/hubble-ui -n kube-system

# 3. 접속 확인
curl -s -o /dev/null -w "%{http_code}" http://<NODE-IP>:30072/
# 200 응답 확인
```

---

## 5. 트러블슈팅

### "Welcome to nginx" 화면만 보임

nginx 기본 설정이 `/usr/share/nginx/html`을 서빙 중. `hubble-ui-nginx` ConfigMap이 마운트됐는지 확인.

```bash
kubectl exec -n kube-system <hubble-ui-pod> -c frontend -- cat /etc/nginx/conf.d/default.conf
# root /app; 이어야 함
```

### "Data streams are reconnecting..."

hubble-relay가 Cilium agent(4244)에 연결 못하는 상태.

```bash
kubectl logs -n kube-system -l k8s-app=hubble-relay | grep -i "peer\|error"
```

**원인**: NetworkPolicy의 `podSelector: k8s-app=cilium` egress 규칙이 `hostNetwork: true` pod에 미작동.
**해결**: port 4244만 허용하는 방식으로 destination 제한 제거 (위 NetworkPolicy 참고).

### "failed to list \*v1.Namespace: dial tcp 10.96.0.1:443: i/o timeout"

**원인 1**: hubble-ui NetworkPolicy가 k8s API(10.96.0.1:443) egress를 차단.
**해결**: hubble-ui NetworkPolicy 삭제.

**원인 2**: ClusterRole에 `namespaces` 권한 누락.
**해결**: ClusterRole에 namespaces get/list/watch 추가.

### hubble-relay "No connection to peer"

hubble-relay와 Cilium agent 연결 확인:
```bash
# Cilium agent가 4244 포트를 리슨 중인지 확인
kubectl exec -n kube-system <cilium-pod> -- ss -tlnp | grep 4244

# NetworkPolicy 적용 확인
kubectl describe networkpolicy cilium-allow -n kube-system
```

---

## 버전 호환성

| 컴포넌트 | 버전 |
|---|---|
| Cilium | v1.16.9 |
| hubble-relay | v1.16.9 |
| hubble-ui | v0.13.1 |
| hubble-ui-backend | v0.13.1 |
