# NEXCAMPUS — MODULE BÁO CÁO HẰNG NGÀY (DAILY REPORT)

## MODULE NÀY LÀM GÌ?

Giúp thực tập sinh (TTS) **nộp báo cáo tiến độ mỗi ngày** (kèm link PR, video demo, tệp đính kèm) và giúp Leader **theo dõi toàn bộ team** xem hôm nay ai đã nộp, ai còn thiếu, tỉ lệ nộp trong tuần ra sao — tất cả gom trên một màn hình có **lịch trực quan** và **thống kê tự động**.

---

## AI DÙNG VÀ LÀM ĐƯỢC GÌ?

| Vai trò         | Được làm gì?                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Intern** | Tạo hoặc chỉnh sửa báo cáo hằng ngày (nội dung, link PR, video demo, tệp đính kèm), xem lại lịch sử qua lịch, theo dõi số ngày thiếu của mình |
| **Leader** | Xem danh sách TTS của mình, tỉ lệ nộp hôm nay / trong tuần, mở lịch từng TTS để xem báo cáo từng ngày                                               |

> Leader có vai trò **giám sát** (xem & đối chiếu), không phê duyệt — báo cáo ngày không qua bước duyệt giấy tờ.

---

## GIAO DIỆN CÓ NHỮNG GÌ? (MÔ TẢ TỪNG KHU VỰC)

### A) Trang "Báo Cáo Hằng Ngày" — dành cho Intern

1. **Thanh tiêu đề**: **"Báo Cáo Hằng Ngày"** + nút **động**:
   - Hôm nay **chưa nộp** → nút **"Tạo Báo Cáo Hằng Ngày"**.
   - Hôm nay **đã nộp** → nút tự đổi thành **"Chỉnh Sửa Báo Cáo"** (không tạo trùng 2 báo cáo/ngày).
2. **Thẻ thống kê**: `Ngày Làm Việc` (từ ngày vào đến nay, trừ Chủ nhật) · `Đã Báo Cáo` · `Thiếu` (ngày chưa nộp) · `Tỉ lệ nộp X%`.
3. **Biểu đồ tròn (donut) "Thống Kê Nộp Báo Cáo"**: phần trăm báo cáo vs thiếu, con số `%` ở giữa.
4. **Thẻ "Tuần Này"**: `Thứ 2 – Hôm nay`, con số `X / Y ngày` kèm **thanh tiến độ "Hoàn thành X%"** — biết ngay tuần này mình có kịp tiến độ không.
5. **Lịch theo tháng** (cột trái): mỗi ô ngày tô màu theo trạng thái:
   - Ngày **đã báo cáo**: xanh nhạt + chấm tròn.
   - Ngày **thiếu**: đỏ.
   - Ngoài khoảng thực tập: khoá (không chọn được).
   - Hôm nay: viền nổi bật; ngày đang chọn: viền xanh.
6. **Cột chi tiết** (mở một ngày): hiện **Nội dung**, **Liên kết PR** (mở tab mới), **Video Demo** (nút "Xem Video"), **Tệp đính kèm (N)** (tải về). Nếu ngày chưa nộp → màn "Thiếu Báo Cáo Hằng Ngày". Nút **"Chỉnh sửa"**.

### B) Cửa sổ tạo / sửa báo cáo

- **Nội Dung Báo Cáo**: ô nhập lớn, bắt buộc, gợi ý "Mô tả những gì bạn đã làm hôm nay...".
- **Liên Kết PR**: đường dẫn (URL).
- **Video Demo**: **dán link** HOẶC **tải file** (MP4/WEBM/MOV/MKV/AVI ≤ 50MB).
- **Tệp Đính Kèm**: tối đa 5 file (ảnh, PDF, DOC/DOCX, ZIP/RAR/7z; mỗi file ≤ 10MB).
- Tệp tải lên kho đám mây (R2) qua link ký sẵn; khi sửa, tệp cũ tải/xoá được, tệp mới gắn nhãn "(mới)". Xoá báo cáo có hộp thoại xác nhận **"Hành động này không thể hoàn tác."**

### C) Trang "Báo Cáo Hằng Ngày" — dành cho Leader

1. **Thanh tiêu đề**: tên trang + tên TTS đang xem (`Họ tên — Phòng ban`).
2. **4 thẻ thống kê**:
   - `Tổng thực tập sinh` ("Được giao cho bạn").
   - `Đã nộp hôm nay` + phần trăm.
   - `Chưa nộp hôm nay`.
   - `Tỉ lệ trong tuần` ("X ngày làm việc tuần này").
3. **3 cột**: trái = **danh sách TTS của mình** (bấm chọn để lọc) → giữa = **lịch của TTS đó** → phải = **chi tiết báo cáo của ngày đã chọn** (chế độ chỉ xem).
4. Trạng thái chọn được lưu vào **đường dẫn URL** (deep-link) — tải lại trang hoặc nút quay lại vẫn giữ nguyên nội dung đang xem.

---

## THÔNG TIN CUNG CẤP CHO NGƯỜI DÙNG

- Báo cáo của mỗi ngày: **nội dung + link PR + video demo + danh sách tệp + thời điểm nộp**.
- Trạng thái nộp chỉ có **2 loại nhị phân** hiển thị trên lịch: ✔ **đã nộp** (xanh) hoặc **thiếu** (đỏ) — Chủ nhật và ngày tương lai không tính.
- Số liệu tổng hợp: số ngày làm việc, số ngày thiếu, tỉ lệ nộp cả quá trình, tuần này và hôm nay.

