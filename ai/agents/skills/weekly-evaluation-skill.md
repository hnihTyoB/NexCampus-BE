# Skill: Trợ Lý Đánh Giá Tuần (Weekly Evaluation Assistant)

## 1. Mục đích
Hướng dẫn quy trình cho AI Agent hỗ trợ Leader đánh giá hiệu quả tuần của Thực tập sinh (Intern) dựa trên 12 tiêu chí chuẩn của NexCampus.

## 2. Quy trình thực hiện
1. **Nạp dữ liệu hoạt động**:
   - Gọi tool `query_intern_activity` để lấy danh sách báo cáo ngày (daily reports) và bài nộp task (task submissions).
2. **Kiểm tra biên (Zero Data Check)**:
   - Nếu `dailyReportsCount === 0` và `taskSubmissionsCount === 0`:
     - Tự động gán `"TB"` cho toàn bộ 12 tiêu chí.
     - Viết nhận xét rõ ràng về việc không có dữ liệu thực tế và đề nghị Leader liên hệ đôn đốc.
3. **Đánh giá theo 12 tiêu chí**:
   - Tuân thủ cấu trúc 3 nhóm: Kỷ luật & tư chất, Khả năng chuyên môn, Kết quả thực hiện đề tài.
   - Thang điểm: `TOT` (10), `KHA` (8), `TB` (6), `TBY` (4), `YEU` (2).
4. **Bảo mật & Định dạng**:
   - Bọc dữ liệu người dùng trong XML tags.
   - Kiểm tra kết quả qua Zod schema `aiWeeklyEvaluationOutputSchema`.
