# Phân tích tuyến đề YouTube

Web app tĩnh (Vercel) + GitHub Actions. Dán link video vào ô trên web → app tự đọc số liệu
video, xếp vào **5 tuyến đề**, trích **Quốc gia / Châu lục** từ tiêu đề, và cộng **VPH** theo
từng nhóm. Kiến trúc và cách gọi API giữ nguyên như app theo dõi kênh: API key YouTube chỉ nằm
trong GitHub Secrets, nhiều key tự xoay vòng khi hết quota, lỗi tạm thời tự thử lại.

```
Dán link trên web ──▶ api/manage-videos.js ──▶ commit videos.json lên GitHub
                                                   │ (push kích hoạt workflow)
                                                   ▼
                                     GitHub Actions: scripts/fetch-data.mjs
                                     gọi YouTube API, tính VPH, commit public/data/*.json
                                                   │
                                                   ▼
                       Vercel tự deploy lại ──▶ web tự tải dữ liệu mới (hỏi lại mỗi 15 giây)
```

Từ lúc bấm "Thêm và phân tích" tới lúc bảng có dữ liệu: thường **1–3 phút**.

## 1. Cấu trúc

```
videos.json                     # danh sách video + phân loại sửa tay (web tự ghi, không cần sửa tay)
scripts/fetch-data.mjs          # gọi YouTube API (videos.list, 1 unit / 50 video)
scripts/velocity.mjs            # tính VPH - giữ nguyên 100% từ app mẫu
scripts/*.test.mjs              # test VPH + test phân loại trên toàn bộ ví dụ mẫu
.github/workflows/fetch-data.yml
api/manage-videos.js            # thêm / xoá video, lưu phân loại sửa tay
api/trigger-fetch.js            # nút "Cập nhật VPH ngay"
public/                         # frontend (Vercel publish thư mục này)
  index.html, style.css, app.js
  lib/topics.js                 # luật xếp tuyến đề (từ khoá + trọng số)
  lib/geo.js                    # từ điển quốc gia → châu lục (tên TBN + Anh)
  data/videos.json, meta.json   # do GitHub Actions ghi
```

## 2. Cài đặt (giống app theo dõi kênh)

1. **YouTube API key**: Google Cloud Console → bật *YouTube Data API v3* → tạo API key.
2. **Đưa code lên 1 repo GitHub mới**, nhánh `main`.
3. **GitHub Secrets** (Settings → Secrets and variables → Actions):
   `YOUTUBE_API_KEY` (1 key) hoặc `YOUTUBE_API_KEYS` = `key1,key2` (nhiều key, mỗi key ở 1 project GCP khác nhau).
4. **Cho phép Actions ghi vào repo**: Settings → Actions → General → Workflow permissions →
   chọn **Read and write permissions**.
5. **Personal Access Token** (github.com/settings/tokens → classic) với scope `repo` và `workflow`.
6. **Vercel**: Import repo, không cần chỉnh build. Thêm biến môi trường
   `GITHUB_TOKEN` (token bước 5), `GITHUB_OWNER`, `GITHUB_REPO`. Deploy.

Xong. Từ đây mọi thao tác đều làm trên web.

## 3. Dùng app

- **Nhập link**: dán 1 hoặc nhiều link (mỗi dòng 1 link, hoặc cách nhau dấu phẩy). Nhận mọi dạng:
  `watch?v=`, `youtu.be/`, `shorts/`, `live/`, link có `&t=`, `?si=`. Link trùng tự bỏ qua.
- **Sắp xếp**: chọn biến (Tuyến đề, Sum of VPH, Quốc gia, Châu lục) + Tăng dần / Giảm dần,
  hoặc bấm thẳng vào tiêu đề cột. "Không xác định" / "Nhiều quốc gia" luôn nằm cuối.
- **Biến hiển thị** (chip Châu lục / Quốc gia phía trên bảng): không chọn → hiện cả 2 cột,
  gộp theo Tuyến × Quốc gia. Bấm "Châu lục" → chỉ còn cột Châu lục, VPH gộp theo Tuyến × Châu lục.
  Bấm "Quốc gia" → chỉ còn cột Quốc gia. Bấm lại chip đang chọn để về mặc định.
- **Thanh tỷ trọng VPH**: tổng VPH thuần theo từng tuyến. Bấm vào tên tuyến bên dưới để lọc bảng.
- **Bấm 1 dòng** để xem các video trong nhóm, lý do app xếp vào tuyến đó, và **Sửa phân loại**
  (chọn tuyến / quốc gia khác). Sửa tay được lưu vào repo, áp dụng cho mọi người.
- **Cập nhật VPH ngay**: chạy lấy dữ liệu ngay, không đợi lịch.

## 4. VPH

Giống hệt app mẫu (`scripts/velocity.mjs`): VPH = (view hiện tại − view ở mốc 6–24 giờ trước) /
số giờ. Video mới thêm chưa có mốc → tạm dùng trung bình cả đời (tổng view / số giờ từ lúc đăng),
đánh dấu `~`. Workflow chạy **6 tiếng/lần** (app mẫu: 1 lần/ngày) vì lấy theo video rất rẻ
(1.000 video ≈ 20 unit/lần), nhờ vậy sau khoảng 6 tiếng mọi video đều có VPH đo thật.
Video đang live / sắp công chiếu và video đã bị xoá không được cộng vào Sum of VPH.

## 5. Chỉnh luật phân loại

- Tuyến đề: `public/lib/topics.js`, mảng `SIGNALS` (cụm từ + trọng số), `TIE_ORDER` (thứ tự ưu
  tiên khi hoà điểm), `MIN_SCORE` (dưới ngưỡng → "Chưa phân loại").
- Quốc gia: `public/lib/geo.js`, thêm alias viết thường không dấu.
- Phân loại chạy trên trình duyệt nên **sửa xong là thấy ngay**, không cần fetch lại.
- Sau khi sửa, chạy test để chắc không làm hỏng các ví dụ mẫu:
  `node --test scripts/classify.test.mjs scripts/velocity.test.mjs`

## 6. Giới hạn cần biết

- Không có mật khẩu bảo vệ ô nhập link / nút cập nhật (giống app mẫu): ai có link web đều dùng được.
- Quốc gia chỉ trích được khi tiêu đề có tên nước, thành phố nổi tiếng, tên bộ tộc, cờ emoji
  hoặc từ chỉ người ("venezolanos"). Nếu tiêu đề không có, app thử tag rồi 300 ký tự đầu mô tả
  (đánh dấu `≈`). Không có gì → "Không xác định".
- Tiêu đề nhắc nhiều nước → "Nhiều quốc gia" (châu lục là châu chung, hoặc "Nhiều châu lục").