---

## LỢI ÍCH / SỰ TIỆN LỢI

- **Không bao giờ bỏ sót ngày**: lịch tô đỏ ngày thiếu ngay lập tức; nút "Tạo / Chỉnh sửa" tự đổi theo trạng thái hôm nay — không thể nhầm nộp trùng hoặc quên.
- **Leader nhìn cả team trong 5 giây**: 4 thẻ thống kê trả lời "hôm nay ai nộp? ai thiếu? tuần này đạt %?", bấm từng TTS là soi lịch + nội dung báo cáo.
- **Nộp báo cáo đầy đủ minh chứng**: PR, video demo, tài liệu gom vào một chỗ — Leader tải về đọc không cần hỏi link.
- **Mọi thứ tự động**: tính phần trăm, đếm ngày thiếu, invalid dữ liệu trước khi gửi (đuôi file, dung lượng).
- **Không mất vị trí đang xem**: deep-link bằng URL giữ nguyên TTS + ngày khi tải lại trang.

---

## CÁCH THAO TÁC TỪNG BƯỚC

### 1. Intern nộp báo cáo

1. Mở trang Báo Cáo Hằng Ngày → bấm **"Tạo Báo Cáo Hằng Ngày"**.
2. Nhập **nội dung** → dán **link PR**, tải **video demo / tệp đính kèm** (nếu có).
3. Bấm **"Nộp"**. Hôm sau thấy ngày này tô xanh trên lịch.

### 2. Intern sửa / bổ sung

1. Bấm **"Chỉnh Sửa Báo Cáo"** → sửa nội dung, thay link, thêm/gỡ tệp.
2. Bấm **"Cập Nhật"**.
3. Muốn xoá hẳn: nút **"Xoá"** → xác nhận trong hộp thoại.

### 3. Leader theo dõi team

1. Mở trang Báo Cáo Hằng Ngày → xem 4 thẻ thống kê.
2. Bấm tên một TTS ở cột trái.
3. Bấm ngày trên lịch → đọc nội dung + mở PR/video/tệp bên cột phải.

---

## FLOW TỔNG QUAN (DIỄN RA NHƯ THẾ NÀO)

```
[1] Mỗi ngày làm việc, Intern mở trang → bấm "Tạo Báo Cáo Hằng Ngày"
        ↓
[2] Nhập nội dung + PR/Video/Tệp → Nộp (lưu lên hệ thống, gắn đúng ngày)
        ↓
[3] Hệ thống tự tính: lịch (xanh/đỏ), tỉ lệ nộp ngày – tuần – cả kỳ
        ↓
[4] Leader mở trang → thấy thống kê cả team → soi từng TTS từng ngày
```

---

## CÂU HỎI GIẢNG VIÊN CÓ THỂ HỎI (KÈM GỢI Ý TRẢ LỜI)

1. **Vì sao báo cáo ngày không có trạng thái "duyệt / từ chối" như task?**
   → Thiết kế có chủ đích: báo cáo ngày phục vụ *minh bạch và đối chiếu tiến độ*, không phải *bài nộp sản phẩm cần duyệt* (việc đó nằm ở module Task). Leader chỉ cần thấy đã nộp hay thiếu là đủ để nhắc việc; giảm tải hành chính cho cả hai phía.
2. **Làm sao biết một ngày có báo cáo hay không khi báo cáo không có trường "ngày"?**
   → Báo cáo được đánh dấu theo thời điểm nộp (createdAt). Đây là điểm cần nói rõ trong phản biện: ngày báo cáo hiện gắn với lúc nộp, nên nếu nộp sát nửa đêm có thể lệch ngày hiển thị 1 ngày — một hướng mở rộng là thêm trường "ngày báo cáo" tách khỏi thời điểm nộp.
3. **Khi team có hơn 100 báo cáo trong một ngày thì thống kê có đúng không?**
   → Hiện một số truy vấn lấy tối đa 100 bản rồi tính trên client, nên trong trường hợp vượt ngưỡng số liệu có thể thiếu. Trả lời hướng khắc phục: đưa phép đếm/tổng hợp xuống phía server, bỏ giới hạn cố định.
4. **Leader có nhận xét được lên báo cáo của TTS không?**
5. → Hiện chỉ xem (read-only). Nếu cần phản hồi chi tiết, nên mở rộng thêm luồng nhận xét 2 chiều — phần này có thể ghép với module Task vốn đã có đánh giá bài nộp.
6. **Chủ nhật có bị tính vào ngày làm việc không?**
   → Không. Thống kê tự loại trừ Chủ nhật khỏi số ngày làm việc, ngày tương lai cũng không tính — đảm bảo con số "thiếu" không bị phóng đại.
7. **Việc đổi ngôn ngữ lịch có đúng tiếng Việt không?**
   → (Điểm cần lưu ý khi demo) Một phần nhãn lịch (tên ngày, tháng) hiện để cứng tiếng Anh trong khi phần còn lại của app tiếng Việt. Có thể nêu đây là điểm tinh chỉnh i18n còn dang dở và hướng hoàn thiện.

---

*Tài liệu mô tả giao diện người dùng module Daily Report của hệ thống NexCampus.*
