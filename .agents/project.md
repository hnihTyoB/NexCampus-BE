# Bản đồ dự án Backend Template

## Mục đích

Backend API Template (NodeJS, Express, TypeScript, Prisma, PostgreSQL) phục vụ khởi tạo nhanh các dự án backend tiêu chuẩn với đầy đủ tính năng Authentication, User Management, và Dynamic RBAC.
Các API được mount dưới tiền tố `/api/v1`; tài liệu Swagger UI tại `/api/docs`.

## Công nghệ

- Node.js + Express 4 + TypeScript (CommonJS, strict mode)
- Prisma 5 + PostgreSQL
- Zod cho validation ở biên HTTP
- JWT cho authentication, middleware kiểm tra role/permission cho authorization
- pnpm là package manager chuẩn (`pnpm@9.15.0`)

## Cấu trúc runtime

```text
src/
├── server.ts             # Nạp env và mở HTTP server
├── app.ts                # Khởi tạo Express, swagger và global middlewares
├── routes/index.ts       # Mount route cấp /api/v1
├── modules/
│   ├── auth/             # Đăng ký, đăng nhập, token, profile, session, thiết bị
│   └── users/            # Quản trị user
├── middlewares/          # Auth, role, validation, rate limit, error
├── config/               # Env, DB, JWT, mail, Swagger
├── database/             # Prisma client instance
└── common/
    ├── constants/        # Error codes, status codes, permission constants
    ├── errors/           # AppError và custom error classes
    ├── helpers/          # Utilities, formatters, cryptography
    ├── services/         # Mail service, token service, common services
    └── types/            # Shared TypeScript types / interfaces

prisma/
├── schema.prisma         # Database schema
├── migrations/           # Lịch sử migration đã áp dụng
└── seed.ts               # Seed data mẫu

scripts/prisma-run.js      # Wrapper nạp env và chạy Prisma CLI
```

## Luồng request chuẩn

```text
Express router
  -> auth / role middleware (khi cần bảo vệ)
  -> Zod validation middleware
  -> controller
  -> service
  -> repository
  -> Prisma Client -> PostgreSQL
  -> response formatter hoặc error middleware
```

## Phạm vi hiện tại

- **Đang hoạt động**: Health check (`/health`), Xác thực (`/auth`), Quản lý tài khoản (`/users`), Phân quyền động RBAC (`/rbac`), Thông báo & Email Queue (`/notifications`).
- **Data models trong schema**:
  - `User`, `Role`, `Permission`, `RolePermission`, `AuditLog`, `RefreshToken`, `UserSocial`, `VerificationToken`, `PasswordResetToken`, `UserDevice`
  - `Notification`, `EmailNotification`
- **Kế hoạch triển khai tiếp theo**: Phát triển các module tính năng nghiệp vụ theo yêu cầu dựa trên kiến trúc chuẩn template.

## File sinh tự động hoặc không được sửa trực tiếp

- `dist/`
- `node_modules/`
- Prisma Client được generate (`node_modules/@prisma/client` hoặc `.prisma/client`)
- Migration cũ đã được áp dụng trong `prisma/migrations/`
