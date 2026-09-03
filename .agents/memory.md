# Project Memory

## Date/time architecture

- `Asia/Ho_Chi_Minh` (UTC+7) là múi giờ chuẩn cho nghiệp vụ tính toán và hiển thị.
- Các trường ngày nghiệp vụ lưu trữ và định dạng dạng `YYYY-MM-DD` tương thích với PostgreSQL `DATE` hoặc `TIMESTAMP`.
- Các mốc thời gian tức thời (Auth expirations, created_at, updated_at, token expiry) dùng ISO 8601 offset-aware.

## Quyết định kiến trúc đang có hiệu lực

- **Layered Architecture**: Tuân thủ nghiêm ngặt ranh giới:
  `route -> validation -> controller -> service -> repository`.
- **Database Access**: Chỉ repository mới được phép gọi Prisma Client; service phụ trách business logic và transaction orchestration.
- **Validation**: Toàn bộ HTTP request input bắt buộc đi qua Zod schema middleware (`body`, `query`, `params`).
- **Error Handling**: API lỗi có chủ đích sử dụng `AppError` kết hợp `ERROR_CODE` trong `src/common/constants/`.
- **Dynamic RBAC Authorization**:
  - Phân quyền theo cơ chế động: `User -> Role -> RolePermission -> Permission`.
  - Middleware bảo vệ endpoint sử dụng `requirePermission('RESOURCE_ACTION')` (hoặc `requireAnyPermission`), không hard-code tên Role trong business authorization.
  - Tối ưu hóa hiệu năng bằng `PermissionCacheService` (in-memory TTL cache) kèm cơ chế tự động xóa cache khi quyền của vai trò thay đổi.
  - Bảo vệ System Roles (`isSystem = true` như `ADMIN`, `MANAGER`, `USER` không thể bị xóa/đổi tên) và chống thu hồi quyền quản trị tối cao `ROLE_PERMISSION_ASSIGN` khỏi `ADMIN` (Anti-lockout).
  - Tự động ghi `AuditLog` cho mọi thao tác tạo/sửa/xóa vai trò, gán quyền và đổi vai trò người dùng.
- **User Authentication & Authorization**:
  - JWT Access Token (short-lived, 15m) và Refresh Token (lưu DB trong bảng `refresh_tokens`).
  - Trả về token và danh sách quyền `permissions: string[]` trong response body JSON (`accessToken`, `refreshToken`) song song với cookie để hỗ trợ Zalo Mini App / WebView client.
  - Hỗ trợ thiết bị đăng nhập qua `UserDevice` và hash thiết bị (`deviceHash` bằng SHA-256).
  - Đổi mật khẩu (`updatePassword`) hoặc reset mật khẩu (`resetPassword`) tự động thu hồi (revoke) toàn bộ Refresh Tokens của user.
- **User Soft Delete & Database Safety**:
  - Sử dụng `deletedAt`, `deletedBy`, vô hiệu hóa user (`isActive = false`) và thu hồi mọi refresh token.
  - Quan hệ `Role` -> `User` cấu hình `onDelete: Restrict` để ngăn chặn rủi ro xóa trắng cơ sở dữ liệu người dùng.
- **Prisma & Migrations**:
  - Database PostgreSQL quản lý bằng Prisma ORM.
  - Đã tối ưu hóa `@@index` cho các bảng cốt lõi (`User`, `Tokens`, `RolePermission`, `AuditLog`, `Notifications`).
  - Đã loại bỏ các bảng cũ của dự án tài chính (`wallets`, `categories`, `transactions`, `budgets`) qua migration `20260822170800_remove_domain_financial_models`.
  - Sử dụng wrapper `scripts/prisma-run.js` cho các tác vụ Prisma CLI để đảm bảo load đúng biến môi trường từ `.env`.
  - Mọi thay đổi schema phải sinh migration mới qua `pnpm run db:migrate`. Không chỉnh sửa migration đã được commit/áp dụng.
  - Tuyệt đối không tự ý chạy `pnpm run db:migrate:reset` trên database đang hoạt động.
- **Automated Testing**: Bộ test tự động đặt tại `tests/`, chạy bằng lệnh `pnpm test` (`tsx --test`).
- **Package Manager**: Dự án sử dụng `pnpm`.

