# Backend REST API Template (NodeJS, Express, TypeScript, Prisma)

Dự án Backend REST API Template tiêu chuẩn, sẵn sàng để phát triển các dịch vụ API hiện đại với đầy đủ kiến trúc phân tầng, cơ chế xác thực bảo mật và phân quyền linh hoạt (Dynamic RBAC).

## Tính năng nổi bật

- **Xác thực toàn diện (Authentication)**: Đăng ký, kích hoạt email, đăng nhập, cấp phát JWT (Access/Refresh Token với cơ chế rotation), đổi/quên mật khẩu, quản lý đa phiên đăng nhập & cảnh báo thiết bị mới qua email.
- **Phân quyền động (Dynamic RBAC)**: Quản lý Roles & Permissions linh hoạt trong database, kiểm soát quyền chi tiết ở cấp middleware (`requirePermission`), in-memory TTL caching hiệu năng cao và tự động ghi Audit Log.
- **Quản lý người dùng (User Management)**: CRUD tài khoản, phân trang, lọc nâng cao, xóa mềm (soft delete) và phân vai trò.
- **Kiến trúc phân tầng chuẩn**: `Route -> Validation (Zod) -> Controller -> Service -> Repository -> Prisma -> PostgreSQL`.
- **Tài liệu API tự động**: Swagger UI tích hợp sẵn tại `/api/docs`.
- **An toàn dữ liệu & Kiểm toán**: Sử dụng Prisma ORM, kiểm soát kiểu dữ liệu tiền tệ chính xác (`Decimal`), ghi nhận vết kiểm toán hệ thống.

---

## Tech Stack

- **Runtime & Framework**: Node.js, Express 4, TypeScript
- **Database & ORM**: PostgreSQL, Prisma 5
- **Authentication & Security**: JWT (jsonwebtoken), BcryptJS, Cookie Parser, Helmet, CORS
- **Validation**: Zod
- **Email Service**: Nodemailer (hỗ trợ SMTP Gmail và giả lập dev mode)
- **API Documentation**: Swagger UI Express
- **Package Manager**: pnpm (`pnpm@9.15.0`)

---

## Getting Started

### 1. Yêu cầu hệ thống

- Node.js (v18 trở lên)
- pnpm (`npm install -g pnpm`)
- PostgreSQL database

### 2. Cài đặt

1. Clone repository hoặc khởi tạo từ template này.
2. Cài đặt các gói phụ thuộc:
   ```bash
   pnpm install
   ```
3. Cấu hình biến môi trường:
   - Sao chép file mẫu:
     ```bash
     cp .env.example .env
     ```
   - Cập nhật các thông số kết nối Database, JWT Secrets, Mail SMTP trong `.env`.

### 3. Khởi tạo Cơ sở Dữ liệu

```bash
# Validate Prisma schema
pnpm exec prisma validate

# Áp dụng migrations
pnpm run db:migrate

# Nạp dữ liệu khởi tạo (Permissions, Roles, Admin user)
pnpm run db:seed
```

> **Tài khoản Quản trị viên mặc định:**
> - **Email**: `admin@template.local`
> - **Mật khẩu**: `Admin@123456`

---

## Khởi chạy Server

- **Chế độ phát triển (Development)**:
  ```bash
  pnpm dev
  ```
- **Biên dịch TypeScript (Build)**:
  ```bash
  pnpm build
  ```
- **Chạy sản phẩm (Production)**:
  ```bash
  pnpm start
  ```
- **Chạy kiểm thử tự động (Test)**:
  ```bash
  pnpm test
  ```
- **Kiểm tra cú pháp & Định dạng**:
  ```bash
  pnpm run lint
  pnpm run format
  ```

---

## Tài liệu API (Swagger UI)

Khi server đang chạy, truy cập tài liệu API trực quan tại:
- **URL**: `http://localhost:8888/api/docs` (hoặc theo cổng `PORT` cấu hình trong `.env`)

