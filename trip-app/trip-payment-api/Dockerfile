FROM gradle:8.7-jdk21 AS builder
WORKDIR /app
COPY . .
RUN gradle clean build -x test

FROM eclipse-temurin:21-jdk
WORKDIR /app
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "app.jar"]
