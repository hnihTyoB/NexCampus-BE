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
- **User Self-Deactivation with Email Verification (2026-09-03)**:
  - Triển khai trọn vẹn tính năng người dùng tự vô hiệu hóa tài khoản (chuẩn GDPR "Right to be Forgotten" & Self-Service) qua 2 endpoint: `POST /api/v1/auth/deactivate/request` và `POST /api/v1/auth/deactivate/confirm`.
  - **Re-Authentication**: Yêu cầu người dùng nhập mật khẩu hiện tại khi gửi yêu cầu để chống chiếm đoạt phiên (session hijacking).
  - **Anti-Lockout Protection**: Ngăn chặn tài khoản `ADMIN` duy nhất còn lại trong hệ thống tự vô hiệu hóa (kiểm tra cả ở bước request và confirm).
  - **Cryptographic Token Isolation**: Token xác nhận được băm SHA-256 kèm prefix cách ly `sha256('deactivate:' + token)` lưu trong `verification_tokens`, ngăn chặn triệt để lỗ hổng Type Confusion giữa token đăng ký và token vô hiệu hóa mà không cần migration database.
  - **Hạn dùng 15 phút**: Token tự động hết hạn và dọn dẹp sau 15 phút.
  - **Immediate RTR Revocation**: Khi xác nhận thành công, Prisma `$transaction` cập nhật `isActive: false`, `deletedAt: new Date()`, `deletedBy: userId`, xóa toàn bộ `refresh_tokens`, xóa token và giải phóng bộ nhớ đệm `permissionCacheService.invalidateUser(userId)`.
  - **Giao tiếp & Kiểm toán**: Gửi email cảnh báo màu đỏ (`MailService.sendAccountDeactivationEmail`) kèm mã/link xác nhận, tự động ghi `AuditLog` cho cả 2 hành động (`REQUEST_ACCOUNT_DEACTIVATION`, `CONFIRM_ACCOUNT_DEACTIVATION`).
  - **OpenAPI & Testing**: Đăng ký đầy đủ OpenAPI 3.0 trong `auth.openapi.ts` và bao phủ 12 test cases tự động trong `tests/auth-deactivation.test.ts` (100% pass, 0 regressions).
