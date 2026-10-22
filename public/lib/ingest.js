// public/lib/ingest.js
//
// Đọc bảng dữ liệu (mảng 2 chiều lấy từ file Excel/CSV) -> danh sách video { title, vph, ... }.
// Tách riêng khỏi giao diện để test được bằng Node (scripts/ingest.test.mjs).
//
// File chuẩn là file "Xuất Excel" của app theo dõi kênh: cột tiêu đề tên "Video", cột VPH tên
// "View/giờ", có "Link video". File khác cũng đọc được: app đoán cột theo tên, sai thì người dùng
// chọn lại cột trên giao diện.

export const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Tên cột ưu tiên (đã bỏ dấu, viết thường). Khớp chính xác trước, rồi mới "chứa".
const TITLE_EXACT = ["video", "tieu de", "tieu de video", "title", "video title", "ten video"];
const TITLE_CONTAINS = ["tieu de", "title", "ten video"];
const TITLE_EXCLUDE = ["link", "dich", "loai", "translat", "url", "id", "thumbnail"];
const VPH_EXACT = ["view/gio", "vph", "views per hour", "viewsperhour", "view / gio", "views/hour", "luot xem/gio"];
const VPH_CONTAINS = ["view/gio", "vph", "per hour", "/gio", "/hour"];

// Mỗi trường: [khớp chính xác], [chứa], [loại trừ khi "chứa"].
const FIELD_RULES = {
  link: [["link video", "url", "link", "video url", "video link", "video id", "videoid"], ["link video", "youtube"], ["thumb", "anh", "kenh", "channel"]],
  channel: [["kenh", "channel", "ten kenh", "channel title", "channel name"], ["ten kenh", "channel"], ["link", "url", "id"]],
  topic: [["tuyen de", "tuyen", "chu de", "topic", "nhom de tai", "de tai", "tuyen noi dung"], ["tuyen de", "chu de", "topic"], ["link", "count", "sum"]],
  subject: [["chu the chinh", "chu the", "main subject", "subject", "doi tuong chinh"], ["chu the"], ["count", "sum"]],
  country: [["quoc gia", "country", "nuoc", "ten nuoc"], [], ["count", "sum"]],
  continent: [["chau luc", "continent", "luc dia"], [], ["count", "sum"]],
  translation: [["dich", "ban dich", "tieu de dich", "dich tieu de", "tieng viet", "translation", "tieu de tieng viet", "vietsub"], ["dich", "translat"], ["link"]],
  date: [["ngay dang", "ngay dang video", "ngay xuat ban", "thoi gian dang", "published", "published at", "publish date", "upload date", "ngay upload", "ngay"], ["ngay dang", "publish", "upload", "xuat ban"], ["cap nhat", "update", "so ngay", "lich su"]],
  views: [["luot xem", "view", "views", "tong view", "tong luot xem", "luot view", "view count", "viewcount", "so view", "so luot xem"], ["luot xem", "tong view"], ["/gio", "gio", "hour", "vph", "/ngay"]],
  engagement: [["tuong tac", "ty le tuong tac", "luot tuong tac", "engagement", "engagement rate", "interactions"], ["tuong tac", "engagement"], []],
  likes: [["like", "likes", "luot thich", "luot like", "so like", "so luot thich"], ["luot thich"], ["/"]],
  comments: [["binh luan", "comment", "comments", "luot binh luan", "so binh luan"], ["binh luan"], ["/"]],
  noun1: [["danh tu 1", "danh tu1", "noun 1", "noun1"], ["danh tu 1"], []],
  noun2: [["danh tu 2", "danh tu2", "noun 2", "noun2"], ["danh tu 2"], []],
  nature: [["tinh chat", "tinh chat video", "nature", "tone"], ["tinh chat"], []],
};

function pick(headers, exact, contains = [], exclude = [], taken = []) {
  const h = headers.map(norm);
  for (const e of exact) {
    const i = h.findIndex((x, j) => x === e && !taken.includes(j));
    if (i !== -1) return i;
  }
  for (const c of contains) {
    const i = h.findIndex((x, j) => x.includes(c) && !exclude.some((ex) => x.includes(ex)) && !taken.includes(j));
    if (i !== -1) return i;
  }
  return -1;
}

// Hàng tiêu đề cột không phải lúc nào cũng là hàng 1 (có file có dòng tên báo cáo phía trên).
// Lấy hàng đầu tiên trong 15 hàng đầu có chứa tên cột tiêu đề hoặc VPH quen thuộc.
export function findHeaderRow(aoa) {
  const limit = Math.min(aoa.length, 15);
  for (let r = 0; r < limit; r++) {
    const row = (aoa[r] || []).map(String);
    if (pick(row, TITLE_EXACT) !== -1 || pick(row, VPH_EXACT, VPH_CONTAINS) !== -1) return r;
  }
  // Không thấy: lấy hàng đầu tiên có ≥ 2 ô không rỗng.
  for (let r = 0; r < limit; r++) {
    if ((aoa[r] || []).filter((c) => String(c ?? "").trim() !== "").length >= 2) return r;
  }
  return 0;
}

