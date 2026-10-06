// public/app.js
//
// Đọc file Excel/CSV ngay trên trình duyệt (SheetJS) rồi dựng 3 bảng tổng hợp kiểu Pivot Table
// nằm cạnh nhau: Tuyến đề · Quốc gia · Châu lục, mỗi bảng có Sum of VPH và COUNTA.
//   - Tuyến đề: LẤY TỪ CỘT TRONG FILE (người dùng tự điền), gộp nhóm giống Pivot Table của Excel.
//   - Quốc gia: lấy từ cột "Quốc gia" nếu file có; ô trống / file không có cột -> app tự tìm từ tiêu đề.
//   - Châu lục: lấy từ cột "Châu lục" nếu file có; không có -> suy ra từ quốc gia.

import { extractGeo, geoFromCodes, countryList, countryFromCell, contentContinent, COUNTRIES } from "./lib/geo.js?v=8";
import { findHeaderRow, detectColumns, buildRecords, dedupeRecords, scoreSheet, labelKey } from "./lib/ingest.js?v=8";
import { pivot, totals } from "./lib/pivot.js?v=8";

const $ = (id) => document.getElementById(id);
const els = {
  topMeta: $("topMeta"),
  statVph: $("statVph"),
  statVideos: $("statVideos"),
  statCountries: $("statCountries"),
  exportBtn: $("exportBtn"),
  fileInput: $("fileInput"),
  dropEmpty: $("dropEmpty"),
  sources: $("sources"),
  sourceRows: $("sourceRows"),
  sourceNote: $("sourceNote"),
  onlyTopic: $("onlyTopic"),
  onlyTopicWrap: $("onlyTopicWrap"),
  dedupe: $("dedupe"),
  clearBtn: $("clearBtn"),
  dropError: $("dropError"),
  dropVeil: $("dropVeil"),
  results: $("results"),
  filters: $("filters"),
  pivots: document.querySelectorAll(".pivot"),
  libraryCount: $("libraryCount"),
  librarySearch: $("librarySearch"),
  reviewOnly: $("reviewOnly"),
  libraryRows: $("libraryRows"),
  libraryMore: $("libraryMore"),
};

const BLANK_TOPIC = "__blank";
const PALETTE = ["#ffd166", "#ff7a52", "#f472b6", "#4ade80", "#22d3ee", "#a78bfa", "#fb923c", "#38bdf8", "#facc15", "#34d399", "#f87171", "#c084fc", "#2dd4bf", "#fda4af", "#93c5fd", "#bef264"];
const SPECIAL_GEO = new Set(["UNK", "MULTI", "WW"]);

const DIMS = {
  topic: {
    title: "Tuyến đề",
    key: (r) => r.topicKey,
    label: (r) => r.topicLabel,
    special: (key) => key === BLANK_TOPIC,
  },
  country: {
    title: "Quốc gia",
    key: (r) => r.countryKey,
    label: (r) => r.country,
    special: (key) => SPECIAL_GEO.has(key),
  },
  continent: {
    title: "Châu lục",
    key: (r) => r.continentKey,
    label: (r) => r.continent,
    special: (key) => SPECIAL_GEO.has(key),
  },
};

const state = {
  files: [],
  records: [],
  excludedNoTopic: 0,
  duplicates: 0,
  hasTopicCol: false,
  topicColors: new Map(),
  sel: { topic: new Set(), country: new Set(), continent: new Set() },
  sort: { topic: { by: "sum", dir: "desc" }, country: { by: "sum", dir: "desc" }, continent: { by: "sum", dir: "desc" } },
  overrides: loadOverrides(),
  editingCountry: null,
  libraryLimit: 100,
};
const PAGE = 100;
let fileSeq = 0;

