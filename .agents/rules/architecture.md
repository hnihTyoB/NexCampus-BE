# Quy tắc kiến trúc

## Ranh giới layer

### Route

- Khai báo HTTP method/path và thứ tự middleware.
- Áp dụng auth, role và validation trước controller.
- Không chứa business logic hoặc Prisma query.

### Validation

- Dùng Zod cho body/query/params có dữ liệu cần kiểm tra.
- Normalize/coerce dữ liệu tại schema khi phù hợp.
- DTO phải phản ánh dữ liệu sau validation, tránh cast che lỗi kiểu.

### Controller

- Đọc request đã validate, gọi service và tạo HTTP response.
- Chuyển lỗi cho error middleware; không lặp lại mapping lỗi ở từng controller.
- Không query Prisma, hash password hoặc thực thi business rule.

### Service

- Chứa use case, business rule, authorization theo dữ liệu và điều phối nhiều
  repository/service.
- Dùng `AppError` + `ERROR_CODE` cho lỗi dự kiến.
- Dùng transaction khi nhiều database write phải thành công hoặc thất bại cùng
  nhau.

### Repository

- Là nơi duy nhất trong module thực hiện Prisma query.
- Không tạo HTTP response hoặc phụ thuộc Express.
- Mặc định loại record soft-deleted khi nghiệp vụ yêu cầu dữ liệu đang hoạt động.
- Chỉ trả các field cần thiết; không làm rò `password`, token hay dữ liệu nhạy cảm.

## Thêm module mới

- Theo naming hiện tại:
  `<name>.route.ts`, `<name>.validation.ts`, `<name>.controller.ts`,
  `<name>.service.ts`, `<name>.repository.ts`, `<name>.dto.ts`.
- Mount route ở `src/routes/index.ts`; API public nằm dưới `/api/v1`.
- Dùng checklist `.agents/checklists/new-module.md`.

## Database

- Thay đổi schema phải xem xét migration, index, unique constraint, quan hệ và
  `onDelete`.
- Không sửa migration cũ đã chia sẻ; tạo migration mới.
- Không chạy `db:migrate:reset` nếu người dùng chưa yêu cầu rõ ràng.
- Với tiền tệ hoặc số thập phân chính xác, giữ Prisma `Decimal`; không âm thầm chuyển sang JavaScript float.

## Quy tắc nghiệp vụ NexCampus kế thừa từ `NexCampus-BE`

- **Khóa chỉnh sửa công việc đã hoàn thành**: Khi assignment của công việc ở trạng thái `DONE`, không cho cập nhật thông tin công việc, thay đổi hoặc huỷ phân công, hay thêm/xoá attachment. Trả về `409 Conflict` với error code `TASK_ALREADY_COMPLETED`.
- **Giao việc xuyên team**: Leader giao hoặc chuyển việc cho TTS thuộc team khác phải nhập chính xác email của TTS; request phân công chuyển sang trạng thái chờ Leader của team nhận duyệt (`PENDING_APPROVAL`).
- **Giới hạn năng lực và Workload**: Kiểm tra `maxWorkloadDays` và `maxActiveTasks`. Owner tính 100% `estDays`, Support tính 50% `estDays`.
- **Quản lý phòng ban (Department)**: Một Leader có thể quản lý tối đa 3 Department qua quan hệ nhiều-nhiều.
- **Đánh giá tuần**: Tuân thủ 12 tiêu chí chuẩn qua 3 nhóm (Kỷ luật & tư chất, Chuyên môn, Kết quả đề tài) với 5 mức điểm (`TOT`, `KHA`, `TB`, `TBY`, `YEU`).
- **Lưu trữ tệp tin**: Dùng Cloudflare R2 / S3-compatible storage với presigned URL; tách prefix logic (`tasks`, `submissions`, `reports`, `avatars`, `applications`). Cleanup tệp mồ côi khi transaction thất bại hoặc hết hạn.
