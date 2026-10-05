// api/manage-videos.js
//
// Ô "Dán link video" trên web gọi vào đây. Endpoint đọc videos.json trong repo qua GitHub
// Contents API, thêm/xoá video hoặc lưu phân loại sửa tay, rồi commit ngược lại. Commit này khớp
// `push: paths: videos.json` trong .github/workflows/fetch-data.yml nên GitHub Actions tự chạy
// lấy dữ liệu ngay - đây là thứ làm app "động": dán link vào là app bắt đầu chạy.
//
// Biến môi trường (Vercel -> Settings -> Environment Variables), giống app theo dõi kênh:
//   GITHUB_TOKEN  PAT có quyền ghi nội dung repo (classic PAT scope "repo" là đủ)
//   GITHUB_OWNER  user/org sở hữu repo
//   GITHUB_REPO   tên repo
//   GITHUB_REF    (tuỳ chọn) nhánh, mặc định "main"
//
// Body (JSON):
//   { action: "add",      links: "<nhiều link, mỗi dòng / dấu phẩy / dấu cách>" }
//   { action: "remove",   videoId: "<id>" }
//   { action: "override", videoId: "<id>", topic: "t1".."t5" | null, country: "<mã nước>" | null }

const TOPIC_IDS = ["t1", "t2", "t3", "t4", "t5"];

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
  const ref = process.env.GITHUB_REF || "main";
  const body = typeof req.body === "string" ? safeJsonParse(req.body) : req.body || {};
  const { action } = body;
  if (!["add", "remove", "override"].includes(action)) {
    return res.status(400).json({ error: "Thiếu hoặc sai 'action'." });
  }

  let report = {};
  const mutate = (current) => {
    if (action === "add") {
      const { ids, invalid } = parseVideoLinks(body.links);
      if (!ids.length) {
        const e = new Error(invalid.length ? `Không nhận ra link video nào hợp lệ (${invalid.length} dòng lỗi).` : "Chưa có link nào.");
        e.status = 400;
        throw e;
      }
      const existing = new Set(current.videos);
      const added = ids.filter((id) => !existing.has(id));
      const duplicates = ids.filter((id) => existing.has(id));
      report = { added, duplicates, invalid };
      if (!added.length) return null; // không có gì mới -> không commit
      current.videos.push(...added);
      return `data: thêm ${added.length} video qua web`;
    }
    const id = String(body.videoId || "");
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
      const e = new Error("videoId không hợp lệ.");
      e.status = 400;
      throw e;
    }
    if (action === "remove") {
      if (!current.videos.includes(id)) {
        const e = new Error("Video này không có trong danh sách.");
        e.status = 404;
        throw e;
      }
      current.videos = current.videos.filter((v) => v !== id);
      delete current.overrides[id];
      report = { removed: id };
      return `data: xoá video ${id} qua web`;
    }
    // override
    const topic = TOPIC_IDS.includes(body.topic) ? body.topic : null;
    const country = typeof body.country === "string" && /^[A-Z]{2}$/.test(body.country) ? body.country : null;
    if (!topic && !country) delete current.overrides[id];
    else current.overrides[id] = { ...(topic ? { topic } : {}), ...(country ? { country } : {}) };
    report = { videoId: id, override: current.overrides[id] || null };
    return `data: sửa phân loại video ${id} qua web`;
  };

  try {
    const result = await commitWithRetry({ token, owner, repo, ref, mutate });
    return res.status(200).json({ ok: true, committed: result.committed, ...report });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

// Đọc - sửa - ghi videos.json. Nếu 2 người cùng bấm một lúc, GitHub trả 409 (sha đã cũ):
// đọc lại và thử lại tối đa 3 lần thay vì làm mất thay đổi của người kia.
async function commitWithRetry({ token, owner, repo, ref, mutate }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/videos.json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const getRes = await fetch(`${url}?ref=${ref}`, { headers });
    let sha;
    let current = { videos: [], overrides: {} };
    if (getRes.ok) {
      const file = await getRes.json();
      sha = file.sha;
      const parsed = safeJsonParse(Buffer.from(file.content, "base64").toString("utf-8"));
      current = Array.isArray(parsed)
        ? { videos: parsed, overrides: {} }
        : { videos: parsed.videos || [], overrides: parsed.overrides || {} };
    } else if (getRes.status !== 404) {
      const e = new Error(`Không đọc được videos.json (HTTP ${getRes.status}). Kiểm tra GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO.`);
      e.status = 502;
      throw e;
    }

    const message = mutate(current);
    if (!message) return { committed: false };

    const putRes = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: Buffer.from(JSON.stringify(current, null, 2) + "\n", "utf-8").toString("base64"),
        branch: ref,
        ...(sha ? { sha } : {}),
      }),
    });
    if (putRes.ok) return { committed: true };
    if (putRes.status === 409 || putRes.status === 422) continue; // sha cũ -> đọc lại, thử lại
    const t = await putRes.text();
    const e = new Error(`Không ghi được videos.json (HTTP ${putRes.status}): ${t.slice(0, 200)}`);
    e.status = 502;
    throw e;
  }
  const e = new Error("Có người khác đang sửa danh sách cùng lúc. Thử lại sau vài giây.");
  e.status = 409;
  throw e;
}

// Nhận mọi dạng link YouTube phổ biến: watch?v=, youtu.be/, shorts/, live/, embed/, m./music.
// và ID trần 11 ký tự. Trùng lặp (cùng video, khác dạng link / có &t=...) chỉ tính 1 lần.
function parseVideoLinks(text) {
  const parts = String(text || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ids = [];
  const invalid = [];
  for (const p of parts) {
    const m =
      p.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/|\/v\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/) ||
      p.match(/^([A-Za-z0-9_-]{11})$/);
    if (m) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    } else invalid.push(p);
  }
  return { ids, invalid };
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

module.exports.parseVideoLinks = parseVideoLinks;