- **Two-Factor Authentication (2FA / TOTP) (2026-09-03)**:
  - Triển khai hoàn chỉnh tính năng Xác thực 2 bước (2FA) theo thuật toán TOTP chuẩn RFC 6238 / RFC 4226 tương thích với mọi Authenticator Apps (Google Authenticator, Microsoft Authenticator, Authy, 1Password).
  - **Zero External Dependencies**: Thuật toán sinh khóa Base32, HMAC-SHA1 và dynamic truncation được cài đặt thuần túy bằng `node:crypto` trong `src/common/helpers/totp.helper.ts`.
  - **Secret Encryption At-Rest**: Khóa bí mật TOTP được mã hóa đối xứng AES-256-GCM (`encryptSecret` / `decryptSecret`) trước khi lưu vào cột `two_factor_secret` của bảng `users`.
  - **Single-Use Backup Recovery Codes**: Sinh 8 mã dự phòng khẩn cấp dạng `xxxx-xxxx`, lưu mảng băm SHA-256 trong cột `two_factor_backup_codes` (JSONB). Mỗi mã chỉ được sử dụng duy nhất một lần (xóa khỏi mảng ngay khi dùng thành công).
  - **Timing-Safe Comparison & Window Drift**: Áp dụng `crypto.timingSafeEqual` chống Timing Attack và cho phép bù lệch giờ $\pm 30$ giây ($window = 1$).
  - **Login Challenge & Isolated Temp Token**: Khi đăng nhập với tài khoản đã bật 2FA, API trả về `{ requires2FA: true, tempToken }` (hạn 5 phút, purpose `2FA_VERIFICATION`), không phát hành cookie hoặc token chính thức cho đến khi qua được endpoint `POST /api/v1/auth/2fa/verify`.
  - **5 API Endpoints & Rate Limiting**:
    1. `POST /api/v1/auth/2fa/setup` (authMiddleware)
    2. `POST /api/v1/auth/2fa/enable` (authMiddleware, authRateLimitMiddleware)
    3. `POST /api/v1/auth/2fa/verify` (authRateLimitMiddleware)
    4. `POST /api/v1/auth/2fa/disable` (authMiddleware, authRateLimitMiddleware)
    5. `POST /api/v1/auth/2fa/backup-codes/regenerate` (authMiddleware, authRateLimitMiddleware)
  - **Session Invalidation & Anti-Hijacking (Cách 1)**: Khi người dùng Bật 2FA (`enable2FA`) hoặc Tắt 2FA (`disable2FA`), hệ thống tự động gọi `revokeOtherSessions(userId, currentRefreshToken)` để xóa toàn bộ refresh token của các thiết bị/trình duyệt khác trong CSDL và giải phóng bộ nhớ đệm quyền (`permissionCacheService.invalidateUser`). Phiên làm việc trên thiết bị hiện tại được bảo lưu nguyên vẹn, trong khi tất cả phiên cũ/bị chiếm đoạt trên các máy khác sẽ lập tức bị đá văng và buộc phải đăng nhập lại từ đầu qua thử thách 2FA.
  - **Database Migration**: `prisma/migrations/20260903000000_add_user_two_factor/migration.sql` bổ sung 3 cột tùy chọn (`two_factor_enabled`, `two_factor_secret`, `two_factor_backup_codes`) vào bảng `users`, bảo đảm tương thích ngược 100%.
  - **OpenAPI 3.0 & Testing**: Tự động sinh tài liệu Swagger UI và bảo đảm bởi 29 automated test cases (12 unit tests trong `tests/totp-helper.test.ts` và 17 integration tests trong `tests/auth-2fa.test.ts`, 100% pass, build và lint 0 warnings/errors).
- **Google OAuth2 Login & Account Linking (2026-09-04)**:
  - Triển khai toàn diện tính năng đăng nhập và liên kết tài khoản bằng Google OAuth2 (Google Sign-In button, One-Tap, Mobile App credentials, và standard OAuth2 redirect code flow).
  - **Zero External Dependencies**: Giao tiếp trực tiếp với các endpoint chính thức của Google (`oauth2.googleapis.com/tokeninfo` và `oauth2.googleapis.com/token`) qua native `fetch` của Node.js 22, triệt tiêu phụ thuộc các thư viện nặng và rủi ro chuỗi cung ứng.
  - **Zero 2FA Bypass**: Nếu tài khoản liên kết Google đã kích hoạt Two-Factor Authentication (`twoFactorEnabled === true`), hệ thống bắt buộc chuyển sang thử thách 2FA (`requires2FA: true, tempToken: ...`), ngăn chặn hoàn toàn việc bypass 2FA thông qua social login.
  - **Auto Email Activation & Account Linking**:
    - Khi đăng nhập lần đầu với Google: tự động tạo user mới với vai trò mặc định `USER` và liên kết `UserSocial(provider='GOOGLE', providerUserId=sub)`.
    - Khi user đã tồn tại qua email thông thường: tự động liên kết tài khoản mạng xã hội `UserSocial` và kích hoạt tài khoản (`isActive = true`) nếu user trước đó chưa kích hoạt email.
    - Chặn đăng nhập đối với tài khoản đã bị soft-deleted (`deletedAt !== null`).
  - **Centralized Constants & Clean Layering**:
    - Quản lý nhà cung cấp tập trung qua `AUTH_PROVIDER.GOOGLE` (`src/common/constants/auth.constant.ts`).
    - Ghi nhận Audit Log tập trung cho cả 2 hành động: `LOGIN_GOOGLE` và `LINK_SOCIAL_ACCOUNT`.
    - Định nghĩa mã lỗi tập trung `ERROR_CODE.GOOGLE_AUTH_FAILED`.
  - **2 Endpoints & Rate Limiting**:
    1. `GET /api/v1/auth/google/url`: Sinh Google OAuth2 authorization URL với `clientId`, `redirectUri`, `state`.
    2. `POST /api/v1/auth/google`: Đăng nhập/liên kết tài khoản với `idToken` hoặc `{ code, redirectUri }`, áp dụng `authRateLimitMiddleware` (30 req/15 phút).
  - **OpenAPI 3.0 & Testing**: Tự động sinh Swagger documentation tại `/api/docs` và bao phủ 21 automated test cases trong `tests/auth-google.test.ts` (100% pass, zero regressions, build và lint 0 errors).
