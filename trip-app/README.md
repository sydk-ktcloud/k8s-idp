# Trip App — 여행 예약 플랫폼

IDP 시연용 여행 상품 예약 애플리케이션입니다. 마이크로서비스 아키텍처로 구성되어 있으며, 플랫폼의 관찰가능성·GitOps·오토스케일링 기능을 검증하기 위한 워크로드로 활용됩니다.

---

## 아키텍처

```
사용자 → trip-front (React/Nginx, :30249)
              ↓
         trip-backend (Spring Boot, :30088)
           ↓              ↓
    trip-cart-api      trip-payment-api
      (:8081)              (:8082)
           ↓
       trip-db (PostgreSQL 15)
```

## 기술 스택

| 컴포넌트 | 기술 | 설명 |
|----------|------|------|
| **trip-front** | React 18 + TypeScript + Vite | Tailwind CSS, Kakao Maps, React Query |
| **trip-backend** | Spring Boot 3.3 + Java 21 | JPA, OpenTelemetry, Swagger API 문서 |
| **trip-cart-api** | Spring Boot 3.3 + Java 21 | 장바구니 내부 API |
| **trip-payment-api** | Spring Boot 3.3 + Java 21 | 결제 처리 내부 API |
| **trip-db** | PostgreSQL 15 | Longhorn PV (5Gi) |

## 주요 기능

- **상품 조회**: 카테고리 필터, 검색, 인기 상품 캐러셀
- **상품 상세**: Kakao Maps 지도 연동, 예약/장바구니 옵션
- **장바구니**: 수량 조절, 실시간 동기화 (cart-api)
- **결제**: 예약자 정보 입력, 결제 처리 (payment-api), 주문번호 발급

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/v1/products` | 전체 상품 목록 |
| `GET` | `/api/v1/products/{id}` | 상품 상세 |
| `GET` | `/api/v1/carts` | 장바구니 조회 |
| `POST` | `/api/v1/carts` | 장바구니 추가 |
| `DELETE` | `/api/v1/carts/{id}` | 장바구니 삭제 |
| `POST` | `/api/v1/orders` | 주문 생성 |
| `POST` | `/api/v1/payments` | 결제 처리 |

## 관찰가능성

- **Tracing**: OpenTelemetry Java Agent → Alloy → Tempo
- **Metrics**: Micrometer Prometheus → Grafana
- **Logs**: Logstash Logback → Alloy → Loki

OTLP 엔드포인트: `http://alloy.monitoring.svc.cluster.local:4317` (gRPC)

## 배포

GitOps(ArgoCD)로 자동 배포됩니다.

```
GitHub Push (trip-app/**)
  → GitHub Actions (Docker Build & Push)
    → ArgoCD Sync (trip-app)
      → Kubernetes (trip-app 네임스페이스)
```

**CI 워크플로우**: `.github/workflows/trip-backend.yaml`, `trip-front.yaml`
**ArgoCD 앱**: `kubernetes/argocd-apps/trip-app.yaml`
**K8s 매니페스트**: `kubernetes/manifests/trip-app/`

## 로컬 개발

```bash
# Frontend
cd trip-front
npm install
npm run dev          # Vite dev server

# Backend
cd trip-backend
./gradlew bootRun    # Spring Boot
```

## 시연 특수 기능

- **서비스 체인 토글**: `TRIP_CHAIN_ENABLED` 환경변수로 backend → cart-api → payment-api 체인 활성화/비활성화
- **장애 주입**: `X-Demo-Failure` 헤더로 의도적 장애 발생 (Chaos Engineering 시연용)
- **GKE Burst**: `trip-app-burst` Deployment + HPA (CPU 70% 임계값, 1→5 replicas)
