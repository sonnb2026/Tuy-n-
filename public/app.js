// public/app.js
//
// Đọc file Excel/CSV ngay trên trình duyệt (SheetJS) rồi dựng các bảng tổng hợp kiểu Pivot Table
// liên kết với nhau: Tuyến đề · Chủ thể chính · Quốc gia · Châu lục · Kênh. Mỗi bảng có Sum of VPH,
// COUNTA và % theo COUNTA (bảng Kênh có thêm Tổng view).
//   - Tuyến đề, Chủ thể chính, Kênh: LẤY TỪ CỘT TRONG FILE, gộp nhóm giống Pivot Table của Excel.
//   - Quốc gia: lấy từ cột "Quốc gia" nếu file có; ô trống / file không có cột -> app tự tìm từ tiêu đề.
//   - Châu lục: lấy từ cột "Châu lục" nếu file có; không có -> suy ra từ quốc gia.

import {
  extractGeo,
  geoFromCodes,
  countryList,
  countryFromCell,
  contentContinent,
  specialCountryCell,
  continentFromCell,
  continentName,
  COUNTRIES,
  MULTI_COUNTRY,
  UNKNOWN_COUNTRY,
  WORLDWIDE_COUNTRY,
} from "./lib/geo.js?v=13";
import { findHeaderRow, detectColumns, buildRecords, dedupeRecords, scoreSheet, labelKey, norm } from "./lib/ingest.js?v=13";
import { pivot, totals } from "./lib/pivot.js?v=13";

const $ = (id) => document.getElementById(id);
const els = {
  topMeta: $("topMeta"),
  statVph: $("statVph"),
  statViews: $("statViews"),
  statViewsBox: $("statViewsBox"),
  statVideos: $("statVideos"),
  statChannels: $("statChannels"),
  statChannelsBox: $("statChannelsBox"),
  statCountries: $("statCountries"),
  exportBtn: $("exportBtn"),
  fileInput: $("fileInput"),
  dropEmpty: $("dropEmpty"),
  sources: $("sources"),
  sourceFiles: $("sourceFiles"),
  sourceNote: $("sourceNote"),
  onlyTopic: $("onlyTopic"),
  onlyTopicWrap: $("onlyTopicWrap"),
  dedupe: $("dedupe"),
  clearBtn: $("clearBtn"),
  dropError: $("dropError"),
  dropVeil: $("dropVeil"),
  results: $("results"),
  filters: $("filters"),
  pivotsWrap: document.querySelector(".pivots"),
  pivots: document.querySelectorAll(".pivot"),
  library: $("library"),
  libraryCount: $("libraryCount"),
  librarySearch: $("librarySearch"),
  reviewOnly: $("reviewOnly"),
  extraBtn: $("extraBtn"),
  libraryScroll: $("libraryScroll"),
  libraryTable: $("libraryTable"),
  libraryMore: $("libraryMore"),
};

const BLANK = "__blank";
const PALETTE = ["#ffd166", "#ff7a52", "#f472b6", "#4ade80", "#22d3ee", "#a78bfa", "#fb923c", "#38bdf8", "#facc15", "#34d399", "#f87171", "#c084fc", "#2dd4bf", "#fda4af", "#93c5fd", "#bef264"];
const SPECIAL_GEO = new Set(["UNK", "MULTI", "WW"]);
const ROWS_PER_VIEW = 7; // số dòng hiện trong 1 lần cuộn của mỗi bảng
const PAGE = 100;
const DAY = 86400000;

// Nhóm theo số ngày đã đăng (số nguyên, tính theo giờ thực lúc dựng bảng).
const AGE_BUCKETS = [
  { key: "d3", name: "Dưới 3 ngày", range: "0 – 2 ngày", max: 2, color: "#f472b6" },
  { key: "d10", name: "Dưới 10 ngày", range: "3 – 9 ngày", max: 9, color: "#4ade80" },
  { key: "d30", name: "Dưới 30 ngày", range: "10 – 29 ngày", max: 29, color: "#ff7a52" },
  { key: "d30p", name: "Trên 30 ngày", range: "từ ngày 30", max: Infinity, color: "#60a5fa" },
  { key: "none", name: "Không rõ ngày đăng", range: "thiếu ngày đăng", max: null, color: "#6c6c9c" },
];
const AGE_BY_KEY = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, b]));
const OLD_DAYS = 30; // từ ngày này trở lên: ô "Lịch sử đăng" tô cam
function ageKeyOf(published) {
  if (published === null || published === undefined) return "none";
  const d = Math.max(0, Math.floor((Date.now() - published) / DAY));
  return AGE_BUCKETS.find((b) => b.max !== null && d <= b.max).key;
}

const DIMS = {
  topic: { title: "Tuyến đề", key: (r) => r.topicKey, label: (r) => r.topicLabel, special: (k) => k === BLANK },
  subject: { title: "Chủ thể chính", key: (r) => r.subjectKey, label: (r) => r.subjectLabel, special: (k) => k === BLANK },
  country: { title: "Quốc gia", key: (r) => r.countryKey, label: (r) => r.country, special: (k) => SPECIAL_GEO.has(k) },
  continent: { title: "Châu lục", key: (r) => r.continentKey, label: (r) => r.continent, special: (k) => SPECIAL_GEO.has(k) },
  channel: { title: "Kênh", key: (r) => r.channelKey, label: (r) => r.channelLabel, special: (k) => k === BLANK, views: true },
  age: { title: "Thời gian đăng", key: (r) => r.ageKey, label: (r) => AGE_BY_KEY[r.ageKey].name, special: (k) => k === "none", fixed: true },
};
const DIM_IDS = Object.keys(DIMS);

const state = {
  files: [],
  records: [],
  byKey: new Map(),
  excludedNoTopic: 0,
  duplicates: 0,
  has: {},
  topicColors: new Map(),
  sel: Object.fromEntries(DIM_IDS.map((d) => [d, new Set()])),
  sort: Object.fromEntries(DIM_IDS.map((d) => [d, { by: "sum", dir: "desc" }])),
  libSort: { by: "vph", dir: "desc" },
  showExtra: false,
  overrides: loadOverrides(),
  editingCountry: null,
  libraryLimit: PAGE,
};
let fileSeq = 0;