// Đoán cột. Trả về chỉ số cột (hoặc -1) cho từng trường.
export function detectColumns(headers, rows) {
  let title = pick(headers, TITLE_EXACT, TITLE_CONTAINS, TITLE_EXCLUDE);
  let vph = pick(headers, VPH_EXACT, VPH_CONTAINS);
  const taken = [title, vph].filter((i) => i >= 0);
  const out = {};
  for (const [field, [exact, contains, exclude]] of Object.entries(FIELD_RULES)) {
    const i = pick(headers, exact, contains, exclude, taken);
    out[field] = i;
    if (i >= 0) taken.push(i);
  }

  // Không tìm được theo tên -> đoán theo nội dung.
  const sample = rows.slice(0, 200);
  if (title === -1) {
    let best = -1;
    let bestLen = 0;
    headers.forEach((_, c) => {
      if (c === vph || taken.includes(c)) return;
      const texts = sample.map((r) => r[c]).filter((v) => typeof v === "string" && !/^https?:/i.test(v));
      const avg = texts.reduce((s, t) => s + t.length, 0) / Math.max(1, sample.length);
      if (avg > bestLen) {
        bestLen = avg;
        best = c;
      }
    });
    title = best;
  }
  if (vph === -1) {
    // Cột số nhiều nhất mà không phải cột đã nhận - chỉ là gợi ý, người dùng nên kiểm tra.
    let best = -1;
    let bestCount = 0;
    headers.forEach((_, c) => {
      if (c === title || taken.includes(c)) return;
      const n = sample.filter((r) => parseNumber(r[c]) !== null).length;
      if (n > bestCount) {
        bestCount = n;
        best = c;
      }
    });
    vph = best;
  }
  return { title, vph, ...out };
}

// Số trong ô: số thật giữ nguyên; chuỗi thì xử lý "1.234" / "1,234" (dấu ngăn hàng nghìn),
// "12,5" (thập phân kiểu VN), "1.234,5" / "1,234.5", "~123" (VPH tạm tính của app mẫu).
// Không phải số -> null (giống SUM của Excel: bỏ qua ô chữ như "Live", ô trống).
export function parseNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/^~\s*/, "").replace(/\s/g, "");
  if (!s) return null;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, "");
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
}

// Ngày đăng -> mốc thời gian (ms) hoặc null. Nhận:
//   số ngày kiểu Excel (45930.5), "2026-10-05", "2026-10-05T14:30:00Z", "05/10/2026", "5/10/2026 14:30",
//   "05-10-2026", "05.10.26". Dạng a/b/yyyy: mặc định ngày/tháng (kiểu Việt Nam); nếu số thứ 2 > 12
//   thì hiểu là tháng/ngày.
export function parseDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      // Số ngày tính từ 30/12/1899 - Excel lưu theo giờ địa phương.
      const whole = Math.floor(v);
      const ms = Math.round((v - whole) * 86400000);
      const d = new Date(1899, 11, 30 + whole);
      return d.getTime() + ms;
    }
    if (v > 1e11) return v; // đã là mili giây
    if (v > 1e9) return v * 1000; // giây (unix time)
    return null;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d+([.,]\d+)?$/.test(s)) return parseDate(parseFloat(s.replace(",", ".")));
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
      const t = Date.parse(s);
      if (Number.isFinite(t)) return t;
    }
    return mk(+m[1], +m[2], +m[3], m[4], m[5], m[6]);
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    let day = a;
    let month = b;
    if (b > 12 && a <= 12) {
      day = b;
      month = a;
    }
    return mk(y, month, day, m[4], m[5], m[6]);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}
function mk(y, mo, d, hh, mm, ss) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, +(hh || 0), +(mm || 0), +(ss || 0));
  return dt.getMonth() === mo - 1 ? dt.getTime() : null;
}

// Tương tác = (Like + Bình luận) / Lượt xem, trả về tỉ lệ (0.0235 = 2,35%).
// Thiếu Like/Bình luận hoặc Lượt xem thì dùng cột "Tương tác" có sẵn trong file (nếu có):
// "2,35%" -> 0.0235; số ≤ 1 coi là tỉ lệ; số > 1 coi là phần trăm (2.35 -> 2,35%).
export function engagementRate(likes, comments, views, fallbackCell) {
  if ((likes !== null || comments !== null) && views !== null && views > 0) return ((likes || 0) + (comments || 0)) / views;
  const raw = String(fallbackCell ?? "").trim();
  if (!raw) return null;
  const pctStr = /%$/.test(raw);
  const n = parseNumber(pctStr ? raw.slice(0, -1) : fallbackCell);
  if (n === null) return null;
  return pctStr || n > 1 ? n / 100 : n;
}

