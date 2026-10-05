// scripts/fetch-data.mjs
//
// Đọc danh sách video trong videos.json (do người dùng nhập link trên web), gọi YouTube Data API
// lấy số liệu, tính VPH, rồi ghi file JSON tĩnh vào public/data/ để frontend đọc.
// Cơ chế giống app theo dõi kênh: API key chỉ nằm trong GitHub Secrets, không bao giờ lộ ra
// trình duyệt; nhiều key tự xoay vòng khi hết quota; lỗi tạm thời được thử lại.
//
// Khác app theo dõi kênh: ở đây đầu vào là VIDEO chứ không phải kênh, nên chỉ cần gọi videos.list
// (1 unit / 50 video). 1.000 video ≈ 20 unit mỗi lần chạy - quota 10.000/ngày gần như không
// bao giờ chạm tới, vì vậy workflow có thể chạy 6 tiếng/lần để VPH luôn tươi.
//
// Đầu vào  : videos.json   { "videos": ["<videoId>", ...], "overrides": { "<videoId>": { "topic": "t3", "country": "IN" } } }
// Đầu ra   : public/data/videos.json  (mảng video, mỗi video 1 dòng)
//            public/data/meta.json    (thời điểm cập nhật, quota, lỗi...)
//
// Mỗi video có (logic VPH ở scripts/velocity.mjs, giữ nguyên như app mẫu):
//   snapshots, viewsPerHour, viewsPerHourSource ("recent" | "lifetime" | "live"), vphWindowHours,
//   liveStatus. Tuyến đề / Quốc gia / Châu lục KHÔNG tính ở đây mà tính ngay trên trình duyệt
//   (public/lib/*.js), để sửa luật phân loại là thấy kết quả ngay, không cần fetch lại.
//
// Chạy local:  YOUTUBE_API_KEY=xxx node scripts/fetch-data.mjs
// Env tuỳ chọn: YOUTUBE_API_KEYS (nhiều key, cách nhau dấu phẩy), MIN_VPH_INTERVAL_HOURS,
//               VPH_WINDOW_MAX_HOURS, VPH_FALLBACK_MAX_HOURS, MAX_SNAPSHOTS (xem velocity.mjs).

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { CONFIG as VPH_CONFIG, computeVelocity, deriveLiveStatus, pickLiveDetails } from "./velocity.mjs";

const API_KEYS = (process.env.YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);
if (API_KEYS.length === 0) {
  console.error("Thiếu biến môi trường YOUTUBE_API_KEY hoặc YOUTUBE_API_KEYS.");
  process.exit(1);
}
console.log(`Đã nạp ${API_KEYS.length} API key: ${API_KEYS.map((k) => k.slice(0, 4) + "…" + k.slice(-4)).join(", ")}`);

let apiKeyIndex = 0;
let keysExhausted = false;
let quotaUnits = 0;

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const INPUT_FILE = path.join(ROOT, "videos.json");
const DATA_DIR = path.join(ROOT, "public", "data");
const OUT_VIDEOS = path.join(DATA_DIR, "videos.json");
const OUT_META = path.join(DATA_DIR, "meta.json");
const API_BASE = "https://www.googleapis.com/youtube/v3";

async function apiGet(endpoint, params, cost = 1) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set("key", API_KEYS[apiKeyIndex]);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  quotaUnits += cost;
  const json = await res.json();
  if (!res.ok) {
    const reason = json?.error?.errors?.[0]?.reason || res.status;
    const err = new Error(`${endpoint} failed: ${reason}`);
    err.reason = reason;
    throw err;
  }
  return json;
}

