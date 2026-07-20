# Base Stage
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies Stage
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile

# Builder Stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm run build

# Production Stage
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/templates ./templates

EXPOSE 8888

CMD ["node", "dist/server.js"]
