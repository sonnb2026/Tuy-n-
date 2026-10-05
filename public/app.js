// public/app.js
//
// Đọc file Excel/CSV ngay trên trình duyệt (SheetJS), xếp tuyến đề + quốc gia + châu lục cho từng
// video (public/lib/topics.js, geo.js), rồi dựng 3 bảng tổng hợp kiểu Pivot Table nằm cạnh nhau.

import { TOPICS, TOPIC_BY_ID, topicLabel, classifyTopic } from "./lib/topics.js";
import { extractGeo, geoFromCodes, countryList, COUNTRIES } from "./lib/geo.js";
import { findHeaderRow, detectColumns, buildRecords, dedupeRecords, scoreSheet } from "./lib/ingest.js";
import { pivot, totals } from "./lib/pivot.js";

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
};

const DIMS = {
  topic: {
    title: "Tuyến đề",
    key: (r) => r.topic,
    label: (r) => topicLabel(r.topic),
    color: (key) => TOPIC_BY_ID[key]?.color,
    special: (key) => key === "t0",
    order: (a, b) => (TOPIC_BY_ID[a.key]?.no ?? 99) - (TOPIC_BY_ID[b.key]?.no ?? 99),
  },
  country: {
    title: "Quốc gia",
    key: (r) => r.geo.countryCode,
    label: (r) => r.geo.country,
    special: (key) => key === "UNK" || key === "MULTI" || key === "WW",
  },
  continent: {
    title: "Châu lục",
    key: (r) => r.geo.continentCode,
    label: (r) => r.geo.continent,
    special: (key) => key === "UNK" || key === "MULTI" || key === "WW",
  },
};

const state = {
  files: [], // { id, name, wb, sheet, aoa, headerRow, headers, cols, records, skipped, error }
  records: [], // đã gộp trùng + phân loại
  duplicates: 0,
  sel: { topic: new Set(), country: new Set(), continent: new Set() },
  sort: { topic: { by: "sum", dir: "desc" }, country: { by: "sum", dir: "desc" }, continent: { by: "sum", dir: "desc" } },
  overrides: loadOverrides(),
  editingCountry: null,
};
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
    return JSON.parse(localStorage.getItem("tuyende:overrides") || "{}") || {};
  } catch {
    return {};
  }
}
function saveOverrides() {
  try {
    localStorage.setItem("tuyende:overrides", JSON.stringify(state.overrides));
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
      // CSV đọc dạng chữ UTF-8 để giữ đúng tiếng Việt / Tây Ban Nha; raw = không tự đổi sang ngày tháng.
      const wb = isText
        ? XLSX.read(await readAs(file, "text"), { type: "string", raw: true })
        : XLSX.read(await readAs(file, "buffer"), { type: "array" });
      const entry = { id: ++fileSeq, name: file.name, wb };
      // Nhiều sheet: chọn sheet trông giống bảng video nhất.
      const scored = wb.SheetNames.map((n) => ({ n, s: scoreSheet(sheetAoa(wb, n)) }));
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

// ---------- phân loại ----------
function classify(rec) {
  const ov = state.overrides[rec.key] || null;
  const autoGeo = extractGeo({ title: rec.title });
  const geo = ov?.country && COUNTRIES[ov.country] ? geoFromCodes([ov.country], "override") : autoGeo;
  const auto = classifyTopic(rec.title, geo);
  const topic = ov?.topic && TOPIC_BY_ID[ov.topic] ? ov.topic : auto.topic;
  return {
    ...rec,
    geo,
    autoGeo,
    topic,
    auto,
    override: ov,
    needsReview: !ov?.topic && auto.confidence === "low" && auto.topic !== "t0",
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
  let records = all;
  state.duplicates = 0;
  if (els.dedupe.checked) {
    const d = dedupeRecords(all);
    records = d.records;
    state.duplicates = d.duplicates;
  }
  state.records = records.map(classify);
  // Bỏ các lựa chọn lọc không còn tồn tại.
  for (const dim of Object.keys(DIMS)) {
    const keys = new Set(state.records.map(DIMS[dim].key));
    for (const k of state.sel[dim]) if (!keys.has(k)) state.sel[dim].delete(k);
  }
  render();
}

function reclassify() {
  state.records = state.records.map(classify);
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
      if (sa !== sb) return sa ? 1 : -1; // "Unknown" / "Chưa phân loại" luôn cuối
      return s * (D.order ? D.order(a, b) : a.label.localeCompare(b.label, "en"));
    }
    return s * (a[by] - b[by]) || b.sum - a.sum || a.label.localeCompare(b.label, "en");
  });
}

