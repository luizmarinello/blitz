# Imagem única: front compilado dentro do jar do Spring (mesma origem => cookie de sessão simples, sem CORS).

# 1) Front-end (TypeScript -> estático)
FROM node:24-alpine AS front
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN mkdir -p /app/backend/src/main/resources && npm run build

# 2) Back-end (Maven -> jar)
FROM maven:3.9.9-eclipse-temurin-21-alpine AS build
WORKDIR /app/backend
COPY backend/pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
COPY --from=front /app/backend/src/main/resources/static ./src/main/resources/static
RUN mvn -q -B -DskipTests package

# 3) Execução
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S blitz && adduser -S blitz -G blitz
USER blitz
COPY --from=build /app/backend/target/*.jar app.jar
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
