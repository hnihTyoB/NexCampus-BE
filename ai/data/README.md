# Thư mục `ai/data/` — Quản lý Dữ liệu đầu vào

Thư mục này quản lý toàn bộ tài liệu, dữ liệu nghiệp vụ và tri thức đầu vào cần thiết cho hệ thống AI của NexCampus.

## Cấu trúc

```text
data/
├── raw/                 # Dữ liệu & tài liệu gốc, không chỉnh sửa trực tiếp
└── processed/           # Dữ liệu đã chuẩn hóa, làm sạch theo JSON schema để AI/backend tiêu thụ
```

## 1. Thư mục `raw/`
- **Nguyên tắc**: Giữ nguyên vẹn văn bản gốc để đối chiếu nguồn gốc sự thật khi có thay đổi nghiệp vụ.
- **Quy tắc đặt tên**: `YYYY-MM-DD_ten-tai-lieu_phien-ban.md`
- **Tài liệu hiện tại**:
  - `2026-08-08_nexcampus-task-spec_v01.md`: Đặc tả nghiệp vụ quản lý Task, phân công công việc, import Excel và yêu cầu AI Task Allocation.
  - `2026-08-08_nexcampus-weekly-evaluation-spec_v01.md`: Đặc tả quy trình đánh giá tuần, 12 tiêu chí đánh giá, gợi ý AI và luồng ký duyệt của Leader & TTS.
  - `2026-08-08_nexcampus-daily-report-spec_v01.md`: Đặc tả quy trình nộp báo cáo hằng ngày, theo dõi tiến độ tuần của TTS.

## 2. Thư mục `processed/`
- **Nguyên tắc**: Dữ liệu có cấu trúc (JSON) được chuẩn hóa từ tài liệu gốc, loại bỏ thông tin rườm rà và định nghĩa rõ ràng Schema, Enum, Fallback rules.
- **Tài liệu hiện tại**:
  - `weekly-evaluation-12-criteria.json`: Bảng tiêu chuẩn 12 tiêu chí phân theo 3 nhóm, trọng số, 5 mức đánh giá (`TOT`, `KHA`, `TB`, `TBY`, `YEU`) và xử lý biên khi không có báo cáo.
  - `task-allocation-rules.json`: Công thức tính điểm tương thích (Workload 30%, Skill 25%, Performance 25%, Learning 20%), hệ số tải Owner/Support và ngưỡng rủi ro quá tải (`HIGH`, `MEDIUM`, `LOW`).

## Quy trình cập nhật dữ liệu
```text
Tài liệu gốc mới / thay đổi chính sách
       │
       ▼
Lưu trữ vào data/raw/ (đánh version)
       │
       ▼
Trích xuất, chuẩn hóa schema & validation
       │
       ▼
Cập nhật vào data/processed/ (kiểm thử JSON schema)
       │
       ▼
Đồng bộ với Service / Prompt của backend
```