- **System Maintenance Mode**:
  - Module quản lý chế độ bảo trì hệ thống backend tại `src/modules/maintenance/` kết hợp middleware bảo vệ `maintenanceGuard`.
  - Hỗ trợ các trạng thái `ONLINE`, `MAINTENANCE`, `READ_ONLY` (cho phép `GET`/`HEAD`/`OPTIONS` và chặn mutations với 503).
  - Trả về mã lỗi chuẩn `503 Service Unavailable` và response body `{ success: false, code: 'SYSTEM_MAINTENANCE', message: '...', data: { title, message, estimatedEndAt, startAt } }`.
  - Cung cấp API Public `GET /api/v1/maintenance/public` cho các ứng dụng client/frontend truy vấn trạng thái và thời gian hoàn tất.
  - Phân quyền bypass bằng Dynamic RBAC permissions (`MAINTENANCE_MANAGE`, `MAINTENANCE_BYPASS`), bypass roles (`ADMIN`), và bypass IP whitelists (`bypassIps` hỗ trợ IPv4, IPv6 và dải CIDR subnet như `10.0.0.0/8`, `192.168.1.0/24`).
  - Cơ chế Anti-Lockout: Tuyệt đối không chặn các endpoint `/health`, `/api/docs`, `/api/v1/auth/(login|refresh|logout|me|sessions)`, và `/api/v1/maintenance/*`.
  - Tối ưu hóa hiệu năng bằng `MaintenanceCacheService` (in-memory TTL cache) kết hợp **Redis Pub/Sub Cache Invalidation Adapter** (`maintenance:events`) để đồng bộ việc xóa cache tức thời giữa nhiều cluster instances / container pods, kèm cơ chế fallback tự động an toàn khi Redis không khả dụng.
  - Tự động ghi `AuditLog` cho các hành động `ENABLE_MAINTENANCE`, `UPDATE_MAINTENANCE`, `DISABLE_MAINTENANCE`.

## Trạng thái đã biết

- Các endpoint hiện hữu: `/health`, `/auth` (đăng ký, đăng nhập, refresh, me, logout, password reset, verification, sessions), `/users` (quản trị người dùng), `/rbac` (quản trị vai trò, phân quyền, nhật ký kiểm toán audit log), `/notifications` (thông báo & email queue), `/maintenance` (quản trị bảo trì hệ thống).
- Cơ sở dữ liệu sạch chuẩn template với các migration `20260722073204_`, `20260822152200_dynamic_rbac`, `20260822164800_notification_system`, `20260822170800_remove_domain_financial_models`, `20260822173600_add_maintenance_and_audit_index`.
- Cấu hình port: fallback code là `8888` (hoặc `7777` theo `.env.example`).
- Tài liệu Swagger UI tại `/api/docs`.

- **Advanced SSRF Defense & URL Validation** (`src/common/helpers/url.helper.ts`):
  - `isPrivateOrReservedIp(ip)`: Phát hiện mọi địa chỉ IPv4/IPv6 private (10.x, 172.16-31.x, 192.168.x, 169.254.x, CGN 100.64-127.x, Loopback 127.x, ULA fc00::/7, Link-local fe80::/10, Multicast ff00::/8, và IPv4-mapped IPv6 `::ffff:127.0.0.1` / `::ffff:169.254.169.254`).
  - `resolveAndValidateDns(hostname, options)`: Phân giải toàn bộ bản ghi DNS A & AAAA, chống tấn công **DNS Rebinding** và domain public trỏ về IP private.
  - `resolveSafeRedirectChain(urlString, options)`: Theo dõi và xác thực từng bước chuyển hướng **HTTP 301/302/303/307/308 redirect** (tối đa 5 redirects), chặn mọi hành vi chuyển hướng sang private IP, metadata IP, protocol không an toàn (`file:`, `ftp:`, `javascript:`), hoặc redirect loop.
  - `isPublicHttpUrl(url, options)`: Validate cú pháp URL, tự động cho phép localhost trong môi trường `development` (`allowPrivate: true`) và chặn nghiêm ngặt trong `production`.
  - Đã gắn vào Zod validation schema cho `avatarUrl` (`auth.validation.ts`) và `actionUrl` (`notification.validation.ts`).
  - Unit tests đầy đủ tại `tests/helpers.test.ts` (102 tests pass).