// ---------- render ----------
function render() {
  const has = state.files.length > 0;
  els.dropEmpty.hidden = has;
  els.sources.hidden = !has;
  els.results.hidden = !state.records.length;
  els.topMeta.hidden = !state.records.length;
  renderSources();
  if (!state.records.length) return;
  renderStats();
  renderFilters();
  for (const el of els.pivots) renderPivot(el, el.dataset.dim);
  renderLibrary();
}

function renderSources() {
  els.sourceRows.innerHTML = state.files
    .map((f) => {
      const opts = (sel, allowNone) =>
        (allowNone ? `<option value="-1"${sel === -1 ? " selected" : ""}>(không có)</option>` : "") +
        f.headers.map((h, i) => `<option value="${i}"${i === sel ? " selected" : ""}>${esc(h)}</option>`).join("");
      const sheets =
        f.wb.SheetNames.length > 1
          ? `<select class="mini" data-file="${f.id}" data-field="sheet">${f.wb.SheetNames.map((n) => `<option${n === f.sheet ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`
          : esc(f.sheet);
      const n = f.records?.length ?? 0;
      return `<tr>
        <td class="fname" title="${esc(f.name)}">${esc(f.name)}</td>
        <td>${sheets}</td>
        <td><select class="mini" data-file="${f.id}" data-field="title">${f.cols.title < 0 ? `<option value="-1" selected>Chọn cột…</option>` : ""}${opts(f.cols.title, false)}</select></td>
        <td><select class="mini" data-file="${f.id}" data-field="vph">${opts(f.cols.vph, true)}</select></td>
        <td><select class="mini" data-file="${f.id}" data-field="link">${opts(f.cols.link, true)}</select></td>
        <td class="num${n ? "" : " warn"}">${fmt(n)}</td>
        <td><button type="button" class="icon-btn" data-remove="${f.id}" title="Bỏ file này" aria-label="Bỏ file ${esc(f.name)}">✕</button></td>
      </tr>`;
    })
    .join("");

  const notes = [];
  const totalsSkipped = state.files.reduce((s, f) => s + (f.skipped?.total || 0), 0);
  if (state.duplicates) notes.push(`Đã gộp ${fmt(state.duplicates)} dòng trùng video (giữ bản xuất hiện sau cùng).`);
  if (totalsSkipped) notes.push(`Bỏ qua ${totalsSkipped} dòng "Tổng cộng".`);
  const noVph = state.records.filter((r) => r.vph === null).length;
  if (noVph) notes.push(`${fmt(noVph)} video có ô VPH trống hoặc là chữ (vd "Live"): vẫn được đếm trong COUNTA nhưng không cộng vào SUM.`);
  if (state.files.some((f) => f.cols.title < 0)) notes.push("Có file chưa xác định được cột tiêu đề, hãy chọn cột ở bảng trên.");
  els.sourceNote.textContent = notes.join(" ");
}

function renderStats() {
  const recs = filtered(null);
  els.statVph.textContent = fmt(recs.reduce((s, r) => s + (r.vph ?? 0), 0));
  els.statVideos.textContent = fmt(recs.length);
  els.statCountries.textContent = fmt(new Set(recs.map((r) => r.geo.countryCode).filter((c) => !DIMS.country.special(c))).size);
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
          const color = D.color?.(r.key);
          const cls = [sel.has(r.key) ? "is-selected" : "", sel.size && !sel.has(r.key) ? "is-dim" : ""].join(" ");
          const missing = r.count - r.vphCount;
          return `<tr class="${cls}" data-key="${esc(r.key)}" tabindex="0" aria-pressed="${sel.has(r.key)}">
            <td><span class="label">${color ? `<i style="background:${color}"></i>` : ""}<span class="${D.special(r.key) ? "muted" : ""}">${esc(r.label)}</span></span></td>
            <td class="num bar" style="--w:${((r.sum / max) * 100).toFixed(1)}"${missing ? ` title="${missing} video không có VPH"` : ""}>${fmt(r.sum)}</td>
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
  if (els.reviewOnly.checked) recs = recs.filter((r) => r.needsReview);
  if (q) recs = recs.filter((r) => `${r.title} ${r.channel}`.toLowerCase().includes(q));
  recs = [...recs].sort((a, b) => (b.vph ?? -1) - (a.vph ?? -1));
  const LIMIT = 500;
  els.libraryCount.textContent = `(${fmt(recs.length)}${recs.length > LIMIT ? `, hiện ${LIMIT} video VPH cao nhất` : ""})`;
  COUNTRY_OPTIONS ??= countryList().map((c) => `<option value="${c.code}">${esc(c.name)}</option>`).join("");

  els.libraryRows.innerHTML =
    recs
      .slice(0, LIMIT)
      .map((r) => {
        const href = r.key.startsWith("id:") ? `https://www.youtube.com/watch?v=${r.key.slice(3)}` : /^https?:/i.test(r.link) ? r.link : "";
        const title = href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title);
        const topicSel = `<select class="mini${r.override?.topic ? " is-edited" : ""}" data-key="${esc(r.key)}" data-field="topic" aria-label="Tuyến đề">
          <option value="">Tự động: ${esc(topicLabel(r.auto.topic))}</option>
          ${TOPICS.filter((t) => t.id !== "t0").map((t) => `<option value="${t.id}"${r.override?.topic === t.id ? " selected" : ""}>${esc(topicLabel(t.id))}</option>`).join("")}
        </select>`;
        const countryCell =
          state.editingCountry === r.key
            ? `<select class="mini" data-key="${esc(r.key)}" data-field="country" aria-label="Quốc gia"><option value="">Tự động: ${esc(r.autoGeo.country)}</option>${COUNTRY_OPTIONS.replace(`value="${r.override?.country}"`, `value="${r.override?.country}" selected`)}</select>`
            : `<button type="button" class="link-btn" data-edit-country="${esc(r.key)}" title="Bấm để sửa quốc gia">${esc(r.geo.country)}</button>`;
        const marks = [
          r.needsReview ? `<span class="mark mark--warn" title="Điểm các tuyến: ${esc(JSON.stringify(r.auto.scores))}">?</span>` : "",
          r.override ? `<span class="mark mark--edit">sửa</span>` : "",
        ].join(" ");
        return `<tr>
          <td>${title} ${marks}<span class="sub">${esc(r.channel)}${r.channel ? " · " : ""}${esc(r.source)} dòng ${r.row}</span></td>
          <td>${topicSel}</td>
          <td>${countryCell}</td>
          <td class="${DIMS.continent.special(r.geo.continentCode) ? "muted" : ""}">${esc(r.geo.continent)}</td>
          <td class="num">${r.vph === null ? `<span class="muted">${esc(r.vphRaw || "–")}</span>` : fmt(r.vph)}</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="5" class="muted">Không có video nào khớp.</td></tr>`;
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
  Object.values(state.sel).forEach((s) => s.clear());
  rebuild();
});
els.dedupe.addEventListener("change", rebuild);

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

// Kéo thả file vào bất cứ đâu trên trang.
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

// 3 bảng: bấm dòng = lọc chéo, bấm tiêu đề cột = sắp xếp.
function toggleSel(dim, key) {
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

els.librarySearch.addEventListener("input", renderLibrary);
els.reviewOnly.addEventListener("change", renderLibrary);
els.libraryRows.addEventListener("click", (e) => {
  const b = e.target.closest("[data-edit-country]");
  if (!b) return;
  state.editingCountry = b.dataset.editCountry;
  renderLibrary();
  els.libraryRows.querySelector('select[data-field="country"]')?.focus();
});
els.libraryRows.addEventListener("change", (e) => {
  const s = e.target.closest("select[data-key]");
  if (!s) return;
  const key = s.dataset.key;
  const ov = { ...(state.overrides[key] || {}) };
  if (s.value) ov[s.dataset.field] = s.value;
  else delete ov[s.dataset.field];
  if (Object.keys(ov).length) state.overrides[key] = ov;
  else delete state.overrides[key];
  saveOverrides();
  state.editingCountry = null;
  reclassify();
});

// ---------- xuất Excel ----------
els.exportBtn.addEventListener("click", () => {
  if (typeof XLSX === "undefined") return alert("Không tải được thư viện Excel, kiểm tra mạng rồi thử lại.");
  // Sheet 1: 3 bảng tổng hợp đặt cạnh nhau, cách nhau 1 cột trống - đúng như trên màn hình (kể cả bộ lọc).
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
    ["Video", "Link video", "Kênh", "VPH", "Tuyến đề", "Quốc gia", "Châu lục", "Cần kiểm tra", "Sửa tay", "File", "Dòng"],
    ...filtered(null).map((r) => [
      r.title,
      r.key.startsWith("id:") ? `https://www.youtube.com/watch?v=${r.key.slice(3)}` : r.link,
      r.channel,
      r.vph ?? r.vphRaw ?? "",
      topicLabel(r.topic),
      r.geo.country,
      r.geo.continent,
      r.needsReview ? "?" : "",
      r.override ? "x" : "",
      r.source,
      r.row,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [34, 13, 18, 3, 24, 13, 18, 3, 18, 13, 18].map((wch) => ({ wch }));
  const ws2 = XLSX.utils.aoa_to_sheet(detail);
  ws2["!cols"] = [60, 44, 22, 10, 34, 20, 16, 12, 8, 24, 6].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp");
  XLSX.utils.book_append_sheet(wb, ws2, "Chi tiết");
  XLSX.writeFile(wb, `phan-tich-tuyen-de-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

render();
