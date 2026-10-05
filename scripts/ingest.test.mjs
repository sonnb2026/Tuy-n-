// public/lib/ingest.js
//
// Đọc bảng dữ liệu (mảng 2 chiều lấy từ file Excel/CSV) -> danh sách video { title, vph, ... }.
// Tách riêng khỏi giao diện để test được bằng Node (scripts/ingest.test.mjs).
//
// File chuẩn là file "Xuất Excel" của app theo dõi kênh: cột tiêu đề tên "Video", cột VPH tên
// "View/giờ", có "Link video". File khác cũng đọc được: app đoán cột theo tên, sai thì người dùng
// chọn lại cột trên giao diện.

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
const LINK_EXACT = ["link video", "url", "link", "video url", "video link", "video id", "videoid"];
const CHANNEL_EXACT = ["kenh", "channel", "ten kenh", "channel title"];
const TOPIC_EXACT = ["tuyen de", "tuyen", "chu de", "topic", "nhom de tai", "de tai", "tuyen noi dung"];
const TOPIC_CONTAINS = ["tuyen de", "chu de", "topic"];
const COUNTRY_EXACT = ["quoc gia", "country", "nuoc", "ten nuoc"];
const CONTINENT_EXACT = ["chau luc", "continent", "luc dia"];
// Ảnh thumbnail: file xuất từ app theo dõi kênh có 2 cột - ưu tiên bản 320x180 ("dự phòng") vì nhẹ,
// đủ nét cho ô nhỏ trong bảng; không có thì lấy bản HD / cột thumbnail bất kỳ.
const THUMB_EXACT = ["thumbnail", "thumb", "anh thumbnail", "link thumbnail", "anh"];
const THUMB_SMALL = ["du phong", "320", "mqdefault"];

function pick(headers, exact, contains = [], exclude = []) {
  const h = headers.map(norm);
  for (const e of exact) {
    const i = h.indexOf(e);
    if (i !== -1) return i;
  }
  for (const c of contains) {
    const i = h.findIndex((x) => x.includes(c) && !exclude.some((ex) => x.includes(ex)));
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

// Đoán cột. Trả về chỉ số cột (hoặc -1) cho title / vph / link / channel.
export function detectColumns(headers, rows) {
  let title = pick(headers, TITLE_EXACT, TITLE_CONTAINS, TITLE_EXCLUDE);
  let vph = pick(headers, VPH_EXACT, VPH_CONTAINS);
  const link = pick(headers, LINK_EXACT, ["link video", "youtube"]);
  const channel = pick(headers, CHANNEL_EXACT);
  const topic = pick(headers, TOPIC_EXACT, TOPIC_CONTAINS, ["link", "count", "sum"]);
  const country = pick(headers, COUNTRY_EXACT, [], ["count", "sum"]);
  const continent = pick(headers, CONTINENT_EXACT, [], ["count", "sum"]);
  const thumbSmall = pick(headers, [], THUMB_SMALL);
  const thumb = thumbSmall !== -1 ? thumbSmall : pick(headers, THUMB_EXACT, ["thumbnail", "thumb"]);

  // Không tìm được theo tên -> đoán theo nội dung.
  const sample = rows.slice(0, 200);
  if (title === -1) {
    let best = -1;
    let bestLen = 0;
    headers.forEach((_, c) => {
      if (c === vph || c === link) return;
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
    // Cột số nhiều nhất mà không phải cột tiêu đề - chỉ là gợi ý, người dùng nên kiểm tra.
    let best = -1;
    let bestCount = 0;
    headers.forEach((_, c) => {
      if (c === title) return;
      const n = sample.filter((r) => parseNumber(r[c]) !== null).length;
      if (n > bestCount) {
        bestCount = n;
        best = c;
      }
    });
    vph = best;
  }
  return { title, vph, link, channel, topic, country, continent, thumb };
}

// Số trong ô: số thật giữ nguyên; chuỗi thì xử lý "1.234" / "1,234" (dấu ngăn hàng nghìn),
// "12,5" (thập phân kiểu VN), "~123" (VPH tạm tính của app mẫu). Không phải số -> null
// (giống SUM của Excel: bỏ qua ô chữ như "Live", ô trống).
export function parseNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/^~\s*/, "").replace(/\s/g, "");
  if (!s) return null;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
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

// Link ảnh thumbnail: ô trong file nếu là link http(s); không có thì tự tạo từ ID video
// (ảnh 320x180 mà YouTube luôn có sẵn cho mọi video).
export function thumbUrl(cell, key) {
  const v = String(cell ?? "").trim();
  if (/^https?:\/\//i.test(v)) return v;
  return key && key.startsWith("id:") ? `https://i.ytimg.com/vi/${key.slice(3)}/mqdefault.jpg` : "";
}

// Dòng tổng ở cuối bảng ("Tổng cộng", "Grand Total") không phải video.
const TOTAL_ROW = /^(tong cong|tong|grand total|total|sum)$/;

// aoa: mảng 2 chiều; cols: kết quả detectColumns (có thể đã được người dùng sửa).
// Trả về { records, skipped: { empty, total } }. Gộp trùng làm riêng ở dedupeRecords (để gộp được
// cả video trùng giữa nhiều file).
export function buildRecords(aoa, headerRow, cols, { source = "" } = {}) {
  const records = [];
  let empty = 0;
  let total = 0;
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
    const rawVph = cols.vph >= 0 ? row[cols.vph] : null;
    const rec = {
      key,
      title,
      link,
      channel: cols.channel >= 0 ? String(row[cols.channel] ?? "").trim() : "",
      topicRaw: cols.topic >= 0 ? cleanLabel(row[cols.topic]) : "",
      countryRaw: cols.country >= 0 ? cleanLabel(row[cols.country]) : "",
      continentRaw: cols.continent >= 0 ? cleanLabel(row[cols.continent]) : "",
      thumb: thumbUrl(cols.thumb >= 0 ? row[cols.thumb] : "", key),
      vph: parseNumber(rawVph),
      vphRaw: rawVph,
      source,
      row: r + 1, // số dòng trong file (đếm từ 1, như Excel)
      cells: row,
    };
    records.push(rec);
  }
  return { records, skipped: { empty, total } };
}

// Cùng 1 video xuất hiện nhiều lần (cùng link, hoặc cùng tiêu đề khi không có cột link) chỉ tính
// 1 lần - nếu không, SUM và COUNTA bị cộng đôi. Giữ bản xuất hiện SAU CÙNG (thường là file/dòng
// mới hơn, VPH mới hơn); nếu bản sau không có VPH thì giữ VPH của bản trước.
export function dedupeRecords(records) {
  const map = new Map();
  const counts = new Map();
  for (const r of records) {
    counts.set(r.key, (counts.get(r.key) || 0) + 1);
    const prev = map.get(r.key);
    map.set(r.key, prev && r.vph === null && prev.vph !== null ? { ...r, vph: prev.vph, vphRaw: prev.vphRaw } : r);
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
