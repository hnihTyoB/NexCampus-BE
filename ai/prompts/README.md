# Thư mục `ai/prompts/` — Quản lý Câu lệnh cho AI

Thư mục này quản lý toàn bộ câu lệnh, system prompt, hướng dẫn nhiệm vụ và công cụ dành cho AI của NexCampus.

## Cấu trúc thư mục

```text
prompts/
├── system/      # System prompt quy định vai trò, nguyên tắc và giới hạn cốt lõi
├── tasks/       # Prompt dành riêng cho từng tác vụ cụ thể (được khởi tạo sẵn)
└── tools/       # Hướng dẫn gọi tool, tích hợp MCP hoặc API ngoài
```

## 1. `system/`
Chứa các hướng dẫn nền tảng bất biến cho các tác vụ AI:
- `task-allocation-assistant.md`: Quy định vai trò trợ lý phân bổ task cho Leader, ngưỡng rủi ro và schema JSON.
- `weekly-evaluation-assistant.md`: Quy định vai trò trợ lý chấm điểm 12 tiêu chí đánh giá tuần và nhận xét.
- `safety-and-privacy-rules.md`: Bộ quy tắc bảo mật PII, chống rò rỉ secret và ranh giới quyền hạn.

## 2. `tasks/`
Dành cho việc lưu trữ các prompt chi tiết theo từng nhiệm vụ khi hệ thống mở rộng:
- Mẫu cấu trúc chuẩn của một task prompt:
  ```markdown
  Mục tiêu: <Mục tiêu cụ thể của tác vụ>
  Dữ liệu đầu vào: <Các trường dữ liệu cần cung cấp>
  Các bước thực hiện: <Trình tự xử lý của AI>
  Tiêu chí kiểm tra: <Yêu cầu về logic và chất lượng>
  Định dạng đầu ra: <Schema JSON / Text mong đợi>
  ```

## 3. `tools/`
Dành cho hướng dẫn sử dụng công cụ nội bộ (ví dụ: query database, parse file excel, trích xuất transcript video demo).