// ---------- tiện ích ----------
const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const nfCompact = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
const pf = new Intl.NumberFormat("vi-VN", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pf0 = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 0 });
const nfRaw = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const fmt = (n) => nf.format(n);
const fmtShort = (n) => (Math.abs(n) >= 10000 ? nfCompact.format(n) : nf.format(n));
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const colLetter = (i) => {
  let s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (t) => {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const fmtDateTime = (t) => {
  const d = new Date(t);
  return `${fmtDate(t)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// Số ngày kể từ lúc đăng, tính theo giờ thực: dưới 10 ngày hiện 1 chữ số thập phân.
const ageDays = (t) => (Date.now() - t) / DAY;
function fmtAge(t) {
  const d = ageDays(t);
  if (d < 0) return "Sắp";
  return fmt(Math.floor(d));
}
const isOld = (t) => Math.floor((Date.now() - t) / DAY) >= OLD_DAYS;
function ageTitle(t) {
  const ms = Date.now() - t;
  if (ms < 0) return `Đăng lúc ${fmtDateTime(t)} (chưa tới)`;
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3600000);
  return `Đã đăng ${d} ngày ${h} giờ (lúc ${fmtDateTime(t)})`;
}

function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem("tuyende:country-overrides") || "{}") || {};
  } catch {
    return {};
  }
}
function saveOverrides() {
  try {
    localStorage.setItem("tuyende:country-overrides", JSON.stringify(state.overrides));
  } catch {
    // trình duyệt chặn bộ nhớ -> sửa tay chỉ giữ trong phiên này
  }
}

// ---------- đọc file ----------
function readAs(file, kind) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("Không đọc được file"));
    kind === "text" ? r.readAsText(file, "utf-8") : r.readAsArrayBuffer(file);
  });
}

async function addFiles(fileList) {
  els.dropError.textContent = "";
  if (typeof XLSX === "undefined") {
    els.dropError.textContent = "Không tải được thư viện đọc Excel (cdnjs.cloudflare.com). Kiểm tra kết nối mạng rồi tải lại trang.";
    return;
  }
  const errors = [];
  for (const file of fileList) {
    try {
      const isText = /\.(csv|txt)$/i.test(file.name);
      const wb = isText
        ? XLSX.read(await readAs(file, "text"), { type: "string", raw: true })
        : XLSX.read(await readAs(file, "buffer"), { type: "array" });
      const entry = { id: ++fileSeq, name: file.name, wb, colsOpen: false };
      // Nhiều sheet: ưu tiên sheet có cột Tuyến đề, rồi tới sheet giống bảng video nhất.
      const scored = wb.SheetNames.map((n) => {
        const aoa = sheetAoa(wb, n);
        const h = findHeaderRow(aoa);
        const cols = detectColumns((aoa[h] || []).map(String), aoa.slice(h + 1));
        return { n, s: scoreSheet(aoa) + (cols.topic >= 0 ? 3 : 0) };
      });
      const best = scored.reduce((a, b) => (b.s > a.s ? b : a), scored[0]);
      loadSheet(entry, best.n);
      state.files.push(entry);
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }
  if (errors.length) els.dropError.textContent = `Không đọc được: ${errors.join(" · ")}`;
  rebuild();
}

function sheetAoa(wb, name) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true, blankrows: true });
}

function loadSheet(entry, sheetName) {
  entry.sheet = sheetName;
  entry.aoa = sheetAoa(entry.wb, sheetName);
  entry.headerRow = findHeaderRow(entry.aoa);
  const width = entry.aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const raw = entry.aoa[entry.headerRow] || [];
  entry.headers = Array.from({ length: width }, (_, i) => String(raw[i] ?? "").trim() || `Cột ${colLetter(i)}`);
  entry.cols = detectColumns(entry.headers, entry.aoa.slice(entry.headerRow + 1));
}

// ---------- gán nhóm cho từng video ----------
const geoCache = new Map();
function titleGeo(title) {
  let g = geoCache.get(title);
  if (!g) {
    g = extractGeo({ title });
    geoCache.set(title, g);
  }
  return g;
}
const specialGeo = (code, continentCode) => {
  const c = { MULTI: MULTI_COUNTRY, WW: WORLDWIDE_COUNTRY, UNK: UNKNOWN_COUNTRY }[code];
  return { countryCode: c.code, country: c.name, continentCode, continent: continentName(continentCode), source: "file", codes: [] };
};

function withGroups(rec, labels) {
  // Tuyến đề / Chủ thể chính / Kênh: đúng chữ trong file. Gộp không phân biệt hoa/thường; tên nhóm =
  // cách viết gặp đầu tiên.
  const group = (raw, map, blankLabel, prefix = "") =>
    raw ? [prefix + labelKey(raw), map.get(labelKey(raw))] : [BLANK, blankLabel];
  const [topicKey, topicLabel] = group(rec.topicRaw, labels.topic, "(trống)");
  const [subjectKey, subjectLabel] = group(rec.subjectRaw, labels.subject, "(trống)");
  const [channelKey, channelLabel] = group(rec.channel, labels.channel, "(không rõ kênh)", "c:");

  // Quốc gia: sửa tay > ô trong file > tự tìm từ tiêu đề.
  let geo;
  let countrySource;
  const ov = state.overrides[rec.key];
  if (ov && COUNTRIES[ov]) {
    geo = geoFromCodes([ov], "override");
    countrySource = "override";
  } else if (rec.countryRaw) {
    const sp = specialCountryCell(rec.countryRaw);
    if (sp === "MULTI") {
      // "Nhiều quốc gia": châu lục lấy theo tiêu đề nếu tiêu đề cho biết.
      const t = titleGeo(rec.title);
      geo = specialGeo("MULTI", t.continentCode !== "UNK" ? t.continentCode : "UNK");
    } else if (sp) {
      geo = specialGeo(sp, sp);
    } else {
      const code = countryFromCell(rec.countryRaw);
      geo = code
        ? geoFromCodes([code], "file")
        : { countryCode: "file:" + labelKey(rec.countryRaw), country: rec.countryRaw, continentCode: "UNK", continent: "Không xác định", source: "file" };
    }
    countrySource = "file";
  } else {
    geo = titleGeo(rec.title);
    countrySource = "title";
  }
  // Nước vắt ngang 2 châu lục: xếp châu lục theo nội dung tiêu đề (xem contentContinent trong geo.js).
  geo = contentContinent(geo, rec.title);
  // Châu lục: ô trong file nếu có (trừ khi quốc gia đã sửa tay), không thì theo quốc gia.
  let continentKey = geo.continentCode;
  let continent = geo.continent;
  if (rec.continentRaw && countrySource !== "override") {
    const c = continentFromCell(rec.continentRaw);
    if (c) {
      continentKey = c;
      continent = continentName(c);
    } else {
      continentKey = "file:" + labelKey(rec.continentRaw);
      continent = rec.continentRaw;
    }
  }

  return {
    ...rec,
    topicKey,
    topicLabel,
    subjectKey,
    subjectLabel,
    channelKey,
    channelLabel,
    countryKey: geo.countryCode,
    country: geo.country,
    continentKey,
    continent,
    countrySource,
    override: ov || null,
    ageKey: ageKeyOf(rec.published),
  };
}

function rebuild() {
  const all = [];
  for (const f of state.files) {
    if (f.cols.title < 0) {
      f.records = [];
      f.skipped = { empty: 0, total: 0 };
      continue;
    }
    const out = buildRecords(f.aoa, f.headerRow, f.cols, { source: f.name });
    f.records = out.records;
    f.skipped = out.skipped;
    all.push(...out.records);
  }
  const hasCol = (field) => state.files.some((f) => f.cols[field] >= 0);
  state.has = Object.fromEntries(
    ["topic", "subject", "channel", "views", "engagement", "date", "noun1", "noun2", "nature", "translation", "region"].map((k) => [k, hasCol(k)])
  );

  let records = all;
  state.duplicates = 0;
  if (els.dedupe.checked) {
    const d = dedupeRecords(all);
    records = d.records;
    state.duplicates = d.duplicates;
  }
  state.excludedNoTopic = 0;
  if (state.has.topic && els.onlyTopic.checked) {
    const kept = records.filter((r) => r.topicRaw);
    state.excludedNoTopic = records.length - kept.length;
    records = kept;
  }

  // Tên nhóm = cách viết xuất hiện đầu tiên; màu tuyến đề cố định theo thứ tự xuất hiện.
  const labels = { topic: new Map(), subject: new Map(), channel: new Map() };
  const firstSpelling = (map, raw) => raw && !map.has(labelKey(raw)) && map.set(labelKey(raw), raw);
  for (const r of records) {
    firstSpelling(labels.topic, r.topicRaw);
    firstSpelling(labels.subject, r.subjectRaw);
    firstSpelling(labels.channel, r.channel);
  }
  for (const key of labels.topic.keys()) if (!state.topicColors.has(key)) state.topicColors.set(key, PALETTE[state.topicColors.size % PALETTE.length]);

  state.records = records.map((r) => withGroups(r, labels));
  state.byKey = new Map(state.records.map((r) => [r.key, r]));
  for (const dim of DIM_IDS) {
    const keys = new Set(state.records.map(DIMS[dim].key));
    for (const k of state.sel[dim]) if (!keys.has(k)) state.sel[dim].delete(k);
  }
  render();
}

// ---------- lọc chéo ----------
const visibleDims = () =>
  DIM_IDS.filter((d) => (d === "subject" ? state.has.subject : d === "channel" ? state.has.channel : d === "age" ? state.has.date : true));
function filtered(except) {
  return state.records.filter((r) =>
    DIM_IDS.every((d) => d === except || !state.sel[d].size || state.sel[d].has(DIMS[d].key(r)))
  );
}

function sortRows(dim, rows) {
  if (DIMS[dim].fixed) {
    const order = AGE_BUCKETS.map((b) => b.key);
    return rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }
  const { by, dir } = state.sort[dim];
  const D = DIMS[dim];
  const s = dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    if (by === "label") {
      const sa = D.special(a.key);
      const sb = D.special(b.key);
      if (sa !== sb) return sa ? 1 : -1; // "(trống)", "Unknown"... luôn nằm cuối
      return s * a.label.localeCompare(b.label, "vi", { numeric: true });
    }
    return s * (a[by] - b[by]) || b.sum - a.sum || a.label.localeCompare(b.label, "vi");
  });
  // Dòng đang chọn luôn nằm trên cùng để thấy ngay số liệu của nó.
  const sel = state.sel[dim];
  if (!sel.size) return rows;
  return [...rows.filter((r) => sel.has(r.key)), ...rows.filter((r) => !sel.has(r.key))];
}

// ---------- render ----------
function render() {
  const has = state.files.length > 0;
  els.dropEmpty.hidden = has;
  els.sources.hidden = !has;
  els.onlyTopicWrap.hidden = !state.has.topic;
  els.results.hidden = !state.records.length;
  els.topMeta.hidden = !state.records.length;
  renderSources();
  if (!state.records.length) return;
  renderStats();
  renderFilters();
  const vis = new Set(visibleDims());
  els.pivotsWrap.classList.toggle("no-subject", !vis.has("subject"));
  els.pivotsWrap.classList.toggle("no-channel", !vis.has("channel"));
  for (const el of els.pivots) {
    el.hidden = !vis.has(el.dataset.dim);
    if (!el.hidden) el.dataset.dim === "age" ? renderAgeCard(el) : renderPivot(el, el.dataset.dim);
  }
  renderLibrary();
}

// Các cột người dùng chọn lại được cho từng file. [trường, nhãn, chữ khi không chọn cột]
const FIELDS = [
  ["title", "Tiêu đề video", null],
  ["topic", "Tuyến đề", "(không có)"],
  ["subject", "Chủ thể chính", "(không có)"],
  ["vph", "View/giờ (VPH)", "(không có)"],
  ["channel", "Kênh", "(không có)"],
  ["views", "Lượt xem", "(không có)"],
  ["engagement", "Tương tác", "(không có)"],
  ["date", "Ngày đăng", "(không có)"],
  ["translation", "Bản dịch tiếng Việt", "(dịch tự động khi trỏ chuột)"],
  ["country", "Quốc gia", "(tự tìm từ tiêu đề)"],
  ["continent", "Châu lục", "(theo quốc gia)"],
  ["link", "Link video", "(không có)"],
  ["region", "Khu vực", "(không có)"],
  ["noun1", "Danh từ 1", "(không có)"],
  ["noun2", "Danh từ 2", "(không có)"],
  ["nature", "Tính chất", "(không có)"],
];

function renderSources() {
  els.sourceFiles.innerHTML = state.files
    .map((f) => {
      const select = (field, label, noneLabel) => {
        const sel = f.cols[field];
        const none = noneLabel
          ? `<option value="-1"${sel === -1 ? " selected" : ""}>${noneLabel}</option>`
          : sel < 0
            ? `<option value="-1" selected>Chọn cột…</option>`
            : "";
        const warn = (field === "topic" || field === "title") && sel < 0 ? " warn" : "";
        return `<label class="colpick"><span>${label}</span><select class="mini${warn}" data-file="${f.id}" data-field="${field}">${none}${f.headers
          .map((h, i) => `<option value="${i}"${i === sel ? " selected" : ""}>${esc(h)}</option>`)
          .join("")}</select></label>`;
      };
      const sheets =
        f.wb.SheetNames.length > 1
          ? `<select class="mini" data-file="${f.id}" data-field="sheet" aria-label="Sheet">${f.wb.SheetNames.map((n) => `<option${n === f.sheet ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`
          : `<span class="muted">Sheet ${esc(f.sheet)}</span>`;
      const n = f.records?.length ?? 0;
      const found = FIELDS.filter(([field]) => f.cols[field] >= 0).length;
      const open = f.colsOpen || f.cols.title < 0;
      return `<div class="srcfile">
        <div class="srcfile__head">
          <span class="fname" title="${esc(f.name)}">${esc(f.name)}</span>
          ${sheets}
          <span class="srcfile__count${n ? "" : " warn"}" title="Số dòng video đọc được trong file, trước khi gộp trùng">${fmt(n)} dòng video</span>
          <button type="button" class="icon-btn" data-remove="${f.id}" title="Bỏ file này" aria-label="Bỏ file ${esc(f.name)}">✕</button>
        </div>
        <details class="srcfile__cols" data-file="${f.id}"${open ? " open" : ""}>
          <summary>Cột dữ liệu: app nhận ra ${found}/${FIELDS.length} cột (bấm để xem / chọn lại)</summary>
          <div class="colgrid">${FIELDS.map(([field, label, none]) => select(field, label, none)).join("")}</div>
        </details>
      </div>`;
    })
    .join("");

  const notes = [];
  if (state.files.length && !state.has.topic) {
    notes.push(
      'File chưa có cột "Tuyến đề": thêm 1 cột tên "Tuyến đề" vào file Excel rồi điền tuyến cho từng video, hoặc chọn cột chứa tuyến đề trong mục "Cột dữ liệu" phía trên.'
    );
  }
  if (state.excludedNoTopic) notes.push(`Bỏ qua ${fmt(state.excludedNoTopic)} video chưa điền tuyến đề (bỏ tích "Chỉ tính video đã có tuyến đề" để tính cả).`);
  if (state.duplicates) notes.push(`Đã gộp ${fmt(state.duplicates)} dòng trùng video (giữ bản xuất hiện sau cùng, ô trống lấy từ bản trước).`);
  const totalsSkipped = state.files.reduce((s, f) => s + (f.skipped?.total || 0), 0);
  if (totalsSkipped) notes.push(`Bỏ qua ${totalsSkipped} dòng "Tổng cộng".`);
  const noVph = state.records.filter((r) => r.vph === null).length;
  if (noVph) notes.push(`${fmt(noVph)} video có ô VPH trống hoặc là chữ (vd "Sắp phát"): vẫn được đếm trong COUNTA nhưng không cộng vào SUM.`);
  if (state.has.date) {
    const badDate = state.records.filter((r) => r.published === null && r.publishedRaw !== "").length;
    if (badDate) notes.push(`${fmt(badDate)} ô ngày đăng không đọc được (cần dạng 05/10/2026, 2026-10-05 hoặc ô ngày của Excel).`);
  }
  els.sourceNote.innerHTML = notes.map((n, i) => (i === 0 && !state.has.topic ? `<span class="warn">${esc(n)}</span>` : esc(n))).join(" ");
}

function renderStats() {
  const recs = filtered(null);
  els.statVph.textContent = fmt(recs.reduce((s, r) => s + (r.vph ?? 0), 0));
  els.statViewsBox.hidden = !state.has.views;
  els.statViews.textContent = fmtShort(recs.reduce((s, r) => s + (r.views ?? 0), 0));
  els.statVideos.textContent = fmt(recs.length);
  els.statChannelsBox.hidden = !state.has.channel;
  els.statChannels.textContent = fmt(new Set(recs.map((r) => r.channelKey).filter((c) => c !== BLANK)).size);
  els.statCountries.textContent = fmt(new Set(recs.map((r) => r.countryKey).filter((c) => !SPECIAL_GEO.has(c))).size);
}

function renderFilters() {
  const chips = [];
  for (const dim of DIM_IDS) {
    for (const key of state.sel[dim]) {
      const r = state.records.find((x) => DIMS[dim].key(x) === key);
      if (!r) continue;
      chips.push(
        `<button type="button" class="fchip fchip--${dim}" data-dim="${dim}" data-key="${esc(key)}" title="Bỏ lọc"><small>${DIMS[dim].title}:</small> ${esc(DIMS[dim].label(r))} <span>✕</span></button>`
      );
    }
  }
  els.filters.innerHTML = chips.length
    ? `<span class="filters__label">Đang lọc:</span>${chips.join("")}<button type="button" class="btn btn--small btn--ghost" data-clear-filters>Bỏ lọc tất cả</button>`
    : "";
}

function pivotColumns(dim) {
  const cols = [{ id: "sum", label: "Sum of VPH" }];
  if (DIMS[dim].views && state.has.views) cols.push({ id: "views", label: "Tổng view" });
  cols.push({ id: "count", label: "COUNTA", title: `COUNTA của ${DIMS[dim].title}` });
  cols.push({ id: "count", label: "%", title: "% theo COUNTA (số video của dòng / tổng số video trong bảng)", pct: true });
  return cols;
}

// Thẻ "VPH theo thời gian đăng": 4 nhóm cố định, % = phần VPH của nhóm / tổng VPH (theo bộ lọc).
function renderAgeCard(el) {
  const recs = filtered("age");
  const groups = new Map(pivot(recs, DIMS.age.key, DIMS.age.label).map((g) => [g.key, g]));
  const total = recs.reduce((s, r) => s + (r.vph ?? 0), 0);
  const sel = state.sel.age;
  const chSel = state.sel.channel;
  const scope = !chSel.size
    ? "tất cả kênh"
    : chSel.size === 1
      ? esc(state.records.find((r) => chSel.has(r.channelKey))?.channelLabel || "1 kênh")
      : `${chSel.size} kênh`;
  const rows = AGE_BUCKETS.filter((b) => b.key !== "none" || groups.get("none")?.count)
    .map((b) => {
      const g = groups.get(b.key) || { sum: 0, count: 0 };
      const share = total ? g.sum / total : 0;
      const cls = ["agerow", sel.has(b.key) ? "is-selected" : "", sel.size && !sel.has(b.key) ? "is-dim" : ""].join(" ");
      return `<div class="${cls}" data-key="${b.key}" role="button" tabindex="0" aria-pressed="${sel.has(b.key)}" style="--c:${b.color}">
        <div class="agerow__top"><span class="agerow__name"><i></i>${b.name}</span><b class="agerow__sum">${fmt(g.sum)}</b><span class="agerow__pct">${pf0.format(share)}</span></div>
        <div class="agerow__bot"><span class="agerow__bar"><span style="width:${(share * 100).toFixed(1)}%"></span></span><span class="agerow__sub">${b.range} · ${fmt(g.count)} video</span></div>
      </div>`;
    })
    .join("");
  el.innerHTML = `<div class="agecard">
    <div class="agecard__head"><div class="agecard__title">VPH theo thời gian đăng</div><div class="agecard__total">Tổng ${fmt(total)} · ${scope}</div></div>
    ${rows}
  </div>`;
}

function renderPivot(el, dim) {
  const D = DIMS[dim];
  const rows = sortRows(dim, pivot(filtered(dim), D.key, D.label));
  const t = totals(rows);
  const max = Math.max(1, ...rows.map((r) => r.sum));
  const sel = state.sel[dim];
  const { by, dir } = state.sort[dim];
  const cols = pivotColumns(dim);
  const th = (key, text, cls = "", title = "", noArrow = false) => {
    const on = by === key && !noArrow;
    return `<th data-sort="${key}" class="${cls}${on ? " is-sorted" : ""}"${title ? ` title="${esc(title)}"` : ""} aria-sort="${on ? (dir === "asc" ? "ascending" : "descending") : "none"}">${text}${on ? `<span class="arrow">${dir === "asc" ? "▲" : "▼"}</span>` : ""}</th>`;
  };
  const cell = (c, r) => {
    if (c.pct) return `<td class="num pct">${t.count ? pf.format(r.count / t.count) : "–"}</td>`;
    if (c.id === "sum") {
      const missing = r.count - r.vphCount;
      return `<td class="num bar" style="--w:${((r.sum / max) * 100).toFixed(1)}"${missing ? ` title="${missing} video không có VPH là số"` : ""}>${fmt(r.sum)}</td>`;
    }
    if (c.id === "views") return `<td class="num" title="${fmt(r.views)} lượt xem">${r.viewsCount ? fmtShort(r.views) : "–"}</td>`;
    return `<td class="num">${fmt(r.count)}</td>`;
  };
  const body = rows.length
    ? rows
        .map((r) => {
          const color = dim === "topic" && !D.special(r.key) ? state.topicColors.get(r.key) : null;
          const cls = [sel.has(r.key) ? "is-selected" : "", sel.size && !sel.has(r.key) ? "is-dim" : ""].join(" ");
          return `<tr class="${cls}" data-key="${esc(r.key)}" tabindex="0" aria-pressed="${sel.has(r.key)}">
            <td><span class="label" title="${esc(r.label)}">${color ? `<i style="background:${color}"></i>` : ""}<span class="${D.special(r.key) ? "muted" : ""}">${esc(r.label)}</span></span></td>
            ${cols.map((c) => cell(c, r)).join("")}
          </tr>`;
        })
        .join("")
    : `<tr class="empty"><td colspan="${cols.length + 1}">Không có dữ liệu với bộ lọc hiện tại</td></tr>`;
  const foot = cols
    .map((c) =>
      c.pct ? `<td class="num">${t.count ? pf.format(1) : "–"}</td>` : c.id === "views" ? `<td class="num" title="${fmt(t.views)}">${fmtShort(t.views)}</td>` : `<td class="num">${fmt(c.id === "sum" ? t.sum : t.count)}</td>`
    )
    .join("");
  el.innerHTML = `<div class="pivot__scroll"><table class="pt">
    <thead><tr>${th("label", D.title)}${cols.map((c) => th(c.pct ? "count" : c.id, c.label, "num" + (c.pct ? " pct-h" : ""), c.title, c.pct)).join("")}</tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td>Tổng cộng</td>${foot}</tr></tfoot>
  </table></div>`;
  fitRows(el.querySelector(".pivot__scroll"), true);
}

// Khung cuộn vừa đúng ROWS_PER_VIEW dòng (cộng hàng tiêu đề và hàng Tổng cộng).
function fitRows(scroll, withFoot) {
  if (!scroll) return;
  const rows = scroll.querySelectorAll("tbody tr");
  if (rows.length <= ROWS_PER_VIEW) {
    scroll.style.maxHeight = "";
    return;
  }
  let h = scroll.querySelector("thead")?.offsetHeight || 0;
  if (withFoot) h += scroll.querySelector("tfoot")?.offsetHeight || 0;
  for (let i = 0; i < ROWS_PER_VIEW; i++) h += rows[i].offsetHeight;
  if (h > 0) scroll.style.maxHeight = `${h + 1}px`;
}
function fitAll() {
  for (const el of els.pivots) if (!el.hidden) fitRows(el.querySelector(".pivot__scroll"), true);
  if (els.library.open) {
    sizeColumns();
    fitRows(els.libraryScroll, false);
  }
}

// ---------- danh sách video ----------
// w: độ rộng cột (px). num: cột số (bấm tiêu đề -> cao xuống thấp). filter: bấm ô -> lọc bảng thống kê.
const LIB_COLS = [
  { id: "thumb", label: "", w: 96 },
  { id: "title", label: "Video", text: (r) => r.title },
  { id: "channel", label: "Kênh", w: 112, need: "channel", text: (r) => (r.channelKey === BLANK ? "" : r.channelLabel), filter: "channel" },
  { id: "date", label: "Ngày đăng", w: 88, need: "date", num: (r) => r.published },
  { id: "age", label: "Lịch sử đăng", w: 74, need: "date", num: (r) => (r.published === null ? null : -r.published) },
  { id: "views", label: "Lượt xem", w: 92, need: "views", num: (r) => r.views },
  { id: "engagement", label: "Tương tác", w: 80, need: "engagement", num: (r) => r.engagement },
  { id: "vph", label: "VPH", w: 66, num: (r) => r.vph },
  { id: "topic", label: "Tuyến đề", w: 124, text: (r) => (r.topicKey === BLANK ? "" : r.topicLabel), filter: "topic" },
  { id: "subject", label: "Chủ thể chính", w: 112, need: "subject", text: (r) => (r.subjectKey === BLANK ? "" : r.subjectLabel), filter: "subject" },
  { id: "country", label: "Quốc gia", w: 108, text: (r) => r.country, filter: "country" },
  { id: "continent", label: "Châu lục", w: 86, text: (r) => r.continent, filter: "continent" },
  { id: "region", label: "Khu vực", w: 100, need: "region", text: (r) => r.region },
  { id: "noun1", label: "Danh từ 1", w: 100, need: "noun1", text: (r) => r.noun1 },
  { id: "noun2", label: "Danh từ 2", w: 100, extra: true, text: (r) => r.noun2 },
  { id: "nature", label: "Tính chất", w: 100, extra: true, text: (r) => r.nature },
];
const LIB_BY_ID = Object.fromEntries(LIB_COLS.map((c) => [c.id, c]));
const libCols = () => LIB_COLS.filter((c) => (c.extra ? state.showExtra : !c.need || state.has[c.need]));

function libraryRecords() {
  const q = norm(els.librarySearch.value);
  let recs = filtered(null);
  if (els.reviewOnly.checked) recs = recs.filter((r) => r.countryKey === "UNK");
  if (q)
    recs = recs.filter((r) =>
      norm(`${r.title} ${r.translation} ${r.channel} ${r.topicLabel} ${r.subjectLabel} ${r.country} ${r.region} ${r.noun1} ${r.noun2} ${r.nature}`).includes(q)
    );
  const col = LIB_BY_ID[state.libSort.by] || LIB_BY_ID.vph;
  const s = state.libSort.dir === "asc" ? 1 : -1;
  const val = col.num || col.text;
  return [...recs].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    const ea = va === null || va === undefined || va === "";
    const eb = vb === null || vb === undefined || vb === "";
    if (ea !== eb) return ea ? 1 : -1; // ô trống luôn nằm cuối
    if (ea) return (b.vph ?? -1) - (a.vph ?? -1);
    const d = col.num ? va - vb : String(va).localeCompare(String(vb), "vi", { numeric: true });
    return s * d || (b.vph ?? -1) - (a.vph ?? -1);
  });
}

