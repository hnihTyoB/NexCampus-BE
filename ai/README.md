# NexCampus AI Module Architecture (NexCampus-v2-BE)

Thư mục `ai/` được xây dựng theo chuẩn kiến trúc 4 thư mục dành cho các hệ thống AI & Agent hiện đại, phục vụ quá trình tái cấu trúc và phát triển mới các tính năng AI từ `NexCampus-BE` sang `NexCampus-v2-BE`.

---

## 1. Triết lý kiến trúc 4 thư mục

```text
ai/
├── prompts/       # Quản lý toàn bộ câu lệnh, hướng dẫn, system prompts và nguyên tắc an toàn
├── data/          # Quản lý tài liệu đầu vào (tài liệu gốc raw và dữ liệu chuẩn hóa processed)
├── agents/        # Quản lý AI Agent, cấu hình kỹ năng (skills) và công cụ (tools)
└── evals/         # Hệ thống kiểm thử độc lập, nhật ký trace và bảng chấm điểm chất lượng
```

> **Nguyên tắc cốt lõi**:  
> **Prompt** là hướng dẫn · **Dữ liệu** là nguyên liệu · **Agent** là người thực hiện · **Đánh giá** là bằng chứng cho thấy hệ thống thực sự hoạt động.

---

## 2. Chi tiết các thành phần trong `ai/`

### 1. `prompts/` — Quản lý Câu lệnh
- **`system/`**:
  - `task-allocation-assistant.md`: System prompt quy định vai trò trợ lý Leader trong việc đề xuất phân công task, đánh giá nguy cơ quá tải (`riskLevel`) và cơ hội học tập.
  - `weekly-evaluation-assistant.md`: System prompt quy định cách thức chấm điểm 12 tiêu chí theo 3 nhóm, 5 mức xếp loại (`TOT`, `KHA`, `TB`, `TBY`, `YEU`) và gợi ý nhận xét tuần.
  - `safety-and-privacy-rules.md`: Quy chuẩn bảo vệ thông tin định danh cá nhân (PII), chống rò rỉ secret/token và ranh giới quyền hạn.
- **`tasks/`**: Thư mục chuẩn bị sẵn cho các prompt chi tiết của từng tác vụ độc lập.
- **`tools/`**: Thư mục chuẩn bị sẵn cho các hướng dẫn gọi tool hoặc function calling.

### 2. `data/` — Quản lý Dữ liệu đầu vào
- **`raw/`**: Lưu trữ nguyên bản các tài liệu đặc tả nghiệp vụ gốc từ dự án để làm cơ sở đối chiếu nguồn sự thật:
  - `2026-08-08_nexcampus-task-spec_v01.md`: Đặc tả nghiệp vụ quản lý công việc và AI phân công.
  - `2026-08-08_nexcampus-weekly-evaluation-spec_v01.md`: Đặc tả đánh giá tuần 12 tiêu chí.
  - `2026-08-08_nexcampus-daily-report-spec_v01.md`: Đặc tả báo cáo hằng ngày.
- **`processed/`**: Dữ liệu có cấu trúc JSON đã được làm sạch, định nghĩa schema nghiêm ngặt:
  - `weekly-evaluation-12-criteria.json`: Bảng chi tiết 12 tiêu chí, 3 nhóm, trọng số, 5 mức xếp loại và logic xử lý khi thiếu dữ liệu (Zero Data Fallback).
  - `task-allocation-rules.json`: Bộ công thức tính điểm tương thích (Workload 30%, Skill 25%, Performance 25%, Learning 20%), hệ số tải Owner/Support và ngưỡng cảnh báo quá tải.

### 3. `agents/` — Quản lý AI Agent & Kỹ năng
- **`skills/`**: Sẵn sàng đón nhận các kỹ năng nghiệp vụ được đóng gói có cấu trúc (`skill.md`, `examples/`, `templates/`, `references/`).
- **`tools/`**: Sẵn sàng đón nhận các định nghĩa công cụ để Agent tương tác với DB, file Excel hoặc API.

### 4. `evals/` — Kiểm thử & Đánh giá Chất lượng
- **`scorecards/`**:
  - `ai-quality-scorecard-100.md`: Bảng chấm điểm 100 điểm với 5 tiêu chí (Độ chính xác 30đ, Đầy đủ 20đ, Đúng format 20đ, Rõ ràng 15đ, An toàn 15đ). Ngưỡng đạt: **>= 80/100 điểm**.
  - `task-allocation-rubric.md`: Bộ tiêu chí chấm điểm chuyên biệt cho phân công công việc (bắt buộc phát hiện HIGH risk khi tải >= 80%).
  - `weekly-evaluation-rubric.md`: Bộ tiêu chí chấm điểm chuyên biệt cho đánh giá tuần (đủ 12 tiêu chí, xử lý zero data).
- **`tests/`**:
  - `test-task-allocation-scenarios.json`: Các kịch bản kiểm thử quá tải, kèm cặp và phân bổ an toàn.
  - `test-weekly-evaluation-scenarios.json`: Các kịch bản kiểm thử TTS tích cực, tuần không có hoạt động và task bị từ chối.
- **`traces/`**:
  - `sample-execution-trace.json`: Mẫu ghi lại quá trình thực thi từ nạp prompt, gọi LLM, tính latency/token, validate Zod đến kết quả scorecard.

---

## 3. Mối liên hệ với `.agents/` của Repository
- Hệ thống `ai/` được thiết kế đồng bộ với triết lý quản trị tri thức trong `.agents/` của `NexCampus-v2-BE`:
  - Quy ước phân lớp nghiêm ngặt (`route -> validation -> controller -> service -> repository`).
  - Toàn bộ kết quả AI đầu ra đều được kiểm tra biên bằng Zod schema trước khi đưa vào luồng nghiệp vụ.
  - Quản lý version, prompt và scorecard như mã nguồn phần mềm, có thể theo dõi qua Git diff.
