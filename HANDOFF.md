# Bắt đầu từ đâu?

Làm đúng thứ tự, chi tiết từng bước ở `README.md` mục 2.

- [ ] Bước 1: Tạo YouTube Data API key.
- [ ] Bước 2: Đưa code lên 1 GitHub repo mới (nhánh `main`).
- [ ] Bước 3: Thêm `YOUTUBE_API_KEY` (hoặc `YOUTUBE_API_KEYS`) vào GitHub Secrets.
- [ ] Bước 4: Settings → Actions → General → Workflow permissions → **Read and write**.
- [ ] Bước 5: Tạo GitHub Personal Access Token (scope `repo` + `workflow`).
- [ ] Bước 6: Deploy lên Vercel, nhập `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`.
- [ ] Bước 7: Mở trang web, dán vài link video, bấm "Thêm và phân tích", đợi 1–3 phút.

Nếu sau 10 phút bảng vẫn trống: mở tab **Actions** trên GitHub, xem lần chạy "Fetch YouTube Data"
gần nhất báo lỗi gì (thường gặp nhất: quên bước 3 hoặc bước 4).
