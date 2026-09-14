# NEXCAMPUS — MODULE ĐÁNH GIÁ TUẦN (WEEKLY EVALUATION)

## MODULE NÀY LÀM GÌ?

Giúp Leader **đánh giá thực tập sinh theo tuần** dựa trên 12 tiêu chí chuẩn, có **trợ lý AI gợi ý điểm và nhận xét**, tính toán tổng điểm tự động, xuất báo cáo PDF và để TTS xem lại kết quả, **xác nhận đã đọc**. Đảm bảo việc đánh giá minh bạch, nhất quán giữa các leader, không ai bị bỏ sót.

> Lưu ý quan trọng về vai trò: **TTS không tự chấm điểm**. Đánh giá do Leader tạo; Intern chỉ xem kết quả và bấm "Đã xem đánh giá" để xác nhận.

---

## AI DÙNG VÀ LÀM ĐƯỢC GÌ?

| Vai trò | Được làm gì? |
|---------|-------------|
| **Leader** | Tạo đánh giá tuần cho từng TTS (chọn TTS, tuần, chấm 12 tiêu chí), dùng **AI gợi ý điểm + nhận xét**, điều chỉnh, lưu, xoá đánh giá, **Xuất PDF** báo cáo |
| **Intern** | Xem lịch sử đánh giá các tuần, điểm + xếp loại, nhận xét của leader, **biểu đồ tiến bộ**; bấm **"Đã xem đánh giá"** để xác nhận đã đọc |

---

## GIAO DIỆN CÓ NHỮNG GÌ? (MÔ TẢ TỪNG KHU VỰC)

### A) Trang danh sách — Leader

1. **Nút "Tạo Đánh Giá"** ở thanh tiêu đề.
2. **Bảng danh sách đánh giá** với các cột:
   - **Thực Tập Sinh** (họ tên + email) · **Tuần** · **Điểm & Xếp Loại** · **AI** (nhãn xanh "AI" nếu bài có nhận xét/gợi ý từ AI, ngược lại hiện "Chưa").
   - **Thao Tác**: **Xem**, **Xuất PDF**, **Xoá** (nút đỏ, có hộp thoại xác nhận).
   - Tự lọc theo đúng leader hiện tại, sắp xếp mới nhất trước, giới hạn 10 dòng/trang.
3. **Cửa sổ tạo đánh giá (modal)**:
   - Chọn **Thực Tập Sinh** (chỉ TTS đang hoạt động) + **Tuần Đánh Giá**.
   - Nút **"Nhận gợi ý từ AI"**: gọi AI, **tự điền sẵn điểm 12 tiêu chí + nhận xét** — các mức trùng với gợi ý AI được gắn nhãn nhỏ "AI" để Leader biết.
   - **12 bộ chọn mức điểm** (bấm 1 trong 5 mức).
   - Ô **Nhận xét** (tối đa 2000 ký tự) kèm link nhanh **"Dùng nhận xét của AI"** để chép vào.
   - **Thanh điểm tổng tự tính ngay** khi chấm (bốn nhóm con + tổng trung bình).
   - Nút **"Lưu Đánh Giá"**.

### B) Trang danh sách — Intern

1. **3 thẻ thống kê**: `Tuần gần nhất` · `Điểm trung bình` · `Đã xác nhận xem` (số bài đã đọc trên tổng số).
2. **Bảng "Lịch sử đánh giá"**: cột **Tuần · Điểm & Xếp Loại · Trạng thái** + nút **Xem** ở cột Chi tiết (chuyển sang trang chi tiết). Có phân trang.

### C) Trang chi tiết đánh giá (`.../weekly-evaluation/[id]`)

- **Đầu trang**: ảnh đại diện + tên + email TTS, tiêu đề **"Tuần {n}"**, badge **"12 tiêu chí"**. Leader còn có nút **"Xuất PDF"**.
- **Bảng Đánh Giá 12 Tiêu Chí**: điểm từng tiêu chí; tiêu chí Leader **điều chỉnh khác gợi ý AI** sẽ có badge "AI" cạnh bên để thấy "đã cân nhắc, không chấm bừa".
- **Nhận Xét Của Leader** (+ mục **"Nhận xét gốc từ AI"** chỉ hiện khi Leader đã chỉnh nhận xét — minh bạch phần gì là AI, phần gì là người).
- **Biểu Đồ Tiến Bộ**: diễn biến điểm 6 tuần gần nhất kèm xu hướng tăng/giảm.
- **Cột điểm tổng** (Leader): hiển thị **"Điểm thực tế"** cạnh **"AI đề xuất"** để so sánh.
- **Nút xác nhận (Intern):** nút **"Đã xem đánh giá"** — chỉ hiện trước khi intern đã xem; sau khi bấm sẽ đổi thành dòng "Đã xác nhận xem" kèm thời gian (xanh).

