# syntax=docker/dockerfile:1
# Production web image: the built frontend served by Caddy, which also
# reverse-proxies /api to the backend (see Caddyfile and deploy/compose.prod.yml).
FROM node:24.22.1-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2.10-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
