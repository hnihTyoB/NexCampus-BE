# Backend Template Upgrade Plan

**Repository**: `template-be`  
**Date**: 2026-08-24  
**Target Architecture**: Modular Layered Monolith with Reusable Enterprise Infrastructure  

---

## 1. Upgrade Objectives

1. **System Configuration & Feature Flags Engine**:
   - Add database-backed dynamic system configuration and feature flags (`SystemConfig` / `FeatureFlag`).
   - Create generic `SystemConfig` module (`system-config.route.ts`, `validation`, `controller`, `service`, `repository`, `dto`).
   - Support typed access (`getFeatureFlag(key)`, `getConfig(key)`), in-memory TTL caching with invalidation, RBAC permissions (`SYSTEM_CONFIG_READ`, `SYSTEM_CONFIG_MANAGE`), and audit logging.
   - Add `requireFeatureFlag('key')` middleware for route-level feature gating.

2. **Clean Layer Separation Refactor**:
   - Refactor `apiKeyAuthMiddleware` to use `IntegrationRepository`.
   - Refactor `permission.middleware.ts` to use `UserRepository` / `AuthRepository`.
   - Refactor direct Prisma queries in `MaintenanceCacheService`, `PermissionCacheService`, `NotificationDispatcher`, `EmailWorker` to utilize repository methods.

3. **Production Observability & Diagnostics**:
   - Add `requestIdMiddleware` with `X-Request-Id` header correlation.
   - Enhance `/health` with `/health/liveness` and `/health/readiness` (PostgreSQL query check, Redis ping check, process memory, uptime).

4. **Graceful Shutdown & Resilience**:
   - Implement `gracefulShutdown` in `server.ts` to cleanly close HTTP server, stop workers, disconnect BullMQ queues, close Redis instances, and disconnect Prisma.

5. **Type & Constant Hygiene**:
   - Fix magic strings in error middleware (`ERROR_CODE.INTERNAL_SERVER_ERROR`).
   - Add new permissions and audit actions to `permission.constant.ts` and `audit-log.constant.ts`.

6. **Comprehensive Test Suite & Documentation**:
   - Add tests for System Config, Feature Flags, Health readiness, Request ID correlation.
   - Generate all Phase 8 documentation files in `docs/template/`.

---

## 2. File Modification & Creation Matrix

### [CREATE]
- `prisma/migrations/20260824000000_add_system_configs_and_feature_flags/migration.sql` (if schema migration needed or unified schema)
- `src/common/constants/system-config.constant.ts`
- `src/middlewares/request-id.middleware.ts`
- `src/middlewares/feature-flag.middleware.ts`
- `src/modules/system-config/system-config.dto.ts`
- `src/modules/system-config/system-config.validation.ts`
- `src/modules/system-config/system-config.repository.ts`
- `src/modules/system-config/system-config.service.ts`
- `src/modules/system-config/system-config.controller.ts`
- `src/modules/system-config/system-config.route.ts`
- `src/routes/health.route.ts`
- `tests/system-config.test.ts`
- `tests/observability.test.ts`
- `docs/template/backend-template-architecture.md`
- `docs/template/backend-template-features.md`
- `docs/template/backend-template-security.md`
- `docs/template/backend-template-operations.md`
- `docs/template/backend-template-testing.md`
- `docs/template/backend-template-completion.md`

### [MODIFY]
- `prisma/schema.prisma` (Add `SystemConfig` / `FeatureFlag` model)
- `src/common/constants/permission.constant.ts` (Add `SYSTEM_CONFIG_READ`, `SYSTEM_CONFIG_MANAGE`)
- `src/common/constants/audit-log.constant.ts` (Add `SYSTEM_CONFIG_UPDATED`, `FEATURE_FLAG_TOGGLED`)
- `src/common/constants/error-code.ts` (Add `FEATURE_DISABLED`, `CONFIGURATION_ERROR`)
- `src/middlewares/api-key.middleware.ts` (Route queries through `IntegrationRepository`)
- `src/middlewares/permission.middleware.ts` (Route queries through repository)
- `src/middlewares/error.middleware.ts` (Use enum for `INTERNAL_SERVER_ERROR`)
- `src/modules/integration/integration.repository.ts` (Add `findApiKeyByKeyHash`, `updateApiKeyLastUsed`)
- `src/routes/index.ts` (Mount `/health` router and `/system` router)
- `src/app.ts` (Attach `requestIdMiddleware`)
- `src/server.ts` (Add graceful shutdown handler)
- `package.json` (Ensure test script runs reliably)

---

## 3. Database Schema Changes & Safety Review

- **Model to Add**: `SystemConfig`
  - `id`: UUID
  - `key`: String (Unique)
  - `value`: Json
  - `description`: String?
  - `category`: String (`GENERAL`, `FEATURE_FLAG`, `INTEGRATION`, `SECURITY`)
  - `isPublic`: Boolean (default `false`)
  - `createdAt`: DateTime
  - `updatedAt`: DateTime
  - `@@index([category])`
  - `@@index([isPublic])`
  - `@@map("system_configs")`
- **Migration Safety**: Non-destructive, additive table creation only. Zero existing tables or columns dropped.