let COUNTRY_OPTIONS = null;
function renderLibrary() {
  const recs = libraryRecords();
  const cols = libCols();
  const LIMIT = state.libraryLimit;
  els.libraryCount.textContent = `(${fmt(recs.length)})`;
  els.extraBtn.textContent = state.showExtra ? "Ẩn bớt" : "Xem thêm: Danh từ 2 · Tính chất";
  els.extraBtn.setAttribute("aria-pressed", String(state.showExtra));
  COUNTRY_OPTIONS ??= countryList().map((c) => `<option value="${c.code}">${esc(c.name)}</option>`).join("");

  const { by, dir } = state.libSort;
  const head = cols
    .map((c) => {
      if (c.id === "thumb") return `<th class="c-thumb"></th>`;
      const on = by === c.id;
      return `<th data-lsort="${c.id}" class="${c.num ? "num " : ""}${on ? "is-sorted" : ""}${c.extra ? " is-extra" : ""}" aria-sort="${on ? (dir === "asc" ? "ascending" : "descending") : "none"}" title="Bấm để sắp xếp${c.num ? " (cao → thấp)" : ""}">${c.label}${c.sub ? `<small>${c.sub}</small>` : ""}${on ? `<span class="arrow">${dir === "asc" ? "▲" : "▼"}</span>` : ""}</th>`;
    })
    .join("");
  const colgroup = cols.map((c) => `<col data-w="${c.w || ""}">`).join("");

  const cellHtml = (c, r) => {
    switch (c.id) {
      case "thumb": {
        const href = videoHref(r);
        // Ảnh lấy thẳng theo ID video (ảnh 320x180 YouTube luôn có sẵn).
        const src = r.key.startsWith("id:") ? `https://i.ytimg.com/vi/${r.key.slice(3)}/mqdefault.jpg` : "";
        const img = src ? `<img src="${src}" alt="" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer" width="88" height="50">` : "";
        return img
          ? href
            ? `<a class="thumb" href="${esc(href)}" target="_blank" rel="noopener" tabindex="-1">${img}</a>`
            : `<span class="thumb">${img}</span>`
          : `<span class="thumb thumb--empty"></span>`;
      }
      case "title": {
        const href = videoHref(r);
        const inner = `<span class="vtitle" data-tr="${esc(r.key)}" tabindex="0">${esc(r.title)}</span>`;
        return `${href ? `<a class="vlink" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : inner}<span class="sub">${esc(r.source)} · dòng ${r.row}</span>`;
      }
      case "date":
        return r.published === null
          ? `<span class="muted">${esc(r.publishedRaw || "–")}</span>`
          : `<span title="${fmtDateTime(r.published)}">${fmtDate(r.published)}</span>`;
      case "age":
        if (r.published === null) return `<span class="muted">–</span>`;
        return `<button type="button" class="cell-link age${isOld(r.published) ? " is-old" : ""}${state.sel.age.has(r.ageKey) ? " is-on" : ""}" data-fdim="age" data-fkey="${r.ageKey}" data-pub="${r.published}" title="${ageTitle(r.published)}">${fmtAge(r.published)}</button>`;
      case "views":
        return r.views === null ? `<span class="muted">–</span>` : fmt(r.views);
      case "engagement": {
        // Hiện đúng giá trị trong file, không tính toán.
        const v = r.engagementRaw;
        if (v === null || v === undefined || String(v).trim() === "") return `<span class="muted">–</span>`;
        return typeof v === "number" ? nfRaw.format(v) : esc(String(v).trim());
      }
      case "vph":
        return r.vph === null ? `<span class="muted">${esc(r.vphRaw || "–")}</span>` : fmt(r.vph);
      case "country": {
        if (state.editingCountry === r.key) {
          return `<select class="mini" data-key="${esc(r.key)}" aria-label="Quốc gia"><option value="">${r.countryRaw ? `Theo file: ${esc(r.countryRaw)}` : "Tự tìm từ tiêu đề"}</option>${COUNTRY_OPTIONS.replace(`value="${r.override}"`, `value="${r.override}" selected`)}</select>`;
        }
        const mark =
          r.countrySource === "override"
            ? `<span class="mark mark--edit" title="Đã sửa tay">sửa</span>`
            : r.countrySource === "title"
              ? `<span class="mark mark--warn" title="Tự tìm từ tiêu đề">≈</span>`
              : "";
        return `${filterBtn("country", r.countryKey, r.country, SPECIAL_GEO.has(r.countryKey))}${mark}<button type="button" class="edit-btn" data-edit-country="${esc(r.key)}" title="Sửa quốc gia" aria-label="Sửa quốc gia">✎</button>`;
      }
      case "continent":
        return filterBtn("continent", r.continentKey, r.continent, SPECIAL_GEO.has(r.continentKey));
      case "topic": {
        const color = state.topicColors.get(r.topicKey);
        return filterBtn("topic", r.topicKey, r.topicLabel, r.topicKey === BLANK, color);
      }
      case "subject":
        return filterBtn("subject", r.subjectKey, r.subjectLabel, r.subjectKey === BLANK);
      case "channel":
        return filterBtn("channel", r.channelKey, r.channelLabel, r.channelKey === BLANK);
      default:
        return r[c.id] ? esc(r[c.id]) : `<span class="muted">–</span>`;
    }
  };

  const body =
    recs
      .slice(0, LIMIT)
      .map((r) => `<tr>${cols.map((c) => `<td class="c-${c.id}${c.num ? " num" : ""}${c.extra ? " is-extra" : ""}">${cellHtml(c, r)}</td>`).join("")}</tr>`)
      .join("") || `<tr><td colspan="${cols.length}" class="muted">Không có video nào khớp.</td></tr>`;

  els.libraryTable.classList.toggle("with-extra", state.showExtra);
  els.libraryTable.innerHTML = `<colgroup>${colgroup}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  sizeColumns();
  // Chỉ vẽ 100 dòng mỗi lần cho nhẹ; bấm "Hiện thêm" để xem tiếp.
  const more = recs.length - LIMIT;
  els.libraryMore.hidden = more <= 0;
  if (more > 0) els.libraryMore.textContent = `Hiện thêm ${fmt(Math.min(PAGE, more))} video (còn ${fmt(more)})`;
  fitRows(els.libraryScroll, false);
}

// Chia độ rộng cột theo khung đang có: cột Video luôn giữ ít nhất MIN_TITLE px, các cột khác co lại
// tối đa còn 62% nếu thiếu chỗ (vd khi bật "Xem thêm"). Chật hơn nữa (màn hình nhỏ) mới cho lướt ngang.
const MIN_TITLE = 260;
function sizeColumns() {
  const avail = els.libraryScroll.clientWidth;
  if (!avail) return;
  const cols = [...els.libraryTable.querySelectorAll("col")];
  const fixed = cols.reduce((s, c) => s + (Number(c.dataset.w) || 0), 0);
  const k = Math.max(0.62, Math.min(1, (avail - MIN_TITLE) / fixed));
  for (const c of cols) if (c.dataset.w) c.style.width = `${Math.floor(Number(c.dataset.w) * k)}px`;
  els.libraryTable.style.minWidth = `${Math.ceil(fixed * k + MIN_TITLE)}px`;
  els.libraryScroll.style.overflowX = fixed * k + MIN_TITLE > avail + 1 ? "auto" : "hidden";
}

const videoHref = (r) => (r.key.startsWith("id:") ? `https://www.youtube.com/watch?v=${r.key.slice(3)}` : /^https?:/i.test(r.link) ? r.link : "");

// Ô bấm được trong danh sách video -> lọc các bảng thống kê theo đúng giá trị đó.
function filterBtn(dim, key, label, muted, color) {
  const on = state.sel[dim].has(key);
  return `<button type="button" class="cell-link${on ? " is-on" : ""}${muted ? " muted" : ""}" data-fdim="${dim}" data-fkey="${esc(key)}" title="Bấm để xem thống kê của ${esc(DIMS[dim].title)}: ${esc(label)}">${color ? `<i style="background:${color}"></i>` : ""}${esc(label)}</button>`;
}

// Cập nhật cột "Lịch sử đăng" theo thời gian thực (mỗi phút).
setInterval(() => {
  for (const el of els.libraryTable.querySelectorAll("[data-pub]")) {
    const t = Number(el.dataset.pub);
    el.textContent = fmtAge(t);
    el.title = ageTitle(t);
    el.classList.toggle("is-old", isOld(t));
  }
}, 60000);

// ---------- dịch tiêu đề khi trỏ chuột ----------
// Ưu tiên cột bản dịch trong file (vd cột "Dịch" của app theo dõi kênh); không có thì gọi Google Dịch
// (chỉ gửi đúng tiêu đề đang trỏ) và nhớ kết quả trên trình duyệt này.
const TR_KEY = "tuyende:translations";
const trCache = (() => {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(TR_KEY) || "{}")));
  } catch {
    return new Map();
  }
})();
const trPending = new Map();
function saveTr() {
  try {
    const entries = [...trCache.entries()].slice(-3000);
    localStorage.setItem(TR_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // bộ nhớ đầy / bị chặn -> chỉ nhớ trong phiên
  }
}
function translate(text) {
  if (trCache.has(text)) return Promise.resolve(trCache.get(text));
  if (trPending.has(text)) return trPending.get(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
  const p = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const vi = (data?.[0] || []).map((x) => x?.[0] || "").join("").trim();
      if (!vi) throw new Error("Không có bản dịch");
      trCache.set(text, vi);
      saveTr();
      return vi;
    })
    .finally(() => trPending.delete(text));
  trPending.set(text, p);
  return p;
}

