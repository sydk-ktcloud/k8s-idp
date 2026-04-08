# DR 클러스터 발동 흐름도 (Active-Passive On-Demand)

> **모델**: 평시 EKS 클러스터 없음 (비용 $0) → 장애 감지 시 자동 프로비저닝 → 복구 후 완전 삭제

## 1. 전체 DR 발동 흐름 (장애 감지 → 자동 프로비저닝 → 복구 → 복귀)

```mermaid
flowchart TD
    subgraph NORMAL["🟢 정상 운영 (EKS 없음, 비용 $0)"]
        HB["On-Prem CronJob<br/>5분마다 Heartbeat<br/>→ AWS S3 업로드"]
        PROM["On-Prem Prometheus<br/>CPU/Memory/Pod 메트릭"]
        BACKUP["MinIO → GCS 미러링<br/>매일 04:30 UTC<br/>Velero + Longhorn 백업"]
    end

    subgraph DETECT["🔍 장애 감지 (15분 임계치)"]
        LAMBDA["AWS Lambda<br/>heartbeat-monitor<br/>5분마다 S3 확인"]
        CHECK{{"Heartbeat 나이<br/>> 15분?"}}
        LAMBDA --> CHECK
    end

    subgraph AUTO_DR["⚡ 자동 DR 트리거"]
        DISCORD_ALERT["Discord 알림<br/>#클러스터-알림<br/>🚨 장애 감지 + DR 트리거"]
        GH_DISPATCH["Lambda → GitHub API<br/>workflow_dispatch 호출"]
        GH_ACTIONS["GitHub Actions<br/>dr-activate 워크플로우<br/>self-hosted runner 실행"]
        REPEAT["60분마다<br/>상태 반복 알림"]
    end

    subgraph DR_ACTIVATE["⚡ DR 활성화 (dr-activate.sh)"]
        STEP1["1️⃣ EKS Crossplane Claim 생성<br/>kubectl apply ekscluster-dr-claim.yaml<br/>(10-15분 소요)"]
        STEP2["2️⃣ EKS kubeconfig 추출<br/>Crossplane Secret → 로컬"]
        STEP3["3️⃣ EKS 인프라 배포<br/>Tailscale VPN<br/>Prometheus / Velero"]
        STEP4["4️⃣ Velero Restore<br/>GCS 최신 백업 → EKS<br/>trip-app, backstage 복구"]
        STEP5["5️⃣ GKE 메트릭 소스 전환<br/>Prometheus Proxy<br/>On-prem → EKS IP"]
        STEP6["6️⃣ Discord 알림<br/>🚨 DR 활성화 완료"]

        STEP1 --> STEP2 --> STEP3 --> STEP4 --> STEP5 --> STEP6
    end

    subgraph DR_RUNNING["🔴 DR 모드 운영"]
        EKS_RUN["EKS DR 클러스터<br/>trip-app + backstage 서비스"]
        GKE_SWITCH["GKE Burst<br/>KEDA 메트릭 소스 = EKS<br/>EKS 부하 시 GKE로 Burst"]
        VELERO_EKS["Velero 자동 백업<br/>6시간 간격, 72시간 보존"]
    end

    subgraph FAILBACK["✅ Failback (dr-failback.sh)"]
        FB1["1️⃣ On-Prem 상태 확인<br/>4 노드 Ready, Heartbeat 정상"]
        FB2["2️⃣ EKS 최종 백업 생성<br/>trip-app, backstage → GCS"]
        FB3["3️⃣ On-Prem에 복구<br/>Velero Restore → On-Prem"]
        FB4["4️⃣ GKE 메트릭 소스 복귀<br/>EKS → On-Prem Prometheus"]
        FB5["5️⃣ EKS 완전 삭제<br/>kubectl delete ekscluster<br/>Crossplane이 AWS 리소스 제거<br/>(비용 $0 복귀)"]
        FB6["6️⃣ Discord 알림<br/>✅ Failback 완료"]

        FB1 --> FB2 --> FB3 --> FB4 --> FB5 --> FB6
    end

    %% Flow connections
    HB -->|"S3 업로드"| LAMBDA
    BACKUP -->|"일일 백업"| STEP4

    CHECK -->|"Yes: 장애"| DISCORD_ALERT
    CHECK -->|"Yes: 장애"| GH_DISPATCH
    CHECK -->|"No: 정상"| HB
    GH_DISPATCH --> GH_ACTIONS
    GH_ACTIONS --> STEP1
    DISCORD_ALERT --> REPEAT

    STEP6 --> EKS_RUN
    EKS_RUN --> GKE_SWITCH
    EKS_RUN --> VELERO_EKS

    PROM -->|"정상 시"| GKE_SWITCH

    EKS_RUN -->|"On-Prem 복구 확인"| FB1
    FB6 -->|"정상 운영 복귀"| NORMAL

    %% Styles
    style NORMAL fill:#d4edda,stroke:#28a745
    style DETECT fill:#fff3cd,stroke:#ffc107
    style AUTO_DR fill:#f8d7da,stroke:#dc3545
    style DR_ACTIVATE fill:#f8d7da,stroke:#dc3545
    style DR_RUNNING fill:#f5c6cb,stroke:#dc3545
    style FAILBACK fill:#cce5ff,stroke:#007bff
```