- **Profile Social Account Management & Anti-Lockout Defense (2026-09-04)**:
  - Bổ sung 3 APIs chuyên dụng quản lý liên kết tài khoản mạng xã hội cho trang cá nhân (Profile Settings) theo chuẩn layered architecture:
    1. `GET /api/v1/auth/social` (`authMiddleware`): Lấy danh sách các tài khoản mạng xã hội đang liên kết của người dùng hiện tại (ID, provider, providerUserId, email, name, avatar, createdAt).
    2. `POST /api/v1/auth/social/link` (`authMiddleware`, `authRateLimitMiddleware`): Chủ động liên kết tài khoản Google mới với tài khoản đang đăng nhập qua `idToken` hoặc `{ code, redirectUri }`.
       - **Collision Guard**: Kiểm tra tài khoản Google đã liên kết với người dùng nào khác trong hệ thống chưa (`findUserSocialByProvider`). Nếu đã liên kết với user khác, chặn lại ngay với mã lỗi `409 Conflict` (`ERROR_CODE.DUPLICATE_ENTRY`).
       - Tự động ghi `AuditLog` với action `LINK_SOCIAL_ACCOUNT`.
    3. `DELETE /api/v1/auth/social/:provider` (`authMiddleware`, `authRateLimitMiddleware`): Hủy liên kết tài khoản mạng xã hội khỏi tài khoản người dùng.
       - **Strict Anti-Lockout Defense**: Nếu người dùng đăng ký ban đầu thuần túy qua Google (`user.password === null`) và chỉ có duy nhất 1 tài khoản mạng xã hội (`countUserSocialAccounts <= 1`), hệ thống từ chối hủy liên kết với `400 Bad Request` (`ERROR_CODE.VALIDATION_ERROR`) kèm thông báo yêu cầu thiết lập mật khẩu trước khi hủy liên kết để ngăn chặn nguy cơ người dùng tự khóa vĩnh viễn tài khoản của chính mình.
       - Tự động ghi `AuditLog` với action `UNLINK_SOCIAL_ACCOUNT`.
  - **Database Migration & Seeding**: Đã chạy triển khai toàn bộ 11 migrations qua `pnpm run db:migrate:deploy` và nạp seed dữ liệu mẫu qua `pnpm run db:seed` thành công trên môi trường Supabase PostgreSQL mới.
  - **Automated Verification**: Mở rộng `tests/auth-google.test.ts` thêm 10 bài test tích hợp và kiểm thử OpenAPI; toàn bộ 232 automated tests trên toàn dự án đều pass 100%, TypeScript build và ESLint sạch 0 warnings / 0 errors.
