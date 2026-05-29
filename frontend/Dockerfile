FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build && npm install --no-save http-proxy

# Продакшен без nginx/apk — только Node (обходит TLS к Docker Hub и dl-cdn.alpinelinux.org)
FROM node:20-alpine
WORKDIR /app

ENV BACKEND_URL=http://backend:8080
ENV PORT=80

COPY --from=build /app/dist ./dist
COPY --from=build /app/docker-server.mjs ./
COPY --from=build /app/node_modules/http-proxy ./node_modules/http-proxy
COPY --from=build /app/node_modules/eventemitter3 ./node_modules/eventemitter3
COPY --from=build /app/node_modules/requires-port ./node_modules/requires-port
COPY --from=build /app/node_modules/follow-redirects ./node_modules/follow-redirects

EXPOSE 80
CMD ["node", "docker-server.mjs"]