## 2. Heartbeat 기반 Dead Man's Switch + 자동 DR 트리거 상세

```mermaid
sequenceDiagram
    participant CRON as On-Prem CronJob<br/>(5분 주기)
    participant S3 as AWS S3<br/>sydk-velero-dr-usw2/heartbeat/
    participant EB as EventBridge<br/>(5분 주기 트리거)
    participant LAMBDA as Lambda<br/>heartbeat-monitor
    participant STATE as S3 State File<br/>monitor-state.json
    participant DISCORD as Discord<br/>#클러스터-알림
    participant GITHUB as GitHub Actions<br/>dr-activate workflow
    participant RUNNER as Self-Hosted Runner<br/>(On-Prem)

    Note over CRON,RUNNER: 🟢 정상 운영 상태 (EKS 없음, 비용 $0)

    loop 5분마다
        CRON->>S3: PUT heartbeat.json<br/>{"timestamp":"...", "status":"alive"}
    end

    loop 5분마다
        EB->>LAMBDA: 트리거
        LAMBDA->>S3: GET heartbeat.json<br/>LastModified 확인
        LAMBDA->>STATE: GET monitor-state.json

        alt Heartbeat 나이 < 15분
            LAMBDA->>STATE: state=OK 업데이트
            Note over LAMBDA: 1시간마다 OK 요약 전송
            LAMBDA-->>DISCORD: 🟢 정상 운영 (1시간 주기)
        end
    end

    Note over CRON,RUNNER: 🔴 On-Prem 장애 발생

    CRON-xS3: ❌ Heartbeat 중단

    loop 5분마다
        EB->>LAMBDA: 트리거
        LAMBDA->>S3: GET heartbeat.json
        Note over LAMBDA: LastModified > 15분 전

        alt 첫 번째 알림 (state: OK → ALERT)
            LAMBDA->>STATE: state=ALERT, dr_triggered=true
            LAMBDA->>DISCORD: 🚨 장애 감지!<br/>DR 자동 트리거됨
            LAMBDA->>GITHUB: workflow_dispatch<br/>dr-activate.yaml
            GITHUB->>RUNNER: dr-activate.sh 실행
            RUNNER->>RUNNER: kubectl apply ekscluster claim<br/>Crossplane → EKS 프로비저닝
            Note over RUNNER: 10-15분 후 EKS ACTIVE
            RUNNER->>RUNNER: Velero Restore + 인프라 배포
            RUNNER->>DISCORD: 🚨 DR 활성화 완료
        else 반복 알림 (60분 주기)
            LAMBDA->>STATE: lastAlertTime 확인
            LAMBDA->>DISCORD: 🚨 장애 지속 중<br/>DR 프로비저닝 진행 중
        end
    end

    Note over CRON,RUNNER: ✅ On-Prem 복구

    CRON->>S3: PUT heartbeat.json (재개)
    EB->>LAMBDA: 트리거
    LAMBDA->>S3: GET heartbeat.json
    Note over LAMBDA: LastModified < 15분
    LAMBDA->>STATE: state=OK (ALERT → OK)
    LAMBDA->>DISCORD: ✅ 복구 확인!<br/>⚠️ DR 클러스터 활성 상태<br/>Failback 실행 필요
```

## 3. GKE Burst & DR 메트릭 소스 전환