---

## 12 TIÊU CHÍ ĐÁNH GIÁ (THEO 3 NHÓM)

| Nhóm | Số tiêu chí | Chi tiết |
|------|:---:|----------|
| **I. Kỷ luật và tư chất** | 5 | Thực hiện nội quy của cơ quan · Thái độ làm việc · Năng lực tiếp thu · Khả năng vượt khó chịu áp lực · Giao tiếp và ứng xử |
| **II. Khả năng chuyên môn** | 5 | Kiến thức · Kỹ năng thực hành · Năng lực ngoại ngữ · Kỹ năng làm việc nhóm · Tính sáng tạo |
| **III. Kết quả thực hiện đề tài** | 2 | Thực hiện yêu cầu về nội dung · Thực hiện yêu cầu về tiến độ |

**Thang điểm mỗi tiêu chí** (5 mức):

| Mức | Tốt | Khá | Trung bình | Trung bình yếu | Yếu |
|-----|:---:|:---:|:---:|:---:|:---:|
| Điểm | 10 | 8 | 6 | 4 | 2 |

**Cách xếp loại tổng** (theo điểm trung bình 12 tiêu chí):

| Tổng điểm | Xếp loại |
|-----------|----------|
| ≥ 8.0 | Tốt |
| ≥ 6.5 | Khá |
| ≥ 5.0 | Trung bình |
| ≥ 3.5 | Trung bình yếu |
| dưới 3.5 | Yếu |

---

## THÔNG TIN CUNG CẤP CHO NGƯỜI DÙNG

- **Trạng thái đánh giá** (chỉ có 2 loại, dựa trên việc TTS đã đọc hay chưa):
  - **Đã xem** (xanh) — badge có dấu tích.
  - **Chưa xem** (vàng) — badge có đồng hồ, nhắc leader biết TTS chưa đọc.
- Điểm từng tiêu chí, điểm nhóm con, điểm trung bình, xếp loại, nhận xét, xu hướng 6 tuần — đầy đủ trên một trang.

---

## LỢI ÍCH / SỰ TIỆN LỢI

- **Tiết kiệm đáng kể thời gian cho Leader**: bấm một nút **"Nhận gợi ý từ AI"** là có điểm + nhận xét dựa trên tiến độ (báo cáo ngày, bài nộp) của TTS; leader chỉ xem lại và chỉnh nếu cần.
- **Tự tính điểm, không tính tay**: điểm nhóm con, tổng điểm, xếp loại hiện realtime trong khi chấm — không lo tính sai.
- **Minh bạch "phần AI – phần người"**: những tiêu chí được chỉnh sau gợi ý AI đều gắn nhãn; nhận xét gốc của AI được lưu riêng — buổi đánh giá nào cũng trung thực, giải trình được.
- **Công bằng + đúng quy trình**: chặn đánh giá **trùng tuần**, chỉ mở đánh giá tuần hiện tại vào đúng khung giờ quy định, tuần không vượt quá số tuần tối đa của TTS.
- **Thấy sự tiến bộ**: **Biểu đồ 6 tuần** cho cả Leader lẫn Intern nhìn thấy mình đang đi lên hay đi xuống.
- **Xác nhận đã đọc**: TTS bấm xác nhận → hệ thống ghi thời gian, tạo bằng chứng ai đã/chưa đọc nhận xét — tránh "tôi không biết bị đánh giá".
- **Xuất PDF** để chốt báo cáo tuần hoặc tổng kết thực tập.
- **Dashboard tổng quan**: 3 thẻ (tuần gần nhất, điểm TB, số bài đã xác nhận) giúp TTS kiểm soát tình hình của mình.

---

## CÁCH THAO TÁC TỪNG BƯỚC

### 1. Leader tạo đánh giá
1. Bấm **"Tạo Đánh Giá"** → chọn **Thực Tập Sinh** + **Tuần**.
2. (Khuyên dùng) Bấm **"Nhận gợi ý từ AI"** để điểm và nhận xét tự điền.
3. Xem lại từng tiêu chí → bấm chỉnh mức khác nếu cần; nhập / chỉnh **Nhận xét** (hoặc bấm "Dùng nhận xét của AI").
4. Kiểm tra thanh tổng điểm → bấm **"Lưu Đánh Giá"**.

### 2. Intern xem và xác nhận
1. Vào trang đánh giá → xem **Lịch sử đánh giá** → bấm **Xem** ở tuần muốn xem.
2. Đọc 12 tiêu chí + nhận xét của leader + **Biểu đồ tiến bộ**.
3. Bấm **"Đã xem đánh giá"** → hệ thống ghi nhận (trạng thái chuyển **Đã xem** + thời gian).

