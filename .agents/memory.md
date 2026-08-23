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
- **Audit & Remediation (full-project-audit)**:
  - **Prisma Error Handling**: `errorMiddleware` tự động phân giải các lỗi Prisma (`P2002` -> 409 DUPLICATE_ENTRY, `P2025` -> 404 NOT_FOUND, `P2003` & Validation -> 400 VALIDATION_ERROR) ngăn ngừa lỗi 500 unhandled.
  - **Token Lifecycle Hygiene**: `createVerificationToken` và `createPasswordResetToken` tự động xóa toàn bộ token cũ của cùng user trong `$transaction` trước khi tạo token mới.
  - **RBAC Cache Invalidation**: `assignUserRole` tự động xóa cache cho cả `oldRoleId` và `newRoleId` để bảo đảm không tồn đọng quyền cũ.
  - **Integration Architecture**: `IntegrationService` sử dụng `createAuditLog` qua repository thay vì gọi Prisma trực tiếp; `dispatchWebhookEvent` đẩy job vào queue song song bằng `Promise.all`.
  - **Broadcast Notifications**: Phân tách người nhận thành các batch 500 bản ghi để tối ưu hóa hiệu năng chèn cơ sở dữ liệu.


