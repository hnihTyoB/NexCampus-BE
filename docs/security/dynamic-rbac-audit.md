# Dynamic RBAC Authorization Audit Report (Phase 0)

**Date**: 2026-08-22 20:25:00 (UTC+7 / Asia/Ho_Chi_Minh)  
**Scope**: Backend API Authorization Architecture (`template-be`)  
**Status**: AUDIT COMPLETE (Pre-Implementation)

---

## 1. Executive Summary

This audit evaluates the authorization system of the backend template. Currently, the system relies on a **Fixed Role-Based Authorization** model:
- Roles (`ADMIN`, `MANAGER`, `USER`) are stored in the database, but access permissions are hard-coded in route definitions (`requireRole(ROLES.ADMIN)`).
- Adding a new role (e.g., `ACCOUNTANT`, `AUDITOR`) or reconfiguring privileges currently requires modifying source code and redeploying the backend.
- The objective is to transition to **Dynamic Role-Based Access Control (RBAC)** where:
  - Permissions represent granular business capabilities (`USER_READ`, `USER_CREATE`, `WALLET_READ`, `ROLE_UPDATE`, etc.).
  - Roles group permissions dynamically in the database (`Role` -> `RolePermission` -> `Permission`).
  - Middleware enforces permissions (`requirePermission('USER_READ')`), making authorization independent of specific role names.
  - Resource ownership checks are strictly preserved to prevent Insecure Direct Object References (IDOR).

---

## 2. Inventory of Current Authorization Artifacts

### 2.1 Current Roles
- Defined in `src/common/constants/role.constant.ts`:
  ```typescript
  export const ROLES = {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    USER: 'USER',
  } as const;
  ```
- Seeded in database via `prisma/seed.ts` into the `Role` table (`roles`).

### 2.2 Current Role Checks & Route Guards
The codebase currently uses `requireRole(...)` from `src/middlewares/role.middleware.ts`:
- `src/modules/users/user.route.ts`:
  - `GET /api/v1/users` -> `authMiddleware, requireRole(ROLES.ADMIN)`
  - `GET /api/v1/users/:id` -> `authMiddleware, requireRole(ROLES.ADMIN)`
  - `POST /api/v1/users` -> `authMiddleware, requireRole(ROLES.ADMIN)`
  - `PUT /api/v1/users/:id` -> `authMiddleware, requireRole(ROLES.ADMIN)`
  - `DELETE /api/v1/users/:id` -> `authMiddleware, requireRole(ROLES.ADMIN)`
- `src/modules/auth/auth.service.ts`:
  - Hardcodes default role on registration: `this.repository.findRoleByName(ROLES.USER)`.
  - JWT token payload creation embeds `role: user.role.name`.

### 2.3 Hard-Coded Authorization Vulnerabilities & Limitations
1. **Coupling to Role Names**: `requireRole(ROLES.ADMIN)` strictly checks `req.user.role === 'ADMIN'`. New roles cannot access any administrative features without modifying route files.
2. **Coarse-Grained Control**: A user either has all admin rights or none. It is impossible to grant read-only user inspection without granting user deletion rights.
3. **No Permission Entity in DB**: The database only contains `roles` and `users`; there are no `permissions` or `role_permissions` tables.

---

## 3. Dynamic RBAC Permission Design

We structure permissions following the `RESOURCE_ACTION` capability model:

