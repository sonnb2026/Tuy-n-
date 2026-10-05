# Phân tích tuyến đề (bản đọc file)

Web app tĩnh, chạy hoàn toàn trên trình duyệt. Kéo thả file Excel/CSV dữ liệu video vào →
app tự xếp từng video vào **5 tuyến đề**, trích **Quốc gia / Châu lục** từ tiêu đề, rồi dựng
**3 bảng tổng hợp đặt cạnh nhau** (Tuyến đề · Quốc gia · Châu lục), mỗi bảng có
**Sum of VPH** và **COUNTA**. File không được gửi lên server nào.

Không cần YouTube API key, GitHub Actions hay biến môi trường nào.

## 1. Đưa lên GitHub và chạy

1. Tạo repo GitHub mới, đưa toàn bộ thư mục này lên (nhánh `main`).
2. Chọn 1 trong 2 cách:
   - **Vercel**: Add New → Project → import repo → Deploy (không cần cấu hình gì).
   - **GitHub Pages**: Settings → Pages → Source "Deploy from a branch" → nhánh `main`,
     thư mục `/ (root)`, rồi mở `https://<user>.github.io/<repo>/public/`.
     (Hoặc chọn thư mục `/docs` nếu bạn đổi tên `public` thành `docs`.)

## 2. File đầu vào

- Định dạng: `.xlsx`, `.xls`, `.xlsm`, `.csv`. Nhiều file cùng lúc được, app gộp lại.
- Chuẩn nhất là file **"Xuất Excel" của app theo dõi kênh**: app tự nhận cột tiêu đề `Video`
  (không nhầm với cột `Dịch`), cột VPH `View/giờ`, cột `Link video`.
- File khác: app đoán cột theo tên (Tiêu đề / Title, VPH / View/giờ...). Đoán sai thì chọn lại
  cột trong bảng "Nguồn dữ liệu". File nhiều sheet: app tự chọn sheet giống bảng video nhất,
  đổi được.
- Hàng tiêu đề cột không cần nằm ở dòng 1. Dòng "Tổng cộng" / "Grand Total" tự bị bỏ qua.

## 3. Cách tính

- **Sum of VPH**: cộng các ô VPH là số. Ô trống hoặc chữ (vd `Live`) bị bỏ qua, giống hàm SUM.
  Số dạng chữ như `1.234`, `1,234`, `12,5`, `~300` vẫn được hiểu đúng.
- **COUNTA**: số video trong nhóm. Mọi video đều có nhãn (kể cả "Unknown" / "Không xác định")
  nên tổng COUNTA = tổng số video, và 3 bảng luôn có cùng dòng Tổng cộng.
- **Gộp video trùng** (bật sẵn): cùng link video (khác dạng link vẫn nhận ra) hoặc cùng tiêu đề
  khi không có cột link → chỉ tính 1 lần, giữ bản xuất hiện sau cùng.
- **Châu lục**: Châu Á, Châu Âu, Châu Phi, Châu Mỹ (gộp Bắc, Trung, Nam Mỹ, Caribe),
  Châu Đại Dương. **Quốc gia**: tên tiếng Anh.
- Đọc được tiêu đề tiếng Tây Ban Nha, Bồ Đào Nha, Pháp và Anh (tên nước, thủ đô / thành phố nổi
  tiếng, tên bộ tộc, cờ emoji).
- Tiêu đề nhắc nhiều nước: chỉ là **"Multiple countries"** khi các nước được nối trực tiếp
  ("Venezuela y Nicaragua", "India vs Pakistán"). Còn lại nước nhắc đầu tiên là chủ đề
  ("Corea del Norte... hasta EE.UU. se siente inquieto" → North Korea).
- Video tổng hợp nhiều nơi không nêu tên nước ("Los 9 Países Más Seguros") → **"Worldwide"** /
  châu lục **"Toàn cầu"**. Không có thông tin nào → "Unknown" / "Không xác định".

## 4. Dùng 3 bảng

- Bấm 1 dòng ở bảng nào thì 2 bảng còn lại lọc theo dòng đó (như slicer của Excel). Bấm nhiều
  dòng để chọn nhiều, bấm lại để bỏ. Bộ lọc đang bật hiện phía trên bảng.
- Bấm tiêu đề cột để sắp xếp (mặc định Sum of VPH giảm dần).
- **Danh sách video** bên dưới: xem từng video được xếp thế nào, sửa tuyến đề / quốc gia bằng
  ô chọn. Sửa tay lưu trên trình duyệt đang dùng (không chia sẻ sang máy khác).
- **Xuất Excel**: sheet "Tổng hợp" (3 bảng cạnh nhau, đúng như đang hiển thị) + sheet
  "Chi tiết" (từng video kèm tuyến đề, quốc gia, châu lục).

## 5. Chỉnh luật phân loại

- Tuyến đề: `public/lib/topics.js` (cụm từ + trọng số trong `SIGNALS`).
- Quốc gia: `public/lib/geo.js` (thêm alias viết thường, không dấu).
- Kiểm tra sau khi sửa: `node --test scripts/classify.test.mjs scripts/ingest.test.mjs`

## 6. Kết quả trên file mẫu (TBN Life in, 3.343 video)

| | Video | % VPH |
|---|---|---|
| Xếp được tuyến đề | 2.536 (76%) | 92% |
| Chưa phân loại | 807 (24%) | 8% |
| Tìm được quốc gia hoặc Worldwide | 2.825 (85%) | 91% |
| Unknown | 518 (15%) | 9% |

Phần Chưa phân loại / Unknown chủ yếu là tiêu đề không có từ khoá chủ đề (vd "¿Por qué todo el
mundo se enamora de Vietnam?") hoặc phim bộ tộc không nêu nơi chốn. Dấu **?** đánh dấu ~730 video
nằm giáp ranh giữa 2 tuyến: lọc "Chỉ video cần kiểm tra" để rà nhanh.
