# ────────────────────────────────────────────────────────────────
# Stage 1 — deps: Cài đặt dependencies (tận dụng layer cache)
# ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

# Cài đặt các phụ thuộc hệ thống cần thiết cho sharp (libvips) và Prisma engine
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Kích hoạt pnpm qua corepack (đã được tích hợp sẵn trong Node 22)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy lockfile + manifest trước để cache layer không bị vỡ khi chỉ đổi code
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Cài toàn bộ dependencies (bao gồm devDependencies để build)
RUN pnpm install --frozen-lockfile


# ────────────────────────────────────────────────────────────────
# Stage 2 — builder: Biên dịch TypeScript và sinh Prisma Client
# ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy toàn bộ node_modules đã cài từ stage deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy toàn bộ source code
COPY . .

# Generate Prisma Client từ schema
RUN pnpm exec prisma generate

# Biên dịch TypeScript → dist/
RUN pnpm build


# ────────────────────────────────────────────────────────────────
# Stage 3 — runner: Image chạy production (tối giản, an toàn)
# ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Cài đặt phụ thuộc hệ thống runtime (Prisma engine & sharp)
RUN apk add --no-cache libc6-compat openssl tini

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files để cài production dependencies
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Chỉ cài production dependencies (loại bỏ toàn bộ devDependencies)
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma Client trong môi trường production
RUN pnpm exec prisma generate

# Copy artifacts đã biên dịch từ builder stage
COPY --from=builder /app/dist ./dist

# ── Bảo mật: Chạy dưới quyền non-root user ────────────────────
# Node 22 Alpine image đã có sẵn user 'node' (uid=1000)
RUN chown -R node:node /app
USER node

# Expose port ứng dụng (giá trị mặc định khớp với PORT trong .env.example)
EXPOSE 9999

# Dùng tini làm PID 1 để xử lý tín hiệu SIGTERM / SIGINT đúng cách
# và đảm bảo zombie process reaping trong container environment
ENTRYPOINT ["/sbin/tini", "--"]

# Chạy production build
CMD ["node", "dist/server.js"]