- **Multi-Tier Rate Limiting & RFC 6585 Standard** (`src/middlewares/rate-limit.middleware.ts`):
  - Factory `createRateLimiter` sliding-window in-memory kèm cơ chế dọn dẹp định kỳ không rò rỉ bộ nhớ.
  - Trả về đầy đủ HTTP Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` và `Retry-After` (khi chạm 429).
  - `rateLimitMiddleware`: Áp dụng toàn cục `/api/v1` (1000 req/15 phút).
  - `authRateLimitMiddleware`: Áp dụng riêng cho các endpoint nhạy cảm `/register`, `/login`, `/forgot-password`, `/reset-password`, `/resend-verification` (30 req/15 phút) để phòng chống Brute Force và Credential Stuffing.
  - Định nghĩa mã lỗi tập trung `ERROR_CODE.RATE_LIMIT_EXCEEDED`.
- **CORS Production Fail-Safe** (`src/config/env.config.ts`):
  - Bắt buộc khai báo danh sách domain cụ thể qua `ALLOWED_ORIGINS` khi chạy `NODE_ENV=production`.
  - Cấm sử dụng wildcard `'*'` hoặc bỏ trống trong môi trường production để bảo vệ cookie/credentials.
- **Dynamic System Configuration & Feature Flags** (`src/modules/system-config/`):
  - Module quản lý cấu hình động và cờ tính năng (Feature Flags) tại `/api/v1/system/configs`, `/api/v1/system/features/:key/toggle` và endpoint công khai `/api/v1/system/public`.
  - Phân loại theo danh mục: `GENERAL`, `FEATURE_FLAG`, `INTEGRATION`, `SECURITY`.
  - Hỗ trợ đánh giá cờ tính năng tức thời `systemConfigService.isFeatureEnabled(flagKey)` kèm middleware bảo vệ route `requireFeatureFlag('flagKey')`.
  - Tối ưu hóa hiệu năng bằng in-memory TTL caching kết hợp Redis Pub/Sub invalidation (`system_config:events`) và tự động ghi `AuditLog` cho mọi thao tác cấu hình.
- **Production Observability & Deep Diagnostics** (`src/routes/health.route.ts` & `src/middlewares/request-id.middleware.ts`):
  - Middleware `requestIdMiddleware` tự động cấp phát và chuyển tiếp header `X-Request-Id` (UUID) phục vụ truy vết phân tán (distributed tracing).
  - Cung cấp `/api/v1/health` (liveness) và `/api/v1/health/readiness` (thực hiện truy vấn kiểm tra PostgreSQL database live, kiểm tra ping Redis, thu thập thông số heapUsedMb, heapTotalMb, rssMb và uptime).
- **Graceful Shutdown & Resilience** (`src/server.ts`):
  - Xử lý tín hiệu `SIGINT` / `SIGTERM` an toàn: đóng HTTP listener, dừng background workers (`EmailWorker`, `WebhookWorker`), đóng BullMQ queue, ngắt kết nối Redis và Prisma client, kèm failsafe timeout 10 giây.
- **Strict Layer Encapsulation & Worker Concurrency**:
  - Toàn bộ Middlewares (`apiKeyAuthMiddleware`, `permissionMiddleware`), Services (`PermissionCacheService`, `MaintenanceCacheService`, `NotificationDispatcher`, `EmailTemplateService`) và Workers (`EmailWorker`, `WebhookWorker`) truy vấn cơ sở dữ liệu độc quyền qua các Repository (`IntegrationRepository`, `AuthRepository`, `UserRepository`, `RbacRepository`, `MaintenanceRepository`, `NotificationRepository`, `SystemConfigRepository`).
  - `EmailWorker` áp dụng cơ chế khóa hàng nguyên tử `FOR UPDATE SKIP LOCKED` (`NotificationRepository.claimPendingEmails`), triệt tiêu hoàn toàn race condition duplicate email khi chạy multi-pod cluster.
  - `rotateRefreshToken()` áp dụng RFC 6819 Token Family Revocation: tự động thu hồi toàn bộ refresh token của user khi phát hiện hành vi tái sử dụng token đã xoay vòng.
  - Tối ưu hóa `api_keys.last_used_at` với cơ chế debounce 5 phút tránh nghẽn write lock khi tiếp nhận tải cao.
  - Tối ưu hóa composite indexes qua migration `20260824010000_update_notification_indexes`.
- **Automated OpenAPI & Swagger Documentation** (`@asteasolutions/zod-to-openapi`):
  - Tài liệu Swagger UI tại `/api/docs` được sinh tự động và đồng bộ 100% theo thời gian thực từ các Zod Schema trong `*.validation.ts`.
  - Loại bỏ hoàn toàn việc duy trì file tĩnh thủ công 1900 dòng.
  - Mỗi module quản lý OpenAPI route definitions độc lập tại `src/modules/*/*.openapi.ts`, tập trung qua `OpenAPIRegistry` (`src/config/openapi/openapi.registry.ts`).
- **Scheduled Background Tasks & Cron Engine** (`BullMQ Repeatable Jobs`):
  - Module quản lý Cron Jobs tập trung tại `src/modules/cron/` và `src/common/queues/cron.queue.ts`.
  - Hỗ trợ 4 tác vụ định kỳ chính:
    1. `cleanup-audit-logs`: Xóa Audit Logs cũ hơn 30 ngày.
    2. `cleanup-unconfirmed-uploads`: Quét bucket Cloudflare R2 / S3 xóa file avatar rác quá 24h không liên kết user.
    3. `cleanup-expired-tokens`: Dọn dẹp Refresh Token, Verification Token và Password Reset Token đã hết hạn.
    4. `daily-summary-digest` & `weekly-summary-digest`: Tổng hợp KPI hệ thống và gửi email báo cáo tới Quản trị viên.
  - Cung cấp REST endpoints `GET /api/v1/cron/jobs` và `POST /api/v1/cron/jobs/:jobName/trigger` cho phép Admin chủ động kích hoạt chạy ngay kèm Audit Log.
  - Quản lý lifecycle an toàn qua `CronWorker` và `CronQueueService` trong `src/server.ts`.
  - **enableJobScheduler/disableJobScheduler**: API mới bật/tắt cron job động không cần restart; `registerSchedules(disabledJobs[])` skip job khi khởi động.

- **Security Hardening (2026-09-01)**:
  - **Token Hashing SHA-256**: `auth.repository.ts` băm SHA-256 toàn bộ token trước khi lưu DB (`refresh_tokens`, `verification_tokens`, `password_reset_tokens`). Breaking change — token cũ plain-text không tìm được sau deploy. `auth.service.ts → getActiveSessions()` so sánh hash.
  - **optionalAuthMiddleware**: Middleware mới trong `auth.middleware.ts` — parse JWT nếu có, bỏ qua nếu sai/thiếu. Dùng cho API public cần context user.
  - **Permission Middleware DB Validation**: Truy vấn DB kiểm tra `isActive` và `deletedAt` trong mỗi request có permission check, chống JWT cũ khi user bị khóa/hạ role. API Key bypass.
  - **XSS Email Protection**: `escapeHtml()` trong `template.helper.ts`; áp dụng vào `verifyEmail`, `resetPassword`, `newDeviceAlert` trong `email-template.service.ts`.
  - **hashToken() public helper**: Thêm vào `crypto.helper.ts` để dùng ở các module khác nếu cần.
  - **R2 listObjects pagination**: Vòng lặp `ContinuationToken` xử lý bucket > 1000 objects.
  - **Redis .connect()**: `maintenance-cache.service.ts` gọi `.connect()` tường minh sau khởi tạo.
  - **Slug P2002 Error**: `error.middleware.ts` trả thông báo slug riêng biệt thân thiện.
  - **Payload Limit**: `app.ts` giới hạn `512kb` chống DoS payload.
  - **CORS Trailing Slash**: Normalize origin trước khi so sánh `allowedOrigins`.
  - **REDIS_URL Parser**: `env.config.ts` hỗ trợ cloud Redis URL (`redis://`, `rediss://`).
- **Full Project Audit & Autonomous Remediation (2026-09-01)**:
  - **XSS & HTML Injection in MailService**: Áp dụng `escapeHtml()` trong `src/common/services/mail.service.ts` cho toàn bộ template email trực tiếp (`sendVerificationEmail`, `sendPasswordResetEmail`, `sendNewDeviceAlertEmail`).
  - **UUID Normalization for Email Notifications**: Chuẩn hóa `userId` thành `null` nếu không đúng chuẩn UUID trong `notification.repository.ts` (`createSingleEmailNotification`, `createManyEmailNotifications`, `createMultiChannelNotifications`), tránh crash runtime PostgreSQL khi dispatch email không kèm user ID.
  - **User State Caching in PermissionCacheService**: Bổ sung in-memory TTL cache (60s) `getUserState(userId)` trong `PermissionCacheService` và sử dụng trong `permission.middleware.ts`, triệt tiêu điểm nghẽn 1 DB query trên mọi request authenticated. Tự động xóa cache khi user bị cập nhật, soft-delete, hoặc gán vai trò mới.
  - **Prisma JSON Array Containment Filter**: Chuẩn hóa `channels: { array_contains: channel }` trong `NotificationRepository.findTemplates`.
  - **Distributed Tracing in Error Handler**: Bổ sung `X-Request-Id` vào log lỗi 500 của `error.middleware.ts` phục vụ trace log trên production.
  - **Database Indexing**: Thêm `@@index([toEmail])` vào model `EmailNotification` trong `prisma/schema.prisma`.
  - **User Management Schemas Enhancement**: Mở rộng `createUserSchema`, `updateUserSchema`, DTOs và `UserService` hỗ trợ cập nhật `fullName` và `phoneNumber`.
  - **Defensive Date Boundary Guard**: Thêm regex validation `/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/` trong `getVietnamDayRange`.
- **Dependencies Upgrade & Security Audit Hardening (2026-09-03)**:
  - **Core Upgrades**: Nâng cấp an toàn lên các phiên bản ổn định mới nhất: `express` (4.22.2), `zod` (3.25.76), `bcryptjs` (3.0.3), `bullmq` (6.3.4), `dotenv` (17.4.2), `helmet` (8.3.0), `@aws-sdk/client-s3` và `@aws-sdk/s3-request-presigner` (3.1125.0), `cors` (2.8.6), `jsonwebtoken` (9.0.3), `morgan` (1.12.0), `multer` (2.3.0), `nodemailer` (9.1.1), `sharp` (0.35.4).
  - **DevDependencies Upgrades**: Nâng cấp `typescript` (5.9.3), `eslint` (9.39.4), `prettier` (3.9.6), `tsx` (4.23.13), `@types/node` (22.20.0), `@types/express` (4.17.25) cùng các types liên quan; gỡ bỏ `@types/bcryptjs` do `bcryptjs@3.0.3` đã tích hợp native types.
  - **Framework Preservation**: Giữ nguyên `Express 4.x`, `Prisma 5.22.0` và `@asteasolutions/zod-to-openapi` 7.3.4 để bảo đảm tính tương thích kiến trúc tuyệt đối.
  - **Security Overrides**: Bổ sung `pnpm.overrides` cho `qs` (^6.16.0), `body-parser` (^1.20.6), `brace-expansion` (^1.1.18), `js-yaml` (^4.3.1), đưa `pnpm audit` về `0 vulnerabilities`.
- **Enterprise Standard Hardening (2026-09-03)**:
  - **Dockerfile Multi-Stage Non-Root**: Tạo mới `Dockerfile` chuẩn production tại thư mục gốc. Sử dụng 3-stage build (`deps` → `builder` → `runner`) trên `node:22-alpine`. Stage runner chỉ chứa production artifacts (`dist/`, `prisma/`, prod `node_modules`); chạy dưới user `node` (uid=1000, non-root); sử dụng `tini` làm PID 1 để xử lý SIGTERM/SIGINT đúng cách và chống zombie process. Docker Compose service `app` đã được bình luận sẵn, sẵn sàng bật khi cần.
  - **Zod Env Config Fail-Fast**: Chuyển đổi `src/config/env.config.ts` từ validation thủ công (IIFE/throw) sang Zod schema (`envSchema`) với `safeParse(process.env)`. Server thoát `process.exit(1)` với thông báo lỗi rõ ràng ra stderr ngay khi thiếu / sai biến môi trường bắt buộc (`DATABASE_URL`). Giữ nguyên 100% interface `envConfig` (cùng key, cùng kiểu dữ liệu) — toàn bộ consumer (`src/app.ts`, `src/server.ts`, workers, middlewares) không bị thay đổi. Bổ sung thêm `as const` để TypeScript suy luận type chính xác hơn. Các ràng buộc production (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS`, `ENCRYPTION_KEY`) được giữ lại qua các `.refine()` trong Zod schema. Build `pnpm build` và `pnpm run lint` đều pass `0 errors / 0 warnings`.