const tip = document.createElement("div");
tip.className = "tip";
tip.setAttribute("role", "tooltip");
tip.hidden = true;
document.body.appendChild(tip);
let tipFor = null;
let tipTimer = 0;

function placeTip(anchor) {
  const r = anchor.getBoundingClientRect();
  tip.style.left = "0px";
  tip.style.top = "0px";
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  const below = r.bottom + 8;
  const top = below + h > window.innerHeight - 8 && r.top - h - 8 > 8 ? r.top - h - 8 : below;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}
function showTip(anchor, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  placeTip(anchor);
}
function hideTip() {
  clearTimeout(tipTimer);
  tipFor = null;
  tip.hidden = true;
}
function openTranslation(anchor) {
  const rec = state.byKey.get(anchor.dataset.tr);
  if (!rec) return;
  tipFor = anchor;
  anchor.setAttribute("aria-describedby", "trTip");
  tip.id = "trTip";
  const body = (vi, src) => `<div class="tip__label">Tiếng Việt</div><div class="tip__vi">${esc(vi)}</div><div class="tip__src">${src}</div>`;
  if (rec.translation) return showTip(anchor, body(rec.translation, "Theo cột bản dịch trong file"));
  if (trCache.has(rec.title)) return showTip(anchor, body(trCache.get(rec.title), "Google Dịch"));
  showTip(anchor, `<div class="tip__label">Tiếng Việt</div><div class="tip__vi muted">Đang dịch…</div>`);
  translate(rec.title).then(
    (vi) => tipFor === anchor && showTip(anchor, body(vi, "Google Dịch")),
    () =>
      tipFor === anchor &&
      showTip(
        anchor,
        `<div class="tip__label">Tiếng Việt</div><div class="tip__vi muted">Không dịch được (mạng chặn Google Dịch?). Thêm cột "Dịch" vào file để luôn có bản dịch.</div>`
      )
  );
}
els.libraryTable.addEventListener("mouseover", (e) => {
  const a = e.target.closest(".vtitle");
  if (!a || a === tipFor) return;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => openTranslation(a), 250);
});
els.libraryTable.addEventListener("mouseout", (e) => {
  const a = e.target.closest(".vtitle");
  if (!a || (e.relatedTarget && a.contains(e.relatedTarget))) return;
  hideTip();
});
els.libraryTable.addEventListener("focusin", (e) => {
  const a = e.target.closest(".vtitle");
  if (a) openTranslation(a);
});
els.libraryTable.addEventListener("focusout", hideTip);
window.addEventListener("scroll", hideTip, { passive: true });
els.libraryScroll.addEventListener("scroll", hideTip, { passive: true });

