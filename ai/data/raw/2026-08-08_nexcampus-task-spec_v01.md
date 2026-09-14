# NEXCAMPUS — MODULE QUẢN LÝ CÔNG VIỆC (TASK)

## MODULE NÀY LÀM GÌ?

Nơi Leader **phân công công việc** cho thực tập sinh và Intern **thực hiện – nộp bài – nhận đánh giá** trên cùng một hệ thống. Từ tạo việc, giao việc, theo dõi tiến độ (kể cả nhập hàng loạt bằng Excel và gợi ý phân công bằng AI) đến chấm bài nộp — tất cả đều có trên giao diện trực quan, không cần qua email hay bảng tính rời rạc.

---

## AI DÙNG VÀ LÀM ĐƯỢC GÌ?

| Vai trò | Được làm gì? |
|---------|-------------|
| **Leader** | Tạo / chỉnh sửa / xoá công việc, **nhập hàng loạt bằng Excel**, lập **nhóm công việc**, giao việc trực tiếp cho TTS, **AI phân công**, xem tổng quan tiến độ, đánh giá bài nộp (**Duyệt / Yêu cầu làm lại**), mở lại việc bị kẹt |
| **Intern** | Xem việc được giao, lọc theo hạn, **Bắt đầu làm**, **Nộp bài** (kèm link PR, video demo, tài liệu), hoặc **Báo bị chặn** khi vướng mắc |

---

## GIAO DIỆN CÓ NHỮNG GÌ? (MÔ TẢ TỪNG KHU VỰC)

### A) Trang "Công Việc Của Tôi" — dành cho Intern

1. **Thanh tiêu đề**: **"Công Việc Của Tôi"**.
2. **Bộ lọc thời gian**: `Tất cả · Tuần này · Tháng này · Tuỳ chỉnh` (chọn khoảng ngày). Toàn bộ thống kê và danh sách tự cập nhật theo khoảng đã chọn.
3. **5 ô thống kê**: `Tổng Công Việc · Đang Làm · Quá Hạn · Hoàn Thành · Tỉ Lệ Hoàn Thành (%)` — biết ngay hôm nay mình đang khá hay đang nợ việc.
4. **Bảng danh sách – chi tiết (Master-Detail)**: cột trái là **Danh Sách Công Việc** (mỗi dòng kèm tổng số đơn vị `[Tổng: n ĐƠN VỊ]` — hỗ trợ theo dõi khối lượng theo đầu việc); bấm chọn một việc thì **cột phải hiện ngay chi tiết** đầy đủ.
5. **Các nút hành động theo trạng thái**:
   - Việc mới (TODO): nút **"Bắt Đầu Làm"**.
   - Đang làm (IN_PROGRESS): nút **"Nộp Bài"** và **"Báo Bị Chặn"**.
6. **Cửa sổ nộp bài**: điền **Liên Kết PR** và/hoặc **Video Demo** (link hoặc tải file MP4/WEBM/MOV/MKV/AVI), **Tài liệu đính kèm**, **Ghi Chú**. Có chế độ **Xem / Sửa / Nộp** — bài nộp mới nhất còn chờ đánh giá thì sửa được.

### B) Trang "Công việc" — dành cho Leader

1. **Thanh tiêu đề** với 3 nút chính: **"Nhập công việc"** (Excel), **"Tạo công việc"**, **"Tạo nhóm"**.
2. **6 ô thống kê bấm được**: `Tổng công việc · Tổng nhóm · Hoàn thành · Đang làm · Quá hạn · Ưu tiên cao` — bấm vào ô nào thì mở ngay danh sách tương ứng. Có preset `Tuần này / Tháng này / Tuỳ chỉnh`.
3. **Panel "Chờ đánh giá"**: đếm số bài nộp đang chờ; bấm vào là mở danh sách review.
4. **Bộ lọc đa chiều**: tìm theo **Mã / Tiêu đề / Người làm / Giai đoạn** + dropdown **Trạng thái** + dropdown **Sắp xếp** (8 kiểu: mới–cũ, A–Z, hạn chót, ưu tiên…) + khoảng **Hạn chót**.
5. **Sidebar "Nhóm công việc"**: nhóm các việc theo chủ đề/đợt; bấm là lọc theo nhóm; menu `⋯` để **Xem / Sửa / Xoá** nhóm.
6. **Bảng công việc**:
   - Cột **Người làm (Owner)** là **ô giao việc inline** — bấm chọn TTS trong nhóm của mình hoặc nhập email TTS nhóm khác là giao ngay, không cần mở modal. Nếu việc đã quá hạn, hiển thị "**Hết hạn**" thay cho ô giao việc.
   - Cột **Trạng thái** là nhãn màu; bài ở trạng thái `Đánh giá (REVIEW)` **bấm vào được** để mở màn hình chấm bài.
   - Menu `⋯` mỗi dòng: **AI Phân công / Xem / Sửa / Xoá**.
   - Phân trang.