// ---------- tiện ích ----------
const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const fmt = (n) => nf.format(n);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const colLetter = (i) => {
  let s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};

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
      const entry = { id: ++fileSeq, name: file.name, wb };
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
function withGroups(rec, topicLabels) {
  // Tuyến đề: đúng chữ trong file. Gộp không phân biệt hoa/thường; tên nhóm = cách viết gặp đầu tiên.
  const topicKey = rec.topicRaw ? labelKey(rec.topicRaw) : BLANK_TOPIC;
  const topicLabel = rec.topicRaw ? topicLabels.get(topicKey) : "(trống)";

  // Quốc gia: sửa tay > ô trong file > tự tìm từ tiêu đề.
  let geo;
  let countrySource;
  const ov = state.overrides[rec.key];
  if (ov && COUNTRIES[ov]) {
    geo = geoFromCodes([ov], "override");
    countrySource = "override";
  } else if (rec.countryRaw) {
    const code = countryFromCell(rec.countryRaw);
    geo = code
      ? geoFromCodes([code], "file")
      : { countryCode: "file:" + labelKey(rec.countryRaw), country: rec.countryRaw, continentCode: "UNK", continent: "Không xác định", source: "file" };
    countrySource = "file";
  } else {
    geo = extractGeo({ title: rec.title });
    countrySource = "title";
  }
  // Nước vắt ngang 2 châu lục: xếp châu lục theo nội dung tiêu đề (xem contentContinent trong geo.js).
  geo = contentContinent(geo, rec.title);
  // Châu lục: ô trong file nếu có, không thì theo quốc gia.
  const continentKey = rec.continentRaw ? "file:" + labelKey(rec.continentRaw) : geo.continentCode;
  const continent = rec.continentRaw || geo.continent;

  return {
    ...rec,
    topicKey,
    topicLabel,
    countryKey: geo.countryCode,
    country: geo.country,
    continentKey,
    continent,
    countrySource,
    override: ov || null,
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
  state.hasTopicCol = state.files.some((f) => f.cols.topic >= 0);

  let records = all;
  state.duplicates = 0;
  if (els.dedupe.checked) {
    const d = dedupeRecords(all);
    records = d.records;
    state.duplicates = d.duplicates;
  }
  state.excludedNoTopic = 0;
  if (state.hasTopicCol && els.onlyTopic.checked) {
    const kept = records.filter((r) => r.topicRaw);
    state.excludedNoTopic = records.length - kept.length;
    records = kept;
  }

  // Tên nhóm tuyến đề = cách viết xuất hiện đầu tiên; màu cố định theo thứ tự xuất hiện.
  const topicLabels = new Map();
  for (const r of records) if (r.topicRaw && !topicLabels.has(labelKey(r.topicRaw))) topicLabels.set(labelKey(r.topicRaw), r.topicRaw);
  for (const key of topicLabels.keys()) if (!state.topicColors.has(key)) state.topicColors.set(key, PALETTE[state.topicColors.size % PALETTE.length]);

  state.records = records.map((r) => withGroups(r, topicLabels));
  for (const dim of Object.keys(DIMS)) {
    const keys = new Set(state.records.map(DIMS[dim].key));
    for (const k of state.sel[dim]) if (!keys.has(k)) state.sel[dim].delete(k);
  }
  render();
}

// ---------- lọc chéo ----------
function filtered(except) {
  return state.records.filter((r) =>
    Object.keys(DIMS).every((d) => d === except || !state.sel[d].size || state.sel[d].has(DIMS[d].key(r)))
  );
}

function sortRows(dim, rows) {
  const { by, dir } = state.sort[dim];
  const D = DIMS[dim];
  const s = dir === "asc" ? 1 : -1;
  return rows.sort((a, b) => {
    if (by === "label") {
      const sa = D.special(a.key);
      const sb = D.special(b.key);
      if (sa !== sb) return sa ? 1 : -1; // "(trống)", "Unknown"... luôn nằm cuối
      return s * a.label.localeCompare(b.label, "vi", { numeric: true });
    }
    return s * (a[by] - b[by]) || b.sum - a.sum || a.label.localeCompare(b.label, "vi");
  });
}

// ---------- render ----------
function render() {
  const has = state.files.length > 0;
  els.dropEmpty.hidden = has;
  els.sources.hidden = !has;
  els.onlyTopicWrap.hidden = !state.hasTopicCol;
  els.results.hidden = !state.records.length;
  els.topMeta.hidden = !state.records.length;
  renderSources();
  if (!state.records.length) return;
  renderStats();
  renderFilters();
  for (const el of els.pivots) renderPivot(el, el.dataset.dim);
  renderLibrary();
}

const COL_FIELDS = [
  ["topic", true],
  ["title", false],
  ["vph", true],
  ["country", true],
  ["continent", true],
  ["link", true],
];
const NONE_LABEL = { topic: "(không có)", vph: "(không có)", country: "(tự tìm từ tiêu đề)", continent: "(theo quốc gia)", link: "(không có)" };

function renderSources() {
  els.sourceRows.innerHTML = state.files
    .map((f) => {
      const select = (field, allowNone) => {
        const sel = f.cols[field];
        const none = allowNone
          ? `<option value="-1"${sel === -1 ? " selected" : ""}>${NONE_LABEL[field]}</option>`
          : sel < 0
            ? `<option value="-1" selected>Chọn cột…</option>`
            : "";
        const warn = field === "topic" && sel < 0 ? " warn" : "";
        return `<td><select class="mini${warn}" data-file="${f.id}" data-field="${field}">${none}${f.headers
          .map((h, i) => `<option value="${i}"${i === sel ? " selected" : ""}>${esc(h)}</option>`)
          .join("")}</select></td>`;
      };
      const sheets =
        f.wb.SheetNames.length > 1
          ? `<select class="mini" data-file="${f.id}" data-field="sheet">${f.wb.SheetNames.map((n) => `<option${n === f.sheet ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`
          : esc(f.sheet);
      const n = f.records?.length ?? 0;
      return `<tr>
        <td class="fname" title="${esc(f.name)}">${esc(f.name)}</td>
        <td>${sheets}</td>
        ${COL_FIELDS.map(([field, none]) => select(field, none)).join("")}
        <td class="num${n ? "" : " warn"}">${fmt(n)}</td>
        <td><button type="button" class="icon-btn" data-remove="${f.id}" title="Bỏ file này" aria-label="Bỏ file ${esc(f.name)}">✕</button></td>
      </tr>`;
    })
    .join("");

  const notes = [];
  if (state.files.length && !state.hasTopicCol) {
    notes.push(
      'File chưa có cột "Tuyến đề": thêm 1 cột tên "Tuyến đề" vào file Excel rồi điền tuyến cho từng video, hoặc chọn cột chứa tuyến đề ở ô "Cột tuyến đề" phía trên.'
    );
  }
  if (state.excludedNoTopic) notes.push(`Bỏ qua ${fmt(state.excludedNoTopic)} video chưa điền tuyến đề (bỏ tích "Chỉ tính video đã có tuyến đề" để tính cả).`);
  if (state.duplicates) notes.push(`Đã gộp ${fmt(state.duplicates)} dòng trùng video (giữ bản xuất hiện sau cùng).`);
  const totalsSkipped = state.files.reduce((s, f) => s + (f.skipped?.total || 0), 0);
  if (totalsSkipped) notes.push(`Bỏ qua ${totalsSkipped} dòng "Tổng cộng".`);
  const noVph = state.records.filter((r) => r.vph === null).length;
  if (noVph) notes.push(`${fmt(noVph)} video có ô VPH trống hoặc là chữ (vd "Sắp phát"): vẫn được đếm trong COUNTA nhưng không cộng vào SUM.`);
  els.sourceNote.innerHTML = notes.map((n, i) => (i === 0 && !state.hasTopicCol ? `<span class="warn">${esc(n)}</span>` : esc(n))).join(" ");
}

function renderStats() {
  const recs = filtered(null);
  els.statVph.textContent = fmt(recs.reduce((s, r) => s + (r.vph ?? 0), 0));
  els.statVideos.textContent = fmt(recs.length);
  els.statCountries.textContent = fmt(new Set(recs.map((r) => r.countryKey).filter((c) => !SPECIAL_GEO.has(c))).size);
}

function renderFilters() {
  const chips = [];
  for (const dim of Object.keys(DIMS)) {
    for (const key of state.sel[dim]) {
      const r = state.records.find((x) => DIMS[dim].key(x) === key);
      if (!r) continue;
      chips.push(`<button type="button" class="fchip fchip--${dim}" data-dim="${dim}" data-key="${esc(key)}" title="Bỏ lọc">${esc(DIMS[dim].label(r))} <span>✕</span></button>`);
    }
  }
  els.filters.innerHTML = chips.length
    ? `<span class="filters__label">Đang lọc:</span>${chips.join("")}<button type="button" class="btn btn--small btn--ghost" data-clear-filters>Bỏ lọc tất cả</button>`
    : "";
}

function renderPivot(el, dim) {
  const D = DIMS[dim];
  const rows = sortRows(dim, pivot(filtered(dim), D.key, D.label));
  const t = totals(rows);
  const max = Math.max(1, ...rows.map((r) => r.sum));
  const sel = state.sel[dim];
  const { by, dir } = state.sort[dim];
  const th = (key, text, cls = "") => {
    const on = by === key;
    return `<th data-sort="${key}" class="${cls}${on ? " is-sorted" : ""}" aria-sort="${on ? (dir === "asc" ? "ascending" : "descending") : "none"}">${text}${on ? `<span class="arrow">${dir === "asc" ? "▲" : "▼"}</span>` : ""}</th>`;
  };
  const body = rows.length
    ? rows
        .map((r) => {
          const color = dim === "topic" && !D.special(r.key) ? state.topicColors.get(r.key) : null;
          const cls = [sel.has(r.key) ? "is-selected" : "", sel.size && !sel.has(r.key) ? "is-dim" : ""].join(" ");
          const missing = r.count - r.vphCount;
          return `<tr class="${cls}" data-key="${esc(r.key)}" tabindex="0" aria-pressed="${sel.has(r.key)}">
            <td><span class="label">${color ? `<i style="background:${color}"></i>` : ""}<span class="${D.special(r.key) ? "muted" : ""}">${esc(r.label)}</span></span></td>
            <td class="num bar" style="--w:${((r.sum / max) * 100).toFixed(1)}"${missing ? ` title="${missing} video không có VPH là số"` : ""}>${fmt(r.sum)}</td>
            <td class="num">${fmt(r.count)}</td>
          </tr>`;
        })
        .join("")
    : `<tr class="empty"><td colspan="3">Không có dữ liệu với bộ lọc hiện tại</td></tr>`;
  el.innerHTML = `<div class="pivot__scroll"><table class="pt">
    <thead><tr>${th("label", D.title)}${th("sum", "Sum of VPH", "num")}${th("count", `COUNTA của ${D.title}`, "num")}</tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td>Tổng cộng</td><td class="num">${fmt(t.sum)}</td><td class="num">${fmt(t.count)}</td></tr></tfoot>
  </table></div>`;
}

let COUNTRY_OPTIONS = null;
function renderLibrary() {
  const q = els.librarySearch.value.trim().toLowerCase();
  let recs = filtered(null);
  if (els.reviewOnly.checked) recs = recs.filter((r) => SPECIAL_GEO.has(r.countryKey));
  if (q) recs = recs.filter((r) => `${r.title} ${r.channel} ${r.topicLabel}`.toLowerCase().includes(q));
  recs = [...recs].sort((a, b) => (b.vph ?? -1) - (a.vph ?? -1));
  const LIMIT = state.libraryLimit;
  els.libraryCount.textContent = `(${fmt(recs.length)})`;
  COUNTRY_OPTIONS ??= countryList().map((c) => `<option value="${c.code}">${esc(c.name)}</option>`).join("");

  els.libraryRows.innerHTML =
    recs
      .slice(0, LIMIT)
      .map((r) => {
        const href = r.key.startsWith("id:") ? `https://www.youtube.com/watch?v=${r.key.slice(3)}` : /^https?:/i.test(r.link) ? r.link : "";
        const title = href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title);
        const mark =
          r.countrySource === "override"
            ? ` <span class="mark mark--edit">sửa</span>`
            : r.countrySource === "title"
              ? ` <span class="mark mark--warn" title="Tự tìm từ tiêu đề">≈</span>`
              : "";
        const countryCell =
          state.editingCountry === r.key
            ? `<select class="mini" data-key="${esc(r.key)}" aria-label="Quốc gia"><option value="">${r.countryRaw ? `Theo file: ${esc(r.countryRaw)}` : "Tự tìm từ tiêu đề"}</option>${COUNTRY_OPTIONS.replace(`value="${r.override}"`, `value="${r.override}" selected`)}</select>`
            : `<button type="button" class="link-btn" data-edit-country="${esc(r.key)}" title="Bấm để sửa quốc gia">${esc(r.country)}</button>${mark}`;
        const color = state.topicColors.get(r.topicKey);
        // Ảnh lấy thẳng theo ID video (ảnh 320x180 YouTube luôn có sẵn), không đọc cột thumbnail trong file.
        const src = r.key.startsWith("id:") ? `https://i.ytimg.com/vi/${r.key.slice(3)}/mqdefault.jpg` : "";
        const img = src
          ? `<img src="${src}" alt="" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer" width="128" height="72">`
          : "";
        const thumbCell = img ? (href ? `<a class="thumb" href="${esc(href)}" target="_blank" rel="noopener" tabindex="-1">${img}</a>` : `<span class="thumb">${img}</span>`) : `<span class="thumb thumb--empty"></span>`;
        return `<tr>
          <td class="thumb-cell">${thumbCell}</td>
          <td>${title}<span class="sub">${esc(r.channel)}${r.channel ? " · " : ""}${esc(r.source)} dòng ${r.row}</span></td>
          <td><span class="label">${color ? `<i style="background:${color};width:8px;height:8px;border-radius:2px;display:inline-block"></i> ` : ""}<span class="${r.topicKey === BLANK_TOPIC ? "muted" : ""}">${esc(r.topicLabel)}</span></span></td>
          <td>${countryCell}</td>
          <td class="${SPECIAL_GEO.has(r.continentKey) ? "muted" : ""}">${esc(r.continent)}</td>
          <td class="num">${r.vph === null ? `<span class="muted">${esc(r.vphRaw || "–")}</span>` : fmt(r.vph)}</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="6" class="muted">Không có video nào khớp.</td></tr>`;
  // Chỉ vẽ 100 dòng mỗi lần cho nhẹ; bấm "Hiện thêm" để xem tiếp.
  const more = recs.length - LIMIT;
  els.libraryMore.hidden = more <= 0;
  if (more > 0) els.libraryMore.textContent = `Hiện thêm ${fmt(Math.min(PAGE, more))} video (còn ${fmt(more)})`;
}

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

els.sourceRows.addEventListener("change", (e) => {
  const s = e.target.closest("select[data-file]");
  if (!s) return;
  const f = state.files.find((x) => x.id === Number(s.dataset.file));
  if (!f) return;
  if (s.dataset.field === "sheet") loadSheet(f, s.value);
  else f.cols = { ...f.cols, [s.dataset.field]: Number(s.value) };
  rebuild();
});
els.sourceRows.addEventListener("click", (e) => {
  const b = e.target.closest("[data-remove]");
  if (!b) return;
  state.files = state.files.filter((f) => f.id !== Number(b.dataset.remove));
  rebuild();
});

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

function toggleSel(dim, key) {
  state.libraryLimit = PAGE;
  const s = state.sel[dim];
  s.has(key) ? s.delete(key) : s.add(key);
  render();
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
    const tr = e.target.closest("tbody tr[data-key]");
    if (tr) toggleSel(dim, tr.dataset.key);
  });
  el.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tbody tr[data-key]");
    if (tr && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggleSel(dim, tr.dataset.key);
    }
  });
}
els.filters.addEventListener("click", (e) => {
  if (e.target.closest("[data-clear-filters]")) {
    Object.values(state.sel).forEach((s) => s.clear());
    return render();
  }
  const chip = e.target.closest(".fchip");
  if (chip) toggleSel(chip.dataset.dim, chip.dataset.key);
});

