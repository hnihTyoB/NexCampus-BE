# Backend Agent Guide

Tài liệu này là điểm vào chính cho mọi phiên làm việc với AI Agent trong repository `template-be`.
Mục tiêu là giữ cách phân tích, triển khai, kiểm tra và bàn giao thay đổi luôn nhất quán, an toàn và chuẩn mực.

## Context bắt buộc

Trước khi sửa code:

1. Đọc `.agents/project.md` để nắm cấu trúc, công nghệ và phạm vi dự án hiện tại.
2. Đọc các quy tắc trong `.agents/rules/` có liên quan; với thay đổi code backend, tối thiểu đọc cả ba file:
   - `.agents/rules/architecture.md` (ranh giới layer: `route -> validation -> controller -> service -> repository`)
   - `.agents/rules/tech-defaults.md` (quy ước TypeScript, Express, Zod, Prisma, Auth & Security)
   - `.agents/rules/workflow.md` (quy trình triển khai, kiểm thử và bàn giao)
3. Đọc `.agents/memory.md` để biết trạng thái và quyết định dài hạn hiện tại.
4. Nếu có `.agents/local.md`, đọc file đó sau cùng. Đây là ghi chú riêng của máy cá nhân và không được commit.

> Code và cấu hình đang chạy là nguồn sự thật cao nhất. Nếu tài liệu khác với code, hãy nêu sự khác biệt, làm theo yêu cầu hiện tại và cập nhật tài liệu khi thay đổi đã được xác nhận.

## Nguyên tắc cốt lõi

- **Đúng phạm vi**: Giữ thay đổi đúng phạm vi yêu cầu; không tiện tay refactor phần không liên quan.
- **Kiến trúc phân tầng chuẩn**: Tuân thủ nghiêm ngặt luồng:
  `route -> validation -> controller -> service -> repository`.
- **Validation**: Validate toàn bộ dữ liệu đầu vào ở biên HTTP bằng Zod schemas. Không tin tưởng dữ liệu thô từ `req.body`, `req.query`, `req.params`.
- **Trách nhiệm rõ ràng**:
  - Controller chỉ xử lý HTTP request/response và chuyển lỗi cho error middleware.
  - Business rules, permissions và logic điều phối thuộc về Service.
  - Mọi thao tác truy vấn Prisma/database nằm tập trung trong Repository.
- **Xử lý lỗi**: Dùng `AppError` và `ERROR_CODE` cho các lỗi nghiệp vụ có chủ đích.
- **Quản lý hằng số & Enums tập trung**: Tuyệt đối KHÔNG hard-code chuỗi ký tự (magic strings) cho các hành động nghiệp vụ, audit log actions, role names, permission names, error codes hay status constants. Mọi giá trị dùng chung hoặc có tính lặp lại phải được định nghĩa trong `src/common/constants/` dưới dạng `as const` kèm exported type (VD: `AUDIT_ACTION`, `AUDIT_TARGET_TYPE`, `PERMISSIONS`, `ROLES`, `ERROR_CODE`).
- **Bảo mật**: Tuyệt đối KHÔNG đọc, ghi log, commit hoặc đưa vào phản hồi giá trị bí mật từ `.env` (JWT secrets, DB credentials, mail passwords, API keys).
- **Không sửa file sinh tự động**: Không sửa trực tiếp `dist/`, `node_modules/` hoặc migration đã được áp dụng.
- **Database Safety**: Không chạy reset database (`db:migrate:reset`), xóa dữ liệu hay tạo migration phá hủy nếu chưa có yêu cầu và xác nhận rõ ràng từ người dùng.
- **Package Manager**: Dùng `pnpm` theo `packageManager` trong `package.json`.

## Prisma schema, migration và generated client

- **Đồng bộ Schema & Migration**: Khi code sử dụng model, field, enum, relation, index hoặc default mới trong `schema.prisma`, luôn kiểm tra cả `prisma/migrations/` và generated Prisma Client. Không được kết luận “schema đã có nên không cần migration”.
- **Migration bất biến**: Mọi thay đổi database chưa có trong migration history phải tạo migration mới; tuyệt đối không sửa migration cũ đã áp dụng.
- **Trình tự build sau khi sửa schema**:
  1. `pnpm exec prisma validate`
  2. `pnpm run prisma:generate`
  3. `pnpm build`
  Xác nhận generated types thực sự chứa field/model mới; không chỉ dựa vào một lần build thành công vì TypeScript hoặc IDE có thể đang resolve client cũ/stale.
- **Script chuẩn**: Sử dụng các script wrapper trong `package.json`:
  - `pnpm run prisma:generate`: Sinh Prisma client
  - `pnpm run db:migrate`: Tạo và áp dụng migration trong môi trường dev
  - `pnpm run db:seed`: Seed data ban đầu
  - `pnpm run prisma:studio`: Mở Prisma Studio để xem dữ liệu
- **Migration an toàn**: Nếu migration diff kéo theo thao tác phá hủy hoặc thay đổi ngoài phạm vi, dừng lại để thông báo và xin xác nhận.

## Bộ lệnh chuẩn của dự án

- `pnpm dev`: Chạy server chế độ development (`ts-node-dev`)
- `pnpm build`: Biên dịch TypeScript sang JavaScript (`dist/`)
- `pnpm start`: Chạy server production từ `dist/server.js`
- `pnpm test`: Chạy toàn bộ automated test suite (`tsx --test`)
- `pnpm run prisma:generate`: Sinh Prisma client
- `pnpm run db:migrate`: Chạy migration Prisma (`prisma migrate dev`)
- `pnpm run db:seed`: Seed database
- `pnpm run lint`: Chạy ESLint kiểm tra code
- `pnpm run format`: Chạy Prettier định dạng code

## Hoàn tất công việc

- Kiểm tra diff (`git diff`, `git status --short`) để không ghi đè thay đổi có sẵn của người dùng.
- Chạy kiểm tra phù hợp (`pnpm build`, `pnpm exec prisma validate`).
- Nêu rõ file đã đổi, kiểm tra đã chạy và hạn chế còn lại (nếu có).
- Khi một quyết định kiến trúc hoặc trạng thái dự án bền vững thay đổi, cập nhật `.agents/memory.md`.

## Code review

- Ưu tiên kiểm tra: tính đúng đắn (correctness), bảo mật (security), phân quyền (authorization), validation chặt chẽ, không rò rỉ dữ liệu nhạy cảm, tính nhất quán trong transaction và an toàn migration.
- Mỗi nhận xét phải chỉ ra file/vị trí cụ thể, tác động và hướng sửa an toàn.
- Không báo lỗi chỉ mang tính format nếu formatter có thể xử lý tự động.