7. **Cửa sổ tạo công việc — 3 bước**:
   - **Bước 1**: Tiêu đề*, Mã việc* (VD `BE1-01`), Ưu tiên (`P0 – Cao / P1 – Trung bình / P2 – Thấp`), Nhóm công việc.
   - **Bước 2**: Ngày bắt đầu, Ngày dự kiến*, Hạn chót*, Giai đoạn, Module, **Mô tả**, **Tiêu chí chấp nhận**, **Ghi chú**. Có **cảnh báo rủi ro lịch** tự động nếu ước lượng thời gian dài hơn số ngày làm việc.
   - **Bước 3**: **Tệp đính kèm** (đa file, hiện trạng thái đang tải / thành công / lỗi; thêm link URL) + **"Assign to Intern"**: `None / Nhóm của tôi / Nhóm khác` (nhập chính xác email TTS, hệ thống hiện leader phụ trách để xác nhận).
8. **Cửa sổ sửa công việc**: đầy đủ trường như trên + đổi người giao, **"Gỡ"** người đang nhận, xoá tệp đã có; khoá thao tác nếu việc đã **Hoàn thành**.

### C) Trang chi tiết công việc (Leader — `/leader/tasks/[id]`)

Hiện đầy đủ thông tin của một việc:
- **Mã / Độ ưu tiên / Trạng thái** (badge trên đầu), nút **"AI Phân công"** khi chưa giao người.
- **Mô tả & Yêu cầu**: Mô tả chi tiết, **Tiêu chí chấp nhận**, Ghi chú quan trọng.
- **Quan hệ & Phụ thuộc**: việc phụ thuộc vào việc nào, tạo lại từ việc nào.
- **Tệp đính kèm**: mở được trong tab mới, có icon theo loại file và dung lượng.
- **Tiến độ & Thời gian**: Hạn chót, Ngày bắt đầu, Ngày dự kiến, Giai đoạn, Module.
- **Chi tiết phân công**: Người làm, Người hỗ trợ, Ngày giao, Cập nhật cuối; nếu việc bị **Bị chặn (BLOCKED)** thì hiện **lý do** + nút **"Mở Lại Công Việc"**.
- **Lịch sử nộp bài**: từng lần nộp kèm **"Đánh giá của Leader"**, trạng thái duyệt, nhận xét.

---

## THÔNG TIN CUNG CẤP CHO NGƯỜI DÙNG

- **Trạng thái công việc** — 7 loại, hiện bằng nhãn màu:

  | Trạng thái | Ý nghĩa | Màu |
  |-----------|---------|-----|
  | TODO | Cần làm | Xám |
  | IN_PROGRESS | Đang làm | Xanh dương |
  | REVIEW | Đang chờ đánh giá | Tím (bấm được ở Leader) |
  | DONE | Hoàn thành | Xanh lục |
  | BLOCKED | Bị chặn (cần leader xử lý) | Đỏ |
  | PENDING_APPROVAL | Chờ phê duyệt | Vàng |
  | UNASSIGNED | Chưa giao ai | Cam |

- **Ưu tiên**: High (đỏ) / Medium (cam) / Low (xanh lá) — badge trên từng việc.
- Các con số khi nào cần: thẻ thống kê, tỉ lệ hoàn thành, việc quá hạn, panel chờ đánh giá.

---

## LỢI ÍCH / SỰ TIỆN LỢI

- **Giao việc nhanh chóng**: gõ ngay trong bảng (inline), không cần mở modal; hoặc dùng **AI phân công** đề xuất TTS phù hợp (đủ năng lực, không quá tải) — kể cả phân công theo nhóm.
- **Nhập hàng loạt bằng Excel**: tải template, điền nhiều việc, xem trước rồi chạy — tiết kiệm thời gian so với gõ tay từng cái.
- **Tìm kiếm mạnh**: mã, tên, người làm, giai đoạn, trạng thái, hạn chót, sắp xếp 8 kiểu — danh sách trăm việc vẫn tìm ra trong giây lát.
- **"Một màn hình biết hết"**: 6 ô thống kê + panel chờ đánh giá cho Leader cái nhìn cả team.
- **Quy trình nộp – chấm rõ ràng**: intern nộp (PR + video demo + tài liệu), leader **Duyệt** hoặc **Yêu cầu làm lại** — mọi thứ có lịch sử, không ai nói "làm xong rồi mà".
- **Xử lý kẹt việc nhanh**: intern báo lý do bị chặn, leader thấy ngay và **Mở Lại Công Việc**.
- **Cảnh báo rủi ro lịch** trước khi lưu: ước lượng không khớp ngày làm việc thực tế.
- **Khối lượng theo đơn vị** (`[Tổng: n ĐƠN VỊ]`) giúp lượng hoá công việc cho cả người giao và người làm.

---

## CÁCH THAO TÁC TỪNG BƯỚC

### 1. Leader tạo + giao công việc
1. Bấm **"Tạo công việc"** → điền thông tin qua 3 bước → gán **Assign to Intern** → **Lưu**.
   *(Hoặc bấm **"Nhập công việc"** để đưa nhiều việc từ file Excel; hoặc **"Tạo nhóm"** trước rồi thêm việc vào nhóm.)*