// ---------- tương tác ----------
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-pick]")) els.fileInput.click();
});
els.fileInput.addEventListener("change", () => {
  if (els.fileInput.files.length) addFiles([...els.fileInput.files]);
  els.fileInput.value = "";
});
els.clearBtn.addEventListener("click", () => {
  state.files = [];
  state.topicColors.clear();
  Object.values(state.sel).forEach((s) => s.clear());
  rebuild();
});
els.dedupe.addEventListener("change", rebuild);
els.onlyTopic.addEventListener("change", rebuild);

els.sourceFiles.addEventListener("change", (e) => {
  const s = e.target.closest("select[data-file]");
  if (!s) return;
  const f = state.files.find((x) => x.id === Number(s.dataset.file));
  if (!f) return;
  if (s.dataset.field === "sheet") loadSheet(f, s.value);
  else f.cols = { ...f.cols, [s.dataset.field]: Number(s.value) };
  rebuild();
});
els.sourceFiles.addEventListener("click", (e) => {
  const b = e.target.closest("[data-remove]");
  if (!b) return;
  state.files = state.files.filter((f) => f.id !== Number(b.dataset.remove));
  rebuild();
});
els.sourceFiles.addEventListener(
  "toggle",
  (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement)) return;
    const f = state.files.find((x) => x.id === Number(d.dataset.file));
    if (f) f.colsOpen = d.open;
  },
  true
);

