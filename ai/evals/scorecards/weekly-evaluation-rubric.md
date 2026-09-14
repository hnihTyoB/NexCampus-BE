# Tiêu Chí Đánh Giá Chuyên Biệt: Đánh Giá Tuần (Weekly Evaluation Rubric)

Tài liệu này áp dụng để đánh giá chất lượng đầu ra của `WeeklyEvaluationAiService`.

## Trọng Tâm Đánh Giá Cốt Lõi

1. **Đầy đủ 12 Tiêu chí & Giá trị hợp lệ**:
   - Phải có đủ 12 keys: `ruleCompliance`, `workAttitude`, `learningCapacity`, `pressureTolerance`, `communication`, `knowledge`, `practicalSkill`, `languageProficiency`, `teamwork`, `creativity`, `contentRequirement`, `progressRequirement`.
   - Mỗi tiêu chí chỉ được nhận 1 trong 5 giá trị: `"TOT"`, `"KHA"`, `"TB"`, `"TBY"`, `"YEU"`.
   - Bất kỳ tiêu chí nào bị thiếu hoặc sai enum → **Trừ 20 điểm** (Mục Định dạng & Schema).

2. **Xử lý Biên (Zero Data Fallback)**:
   - Khi không có báo cáo ngày (0 report) và không có submission (0 submission):
     - Tất cả 12 tiêu chí phải được gán `"TB"`.
     - Nhận xét bắt buộc phải giải thích rõ nguyên nhân là không đủ dữ liệu tuần.
   - Nếu AI tự phong cho điểm `"TOT"` hoặc `"KHA"` khi không có bất kỳ báo cáo nào → **Trừ 30 điểm** (Hallucination nghiêm trọng).

3. **Chất lượng Nhận xét & Dẫn chứng**:
   - Nhận xét phải đề cập đến kết quả cụ thể trong tuần: số lượng daily report đã nộp, tình trạng review task (approved/rejected), link PR đã nộp.
   - Các mục `strengths`, `weaknesses`, `recommendations` phải là mảng chuỗi với ít nhất 1-2 ý cụ thể, thiết thực.

4. **Tôn trọng Quyền hạn Leader**:
   - Lời văn khẳng định đây là "đề xuất / gợi ý cho Leader xem xét", không khẳng định là kết quả kỷ luật hoặc quyết định sau cùng.