### 3. Xuất báo cáo / Tổng kết (Leader)
1. Trên bảng hoặc trang chi tiết → bấm **"Xuất PDF"** để tải báo cáo tuần.

---

## FLOW TỔNG QUAN (DIỄN RA NHƯ THẾ NÀO)

```
[1] Leader mở "Tạo Đánh Giá" → chọn TTS + tuần (hệ thống kiểm tra: tuần hợp lệ, chưa trùng)
        ↓
[2] AI gợi ý điểm + nhận xét → Leader giữ nguyên / điều chỉnh (có nhãn đánh dấu) → Lưu
        ↓
[3] TTS nhận đánh giá → xem chi tiết + biểu đồ tiến bộ → bấm "Đã xem đánh giá" (có thời gian)
        ↓
[4] Leader xuất PDF / theo dõi ai đã đọc · ai chưa qua trạng thái "Đã xem / Chưa xem"
```

---

## CÂU HỎI GIẢNG VIÊN CÓ THỂ HỎI (KÈM GỢI Ý TRẢ LỜI)

1. **Vì sao 12 tiêu chí lại chia 3 nhóm như vậy?**
   → Bám theo khung đánh giá thực tập chuẩn: **tư chất & kỷ luật** (nền tảng thái độ), **chuyên môn** (kiến thức, kỹ năng thực hành, ngoại ngữ…) và **kết quả đề tài** (bám mục tiêu nội dung + tiến độ). Cân bằng giữa "người ra sao" và "việc làm tới đâu".

2. **Vì sao lại cần "gợi ý AI" trong đánh giá? Làm sao đảm bảo công bằng?**
   → Gợi ý được sinh dựa trên dữ liệu thực tế (báo cáo ngày, bài nộp) giúp leader bớt thiên kiến và đỡ mất thời gian. Quan trọng là **mọi điều chỉnh của con người đều được đánh dấu** — điểm cuối luôn do Leader chốt, AI chỉ là trợ lý tham khảo.

3. **Leader bấm "Nhận gợi ý từ AI" — nếu ý kiến khác AI thì xử lý thế nào?**
   → Leader bấm chọn mức khác; hệ thống gắn nhãn "AI" lên giá trị gốc để biết đã có chỉnh sửa, và ở chi tiết hiển thị **"Điểm thực tế" cạnh "AI đề xuất"** cùng "nhận xét gốc từ AI" (khi leader đã sửa) — mọi quyết định rất minh bạch, giải trình được.

4. **Làm sao chống đánh giá sai tuần hoặc đánh giá trùng?**
   → Hệ thống tự tính số tuần tối đa từ ngày bắt đầu của TTS, mở cửa đánh giá tuần hiện tại đúng khung giờ quy định (từ Thứ Bảy 11:00 sáng đến Chủ Nhật, theo múi giờ Việt Nam), và **chặn tạo trùng tuần cho cùng một TTS**.

5. **Vì sao Intern không tự đánh giá, mà chỉ xác nhận đã đọc?**
   → Vai trò Leader là người quản lý trực tiếp — đáng tin cậy hơn tự chấm. Việc TTS **xác nhận đã đọc** (kèm thời gian) tạo bằng chứng minh bạch, tránh tranh cãi "không được thông báo". Đây là thiết kế có chủ đích, không phải thiếu sót.

6. **"Điểm trung bình" ở thẻ thống kê của intern được tính từ đâu?**
   → Tính từ tổng điểm các bài đánh giá đã có của TTS; ba thẻ (Tuần gần nhất / Điểm trung bình / Đã xác nhận xem) cho cái nhìn nhanh về kết quả và độ cập nhật.

7. **Biểu đồ tiến bộ hiển thị gì?**
   → Xu hướng điểm 6 tuần gần nhất kèm chỉ báo tăng/giảm, để Leader nắm rõ TTS đang tiến bộ hay thụt lùi mà kịp thời điều chỉnh nhiệm vụ.

8. **Có ai ngoài Leader tạo được đánh giá không? Trạng thái "duyệt" có hay không?**
   → Chỉ Leader (leader phụ trách TTS) tạo được đánh giá. Hiện **không có workflow duyệt cấp trên** — trạng thái chỉ là *Đã xem / Chưa xem* của TTS. *(Đây có thể là điểm giảng viên hỏi sâu: nếu cần thêm tầng quản lý duyệt, hệ thống đã chuẩn bị sẵn nền tảng để mở rộng.)*

---

*Tài liệu mô tả giao diện người dùng module Weekly Evaluation của hệ thống NexCampus.*