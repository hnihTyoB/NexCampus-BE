# Backend Template Operations & Deployment Guide

**Repository**: `template-be`  
**Target Environments**: Docker, Docker Compose, Kubernetes, Linux VM, Cloud Run  

---

## 1. Environment Configuration

Copy `.env.example` to `.env` and configure credentials:

```bash
# Server & Environment
NODE_ENV=production
PORT=8888
TRUST_PROXY=true

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:password@postgres:5432/template_db?schema=public"

# JWT Authentication
JWT_ACCESS_SECRET="generate-a-strong-random-64-character-secret"
JWT_REFRESH_SECRET="generate-a-strong-random-64-character-secret"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption Key (AES-256-GCM - exactly 32 bytes or random string)
ENCRYPTION_KEY="a-super-secret-32-byte-encryption-key-for-gcm"

# CORS Allowed Origins (Comma-separated in Production, no wildcards)
ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"

# Redis Configuration (Cache invalidation & BullMQ)
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=""

# SMTP / Email Configuration
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER="your-email@example.com"
MAIL_PASS="your-app-password"
MAIL_FROM="noreply@example.com"
APP_CLIENT_URL="https://app.example.com"

# Cloudflare R2 / S3 Storage
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_BUCKET_NAME="your-bucket-name"
R2_ACCESS_KEY_ID="your-access-key-id"
R2_SECRET_ACCESS_KEY="your-secret-access-key"
R2_PUBLIC_BASE_URL="https://assets.example.com"
```

---

## 2. Standard Command Reference

```bash
# Development server with hot reload
pnpm dev

# Type check & production build
pnpm build

# Start production server
pnpm start

# Run full automated test suite
pnpm test

# Run code linter
pnpm run lint

# Format code with Prettier
pnpm run format

# Prisma ORM Operations
pnpm run prisma:generate   # Generate Prisma Client types
pnpm run db:migrate        # Apply migrations in development
pnpm run db:seed           # Seed default roles, permissions, configs
pnpm run prisma:studio     # Open web database viewer
```

---

## 3. Observability & Health Probes

| Endpoint | Probe Type | Purpose | Expected Status |
|---|---|---|---|
| `GET /api/v1/health` | Liveness | Basic process heartbeat and uptime | 200 OK |
| `GET /api/v1/health/liveness` | Liveness | Kubernetes liveness probe | 200 OK |
| `GET /api/v1/health/readiness` | Readiness | Deep checks for PostgreSQL query, Redis ping, heap/RSS memory | 200 OK (503 if DB down) |
| `GET /api/v1/maintenance/public` | Public Status | Frontend maintenance banner & ETA query | 200 OK |
| `GET /api/v1/system/public` | Public Config | Frontend bootstrap feature flags and settings | 200 OK |

---

## 4. Graceful Shutdown & Zero-Downtime Rollouts

The backend implements clean lifecycle termination on `SIGINT` / `SIGTERM`:
1. Closes HTTP listener (stops accepting new connections, drains active requests).
2. Stops background polling workers (`EmailWorker`).
3. Closes BullMQ workers and queues (`WebhookWorker`, `WebhookQueue`).
4. Closes Redis cache subscriber/publisher instances.
5. Disconnects PostgreSQL database client (`prisma.$disconnect()`).
6. Failsafe 10-second timeout forces process exit if external handles stall.
