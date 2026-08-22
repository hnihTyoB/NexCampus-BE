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

## Trạng thái đã biết

- Các endpoint hiện hữu: `/health`, `/auth` (đăng ký, đăng nhập, refresh, me, logout, password reset, verification, sessions), `/users` (quản trị người dùng), `/rbac` (quản trị vai trò, phân quyền, nhật ký kiểm toán audit log).
- Cơ sở dữ liệu sạch chuẩn template với các migration `20260722073204_`, `20260822152200_dynamic_rbac`, `20260822164800_notification_system`, `20260822170800_remove_domain_financial_models`.
- Cấu hình port: fallback code là `8888` (hoặc `7777` theo `.env.example`).
- Tài liệu Swagger UI tại `/api/docs`.

