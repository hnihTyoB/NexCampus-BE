# NexCampus backend

Phạm vi: toàn bộ `NexCampus-BE/`.

Khi workspace cha có `.agents/`, phải đọc:

- `../.agents/rules/project.md`
- `../.agents/rules/workflow.md`
- `../.agents/rules/backend.md`
- `../.agents/rules/quality.md`
- `../.agents/rules/api-contract.md` nếu thay đổi API

Quy tắc tóm tắt:

- Giữ luồng route → middleware/validation → controller → service → repository →
  Prisma.
- Validate bằng Zod ở biên; coerce query param số trước khi dùng với Prisma.
- Dùng `AppError` và error code ổn định cho lỗi nghiệp vụ.
- Không sửa migration đã áp dụng, không reset/seed database nếu chưa được yêu cầu.
- Không đọc hoặc commit `.env`; không sửa `dist/` hay `node_modules/`.
- Chạy `npm run build` cho thay đổi code và rà diff trước khi bàn giao.
