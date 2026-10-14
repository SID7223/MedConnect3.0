# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM eclipse-temurin:17-jdk AS build
WORKDIR /src

# Warm the Gradle and dependency caches in a layer that survives source edits.
COPY gradle gradle
COPY gradlew gradlew
COPY gradlew.bat gradlew.bat
COPY settings.gradle.kts build.gradle.kts ./
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies --quiet || true

COPY src src
RUN ./gradlew --no-daemon installDist

# ---- run ------------------------------------------------------------------
FROM eclipse-temurin:17-jre
WORKDIR /app

# Run unprivileged.
RUN useradd --system --uid 10001 medconnect && chown -R medconnect /app
USER medconnect

COPY --from=build --chown=medconnect:root /src/build/install/medconnect-server /app

ENV PORT=8080 \
    HOST=0.0.0.0 \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["sh", "-c", "exec 3<>/dev/tcp/127.0.0.1/${PORT:-8080} && printf 'GET /healthz HTTP/1.0\\r\\n\\r\\n' >&3 && head -n 1 <&3 | grep -q 200"]

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/lib/medconnect-server.jar"]