let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
  dragDepth++;
  els.dropVeil.hidden = false;
});
window.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    els.dropVeil.hidden = true;
  }
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  els.dropVeil.hidden = true;
  if (e.dataTransfer?.files?.length) addFiles([...e.dataTransfer.files]);
});

const scrollPivotsTop = () => {
  for (const el of els.pivots) {
    const s = el.querySelector(".pivot__scroll");
    if (s) s.scrollTop = 0;
  }
};
function toggleSel(dim, key) {
  state.libraryLimit = PAGE;
  const s = state.sel[dim];
  s.has(key) ? s.delete(key) : s.add(key);
  render();
  scrollPivotsTop();
}
for (const el of els.pivots) {
  const dim = el.dataset.dim;
  el.addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort]");
    if (th) {
      const cur = state.sort[dim];
      const by = th.dataset.sort;
      state.sort[dim] = cur.by === by ? { by, dir: cur.dir === "asc" ? "desc" : "asc" } : { by, dir: by === "label" ? "asc" : "desc" };
      renderPivot(el, dim);
      return;
    }
    const tr = e.target.closest("tbody tr[data-key], .agerow[data-key]");
    if (tr) toggleSel(dim, tr.dataset.key);
  });
  el.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tbody tr[data-key], .agerow[data-key]");
    if (tr && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggleSel(dim, tr.dataset.key);
    }
  });
}
els.filters.addEventListener("click", (e) => {
  if (e.target.closest("[data-clear-filters]")) {
    Object.values(state.sel).forEach((s) => s.clear());
    state.libraryLimit = PAGE;
    return render();
  }
  const chip = e.target.closest(".fchip");
  if (chip) toggleSel(chip.dataset.dim, chip.dataset.key);
});

