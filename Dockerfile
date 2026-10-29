# Imagem só do back-end (API). O front é publicado à parte como Render Static Site (ver render.yaml).

# 1) Build (Maven -> jar)
FROM maven:3.9.9-eclipse-temurin-21-alpine AS build
WORKDIR /app/backend
COPY backend/pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
RUN mvn -q -B -DskipTests package

# 2) Execução
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S blitz && adduser -S blitz -G blitz
USER blitz
COPY --from=build /app/backend/target/*.jar app.jar
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
