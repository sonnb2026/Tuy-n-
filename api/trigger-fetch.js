// api/trigger-fetch.js
//
// Nút "Cập nhật VPH ngay" trên web gọi vào đây để chạy workflow lấy dữ liệu ngay lập tức
// (không cần đợi lịch 6 tiếng/lần). Việc gọi YouTube API + commit vẫn diễn ra trong GitHub
// Actions; endpoint này chỉ gọi workflow_dispatch. Dùng chung biến môi trường với manage-videos.js.
//   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO  (bắt buộc)
//   GITHUB_WORKFLOW_FILE (mặc định "fetch-data.yml"), GITHUB_REF (mặc định "main")

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const missing = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"].filter((k) => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({
      error: `Server chưa cấu hình đủ biến môi trường: ${missing.join(", ")} (Vercel → Settings → Environment Variables).`,
    });
  }
  const { GITHUB_TOKEN: token, GITHUB_OWNER: owner, GITHUB_REPO: repo } = process.env;
  const workflowFile = process.env.GITHUB_WORKFLOW_FILE || "fetch-data.yml";
  const ref = process.env.GITHUB_REF || "main";
  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref }),
      }
    );
    if (ghRes.status === 204) return res.status(200).json({ ok: true });
    const t = await ghRes.text();
    return res.status(502).json({
      error: `GitHub từ chối yêu cầu (HTTP ${ghRes.status}). Kiểm tra GITHUB_TOKEN có scope "repo" + "workflow". Chi tiết: ${t.slice(0, 200)}`,
    });
  } catch (err) {
    return res.status(500).json({ error: `Lỗi khi gọi GitHub API: ${err.message}` });
  }
};
