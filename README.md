# Phân tích tuyến đề (bản đọc file)

Web app tĩnh, chạy hoàn toàn trên trình duyệt. Kéo thả file Excel/CSV dữ liệu video vào → app dựng
**5 bảng tổng hợp liên kết với nhau** (Tuyến đề · Chủ thể chính · Quốc gia · Châu lục · Kênh), mỗi bảng
có **Sum of VPH**, **COUNTA** và **% theo COUNTA** (bảng Kênh có thêm **Tổng view**), kèm danh sách
video chi tiết. File không được gửi lên server nào.

Không cần YouTube API key, GitHub Actions hay biến môi trường nào.

## 1. Đưa lên GitHub và chạy

1. Tạo repo GitHub mới, đưa toàn bộ thư mục này lên (nhánh `main`).
2. Chọn 1 trong 2 cách:
   - **Vercel**: Add New → Project → import repo → Deploy (không cần cấu hình gì).
   - **GitHub Pages**: Settings → Pages → Source "Deploy from a branch" → nhánh `main`,
     thư mục `/ (root)`, rồi mở `https://<user>.github.io/<repo>/public/`.

## 2. File đầu vào

- Định dạng: `.xlsx`, `.xls`, `.xlsm`, `.csv`. Nhiều file cùng lúc được, app gộp lại.
- App tự nhận cột theo tên (không phân biệt hoa/thường, có dấu hay không):

| Cột | Tên cột app nhận ra (ví dụ) | Dùng để |
|---|---|---|
| Tiêu đề video | `Video`, `Tiêu đề`, `Title` | bắt buộc |
| Tuyến đề | `Tuyến đề`, `Chủ đề`, `Topic` | bảng Tuyến đề (bạn tự điền) |
| Chủ thể chính | `Chủ thể chính`, `Chủ thể` | bảng Chủ thể chính |
| VPH | `View/giờ`, `VPH` | Sum of VPH |
| Kênh | `Kênh`, `Channel` | bảng Kênh |
| Lượt xem | `Lượt xem`, `Views`, `Tổng view` | Tổng view, cột Lượt xem |
| Like, Bình luận | `Like`, `Lượt thích`, `Bình luận`, `Comment` | tính Tương tác |
| Tương tác (dự phòng) | `Tương tác`, `Engagement` | chỉ dùng khi thiếu Like/Bình luận/Lượt xem |
| Ngày đăng | `Ngày đăng`, `Published` | cột Ngày đăng + Lịch sử đăng |
| Bản dịch | `Dịch`, `Bản dịch`, `Tiếng Việt` | bản dịch khi trỏ chuột vào tiêu đề |
| Quốc gia / Châu lục | `Quốc gia`, `Châu lục` | không có thì app tự tìm từ tiêu đề |
| Link | `Link video`, `URL` | gộp trùng, ảnh thumbnail |
| Danh từ 1 / Danh từ 2 / Tính chất | đúng các tên đó | cột ẩn, bấm "Xem thêm" để hiện |

- Đoán sai thì bấm "Cột dữ liệu" trong khung "Nguồn dữ liệu" để chọn lại. File nhiều sheet: app tự
  chọn sheet giống bảng video nhất, đổi được.
- Ngày đăng đọc được: ô ngày của Excel, `05/10/2026` (ngày/tháng), `5/10/26 14:30`, `2026-10-05`.
- Hàng tiêu đề cột không cần nằm ở dòng 1. Dòng "Tổng cộng" / "Grand Total" tự bị bỏ qua.

## 3. Cách tính

- **Sum of VPH**: cộng các ô VPH là số. Ô trống hoặc chữ (vd `Live`) bị bỏ qua, giống hàm SUM.
- **COUNTA**: số video trong nhóm. **%** = COUNTA của dòng / tổng COUNTA của bảng (theo bộ lọc đang bật).
- **Tương tác** = (Like + Bình luận) / Lượt xem, hiện dạng % (vd 1,23%). Thiếu Like/Bình luận hoặc
  Lượt xem thì lấy cột "Tương tác" có sẵn trong file ("2,5%" hoặc 0,025 đều hiểu là 2,5%).
- **Tổng view** (bảng Kênh): cộng cột Lượt xem của các video trong nhóm.
- **Lịch sử đăng**: số ngày (số nguyên) kể từ lúc đăng, tính theo giờ thực, tự cập nhật mỗi phút.
- **Gộp video trùng** (bật sẵn): cùng link video hoặc cùng tiêu đề khi không có cột link → chỉ tính 1
  lần, giữ bản xuất hiện sau cùng; ô nào bản sau để trống (vd file xuất mới chưa điền Tuyến đề) thì lấy
  từ bản trước.
- **Châu lục**: Châu Á, Châu Âu, Châu Phi, Châu Mỹ (gộp Bắc, Trung, Nam Mỹ, Caribe), Châu Đại Dương.
  Ô châu lục tự điền như "Asia", "Nam Mỹ" được gộp chung với châu lục tương ứng.
- **Quốc gia**: tên tiếng Anh. Ô quốc gia ghi "Nhiều quốc gia", "Worldwide", "Không xác định" được
  xếp vào đúng nhóm đặc biệt (luôn nằm cuối bảng khi xếp theo tên).

## 4. Dùng các bảng

- Bấm 1 dòng ở bảng nào thì các bảng còn lại lọc theo dòng đó (như slicer của Excel). Dòng đang chọn
  được đưa lên đầu bảng. Bấm nhiều dòng để chọn nhiều, bấm lại để bỏ.
- Thẻ **VPH theo thời gian đăng** (cần cột Ngày đăng): Dưới 3 ngày (0–2), Dưới 10 ngày (3–9), Dưới 30 ngày
  (10–29), Trên 30 ngày (từ ngày 30). % = VPH của nhóm / tổng VPH. Bấm 1 nhóm để lọc các bảng khác.
- Ô Lịch sử đăng của video từ 30 ngày trở lên hiện màu cam; bấm ô này để lọc theo nhóm thời gian.
- Mỗi bảng hiện 7 dòng, cuộn để xem tiếp. Bấm tiêu đề cột để sắp xếp.
- **Danh sách video**:
  - Trỏ chuột vào tiêu đề → hiện bản dịch tiếng Việt (lấy từ cột Dịch trong file; không có thì gọi
    Google Dịch cho đúng tiêu đề đó và nhớ lại trên trình duyệt).
  - Bấm ô Tuyến đề / Chủ thể chính / Quốc gia / Châu lục / Kênh → các bảng thống kê phía trên lọc
    theo giá trị đó. Bấm lại để bỏ lọc.
  - Bấm tiêu đề cột để sắp xếp (cột số: cao → thấp; bấm lần nữa để đảo).
  - "Xem thêm" hiện 3 cột Danh từ 1, Danh từ 2, Tính chất.
  - Bấm ✎ cạnh tên nước để sửa quốc gia (lưu trên trình duyệt đang dùng).
- **Xuất Excel**: sheet "Tổng hợp" (các bảng cạnh nhau, đúng như đang lọc) + sheet "Chi tiết".

## 5. Kiểm tra sau khi sửa code

`node --test scripts/classify.test.mjs scripts/ingest.test.mjs`