- **Organization & Human Resource Management (HRM) Modules (2026-09-14)**:
  - Hoàn thiện trọn bộ 3 module Tổ chức & Nhân sự (`departments`, `leaders`, `interns`) theo kiến trúc phân tầng chuẩn 6 file (`route`, `validation`, `controller`, `service`, `repository`, `dto`) và OpenAPI 3.0 auto-generation:
    1. **Departments & Positions** (`src/modules/departments/`):
       - CRUD Department: Soft-delete (`deletedAt`), đếm số lượng vị trí và TTS đang hoạt động (`positionsCount`, `internsCount`, `_count`), danh sách Leader quản lý.
       - CRUD Position: Quản lý vị trí trực thuộc từng `departmentId`, kiểm tra liên kết phụ thuộc chống xóa nhầm.
       - Chặn xóa phòng ban/vị trí có liên kết phụ thuộc (`ERROR_CODE.DEPENDENCY_ERROR`).
    2. **Leaders** (`src/modules/leaders/`):
       - Hồ sơ Leader: Quản lý tối đa 3 Department qua quan hệ nhiều-nhiều (`MAX_LEADER_DEPARTMENTS = 3`), ràng buộc `@unique` trên `LeaderDepartment.departmentId` (mỗi phòng ban chỉ do 1 Leader quản lý trực tiếp).
       - Đồng bộ chức danh: Khi thay đổi danh sách Department của Leader, chức danh cũ (`position`) tự động được reset về `null` nếu không truyền chức danh mới theo đúng quy tắc kế thừa.
       - Xem chi tiết Leader kèm danh sách phòng ban và toàn bộ TTS trực thuộc.
    3. **Interns** (`src/modules/interns/`):
       - Tìm kiếm đa tiêu chí: `internCode`, `fullName`, `university`, `major`, email; phân trang và lọc theo trạng thái (`ACTIVE`, `COMPLETED`, `DROPPED`), leader, phòng ban, vị trí.
       - Scoped Query Authorization: Leader chỉ xem được các TTS thuộc phòng ban do mình quản lý hoặc do mình trực tiếp hướng dẫn. Admin có toàn quyền.
       - Chi tiết TTS: Đầy đủ thông tin học vụ (`university`, `major`, `duration`, `startDate`), thông tin liên hệ và tài khoản người dùng.
       - Tạo tài khoản trực tiếp (`POST /interns/direct`): Tự sinh mật khẩu an toàn và mã TTS `internCode` (`INT-XXXXXXXX`).
       - Phân công/chuyển đổi Leader (`PATCH /interns/:id/assign-leader`): Xác thực vai trò và trạng thái hoạt động của Leader.
       - Tự động hoàn thành (`completeExpiredInterns`): Lazy auto-complete chuyển trạng thái sang `COMPLETED` khi hết thời gian thực tập.
  - **Dynamic RBAC & Validation**:
    - Phân quyền động qua `PERMISSIONS` (`DEPARTMENT_*`, `POSITION_*`, `LEADER_*`, `INTERN_*`).
    - Validation ở biên bằng Zod, ép kiểu số query param qua `z.coerce.number()`, kiểm tra số điện thoại VN bằng `VIETNAMESE_PHONE_REGEX` và tính duy nhất qua `validatePhoneUniqueness`.
  - **Routing & Documentation**: Gắn toàn bộ resource routes tại `src/routes/index.ts` dưới prefix `/api/v2`, đồng bộ Swagger UI tại `/api/docs`. Bộ test tự động 292 tests pass 100%, build và lint sạch 0 errors / 0 warnings.
