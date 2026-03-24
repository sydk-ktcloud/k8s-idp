# 1단계: 빌드 환경
FROM gradle:8.7-jdk21 AS builder
WORKDIR /app
COPY . .
RUN gradle clean build -x test

# 2단계: 실행 환경
FROM eclipse-temurin:21-jdk
WORKDIR /app

# --- [추가] OpenTelemetry Java Agent 다운로드 ---
# 이 에이전트가 앱의 로그와 트레이스를 가로채서 Alloy로 보냅니다.
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

# 빌드된 jar 파일 복사
COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

# --- [수정] 자바 실행 시 에이전트를 포함하도록 변경 ---
ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "app.jar"]