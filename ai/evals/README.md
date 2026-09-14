# Thư mục `ai/evals/` — Kiểm Thử & Đánh Giá Chất Lượng AI

Một hệ thống AI không thể và không nên được đánh giá chỉ bằng cảm tính hay kiểm tra thủ công vài lần. Thư mục `evals/` thiết lập hệ thống bằng chứng thực nghiệm (empirical evidence) để chứng minh AI hoạt động chính xác, an toàn và ổn định.

## Cấu trúc thư mục

```text
evals/
├── tests/           # Kịch bản kiểm thử (test cases) theo từng module
├── traces/          # Nhật ký thực thi chi tiết (bước gọi, latency, token, lỗi)
└── scorecards/      # Tiêu chí và thang điểm đánh giá chất lượng (100 điểm)
```

## 1. `scorecards/`
- **`ai-quality-scorecard-100.md`**: Thang điểm 100 tổng quát đánh giá 5 khía cạnh cốt lõi:
  1. Độ chính xác & Trích dẫn thực tế (30đ)
  2. Đầy đủ nội dung (20đ)
  3. Tuân thủ định dạng & Schema (20đ)
  4. Rõ ràng, tích cực & Có tính xây dựng (15đ)
  5. An toàn, bảo mật & Tuân thủ vai trò (15đ)
  - **Ngưỡng chấp thuận**: Tối thiểu **>= 80/100 điểm** mới được đưa vào sử dụng thực tế.
- **`task-allocation-rubric.md`**: Tiêu chuẩn riêng về nhận diện quá tải (HIGH risk khi workload >= 80%), cơ hội kèm cặp.
- **`weekly-evaluation-rubric.md`**: Tiêu chuẩn riêng về 12 tiêu chí, 5 mức xếp loại (`TOT`, `KHA`, `TB`, `TBY`, `YEU`) và zero data fallback.

## 2. `tests/`
- **`test-task-allocation-scenarios.json`**: Bộ kịch bản kiểm tra khả năng phát hiện quá tải, ghép cặp Senior-Junior, và tính logic trong đề xuất.
- **`test-weekly-evaluation-scenarios.json`**: Bộ kịch bản kiểm tra đánh giá TTS tích cực, xử lý tuần hoàn toàn thiếu dữ liệu, và đánh giá TTS gặp lỗi/blocker.

## 3. `traces/`
- **`sample-execution-trace.json`**: Mẫu bản ghi trace thực thi, ghi nhận:
  - Input & Context nạp vào.
  - Số lượng token tiêu thụ, thời gian phản hồi (latency ms).
  - Lỗi phát sinh (nếu có) và kết quả validate qua Zod.
  - Kết quả đối chiếu với Scorecard (Điểm số và trạng thái PASS/FAIL).

## Nguyên tắc cốt lõi
> **Prompt là hướng dẫn, Dữ liệu là nguyên liệu, Agent là người thực hiện, còn Đánh giá là bằng chứng cho thấy hệ thống thực sự hoạt động.**