```mermaid
flowchart LR
    subgraph ONPREM["On-Prem"]
        PROM_OP["Prometheus<br/>10.102.177.113:9090"]
        METRICS_OP["Recording Rules<br/>• node_cpu_utilization<br/>• node_memory_utilization<br/>• pending_pods"]
    end

    subgraph EKS["EKS DR (On-Demand)"]
        PROM_EKS["Prometheus<br/>&lt;EKS_TAILSCALE_IP&gt;:9090"]
        METRICS_EKS["Recording Rules<br/>• node_cpu_utilization<br/>• node_memory_utilization<br/>• pending_pods"]
        EKS_NOTE["평시: 존재하지 않음<br/>DR 시: 자동 프로비저닝"]
    end

    subgraph GKE["GKE Burst"]
        PROXY["Prometheus Proxy<br/>(Nginx)<br/>ConfigMap: upstream_url"]
        KEDA["KEDA ScaledObject<br/>burst-demo-scaler"]
        BURST_PODS["Burst 워크로드<br/>0-5 replicas"]

        PROXY --> KEDA
        KEDA -->|"Scale 0↔5"| BURST_PODS
    end

    PROM_OP --> METRICS_OP
    PROM_EKS --> METRICS_EKS

    METRICS_OP -->|"정상: On-Prem 메트릭"| PROXY
    METRICS_EKS -.->|"DR: EKS 메트릭"| PROXY

    subgraph TRIGGERS["KEDA 트리거 조건"]
        T1["HTTP Rate > 100 req/min"]
        T2["CPU > 70% (2분)"]
        T3["Pending Pods > 3개 (1분)"]
    end

    KEDA --> TRIGGERS
```

---

## 비용 비교

| 항목 | 기존 (Dormant) | 현재 (On-Demand) |
|------|---------------|-----------------|
| **평시 EKS 비용** | ~$73/월 (Control Plane) | **$0** |
| **평시 노드 비용** | $0 (nodeCount=0) | **$0** (클러스터 없음) |
| **DR 활성화 시간** | 3-5분 (노드 scale-up) | 10-15분 (클러스터 생성) |
| **DR 비용** | Control Plane + 노드 | Control Plane + 노드 |
| **Failback 후** | Control Plane 유지 | **완전 삭제, $0** |
| **트레이드오프** | 빠른 복구 | 비용 절감, 느린 복구 |

## 알람 메커니즘 정리

### 알람 채널별 분류

| 채널 | 발신 주체 | 트리거 | 내용 |
|------|----------|--------|------|
| **Discord #클러스터-알림** | AWS Lambda | Heartbeat 15분 미갱신 | 🚨 장애 감지 + DR 자동 트리거 알림 |
| **Discord #클러스터-알림** | AWS Lambda | ALERT → OK 전환 | ✅ 복구 확인 + Failback 안내 |
| **Discord #라이프사이클-알림** | Backstage Provider | Crossplane 리소스 Ready 전환 | 리소스 프로비저닝 완료 알림 |
| **Discord #라이프사이클-알림** | Lifecycle Scanner CronJob | 매일 08:00 UTC | 만료 예정/만료 리소스 삭제 알림 |
| **Alertmanager → Discord** | Prometheus Rules | 메트릭 임계치 초과 | Backup 실패, 스토리지 부족, Burst 트리거 |
| **Discord (Cloud Credits)** | Cloud Credit Monitor | 매시간 | AWS/GCP/Azure 비용 리포트 |
| **Discord (DR 스크립트)** | dr-activate.sh / dr-failback.sh | 자동/수동 실행 | DR 활성화/복귀 완료 알림 |

### 알람 흐름 요약

```
1. 장애 감지 + 자동 DR 체인:
   On-Prem CronJob (5분) → S3 Heartbeat → Lambda (5분) → 15분 임계
   → Discord 알림 + GitHub Actions workflow_dispatch
   → Self-Hosted Runner → dr-activate.sh
   → Crossplane EKS Claim Apply → EKS 프로비저닝 (10-15분)
   → Velero Restore → 서비스 복구

2. Burst 트리거 체인:
   Prometheus 메트릭 → PrometheusRule 알림 → KEDA ScaledObject → GKE Pod Scale-Up

3. 백업 실패 체인:
   Velero/Longhorn 에러 → PrometheusRule → Alertmanager → Discord 알림

4. Failback 체인:
   Lambda 복구 알림 → 운영자 확인 → dr-failback.sh
   → EKS 최종 백업 → On-Prem 복구 → EKS Claim 삭제 (완전 제거)
   → 비용 $0 복귀
```

### Split-Brain 방지

1. **15분 임계치**: 네트워크 순단 등 false positive 방지
2. **수동 Failback**: 자동 복구 시 flip-flop 방지, 운영자 판단 필수
3. **Lambda 상태 파일**: S3에 `monitor-state.json` 저장, ALERT/OK 전환 + `dr_triggered` 플래그 추적
4. **60분 반복 알림**: 알림 폭주 방지, 상태 변경 시에만 즉시 발송
5. **EKS 존재 여부 체크**: `dr-activate.sh`가 이미 EKS가 존재하면 중복 생성 방지
6. **GitHub Actions 멱등성**: 워크플로우가 EKS ACTIVE 상태면 재프로비저닝 건너뜀