| Resource | Action | Permission Name | Description |
| :--- | :--- | :--- | :--- |
| `USER` | `READ` | `USER_READ` | View user list and profile details |
| `USER` | `CREATE` | `USER_CREATE` | Create new user accounts (Admin) |
| `USER` | `UPDATE` | `USER_UPDATE` | Update user status and role assignments |
| `USER` | `DELETE` | `USER_DELETE` | Soft-delete user accounts |
| `WALLET` | `READ` | `WALLET_READ` | View wallet details and balances |
| `WALLET` | `CREATE` | `WALLET_CREATE` | Create new wallets |
| `WALLET` | `UPDATE` | `WALLET_UPDATE` | Update wallet name/settings |
| `WALLET` | `DELETE` | `WALLET_DELETE` | Delete or archive wallets |
| `TRANSACTION` | `READ` | `TRANSACTION_READ` | View transaction history and entries |
| `TRANSACTION` | `CREATE` | `TRANSACTION_CREATE` | Record income, expense, and transfers |
| `TRANSACTION` | `UPDATE` | `TRANSACTION_UPDATE` | Edit existing transactions |
| `TRANSACTION` | `DELETE` | `TRANSACTION_DELETE` | Delete transactions |
| `CATEGORY` | `READ` | `CATEGORY_READ` | View transaction categories |
| `CATEGORY` | `CREATE` | `CATEGORY_CREATE` | Create custom categories |
| `CATEGORY` | `UPDATE` | `CATEGORY_UPDATE` | Edit categories |
| `CATEGORY` | `DELETE` | `CATEGORY_DELETE` | Delete custom categories |
| `BUDGET` | `READ` | `BUDGET_READ` | View budgets and spending progress |
| `BUDGET` | `CREATE` | `BUDGET_CREATE` | Set new budget limits |
| `BUDGET` | `UPDATE` | `BUDGET_UPDATE` | Modify budget amounts/periods |
| `BUDGET` | `DELETE` | `BUDGET_DELETE` | Remove budget goals |
| `REPORT` | `READ` | `REPORT_READ` | View financial analytics and reports |
| `ROLE` | `READ` | `ROLE_READ` | View roles and role permissions |
| `ROLE` | `CREATE` | `ROLE_CREATE` | Create new custom roles |
| `ROLE` | `UPDATE` | `ROLE_UPDATE` | Edit role information |
| `ROLE` | `DELETE` | `ROLE_DELETE` | Delete non-system roles |
| `PERMISSION` | `READ` | `PERMISSION_READ` | View system permission catalog |
| `ROLE_PERMISSION` | `ASSIGN` | `ROLE_PERMISSION_ASSIGN` | Assign/revoke permissions to/from roles |
| `AUDIT_LOG` | `READ` | `AUDIT_LOG_READ` | View security and RBAC audit logs |

---

## 4. Initial Role-to-Permission Mapping (Baseline Seeding)

| Role Name | Is System | Assigned Permissions |
| :--- | :---: | :--- |
| **`ADMIN`** | `true` | **ALL Permissions** (Full system management + all capabilities) |
| **`MANAGER`** | `true` | `USER_READ`, `ROLE_READ`, `PERMISSION_READ`, `WALLET_*`, `TRANSACTION_*`, `CATEGORY_*`, `BUDGET_*`, `REPORT_READ` |
| **`USER`** | `true` | `WALLET_*`, `TRANSACTION_*`, `CATEGORY_*`, `BUDGET_*`, `REPORT_READ` (Scoped to owned resources) |

---

## 5. Security Invariants & Protections

1. **System Roles Protection (`isSystem = true`)**:
   - The `ADMIN` and `USER` system roles cannot be deleted.
   - The `ADMIN` role must always retain `ROLE_PERMISSION_ASSIGN` to prevent permanent administrator lockout.
2. **Resource Ownership Preservation**:
   - `WALLET_READ` or `TRANSACTION_READ` only allows users to query their **own** data (`where: { userId }`).
   - Having a permission grants the *capability* to perform an action, while the service layer enforces *resource ownership*.
3. **Audit Logging**:
   - Every mutation on Roles, RolePermissions, and User Roles is captured in `AuditLog`.

---

## 6. Migration Plan

1. **Database Schema**: Add `Permission`, `RolePermission`, `AuditLog` models to `prisma/schema.prisma`. Add `isSystem` and `description` to `Role`.
2. **Database Migration**: Run `pnpm run prisma:generate` and safe migration.
3. **Idempotent Seed**: Upsert all permissions and link initial baseline permissions to `ADMIN`, `MANAGER`, and `USER`.
4. **Middleware & Caching**: Implement `requirePermission(...permissions)` middleware with in-memory TTL caching for role permissions.
5. **RBAC APIs**: Expose `/api/v1/roles`, `/api/v1/permissions`, and `/api/v1/audit-logs` modules.
6. **Refactor Existing Routes**: Replace `requireRole` with `requirePermission` in User and Auth routes.
7. **Auth / Me & Token**: Update `GET /auth/me` and login response to provide user permissions for frontend UI rendering.
8. **Automated Testing & Security Audit**: Add comprehensive unit and integration tests verifying permission grant, denial, ownership, and protection invariants.
