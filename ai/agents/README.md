# Thư mục `ai/agents/` — Quản lý AI Agent, Kỹ Năng & Công Cụ

Thư mục này quản lý cấu hình, kỹ năng (skills) và công cụ (tools) dành cho các Agent AI tự động trong hệ sinh thái NexCampus.

## Cấu trúc thư mục

```text
agents/
├── skills/      # Các kỹ năng có thể tái sử dụng (chuẩn bị sẵn cấu trúc)
└── tools/       # Cấu hình và hướng dẫn sử dụng công cụ của Agent
```

## 1. `skills/`
Mỗi skill đại diện cho một năng lực nghiệp vụ độc lập, có thể tái sử dụng bởi nhiều Agent.
Khi một tác vụ được đóng gói thành skill, cấu trúc chuẩn bao gồm:
```text
skills/<ten-ky-nang>/
├── skill.md          # Đặc tả mục tiêu, khi nào dùng, input/output, quy trình
├── examples/         # Mẫu dữ liệu đầu vào và kết quả mong muốn
├── templates/        # Template định dạng câu trả lời hoặc báo cáo
└── references/       # Tài liệu tham khảo kỹ thuật liên quan
```

Các năng lực dự kiến được đóng gói thành skill khi hoàn thiện:
- `task-allocation`: Năng lực phân tích năng lực và phân công công việc.
- `weekly-evaluation`: Năng lực tổng hợp báo cáo và chấm điểm thực tập sinh.
- `daily-report-summary`: Năng lực tóm tắt và phát hiện bất thường trong tiến độ ngày.

## 2. `tools/`
Quản lý các định nghĩa công cụ (tool definitions) cho phép AI tương tác với hệ thống:
- `query-intern-profile`: Truy vấn thông tin thực tập sinh từ database.
- `calculate-workload`: Tính toán tải công việc hiện tại.
- `validate-github-pr`: Kiểm tra tính hợp lệ của đường dẫn PR và trạng thái commit.
- `parse-excel-tasks`: Trích xuất danh sách công việc từ file bảng tính Excel tải lên.
