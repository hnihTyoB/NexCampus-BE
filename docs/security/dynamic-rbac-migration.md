# Dynamic RBAC Migration & Safety Guide

**Document**: `docs/security/dynamic-rbac-migration.md`  
**Version**: 1.0.0  
**Target**: `template-be`

---

## 1. Migration Overview

The migration to Dynamic RBAC is non-destructive:
- It preserves all existing `users`, `roles`, `wallets`, `categories`, and `transactions`.
- It introduces new relational tables: `permissions`, `role_permissions`, `audit_logs`.
- It updates the existing `roles` table with `description` and `is_system` columns.
- An idempotent seed script registers the 27 system permissions and assigns them to default roles (`ADMIN`, `MANAGER`, `USER`), ensuring zero downtime or permission loss for existing users.

---

## 2. Step-by-Step Migration Execution

1. **Schema Validation**:
   ```bash
   pnpm exec prisma validate
   ```
2. **Generate Prisma Client**:
   ```bash
   pnpm run prisma:generate
   ```
3. **Apply Database Migration**:
   ```bash
   pnpm run db:migrate
   ```
4. **Execute Idempotent Database Seeding**:
   ```bash
   pnpm run db:seed
   ```
5. **Verify Build & Run Automated Test Suite**:
   ```bash
   pnpm test
   pnpm build
   pnpm run lint
   ```

---

## 3. Rollback Strategy

In the unlikely event of an issue:
1. Since the foreign keys on `role_permissions` and `permissions` are additive, existing queries on `User.roleId` continue to resolve normally.
2. Route guards retain fallback authorization capabilities if required.
