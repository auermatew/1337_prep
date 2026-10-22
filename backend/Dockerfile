# syntax=docker/dockerfile:1
FROM node:24.22.1-slim AS base
WORKDIR /app

# Production dependencies only (postinstall runs `prisma generate`, no DB needed).
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev && npm cache clean --force

# Full install, then build (nest build emits dist/ including dist/generated).
FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
# Regenerate now that tsconfig is present: the generator derives its import
# file extensions (.js vs .ts) from it, and the postinstall run above had none.
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
# The prisma schema engine needs openssl.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
USER node
EXPOSE 3000
# exec hands PID 1 (via compose `init: true`) to node so SIGTERM reaches Nest.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