// Ảnh lỗi (video đã bị xoá / riêng tư): để ô trống có sọc.
els.libraryRows.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    {
      const box = img.closest(".thumb");
      if (box) {
        box.classList.add("thumb--empty");
        box.title = `Không tải được ảnh: ${img.src}`;
      }
      img.remove();
    }
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
els.libraryMore.addEventListener("click", () => {
  state.libraryLimit += PAGE;
  renderLibrary();
});
els.libraryRows.addEventListener("click", (e) => {
  const b = e.target.closest("[data-edit-country]");
  if (!b) return;
  state.editingCountry = b.dataset.editCountry;
  renderLibrary();
  els.libraryRows.querySelector("select[data-key]")?.focus();
});
els.libraryRows.addEventListener("change", (e) => {
  const s = e.target.closest("select[data-key]");
  if (!s) return;
  if (s.value) state.overrides[s.dataset.key] = s.value;
  else delete state.overrides[s.dataset.key];
  saveOverrides();
  state.editingCountry = null;
  rebuild();
});

// ---------- xuất Excel ----------
els.exportBtn.addEventListener("click", () => {
  if (typeof XLSX === "undefined") return alert("Không tải được thư viện Excel, kiểm tra mạng rồi thử lại.");
  const blocks = Object.keys(DIMS).map((dim) => {
    const D = DIMS[dim];
    const rows = sortRows(dim, pivot(filtered(dim), D.key, D.label));
    const t = totals(rows);
    return [[D.title, "Sum of VPH", `COUNTA của ${D.title}`], ...rows.map((r) => [r.label, r.sum, r.count]), ["Tổng cộng", t.sum, t.count]];
  });
  const height = Math.max(...blocks.map((b) => b.length));
  const summary = Array.from({ length: height }, (_, i) =>
    blocks.flatMap((b, j) => [...(b[i] || ["", "", ""]), ...(j < blocks.length - 1 ? [""] : [])])
  );
  const detail = [
    ["Video", "Link video", "Kênh", "VPH", "Tuyến đề", "Quốc gia", "Châu lục", "Nguồn quốc gia", "File", "Dòng"],
    ...filtered(null).map((r) => [
      r.title,
      r.key.startsWith("id:") ? `https://www.youtube.com/watch?v=${r.key.slice(3)}` : r.link,
      r.channel,
      r.vph ?? r.vphRaw ?? "",
      r.topicKey === BLANK_TOPIC ? "" : r.topicLabel,
      r.country,
      r.continent,
      { file: "Theo file", title: "Tự tìm từ tiêu đề", override: "Sửa tay" }[r.countrySource],
      r.source,
      r.row,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [30, 13, 18, 3, 24, 13, 18, 3, 18, 13, 18].map((wch) => ({ wch }));
  const ws2 = XLSX.utils.aoa_to_sheet(detail);
  ws2["!cols"] = [60, 44, 22, 10, 28, 20, 16, 18, 24, 6].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp");
  XLSX.utils.book_append_sheet(wb, ws2, "Chi tiết");
  XLSX.writeFile(wb, `phan-tich-tuyen-de-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

render();
