# Tiêu Chí Đánh Giá Chuyên Biệt: Phân Bổ Công Việc (Task Allocation Rubric)

Tài liệu này áp dụng để đánh giá chất lượng đầu ra của `TaskAllocationAiService`.

## Trọng Tâm Đánh Giá Cốt Lõi

1. **Nhận diện Rủi ro Quá tải (`riskLevel`)**:
   - Nếu ứng viên có `activeTaskDays + task.estDays >= 0.8 * maxWorkloadDays`: BẮT BUỘC xếp loại `HIGH`.
   - Nếu AI xếp loại `LOW` hoặc `MEDIUM` trong tình huống này → **Trừ 25 điểm** tại mục Độ chính xác.

2. **Tính logic của Đề xuất Owner & Support**:
   - Người được chọn làm Owner phải là người có điểm tương thích cao nhất hoặc có sự lý giải thuyết phục về sự cân bằng workload.
   - Khi Owner là ứng viên mới/kỹ năng thấp hơn, ứng viên Support được đề xuất phải là người có kinh nghiệm hoặc kỹ năng cao để đóng vai trò Mentor.

3. **Phân tích Workload & Cơ hội học tập**:
   - `workloadAnalysis`: Phải phản ánh đúng số ngày còn trống thực tế.
   - `learningOpportunity`: Phải chỉ ra giá trị chuyên môn mà task mang lại cho nhân sự tham gia.

4. **Tuân thủ Schema**:
   - Khóa bắt buộc: `recommendedOwnerId`, `recommendedSupportId`, `reasons`, `riskLevel`, `workloadAnalysis`, `learningOpportunity`.
   - `riskLevel` chỉ được phép là 1 trong 3 giá trị: `"LOW"`, `"MEDIUM"`, `"HIGH"`.
