# syntax=docker/dockerfile:1
FROM node:24.22.1-slim AS base
WORKDIR /app
# OpenSSL 3 must be present in every stage: prisma picks its schema engine
# binary (openssl-1.1.x vs 3.0.x) at install time, and the runtime needs the
# 3.0.x one baked in rather than downloaded at every container start.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Production dependencies only (postinstall runs `prisma generate`, no DB needed).
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev && npm cache clean --force

# Full install, then build (nest build emits dist/ including dist/generated).
FROM base AS build
COPY package.json package-lock.json ./
# Scripts off so schema/migration edits don't invalidate this layer.
RUN npm ci --ignore-scripts
COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
# Generate with tsconfig present: the generator derives its import file
# extensions (.js vs .ts) from it.
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false CHECKPOINT_DISABLE=1
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
USER node
EXPOSE 3000
# exec hands PID 1 (via compose `init: true`) to node so SIGTERM reaches Nest.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main"]
