# Backend Template Features Reference

**Repository**: `template-be`  
**Target Domains**: SaaS, CRM, E-Commerce, Admin Systems, LMS, HRM, Financial & AI-enabled Backends  

---

## 1. Feature Matrix

### 🔐 Authentication & Session Management
- **Token Delivery**: Dual-delivery support (HTTP-Only Secure Cookies for Web + Bearer Tokens in JSON body for Zalo Mini Apps / Mobile WebViews).
- **Token Lifecycle**: Short-lived JWT Access Tokens (15m) + Single-Use Refresh Token Rotation (RTR) stored in DB.
- **Session Revocation**: Automatic invalidation of all sessions on password change or password reset. Remote session logout API (`DELETE /auth/sessions/:id` and `DELETE /auth/sessions`).
- **Device Intelligence**: Detects browser, OS, and client IP. Automatically alerts user via email & in-app notification when a login from an unrecognized device occurs.

### 🛡️ Dynamic Role-Based Access Control (RBAC)
- **Granular Permissions**: Modelled as `User -> Role -> RolePermission -> Permission`.
- **Permission Caching**: `PermissionCacheService` with in-memory TTL caching and instant invalidation on role updates.
- **Anti-Lockout Protection**: System roles (`isSystem=true`) cannot be deleted/renamed; the `ADMIN` role is strictly prevented from losing `ROLE_PERMISSION_ASSIGN`.

### ⚙️ Dynamic System Configuration & Feature Flags
- **Database Storage**: `SystemConfig` table with category classification (`GENERAL`, `FEATURE_FLAG`, `INTEGRATION`, `SECURITY`).
- **Public Bootstrap**: `GET /api/v1/system/public` allows frontend apps to fetch feature flags and public branding without authentication.
- **Admin Management**: Full CRUD + instant toggle via `PATCH /api/v1/system/features/:key/toggle`.
- **Route Gating**: `requireFeatureFlag('feature.name')` middleware enforces feature access at the HTTP router level with 403 `FEATURE_DISABLED`.

### 🚧 System Maintenance Mode
- **Modes**: `ONLINE`, `MAINTENANCE`, `READ_ONLY` (permits `GET` queries, blocks mutations with 503).
- **Public API**: `GET /api/v1/maintenance/public` returns maintenance window schedule (`startAt`, `estimatedEndAt`, `title`, `message`).
- **Multi-Tier Bypass**:
  - Permission bypass: `MAINTENANCE_MANAGE`, `MAINTENANCE_BYPASS`
  - Role bypass: `ADMIN`
  - Network bypass: IPv4, IPv6, and CIDR subnet whitelists (e.g. `10.0.0.0/8`, `192.168.1.0/24`)
- **Anti-Lockout Exemption**: Never blocks `/health`, `/api/docs`, auth routes (`/login`, `/refresh`), or maintenance routes.
- **Pub/Sub Cache Invalidation**: Synchronizes cache invalidation across distributed pods via Redis Pub/Sub channel `maintenance:events`.

### 📜 Audit Logging
- **Structured Audit Trail**: Records `actorId`, `action`, `targetType`, `targetId`, `details`, `ipAddress`, `userAgent`, and `createdAt`.
- **Sensitive Data Masking**: Excludes credentials, plaintext passwords, secrets, and authorization tokens.

### 📬 Notification & Email Infrastructure
- **Channels**: Multi-channel dispatcher supporting Web (In-App) and Email.
- **Templates**: Database-driven `NotificationTemplate` with variable interpolation `{{variableName}}` and fallback to built-in email layouts.
- **Email Queue**: `EmailNotification` queue table with background `EmailWorker` polling, exponential retry, and maintenance-mode awareness.

### 🔗 Integrations, API Keys & Webhooks
- **API Keys**: Cryptographically secure keys (`ak_live_...`) with SHA-256 hashed storage, per-key permissions, expiry, and async usage tracking.
- **Webhooks**: Outbound webhook delivery system with AES-256-GCM secret encryption, HMAC-SHA256 request signing (`t=timestamp,v1=signature`), BullMQ retry queue with exponential backoff, and full SSRF defense.

### 📁 File Upload & Storage Abstraction
- **Presigned URLs**: Direct-to-storage upload architecture using S3 / Cloudflare R2 presigned PUT URLs (`R2Service`).
- **Access Safety**: Validates user prefix boundaries (e.g. `avatars/:userId/*`) preventing unauthorized file overrides.
