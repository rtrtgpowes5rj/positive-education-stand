# Стенд Positive Education: сборка игры + сервер общего топа в одном контейнере
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 DATA_DIR=/data STATIC_DIR=/app/dist
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server ./server
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server/server.mjs"]