// Thử lại lỗi tạm thời; hết quota thì chuyển ngay sang key kế tiếp (không tốn lượt thử).
async function apiGetWithRetry(endpoint, params, cost = 1, retries = 2) {
  let attempt = 0;
  for (;;) {
    try {
      return await apiGet(endpoint, params, cost);
    } catch (err) {
      if (err.reason === "quotaExceeded" || err.reason === "dailyLimitExceeded") {
        if (apiKeyIndex < API_KEYS.length - 1) {
          apiKeyIndex++;
          console.error(`  ! Key #${apiKeyIndex} hết quota, chuyển sang key #${apiKeyIndex + 1}`);
          continue;
        }
        keysExhausted = true;
        throw err;
      }
      attempt++;
      if (attempt > retries) throw err;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf-8"));
  } catch {
    return fallback;
  }
}

// Chấp nhận cả dạng cũ là mảng thuần ["id1", "id2"].
function normalizeInput(raw) {
  if (Array.isArray(raw)) return { videos: raw, overrides: {} };
  return { videos: Array.isArray(raw?.videos) ? raw.videos : [], overrides: raw?.overrides || {} };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const input = normalizeInput(await readJson(INPUT_FILE, {}));
  const ids = [...new Set(input.videos.filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)))];
  console.log(`Danh sách: ${ids.length} video.`);

  const prevArr = await readJson(OUT_VIDEOS, []);
  const prevMap = new Map(prevArr.map((v) => [v.videoId, v]));
  const prevMeta = await readJson(OUT_META, {});
  const legacyFetchTime = prevMeta.lastUpdated ? new Date(prevMeta.lastUpdated) : null;

  const out = new Map();
  const errors = [];
  const notFound = [];

  for (const group of chunk(ids, 50)) {
    let json;
    try {
      json = await apiGetWithRetry("videos", {
        part: "snippet,statistics,contentDetails,liveStreamingDetails",
        id: group.join(","),
      });
    } catch (err) {
      console.error(`! Lỗi khi lấy ${group.length} video: ${err.message}`);
      errors.push({ videoIds: group, error: err.message });
      // Giữ nguyên dữ liệu lần trước cho nhóm này thay vì xoá mất.
      for (const id of group) if (prevMap.has(id)) out.set(id, prevMap.get(id));
      if (keysExhausted) {
        // Hết sạch quota: các nhóm còn lại cũng giữ dữ liệu cũ, dừng gọi API.
        for (const id of ids) if (!out.has(id) && prevMap.has(id)) out.set(id, prevMap.get(id));
        break;
      }
      continue;
    }

    const nowMs = Date.now();
    const returned = new Set();
    for (const v of json.items || []) {
      returned.add(v.id);
      const prev = prevMap.get(v.id);
      const liveStatus = deriveLiveStatus(v.snippet, v.liveStreamingDetails);
      const base = {
        videoId: v.id,
        title: v.snippet.title,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        publishedAt: v.snippet.publishedAt,
        thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
        tags: (v.snippet.tags || []).slice(0, 20),
        descriptionHead: (v.snippet.description || "").slice(0, 300),
        language: v.snippet.defaultAudioLanguage || v.snippet.defaultLanguage || null,
        viewCount: parseInt(v.statistics.viewCount || "0", 10),
        likeCount: v.statistics.likeCount !== undefined ? parseInt(v.statistics.likeCount, 10) : null,
        commentCount: v.statistics.commentCount !== undefined ? parseInt(v.statistics.commentCount, 10) : null,
        duration: v.contentDetails.duration,
        liveStatus,
        liveStreamingDetails: pickLiveDetails(v.liveStreamingDetails),
      };
      const velocity = computeVelocity({ video: base, prev, legacyFetchTime, liveStatus, nowMs });
      out.set(v.id, {
        ...base,
        ...velocity,
        firstSeenAt: prev?.firstSeenAt || new Date(nowMs).toISOString(),
        available: true,
      });
    }
    // Video bị xoá / để riêng tư / sai ID: API không trả về.
    for (const id of group) {
      if (returned.has(id)) continue;
      notFound.push(id);
      if (prevMap.has(id)) out.set(id, { ...prevMap.get(id), available: false });
    }
  }

  // Giữ đúng thứ tự người dùng đã nhập (video mới nhập nằm cuối).
  const result = ids.filter((id) => out.has(id)).map((id) => {
    const v = out.get(id);
    const ov = input.overrides[id];
    return ov && (ov.topic || ov.country) ? { ...v, override: ov } : (({ override, ...rest }) => rest)(v);
  });

  await writeFile(OUT_VIDEOS, "[\n" + result.map((v) => JSON.stringify(v)).join(",\n") + "\n]\n");
  await writeFile(
    OUT_META,
    JSON.stringify(
      {
        lastUpdated: new Date().toISOString(),
        inputCount: ids.length,
        videoCount: result.length,
        notFound,
        quotaUnitsUsed: quotaUnits,
        apiKeysConfigured: API_KEYS.length,
        allKeysExhausted: keysExhausted,
        vph: VPH_CONFIG,
        errors,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Xong: ${result.length}/${ids.length} video, ${notFound.length} không tìm thấy, quota ≈ ${quotaUnits} unit.`);
}

main().catch((err) => {
  console.error("Lỗi nghiêm trọng:", err);
  process.exit(1);
});
