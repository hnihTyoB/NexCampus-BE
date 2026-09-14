# Bản đồ dự án NexCampus Backend v2 (NexCampus-v2-BE)

## Mục đích

`NexCampus-v2-BE` là phiên bản backend được code lại (rewrite) từ `NexCampus-BE/`, phục vụ toàn bộ nền tảng quản lý thực tập sinh NexCampus: tuyển dụng và onboarding, quản lý người dùng & phòng ban, giao việc & chấm bài nộp, báo cáo ngày, đánh giá tuần 12 tiêu chí, trợ lý phân bổ và chấm điểm bằng AI, xuất PDF và gửi thông báo.

Dự án được xây dựng trên nền tảng backend tiêu chuẩn hiện đại (NodeJS, Express, TypeScript, Prisma, PostgreSQL, pnpm) với Dynamic RBAC, Maintenance Guard và hệ thống AI 4 thư mục (`ai/`).
Các API được mount dưới tiền tố `/api/v1`; tài liệu Swagger UI tại `/api/docs`.

## Công nghệ

- Node.js + Express 4 + TypeScript (CommonJS, strict mode)
- Prisma 5 + PostgreSQL
- Zod cho validation ở biên HTTP
- JWT cho authentication, middleware kiểm tra permission động cho authorization
- pnpm là package manager chuẩn (`pnpm@9.15.0`)
- Cloudflare R2 / S3-compatible storage cho file đính kèm & video demo
- BullMQ queue / worker cho tác vụ nền và dọn dẹp file
- AI Provider: Google Gemini / OpenAI qua module chuẩn hóa `ai/`

## Cấu trúc runtime

```text
src/
├── server.ts             # Nạp env và mở HTTP server
├── app.ts                # Khởi tạo Express, swagger và global middlewares
├── routes/index.ts       # Mount route cấp /api/v1
├── modules/
│   ├── auth/             # Đăng ký, đăng nhập, token, profile, session, thiết bị
│   ├── users/            # Quản trị user
│   ├── rbac/             # Quản lý phân quyền động (Role, Permission)
│   ├── maintenance/      # Chế độ bảo trì hệ thống và maintenance guard
│   ├── notification/     # Thông báo hệ thống và email queue
│   └── [domain modules]/ # Các module nghiệp vụ đang code lại từ NexCampus-BE
├── middlewares/          # Auth, role, permission, validation, rate limit, error, maintenance
├── config/               # Env, DB, JWT, mail, Swagger, storage, ai
├── database/             # Prisma client instance
└── common/
    ├── constants/        # Error codes, status codes, permission constants, roles
    ├── errors/           # AppError và custom error classes
    ├── helpers/          # Utilities, formatters, cryptography, date/time
    ├── services/         # Mail service, token service, cache service, storage service
    └── types/            # Shared TypeScript types / interfaces

ai/                       # Cấu trúc 4 thư mục quản lý tài nguyên AI
├── prompts/              # System prompts, task prompts, tools
├── data/                 # Raw specs & processed JSON data (12 criteria, allocation rules)
├── agents/               # Skills & tools của Agent
└── evals/                # Tests, traces và scorecards (thang điểm 100)

prisma/
├── schema.prisma         # Database schema
├── migrations/           # Lịch sử migration đã áp dụng
└── seed.ts               # Seed data mẫu

scripts/prisma-run.js      # Wrapper nạp env và chạy Prisma CLI
```

## Luồng request chuẩn

```text
Express router
  -> maintenanceGuard (kiểm tra trạng thái bảo trì)
  -> auth / permission middleware (khi cần bảo vệ)
  -> Zod validation middleware (validate & coerce params/body/query)
  -> controller (chuyển đổi HTTP request/response)
  -> service (thực thi business rule, điều phối transaction)
  -> repository (thao tác Prisma Client -> PostgreSQL)
  -> response formatter hoặc error middleware
```

## Phạm vi nghiệp vụ chuyển giao từ `NexCampus-BE`

1. **Hạ tầng & Xác thực nền tảng (Đã hoàn thành)**:
   - Health check (`/health`), Xác thực (`/auth`), Quản lý tài khoản (`/users`), Phân quyền động RBAC (`/rbac`), Bảo trì (`/maintenance`), Thông báo (`/notifications`).
   - Module AI 4 thư mục (`ai/`): Task Allocation & Weekly Evaluation prompts/evals/data.
2. **Các module nghiệp vụ NexCampus đang chuyển giao**:
   - `departments`: Quản lý phòng ban, quan hệ nhiều-nhiều với Leader (tối đa 3 phòng ban/leader).
   - `applications`: Tiếp nhận ứng viên, form onboarding, phê duyệt phân công.
   - `regulations`: Quản lý nội quy, chính sách thực tập.
   - `interns` & `leaders`: Hồ sơ chuyên sâu, quản lý workload, phân công trực tiếp.
   - `tasks`, `task-groups`, `task-assignments`, `task-submissions`: Quản lý vòng đời công việc, nộp PR/video demo, duyệt bài, khóa chỉnh sửa khi `DONE` (409), giao việc xuyên team.
   - `daily-reports`: Báo cáo tiến độ ngày, theo dõi lịch nộp của TTS.
   - `weekly-evaluations`: Chấm điểm tuần 12 tiêu chí, gợi ý AI, xuất PDF, ký nhận kết quả.
   - `meetings`: Quản lý lịch họp, biên bản meeting.
   - `stats` & `pdf-export`: Thống kê tổng hợp dashboard và trích xuất báo cáo.

## File sinh tự động hoặc không được sửa trực tiếp

- `dist/`
- `node_modules/`
- Prisma Client được generate (`node_modules/@prisma/client` hoặc `.prisma/client`)
- Migration cũ đã được áp dụng trong `prisma/migrations/`