2. Giao lại nhanh: tìm dòng việc trong bảng → bấm ô **Người làm** → chọn TTS / nhập email.
3. Muốn hệ thống gợi ý: bấm **AI Phân công** trên dòng hoặc trong trang chi tiết.

### 2. Intern thực hiện công việc
1. Vào **"Công Việc Của Tôi"** → chọn việc → bấm **"Bắt Đầu Làm"**.
2. Làm xong → **"Nộp Bài"**: dán link PR, tải video demo / tài liệu, ghi chú → **Nộp**.
3. Vướng mắc không làm được → **"Báo Bị Chặn"** + ghi lý do; Leader sẽ xử lý.

### 3. Leader đánh giá bài nộp
1. Vào panel **"Chờ đánh giá"** (hoặc bấm badge `REVIEW` trong bảng).
2. Xem bài nộp mới nhất + chi tiết việc → nhập **nhận xét**.
3. Bấm **Approve** → việc chuyển **Hoàn thành**; hoặc **Request Rework** → intern nhận yêu cầu và sửa lại.
4. Nếu việc bị chặn: vào trang chi tiết → xem lý do → **"Mở Lại Công Việc"**.

---

## FLOW TỔNG QUAN (DIỄN RA NHƯ THẾ NÀO)

```
[1] Leader tạo / nhập Excel / tạo nhóm → giao công việc cho Intern (kèm AI hỗ trợ)
        ↓
[2] Intern: Bắt Đầu Làm → thực hiện → Nộp bài (PR + video + tài liệu)
        ↕ (nếu vướng: Báo Bị Chặn → Leader Mở Lại)
[3] Leader: Đánh giá → Approve (Hoàn thành)  /  Request Rework (Intern sửa lại)
        ↓
[4] Việc Hoàn thành → thống kê, báo cáo cập nhật tự động
```

---

## CÂU HỎI GIẢNG VIÊN CÓ THỂ HỎI (KÈM GỢI Ý TRẢ LỜI)

1. **Vì sao thiết kế màn hình intern theo dạng "danh sách bên trái – chi tiết bên phải"?**
   → Giảm số lần chuyển trang: chọn việc nào thấy việc đó ngay, không mất ngữ cảnh; phù hợp với tần suất thao tác cao (mở/xem nhiều việc liên tiếp) của TTS.

2. **Quy trình "Bị chặn (BLOCKED)" xử lý ra sao?**
   → Intern báo chặn kèm lý do bắt buộc → trạng thái việc chuyển BLOCKED, Leader thấy lý do ở trang chi tiết → bấm **"Mở Lại Công Việc"** để intern tiếp tục. Có kiểm tra tính hợp lệ (người được giao / Leader phụ trách mới thao tác được).

3. **"AI Phân công" dựa trên tiêu chí gì để chọn người?**
   → Hệ thống đề xuất TTS dựa trên khả năng phù hợp và **kiểm tra tải (capacity)**: tránh giao quá nhiều việc cho một người, đề xuất người chưa quá tải — sau đó Leader vẫn hoàn toàn chủ động điều chỉnh trước khi chốt.

4. **Nộp bài cho phép dạng gì? Có bị ép chọn cả PR lẫn video không?**
   → Link **PR** và **Video demo** là hai tuỳ chọn **"hoặc"** (có thể chỉ cần 1 trong 2), video chấp nhận các định dạng MP4/WEBM/MOV/MKV/AVI, dung lượng theo cấu hình hệ thống; kèm tài liệu và ghi chú.

5. **Làm sao ngăn Leader sửa bài đã hoàn thành?**
   → Các trường khoá khi trạng thái là **Hoàn thành (DONE)** — bảo toàn dữ liệu đã chốt, mọi thay đổi cần lịch sử rõ ràng.

6. **"Yêu cầu làm lại" (Request Rework) tác động gì tới trạng thái?**
   → Bài nộp không được duyệt sẽ đưa về trạng thái cần làm lại, intern sửa và nộp lại; Leader xem lịch sử nộp bài để đối chiếu từng phiên bản, tránh tranh cãi về "ai nộp cái gì lúc nào".

7. **Nếu công việc quá hạn thì giao việc tiếp có được không?**
   → Ô giao việc inline chuyển thành nhãn **"Hết hạn"** — hệ thống nhắc Leader ưu tiên xử lý việc chậm thay vì tiếp tục giao thêm; đây là điểm kiểm soát nghiệp vụ có chủ đích.

8. **Cảnh báo rủi ro lịch báo gì?**
   → Khi số ngày ước lượng (estDays) vượt quá số ngày làm việc thực tế trong khoảng thời gian đã chọn, hệ thống cảnh báo ngay tại form để Leader điều chỉnh trước khi lưu — tránh ngay từ khâu tạo việc.

---

*Tài liệu mô tả giao diện người dùng module Task của hệ thống NexCampus.*