// Khoá nhận diện 1 video: videoId lấy từ link nếu có, không thì tiêu đề chuẩn hoá.
export function videoKey(link, title) {
  const m = String(link || "").match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return "id:" + m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(String(link || "").trim())) return "id:" + String(link).trim();
  return "t:" + norm(title);
}

// Nhãn nhóm lấy từ file: bỏ khoảng trắng thừa ở đầu/cuối/giữa ("Du Lịch " = "Du Lịch").
export const cleanLabel = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
// Khoá gộp nhóm: không phân biệt hoa/thường, giống Pivot Table của Excel ("DU LỊCH" = "Du lịch").
export const labelKey = (v) => cleanLabel(v).toLocaleLowerCase("vi");

// Dòng tổng ở cuối bảng ("Tổng cộng", "Grand Total") không phải video.
const TOTAL_ROW = /^(tong cong|tong|grand total|total|sum)$/;

// aoa: mảng 2 chiều; cols: kết quả detectColumns (có thể đã được người dùng sửa).
// Trả về { records, skipped: { empty, total } }. Gộp trùng làm riêng ở dedupeRecords (để gộp được
// cả video trùng giữa nhiều file).
export function buildRecords(aoa, headerRow, cols, { source = "" } = {}) {
  const records = [];
  let empty = 0;
  let total = 0;
  const cell = (row, i) => (i >= 0 ? row[i] : undefined);
  const text = (row, i) => (i >= 0 ? cleanLabel(row[i]) : "");
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const title = String(row[cols.title] ?? "").trim();
    if (!title) {
      if (row.some((c) => String(c ?? "").trim() !== "")) empty++;
      continue;
    }
    if (TOTAL_ROW.test(norm(title))) {
      total++;
      continue;
    }
    const link = cols.link >= 0 ? String(row[cols.link] ?? "").trim() : "";
    const key = videoKey(link, title);
    const rawVph = cell(row, cols.vph) ?? null;
    const views = parseNumber(cell(row, cols.views));
    const likes = parseNumber(cell(row, cols.likes));
    const comments = parseNumber(cell(row, cols.comments));
    const engagement = engagementRate(likes, comments, views, cell(row, cols.engagement));
    const rawDate = cell(row, cols.date);
    records.push({
      key,
      title,
      link,
      channel: text(row, cols.channel),
      topicRaw: text(row, cols.topic),
      subjectRaw: text(row, cols.subject),
      countryRaw: text(row, cols.country),
      continentRaw: text(row, cols.continent),
      translation: text(row, cols.translation),
      noun1: text(row, cols.noun1),
      noun2: text(row, cols.noun2),
      nature: text(row, cols.nature),
      vph: parseNumber(rawVph),
      vphRaw: rawVph,
      views,
      likes,
      comments,
      engagement,
      published: parseDate(rawDate),
      publishedRaw: rawDate ?? "",
      source,
      row: r + 1, // số dòng trong file (đếm từ 1, như Excel)
    });
  }
  return { records, skipped: { empty, total } };
}

const META = new Set(["key", "source", "row", "dupCount"]);
const isEmpty = (v) => v === null || v === undefined || v === "";

// Cùng 1 video xuất hiện nhiều lần (cùng link, hoặc cùng tiêu đề khi không có cột link) chỉ tính
// 1 lần - nếu không, SUM và COUNTA bị cộng đôi. Giữ bản xuất hiện SAU CÙNG (thường là file/dòng
// mới hơn, số liệu mới hơn); ô nào bản sau để trống (vd file xuất mới chưa điền Tuyến đề) thì lấy
// từ bản trước.
export function dedupeRecords(records) {
  const map = new Map();
  const counts = new Map();
  for (const r of records) {
    counts.set(r.key, (counts.get(r.key) || 0) + 1);
    const prev = map.get(r.key);
    if (!prev) {
      map.set(r.key, r);
      continue;
    }
    const merged = { ...r };
    for (const k of Object.keys(prev)) {
      if (META.has(k)) continue;
      if (isEmpty(merged[k]) && !isEmpty(prev[k])) {
        merged[k] = prev[k];
        if (k === "vph") merged.vphRaw = prev.vphRaw;
        if (k === "published") merged.publishedRaw = prev.publishedRaw;
      }
    }
    map.set(r.key, merged);
  }
  const out = [...map.values()].map((r) => ({ ...r, dupCount: counts.get(r.key) }));
  return { records: out, duplicates: records.length - out.length };
}

// Điểm "giống bảng dữ liệu video" của 1 sheet: 2 = có cả cột tiêu đề lẫn cột VPH đúng tên,
// 1 = có 1 trong 2, 0 = không có. Dùng để tự chọn sheet khi file có nhiều sheet.
export function scoreSheet(aoa) {
  const h = findHeaderRow(aoa);
  const row = (aoa[h] || []).map(String);
  return (pick(row, TITLE_EXACT) !== -1 ? 1 : 0) + (pick(row, VPH_EXACT, VPH_CONTAINS) !== -1 ? 1 : 0);
}
