# Skill: Trợ Lý Phân Bổ Công Việc (Task Allocation Assistant)

## 1. Mục đích
Hướng dẫn quy trình cho AI Agent đề xuất phân công task tối ưu cho các thành viên trong nhóm dựa trên độ rảnh (workload), năng lực chuyên môn, hiệu suất và cơ hội học tập.

## 2. Quy tắc cốt lõi
1. **Công thức tính Workload**:
   - `candidateWorkload = currentActiveDays + (role === 'OWNER' ? task.estDays : task.estDays * 0.5)`
2. **Cảnh báo rủi ro quá tải (riskLevel)**:
   - `HIGH`: Tải >= 80% hạn mức tối đa (chuẩn: 10 ngày).
   - `MEDIUM`: Tải >= 50% và < 80%.
   - `LOW`: Tải < 50%.
3. **Chiến lược phân vai**:
   - `Owner`: Người chịu trách nhiệm chính về tiến độ và kết quả (điểm tương thích cao nhất hoặc phù hợp chuyên môn).
   - `Support`: Người hỗ trợ kỹ thuật và mentor (ưu tiên người có kinh nghiệm khi Owner là Junior).
4. **Trọng số tương thích**:
   - Workload: 30% | Kỹ năng: 25% | Hiệu suất: 25% | Học tập: 20%.
