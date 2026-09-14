# Quy Tắc An Toàn & Bảo Mật Dữ Liệu Cho AI (Safety & Privacy Rules)

Áp dụng cho toàn bộ các dịch vụ và module AI trong NexCampus.

## 1. Bảo vệ Thông tin Định danh Cá nhân (PII)
- Tuyệt đối **KHÔNG** đưa mật khẩu, JWT token, secret key, chuỗi kết nối database hoặc API key vào prompt.
- Khi nạp dữ liệu người dùng (TTS, Leader), chỉ nạp các trường cần thiết phục vụ đánh giá: `fullName`, `email` định danh công việc, `position`.
- Không xử lý hay lưu trữ thông tin nhạy cảm: số CMND/CCCD, thông tin ngân hàng, mật khẩu tài khoản cá nhân.

## 2. Ranh giới Quyền hạn (Role Boundaries)
- AI chỉ đóng vai trò **Trợ lý (Assistant)**:
  - Gợi ý phân công task → Quyết định thuộc về **Leader**.
  - Gợi ý đánh giá tuần → Phê duyệt và sửa đổi thuộc về **Leader**.
  - TTS chỉ có quyền xem và xác nhận đã đọc đánh giá.
- AI không bao giờ được phép tự động gọi API thực thi cập nhật trực tiếp vào cơ sở dữ liệu nếu không thông qua tầng xác thực và controller/service backend.

## 3. Kiểm soát Nội dung & Ngăn chặn Hallucination
- Mọi nhận xét và điểm số đề xuất phải bắt nguồn trực tiếp từ dữ liệu được nạp vào (`dailyReports`, `taskSubmissions`, `candidates`).
- Không suy diễn hoặc tự sáng tạo các task, lỗi kỹ thuật không có thật.
- Trong tình huống thiếu dữ liệu, phải kích hoạt cơ chế fallback và thông báo rõ ràng cho Leader.

## 4. Xử lý Lỗi & Định dạng Biên (Edge Sanitization)
- Toàn bộ kết quả sinh ra từ LLM/Gemini phải được validate qua Zod schema ở phía Backend trước khi trả về client hoặc lưu DB.
- Khi LLM trả về kết quả lỗi hoặc sai định dạng:
  - Không ném trực tiếp raw error kèm prompt ra API response.
  - Sử dụng fallback response an toàn và ghi log vào hệ thống audit nội bộ.