- **Dynamic System Configuration for HRM & Storage (2026-09-14)**:
  - Tích hợp cấu hình động tập trung từ module `system-config` vào toàn bộ quy trình nghiệp vụ Quản lý Tổ chức & Nhân sự và Lưu trữ:
    1. **HRM Configuration Keys** (`HRM_CONFIG_KEYS`):
       - `hrm.max_leader_departments` (mặc định `3`): Giới hạn số phòng ban tối đa 1 Leader có thể quản lý đồng thời, được `LeaderService.validateDepartments` truy vấn động qua `systemConfigService.get(HRM_CONFIG_KEYS.MAX_LEADER_DEPARTMENTS, 3)`.
       - `hrm.default_intern_duration_months` (mặc định `3`): Thời hạn thực tập mặc định (tháng), tự động áp dụng khi tạo TTS mới nếu không truyền thời hạn cụ thể.
       - `hrm.intern_code_prefix` (mặc định `'INT'`): Tiền tố sinh mã định danh TTS tự động (`INT-XXXXXXXX`).
       - `hrm.max_active_tasks_per_intern` (mặc định `5`): Giới hạn số công việc đang xử lý tối đa cho mỗi thực tập sinh.
       - `hrm.auto_complete_expired_interns` (mặc định `true`): Feature flag điều khiển việc tự động chuyển trạng thái TTS hết hạn sang `COMPLETED` qua `systemConfigService.isFeatureEnabled`.
    2. **Storage Configuration Keys** (`STORAGE_CONFIG_KEYS` kế thừa từ legacy backend):
       - `storage.avatar_max_file_size_mb` (mặc định `5 MB`).
       - `storage.report_max_file_size_mb` (mặc định `10 MB`).
       - `storage.submission_max_file_size_mb` (mặc định `50 MB`).
       - `storage.task_attachment_max_file_size_mb` (mặc định `25 MB`).
    3. **Bootstrapping & Resilience**: Toàn bộ cấu hình được định nghĩa trong `DEFAULT_SYSTEM_CONFIGS` và tự động nạp vào PostgreSQL khi khởi động server (`ensureDefaultConfigs`). Cache in-memory TTL kết hợp Redis Pub/Sub đảm bảo tốc độ phản hồi tức thì và không bị bottleneck CSDL.
- **Recruitment & Onboarding Module (applications) (2026-09-14)**:
  - Hoàn thiện trọn bộ module Tuyển dụng & Tiếp nhận thực tập sinh (`src/modules/applications/`) theo kiến trúc phân tầng 6 file chuẩn (`route`, `validation`, `controller`, `service`, `repository`, `dto`) và OpenAPI 3.0:
    1. **Application Invites (Thư mời ứng tuyển)**:
       - Tạo link mời (`POST /applications/invites`): Sinh token bảo mật ngẫu nhiên 32 bytes hex, hạn 7 ngày, trạng thái ban đầu `UNUSED`, tự động gửi email mời qua `notificationDispatcher`.
       - Xác thực token (`GET /applications/invites/verify/:token` & `GET /verify`): Public API kiểm tra token chưa dùng (`UNUSED`/`ACTIVE`) và chưa hết hạn trước khi hiển thị form onboarding. Tự động đánh dấu `EXPIRED` nếu quá hạn.
       - Thu hồi thư mời (`PATCH /applications/invites/:id/revoke`).
    2. **Public Candidate Submission (Nộp đơn trực tuyến)**:
       - Endpoint `POST /applications/submit` (alias `POST /applications`): Nhận thông tin cá nhân, trường, ngành, nguyện vọng phòng ban/vị trí tĩnh (`Engineering`, `Design`, `Marketing`, `Data`, `QA`, `HR`, `Product`), tệp đính kèm R2.
       - **Ràng buộc ngày bắt đầu (`startDate`)**: Kiểm tra chặt chẽ theo ngày lịch ở múi giờ `Asia/Ho_Chi_Minh`: không ở quá khứ và không rơi vào thứ Bảy hoặc Chủ Nhật (`![0, 6].includes(day)`).
       - **Transaction Safety**: Tạo bản ghi `Application` (`PENDING`), lưu attachments, và tự động chuyển token invite sang `USED` trong cùng 1 transaction chống dùng lại.
    3. **Admin Workflow (Phê duyệt & Phân công)**:
       - Gán phòng ban/vị trí nội bộ (`PATCH /applications/:id/assign` & `/assignment`): Chỉ cho phép khi đơn ở trạng thái `PENDING`.
       - Phê duyệt đơn (`POST /applications/:id/approve` & `/review`): Bắt buộc đã gán đủ phòng ban và vị trí nội bộ. Trong transaction:
         1. Tạo tài khoản `User` (Role `INTERN`, mật khẩu ngẫu nhiên an toàn).
         2. Tạo bản ghi `Intern` (sinh mã `internCode = INT-XXXXXXXX`, gán leader nếu có).
         3. Cập nhật trạng thái đơn sang `APPROVED`.
         4. Enqueue gửi email thông báo tài khoản qua `notificationDispatcher`.
       - Từ chối đơn (`POST /applications/:id/reject`): Bắt buộc có lý do cụ thể (`rejectedReason`), cập nhật đơn `REJECTED` và gửi email thông báo kết quả.
    4. **Cloudflare R2 File Storage**:
       - Endpoint `GET /applications/attachments/upload-url` sinh presigned PUT URL với prefix `applications/` phục vụ upload CV/minh chứng trực tiếp từ client.
  - **Dynamic RBAC & Verification**:
    - Phân quyền qua `PERMISSIONS.APPLICATION_*`.
