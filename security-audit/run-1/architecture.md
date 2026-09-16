# Architecture & Threat Model: NexCampus-v2-BE

## 1. Application Overview
**NexCampus-v2-BE** is an enterprise backend API service for university and corporate internship management, recruiting/onboarding, daily reporting, weekly performance evaluation, task tracking, and department/leader coordination.
- **Runtime & Language**: Node.js, TypeScript, Express.js.
- **Database & ORM**: PostgreSQL via Prisma ORM.
- **Caching & Pub/Sub**: Redis (IORedis) with in-memory fallbacks for dynamic permissions, user state caching, and feature flag invalidation.
- **Queue & Workers**: BullMQ for email dispatch, webhook deliveries, and notifications.
- **Storage**: Cloudflare R2 object storage with S3-compatible presigned upload URLs for avatars, task attachments, reports, and applicant resumes.
- **Export & Rendering**: Headless Chromium via Puppeteer for PDF export from Handlebars templates.
- **External Integrations**: Google OAuth2 (ID Token & Authorization code exchange), Google Generative AI (Gemini 1.5 Flash) for automated weekly evaluation suggestions.

## 2. Trust Boundaries & Access Control Architecture
- **Perimeter Defenses**:
  - `helmet`: Basic HTTP security headers and CSP.
  - `cors`: Explicit origin whitelist (wildcard `*` blocked in production).
  - `express.json({ limit: "512kb" })`: Payload size limits against request body flooding.
  - `rateLimitMiddleware` & `authRateLimitMiddleware`: In-memory IP rate limiting.
  - `maintenanceGuard`: Global toggle gating all `/api/v2/*` endpoints except `/maintenance/public` and `/health`.
- **Identity & Authentication**:
  - JWT Bearer tokens (or HttpOnly cookies) for access tokens (15m expiry) and refresh tokens (7d expiry).
  - Session revocation and device fingerprint tracking.
  - API Keys for external third-party integrations (`X-API-Key` or `Bearer ak_*`), hashed with SHA-256 in database.
  - 2FA TOTP (RFC 6238) with encrypted secret keys and hashed one-time backup recovery codes.
- **Authorization & Dynamic RBAC**:
  - Role-based and Permission-based access control (`requirePermission`, `requireRole`, `requireAnyPermission`).
  - Cache layer (`PermissionCacheService`) caching user status (60s) and role permissions (10m) with Redis Pub/Sub invalidation.
  - Actors: `GUEST` (unauthenticated), `USER` (registered base user), `INTERN` (admitted intern), `LEADER` (team/department mentor), `MANAGER` (department/program manager), `ADMIN` (system administrator).

## 3. Input Surfaces & Dangerous Sinks Inventory
1. **Public Network Surfaces**:
   - `/api/v2/auth/*` (register, login, refresh, logout, password reset, email verification, 2FA, OAuth2).
   - `/api/v2/applications/attachments/upload-url` (presigned upload URL generation).
   - `/api/v2/applications/submit` (application submission).
   - `/api/v2/system/public` & `/api/v2/maintenance/public` & `/api/v2/health`.
2. **Authenticated Business Surfaces**:
   - `/api/v2/stats/*` (admin, leader, intern dashboard analytics).
   - `/api/v2/task-submissions/*` (submission creation, grading, file attachment management).
   - `/api/v2/daily-reports/*` (daily progress report submission, editing, attachment management).
   - `/api/v2/weekly-evaluations/*` (evaluation creation, scoring, AI suggestion assistant, review confirmation).
   - `/api/v2/tasks/*` & `/api/v2/task-assignments/*` (task lifecycle, assignments, progress transitions).
   - `/api/v2/meetings/*` (meeting creation, attendance, RSVP, minutes, absences).
   - `/api/v2/interns/*` (intern profile management, self-service updates).
   - `/api/v2/integrations/*` (API keys, webhook endpoints, dispatching).
3. **Critical Sinks**:
   - Cloudflare R2 Presigned URLs: Avatar, Task, Submission, Daily Report, and Application uploads.
   - Puppeteer (`page.setContent`, `page.pdf`): PDF rendering from Handlebars templates.
   - Gemini Generative AI API: Prompt construction from daily report contents.
   - Outbound HTTP Webhooks: Dynamic HTTP dispatch to user-registered webhook URLs.
   - Prisma Client Queries: Database mutations and relation traversal.

## 4. Baseline Comparable
Comparable platforms include enterprise HRIS and LMS platforms like Workday, Canvas LMS, and Jira. In such systems, intern self-service must be strictly compartmentalized from organizational role mutation, candidate submission URLs must enforce strict media whitelists, and analytics dashboards must adhere to strict managerial hierarchy boundaries.