// Ảnh lỗi (video đã bị xoá / riêng tư): để ô trống có sọc.
els.libraryTable.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const box = img.closest(".thumb");
    if (box) {
      box.classList.add("thumb--empty");
      box.title = `Không tải được ảnh: ${img.src}`;
    }
    img.remove();
  },
  true
);

// Đổi tìm kiếm / bộ lọc -> quay về 100 dòng đầu.
const resetLibrary = () => {
  state.libraryLimit = PAGE;
  renderLibrary();
};
els.librarySearch.addEventListener("input", resetLibrary);
els.reviewOnly.addEventListener("change", resetLibrary);
els.extraBtn.addEventListener("click", () => {
  state.showExtra = !state.showExtra;
  if (!state.showExtra && LIB_BY_ID[state.libSort.by]?.extra) state.libSort = { by: "vph", dir: "desc" };
  renderLibrary();
});
els.libraryMore.addEventListener("click", () => {
  state.libraryLimit += PAGE;
  renderLibrary();
});
els.library.addEventListener("toggle", () => els.library.open && fitAll());

els.libraryTable.addEventListener("click", (e) => {
  // Bấm tiêu đề cột -> sắp xếp. Cột số: lần đầu cao → thấp; cột chữ: A → Z. Bấm lại để đảo chiều.
  const th = e.target.closest("th[data-lsort]");
  if (th) {
    const by = th.dataset.lsort;
    const cur = state.libSort;
    state.libSort = cur.by === by ? { by, dir: cur.dir === "asc" ? "desc" : "asc" } : { by, dir: LIB_BY_ID[by].num ? "desc" : "asc" };
    state.libraryLimit = PAGE;
    renderLibrary();
    els.libraryScroll.scrollTop = 0;
    return;
  }
  const edit = e.target.closest("[data-edit-country]");
  if (edit) {
    state.editingCountry = edit.dataset.editCountry;
    renderLibrary();
    els.libraryTable.querySelector("select[data-key]")?.focus();
    return;
  }
  // Bấm 1 ô (Tuyến đề, Chủ thể chính, Quốc gia, Châu lục, Kênh) -> các bảng thống kê lọc theo giá trị đó.
  const cell = e.target.closest(".cell-link");
  if (cell) {
    const { fdim: dim, fkey: key } = cell.dataset;
    const s = state.sel[dim];
    const only = s.size === 1 && s.has(key);
    s.clear();
    if (!only) s.add(key);
    state.libraryLimit = PAGE;
    render();
    scrollPivotsTop();
    if (!only) {
      els.results.scrollIntoView({ behavior: "smooth", block: "start" });
      const p = document.querySelector(`.pivot[data-dim="${dim}"]`);
      p?.classList.remove("flash");
      void p?.offsetWidth;
      p?.classList.add("flash");
    }
  }
});
els.libraryTable.addEventListener("change", (e) => {
  const s = e.target.closest("select[data-key]");
  if (!s) return;
  if (s.value) state.overrides[s.dataset.key] = s.value;
  else delete state.overrides[s.dataset.key];
  saveOverrides();
  state.editingCountry = null;
  rebuild();
});
els.libraryTable.addEventListener("focusout", (e) => {
  const s = e.target.closest("select[data-key]");
  if (s && state.editingCountry) {
    setTimeout(() => {
      if (document.activeElement !== s && state.editingCountry === s.dataset.key) {
        state.editingCountry = null;
        renderLibrary();
      }
    }, 150);
  }
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitAll, 150);
});
document.fonts?.ready?.then(fitAll);