- **Task Management & Assignment Modules (task-groups, tasks, task-assignments) (2026-09-14)**:
  - Hoàn thiện trọn bộ 3 module Quản lý Công việc & Phân công (`task-groups`, `tasks`, `task-assignments`) theo kiến trúc phân tầng chuẩn 6 file (`route`, `validation`, `controller`, `service`, `repository`, `dto`) và OpenAPI 3.0:
    1. **Task Groups (`src/modules/task-groups/`)**:
       - CRUD TaskGroup: `name`, `description`, `departmentId`, `status` (`ACTIVE`, `COMPLETED`, `ARCHIVED`), `maxWorkloadDays`, `maxActiveTasks`, `requireAllMembers`.
       - Quản lý Membership (`TaskGroupMember`): Khai báo rõ ràng danh sách TTS (`memberIds`). Validation kiểm tra TTS active và thuộc phòng ban/leader phụ trách.
       - Thống kê tiến độ nhóm (`GET /task-groups/:id/progress`): Tổng số task, đếm theo trạng thái (`DONE`, `IN_PROGRESS`, `REVIEW`, `TODO`, `BLOCKED`, `unassigned`), tính tỷ lệ hoàn thành (`completionRate`).
       - Danh sách công việc thuộc nhóm (`GET /task-groups/:id/tasks`).
    2. **Tasks & Attachments (`src/modules/tasks/`)**:
       - CRUD Task: `code` (VD `BE1-01`), `title`, `description`, `module`, `phase`, `priority` (hỗ trợ cả `P0`/`P1`/`P2` và `LOW`/`MEDIUM`/`HIGH`), `estDays`, `startDate`, `deadline`, `taskNotes`, `acceptanceCriteria`, `taskGroupId`.
       - Ràng buộc lịch: `startDate <= deadline`.
       - Tệp đính kèm (`/tasks/:taskId/attachments`): Presigned PUT URL lên Cloudflare R2 bucket với prefix `tasks/` (`tasks/:taskId/:uuid_filename`), xác nhận metadata sau upload, thêm link ngoài, xóa tệp khỏi R2 & DB.
       - **RÀNG BUỘC KHÓA CÔNG VIỆC HOÀN THÀNH (`TASK_ALREADY_COMPLETED`)**: Khi assignment của task ở trạng thái `DONE`, khóa toàn bộ thao tác (sửa task, xóa task, đổi deadline, thêm/xóa attachment), trả về HTTP `409 Conflict` kèm mã lỗi `TASK_ALREADY_COMPLETED`.
    3. **Task Assignments (`src/modules/task-assignments/`)**:
       - Vai trò mỗi task: Tối đa 1 `OWNER` và 1 `SUPPORT` (`internId !== supportId`).
       - Ràng buộc Task Group Membership: Nếu task thuộc Task Group, TTS nhận việc (Owner hoặc Support) bắt buộc phải thuộc danh sách thành viên của Task Group đó.
       - Tính toán Capacity & Workload: `Owner` tính 100% `estDays`, `Support` tính 50% `estDays` (`SUPPORT_WORKLOAD_FACTOR = 0.5`). Kiểm tra không vượt `maxWorkloadDays` và `maxActiveTasks`.
       - Phân công nội bộ: Giao trực tiếp cho TTS active thuộc quyền quản lý, chuyển thẳng sang trạng thái `TODO`.
       - Phân công xuyên team (Cross-team Assignment Workflow): Leader bắt buộc nhập chính xác email của TTS team khác. Phân công khởi tạo ở `PENDING_APPROVAL` (tạm giữ capacity). Leader trực tiếp của TTS nhận việc có quyền duyệt (`APPROVE` -> chuyển `TODO`, kích hoạt assignment) hoặc từ chối (`REJECT` -> chuyển `BLOCKED` với lý do, giải phóng capacity).
       - Quyền hủy/xóa phân công: Admin, Leader trực tiếp của TTS hoặc người đã giao việc (`assignedBy`). Chặn hủy nếu task đã `DONE` (HTTP 409 `TASK_ALREADY_COMPLETED`).
       - Intern self-service: Cho phép TTS bắt đầu làm việc (`TODO` -> `IN_PROGRESS`) hoặc báo bị chặn (`IN_PROGRESS` -> `BLOCKED` kèm lý do).
    4. **Dynamic RBAC, Routing & Documentation**:
       - Phân quyền qua `PERMISSIONS.TASK_GROUP_*`, `TASK_*`, `TASK_ASSIGNMENT_*`.
       - Gắn routes tại `src/routes/index.ts` dưới prefix `/api/v2/task-groups`, `/api/v2/tasks`, `/api/v2/task-assignments`.
       - Đăng ký Swagger OpenAPI UI tại `/api/docs`. Toàn bộ 345 tests pass 100%, TypeScript build và ESLint sạch 0 errors / 0 warnings.