// ---------- xuất Excel ----------
els.exportBtn.addEventListener("click", () => {
  if (typeof XLSX === "undefined") return alert("Không tải được thư viện Excel, kiểm tra mạng rồi thử lại.");
  const blocks = visibleDims().map((dim) => {
    const D = DIMS[dim];
    const rows = sortRows(dim, pivot(filtered(dim), D.key, D.label));
    const t = totals(rows);
    if (D.fixed) rows.forEach((r) => (r.label = `${r.label} (${AGE_BY_KEY[r.key].range})`));
    const withViews = D.views && state.has.views;
    const head = [D.title, "Sum of VPH", ...(withViews ? ["Tổng view"] : []), `COUNTA của ${D.title}`, "% theo COUNTA"];
    const line = (label, r) => [label, r.sum, ...(withViews ? [r.views] : []), r.count, t.count ? +(r.count / t.count).toFixed(4) : 0];
    return [head, ...rows.map((r) => line(r.label, r)), line("Tổng cộng", t)];
  });
  const height = Math.max(...blocks.map((b) => b.length));
  const summary = Array.from({ length: height }, (_, i) =>
    blocks.flatMap((b, j) => [...(b[i] || Array(b[0].length).fill("")), ...(j < blocks.length - 1 ? [""] : [])])
  );
  const recs = libraryRecords();
  const detail = [
    ["Video", "Bản dịch", "Link video", "Kênh", "Ngày đăng", "Số ngày đã đăng", "Lượt xem", "Tương tác", "VPH", "Tuyến đề", "Chủ thể chính", "Quốc gia", "Châu lục", "Khu vực", "Danh từ 1", "Danh từ 2", "Tính chất", "Nguồn quốc gia", "File", "Dòng"],
    ...recs.map((r) => [
      r.title,
      r.translation || trCache.get(r.title) || "",
      videoHref(r) || r.link,
      r.channel,
      r.published === null ? r.publishedRaw : fmtDateTime(r.published),
      r.published === null ? "" : Math.floor(ageDays(r.published)),
      r.views ?? "",
      r.engagementRaw ?? "",
      r.vph ?? r.vphRaw ?? "",
      r.topicKey === BLANK ? "" : r.topicLabel,
      r.subjectKey === BLANK ? "" : r.subjectLabel,
      r.country,
      r.continent,
      r.region,
      r.noun1,
      r.noun2,
      r.nature,
      { file: "Theo file", title: "Tự tìm từ tiêu đề", override: "Sửa tay" }[r.countrySource],
      r.source,
      r.row,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = blocks.flatMap((b, j) => [{ wch: 28 }, ...b[0].slice(1).map(() => ({ wch: 13 })), ...(j < blocks.length - 1 ? [{ wch: 3 }] : [])]);
  // Cột % hiển thị dạng phần trăm.
  let c0 = 0;
  for (const b of blocks) {
    const pc = c0 + b[0].length - 1;
    for (let r = 1; r < b.length; r++) {
      const cell = ws1[XLSX.utils.encode_cell({ r, c: pc })];
      if (cell && typeof cell.v === "number") cell.z = "0.0%";
    }
    c0 += b[0].length + 1;
  }
  const ws2 = XLSX.utils.aoa_to_sheet(detail);
  ws2["!cols"] = [60, 60, 44, 22, 16, 10, 12, 12, 10, 24, 20, 20, 16, 18, 16, 16, 16, 18, 24, 6].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp");
  XLSX.utils.book_append_sheet(wb, ws2, "Chi tiết");
  XLSX.writeFile(wb, `phan-tich-tuyen-de-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

render();