- **Task Submissions, Lifecycle Actions & Meetings/Absence Management (2026-09-15)**:
  - Hoàn thiện trọn bộ các module Quản lý Nộp bài (`task-submissions`), Vòng đời trạng thái công việc (`task-assignments` lifecycle actions), Đánh giá bài nộp (`review`) và Quản lý Cuộc họp / Đơn xin vắng mặt (`meetings`, `absences`) theo kiến trúc phân tầng chuẩn 6 file (`route`, `validation`, `controller`, `service`, `repository`, `dto`) và OpenAPI 3.0:
    1. **Task Assignment Lifecycle Actions (`src/modules/task-assignments/`)**:
       - `POST /api/v2/task-assignments/:id/start`: Chuyển từ `TODO` sang `IN_PROGRESS` (ghi nhận `startedAt: new Date()`). Chặn thao tác nếu task không ở trạng thái `TODO` hoặc đã `DONE` (`TASK_ALREADY_COMPLETED`).
       - `POST /api/v2/task-assignments/:id/block`: Báo task bị kẹt/chặn. Bắt buộc task đang ở `IN_PROGRESS` (chặn khi `TODO` theo `INVALID_STATUS_TRANSITION`) và bắt buộc có `blockedReason`. Chuyển trạng thái sang `BLOCKED`.
       - `POST /api/v2/task-assignments/:id/unblock`: Mở lại task bị chặn. Ràng buộc bảo mật: Chỉ Leader trực tiếp phụ trách TTS hoặc Admin mới có quyền mở lại (Intern bị cấm với mã lỗi `403 FORBIDDEN`). Tự động chuyển về `IN_PROGRESS` và xóa `blockedReason`.
    2. **Task Submissions & Attachments (`src/modules/task-submissions/`)**:
       - Nộp bài (`POST /api/v2/task-submissions`):
         - **Điều kiện tiên quyết**: Assignment BẮT BUỘC đang ở trạng thái `IN_PROGRESS`. Nếu đang `TODO` (kể cả task vừa bị Leader từ chối trả về `TODO`), hệ thống từ chối request với mã lỗi HTTP 400 `TASK_NOT_IN_PROGRESS` và thông điệp hướng dẫn TTS bấm bắt đầu làm việc.
         - Thông tin nộp: `prLink`, `videoDemo`, `note`, danh sách tệp đính kèm.
         - Tự động tính số lần nộp (`attempt`: lần 1, lần 2,...) và chuyển trạng thái assignment sang `REVIEW` trong Prisma `$transaction`.
         - Upload file: Lưu trữ đám mây Cloudflare R2 qua presigned PUT URL với prefix bắt buộc `submissions/` (`GET /api/v2/task-submissions/upload-url`).
       - Đánh giá bài nộp (`POST /api/v2/task-submissions/:id/review`):
         - Quyền đánh giá: Chỉ Leader trực tiếp hoặc Admin.
         - Chấp thuận (`APPROVED`): Chuyển assignment sang `DONE`, ghi nhận `completedAt`. Tự động kích hoạt cơ chế khóa toàn bộ thao tác sửa đổi công việc theo mã lỗi HTTP 409 `TASK_ALREADY_COMPLETED`.
         - Yêu cầu làm lại (`REJECTED`): Bắt buộc có nhận xét lý do cần sửa (`reviewComment`), chuyển trạng thái assignment quay lại `TODO` để TTS bấm bắt đầu và làm lại từ đầu.
    3. **Meetings Management (`src/modules/meetings/`)**:
       - CRUD Meeting: `title`, `description`, `minutes` (biên bản cuộc họp), `meetingType` (`ONLINE`, `OFFLINE`, `HYBRID`), `location`, `meetingLink`, `startTime`, `endTime`, `status` (`DRAFT`, `SCHEDULED`, `ONGOING`, `COMPLETED`, `CANCELLED`), `visibility` (`PRIVATE`, `TEAM`).
       - Phân quyền tổ chức: Chỉ Admin và Leader được quyền lên lịch họp. Intern không có quyền lên lịch họp (`403 FORBIDDEN`).
       - Kiểm tra trùng lịch (`GET /api/v2/meetings/busy-users`): Phát hiện người tham gia đang có lịch họp trùng khung giờ (`startTime < other.endTime AND endTime > other.startTime`).
       - Quản lý người tham gia: Mời người tham gia (`MeetingParticipant`), phản hồi tham dự RSVP (`ACCEPTED`, `DECLINED`), điểm danh tham gia (`ATTENDED`).
       - Đơn xin vắng mặt cuộc họp (`AbsenceRequest`): TTS gửi lý do xin vắng mặt; Leader/Admin phê duyệt (`APPROVED` -> tự động cập nhật RSVP sang `DECLINED` và trạng thái điểm danh sang `ABSENT`) hoặc từ chối (`REJECTED`).
    4. **General Intern Absence Requests (`src/modules/absences/`)**:
       - Đơn xin nghỉ phép/vắng mặt: TTS tạo đơn xin nghỉ (`startDate`, `endDate`, `reason`, `evidenceUrl`). Ràng buộc logic `startDate <= endDate`.
       - Phê duyệt: Leader trực tiếp hoặc Admin duyệt (`APPROVED`) hoặc từ chối (`REJECTED`) kèm ghi chú `reviewNote`.
    5. **Dynamic RBAC, Routing & Documentation**:
       - Bổ sung permissions: `TASK_SUBMISSION_*`, `MEETING_*`, `ABSENCE_*`.
       - Gắn routes tại `src/routes/index.ts` dưới prefix `/api/v2/task-submissions`, `/api/v2/meetings`, `/api/v2/absences`.
       - Đăng ký Swagger OpenAPI 3.0 tại `/api/docs`.
       - Bộ test tự động toàn dự án đạt 370 tests pass 100%, build `tsc` và `eslint` sạch 0 errors / 0 warnings.

