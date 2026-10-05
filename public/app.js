// public/app.js
//
// Đọc public/data/videos.json (do GitHub Actions ghi), phân loại từng video ngay trên trình duyệt
// (public/lib/topics.js + geo.js), gộp nhóm theo Tuyến đề × Quốc gia / Châu lục và cộng VPH.

import { TOPICS, TOPIC_BY_ID, topicLabel, classifyTopic } from "./lib/topics.js";
import { extractGeo, geoFromCodes, countryList, COUNTRIES } from "./lib/geo.js";

const $ = (id) => document.getElementById(id);
const els = {
  statVph: $("statVph"),
  statVideos: $("statVideos"),
  statCountries: $("statCountries"),
  statUpdated: $("statUpdated"),
  refreshBtn: $("refreshBtn"),
  linksInput: $("linksInput"),
  addBtn: $("addBtn"),
  intakeStatus: $("intakeStatus"),
  shareBar: $("shareBar"),
  shareLegend: $("shareLegend"),
  sortKey: $("sortKey"),
  dirButtons: document.querySelectorAll(".segmented button"),
  dimBar: $("dimBar"),
  gridHead: $("gridHead"),
  gridBody: $("gridBody"),
  gridFoot: $("gridFoot"),
  library: $("library"),
  libraryCount: $("libraryCount"),
  librarySearch: $("librarySearch"),
  libraryList: $("libraryList"),
};

const state = {
  raw: [], // dữ liệu thô từ videos.json
  meta: {},
  videos: [], // đã phân loại
  dim: null, // null = hiện cả Quốc gia + Châu lục; "continent" | "country" = chỉ hiện biến đó
  sortKey: "topic",
  sortDir: "asc",
  topicFilter: new Set(), // rỗng = mọi tuyến
  openRow: null,
  editing: null, // videoId đang mở ô sửa phân loại
  localOverrides: {}, // sửa tay vừa lưu, áp dụng ngay trong lúc chờ GitHub Actions
  pendingIds: new Set(), // link vừa thêm, chưa có dữ liệu
};

// ---------- tiện ích ----------
const nf = new Intl.NumberFormat("vi-VN");
const fmt = (n) => (n === null || n === undefined ? "–" : nf.format(Math.round(n)));
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isSpecial = (code) => code === "UNK" || code === "MULTI";

function timeAgo(iso) {
  if (!iso) return "–";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

// Giống api/manage-videos.js - để báo lỗi link ngay khi gõ, trước khi gửi lên server.
function parseVideoLinks(text) {
  const ids = [];
  const invalid = [];
  for (const p of String(text || "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const m =
      p.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/|\/v\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/) ||
      p.match(/^([A-Za-z0-9_-]{11})$/);
    if (m) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    } else invalid.push(p);
  }
  return { ids, invalid };
}

// ---------- tải dữ liệu ----------
async function loadData() {
  const t = Date.now();
  const [videos, meta] = await Promise.all([
    fetch(`data/videos.json?t=${t}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch(`data/meta.json?t=${t}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  state.raw = Array.isArray(videos) ? videos : [];
  state.meta = meta || {};
  // Override trong file đã có -> bỏ bản tạm cục bộ tương ứng.
  for (const v of state.raw) {
    const local = state.localOverrides[v.videoId];
    if (local && JSON.stringify(local) === JSON.stringify(v.override || null)) delete state.localOverrides[v.videoId];
    state.pendingIds.delete(v.videoId);
  }
  classifyAll();
  render();
}

function classifyAll() {
  state.videos = state.raw.map((v) => {
    const ov = v.videoId in state.localOverrides ? state.localOverrides[v.videoId] : v.override || null;
    const autoGeo = extractGeo({ title: v.title, tags: v.tags, description: v.descriptionHead });
    const geo = ov?.country && COUNTRIES[ov.country] ? geoFromCodes([ov.country], "override") : autoGeo;
    const auto = classifyTopic(v.title, geo);
    const topic = ov?.topic && TOPIC_BY_ID[ov.topic] ? ov.topic : auto.topic;
    const live = v.liveStatus === "live" || v.liveStatus === "upcoming";
    return {
      ...v,
      geo,
      topic,
      auto,
      override: ov,
      edited: !!(ov?.topic || ov?.country),
      needsReview: !ov?.topic && auto.confidence === "low" && auto.topic !== "t0",
      // VPH dùng để cộng: bỏ video đang live/sắp phát (giống "Tổng VPH" của app mẫu)
      // và video đã bị xoá/ẩn khỏi YouTube (số liệu cũ, không còn tăng).
      vph: live || v.available === false ? 0 : v.viewsPerHour || 0,
      approx: v.viewsPerHourSource === "lifetime",
      live,
    };
  });
}

// ---------- gộp nhóm ----------
function visibleVideos() {
  return state.topicFilter.size ? state.videos.filter((v) => state.topicFilter.has(v.topic)) : state.videos;
}

function buildRows(videos) {
  const map = new Map();
  for (const v of videos) {
    const key =
      state.dim === "continent"
        ? `${v.topic}|${v.geo.continentCode}`
        : state.dim === "country"
          ? `${v.topic}|${v.geo.countryCode}`
          : `${v.topic}|${v.geo.countryCode}|${v.geo.continentCode}`;
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        topic: v.topic,
        country: v.geo.country,
        countryCode: v.geo.countryCode,
        continent: v.geo.continent,
        continentCode: v.geo.continentCode,
        vph: 0,
        videos: [],
      };
      map.set(key, row);
    }
    row.vph += v.vph;
    row.videos.push(v);
  }
  return [...map.values()];
}

const topicOrder = (id) => TOPIC_BY_ID[id]?.no ?? 999;

function sortRows(rows) {
  const dir = state.sortDir === "asc" ? 1 : -1;
  const byTopic = (a, b) => topicOrder(a.topic) - topicOrder(b.topic);
  const byVph = (a, b) => a.vph - b.vph;
  // "Không xác định" / "Nhiều …" luôn nằm cuối, bất kể chiều sắp xếp.
  const byText = (field, codeField) => (a, b) => {
    const sa = isSpecial(a[codeField]);
    const sb = isSpecial(b[codeField]);
    if (sa !== sb) return sa ? 1 : -1;
    return dir * a[field].localeCompare(b[field], "vi");
  };
  const cmp = {
    topic: (a, b) => dir * byTopic(a, b) || -byVph(a, b),
    vph: (a, b) => dir * byVph(a, b) || byTopic(a, b),
    country: (a, b) => byText("country", "countryCode")(a, b) || byTopic(a, b) || -byVph(a, b),
    continent: (a, b) => byText("continent", "continentCode")(a, b) || byTopic(a, b) || -byVph(a, b),
  }[state.sortKey];
  return rows.sort(cmp);
}

// ---------- render ----------
function render() {
  renderStats();
  renderShare();
  renderDims();
  renderTable();
  renderLibrary();
}

function renderStats() {
  const all = state.videos;
  els.statVph.textContent = all.length ? fmt(all.reduce((s, v) => s + v.vph, 0)) : "–";
  els.statVideos.textContent = all.length ? fmt(all.length) : "–";
  const countries = new Set(all.map((v) => v.geo.countryCode).filter((c) => !isSpecial(c)));
  els.statCountries.textContent = all.length ? fmt(countries.size) : "–";
  els.statUpdated.textContent = timeAgo(state.meta.lastUpdated);
  els.statUpdated.title = state.meta.lastUpdated ? new Date(state.meta.lastUpdated).toLocaleString("vi-VN") : "";
}

function renderShare() {
  const sums = Object.fromEntries(TOPICS.map((t) => [t.id, { vph: 0, count: 0 }]));
  for (const v of state.videos) {
    sums[v.topic].vph += v.vph;
    sums[v.topic].count++;
  }
  const total = Object.values(sums).reduce((s, x) => s + x.vph, 0);
  const shown = TOPICS.filter((t) => t.id !== "t0" || sums.t0.count > 0);
  const f = state.topicFilter;

  els.shareBar.innerHTML = total
    ? shown
        .filter((t) => sums[t.id].vph > 0)
        .map((t) => {
          const pct = (sums[t.id].vph / total) * 100;
          const dim = f.size && !f.has(t.id) ? " is-dim" : "";
          return `<div class="share__seg${dim}" style="flex-grow:${sums[t.id].vph};background:${t.color}" title="${esc(topicLabel(t.id))}: ${fmt(sums[t.id].vph)} VPH (${pct.toFixed(1)}%)">${pct >= 7 ? `${pct.toFixed(0)}%` : ""}</div>`;
        })
        .join("")
    : `<span class="share__empty">${state.videos.length ? "Chưa có VPH để chia tỷ trọng" : "Chưa có video nào. Dán link ở ô phía trên để bắt đầu."}</span>`;

  els.shareLegend.innerHTML = shown
    .map((t) => {
      const s = sums[t.id];
      const pct = total ? ((s.vph / total) * 100).toFixed(1) : "0";
      const cls = f.has(t.id) ? " is-active" : f.size ? " is-dim" : "";
      return `<button type="button" class="legend-item${cls}" data-topic="${t.id}" style="color:${t.color}" aria-pressed="${f.has(t.id)}" title="Bấm để chỉ xem tuyến này (bấm lại để bỏ)">
        <span class="legend-item__dot" style="background:${t.color}"></span>
        <span class="legend-item__name">${esc(topicLabel(t.id))}</span>
        <span class="legend-item__num">${fmt(s.vph)} VPH · ${pct}% · ${s.count} video</span>
      </button>`;
    })
    .join("");
}

function renderDims() {
  const vids = visibleVideos();
  const continents = new Set(vids.map((v) => v.geo.continentCode).filter((c) => !isSpecial(c)));
  const countries = new Set(vids.map((v) => v.geo.countryCode).filter((c) => !isSpecial(c)));
  const chip = (dim, label, n) =>
    `<button type="button" class="dim-chip dim-chip--${dim}${state.dim === dim ? " is-active" : ""}" data-dim="${dim}" aria-pressed="${state.dim === dim}" title="Bấm để chỉ hiển thị theo ${label} (bấm lại để hiện cả 2)">${label} · ${n}</button>`;
  els.dimBar.innerHTML =
    `<span class="dims__label">Biến hiển thị (${vids.length} video):</span>` +
    chip("continent", "Châu lục", continents.size) +
    chip("country", "Quốc gia", countries.size) +
    (state.dim ? `<span class="dims__hint">Đang gộp theo ${state.dim === "continent" ? "châu lục" : "quốc gia"}</span>` : "");

  // Cột đang ẩn thì không cho chọn làm biến sắp xếp.
  for (const opt of els.sortKey.options) {
    opt.disabled = (opt.value === "country" && state.dim === "continent") || (opt.value === "continent" && state.dim === "country");
  }
  if (els.sortKey.selectedOptions[0]?.disabled) state.sortKey = "topic";
  els.sortKey.value = state.sortKey;
  els.dirButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.dir === state.sortDir));
}

function columns() {
  const cols = [
    { key: "topic", label: "Tuyến đề" },
    { key: "vph", label: "Sum of VPH", num: true },
  ];
  if (state.dim !== "continent") cols.push({ key: "country", label: "Quốc gia" });
  if (state.dim !== "country") cols.push({ key: "continent", label: "Châu lục" });
  return cols;
}

function renderTable() {
  const cols = columns();
  els.gridHead.innerHTML = cols
    .map((c) => {
      const sorted = state.sortKey === c.key;
      const arrow = sorted ? `<span class="arrow">${state.sortDir === "asc" ? "▲" : "▼"}</span>` : "";
      return `<th data-sort="${c.key}" class="${c.num ? "num" : ""}${sorted ? " is-sorted" : ""}" aria-sort="${sorted ? (state.sortDir === "asc" ? "ascending" : "descending") : "none"}">${c.label}${arrow}</th>`;
    })
    .join("");

  const vids = visibleVideos();
  if (!vids.length) {
    els.gridBody.innerHTML = `<tr class="empty"><td colspan="${cols.length}">${
      state.videos.length ? "Không có video nào thuộc tuyến đang chọn." : "Bảng sẽ hiện ở đây sau khi bạn thêm link video."
    }</td></tr>`;
    els.gridFoot.innerHTML = "";
    return;
  }

  const rows = sortRows(buildRows(vids));
  els.gridBody.innerHTML = rows.map((r) => rowHtml(r, cols)).join("");
  const total = vids.reduce((s, v) => s + v.vph, 0);
  els.gridFoot.innerHTML = `<tr><td>Tổng cộng (${vids.length} video)</td><td class="num">${fmt(total)}</td>${"<td></td>".repeat(cols.length - 2)}</tr>`;
}

function rowHtml(r, cols) {
  const t = TOPIC_BY_ID[r.topic];
  const open = state.openRow === r.key;
  const approx = r.videos.some((v) => v.approx && !v.live);
  const review = r.videos.some((v) => v.needsReview);
  const cells = cols.map((c) => {
    if (c.key === "topic") {
      return `<td><div class="topic-cell"><span class="caret" aria-hidden="true">▶</span><span class="topic-cell__bar" style="background:${t.color}"></span><span class="topic-cell__name">${esc(topicLabel(r.topic))}<span class="topic-cell__count">${r.videos.length} video${review ? ` <span class="mark mark--warn" title="Có video giáp ranh giữa 2 tuyến">?</span>` : ""}</span></span></div></td>`;
    }
    if (c.key === "vph") {
      return `<td class="num">${approx ? `<span class="mark mark--approx" title="Có video VPH tạm tính">~</span> ` : ""}${fmt(r.vph)}</td>`;
    }
    if (c.key === "country") return `<td class="${isSpecial(r.countryCode) ? "muted" : ""}">${esc(r.country)}</td>`;
    return `<td class="${isSpecial(r.continentCode) ? "muted" : ""}">${esc(r.continent)}</td>`;
  });
  let html = `<tr class="row${open ? " is-open" : ""}" data-key="${esc(r.key)}" tabindex="0" aria-expanded="${open}">${cells.join("")}</tr>`;
  if (open) {
    const list = [...r.videos].sort((a, b) => b.vph - a.vph).map(videoItemHtml).join("");
    html += `<tr class="detail"><td colspan="${cols.length}"><ul class="vlist">${list}</ul></td></tr>`;
  }
  return html;
}

function vphText(v) {
  if (v.live) return `<span title="Đang live / sắp công chiếu: không tính VPH">LIVE</span>`;
  if (v.available === false) return `<span class="tag-unavailable" title="Video đã bị xoá hoặc để riêng tư">ẩn</span>`;
  const win = v.viewsPerHourSource === "recent" && v.vphWindowHours ? ` đo trong ${v.vphWindowHours} giờ` : "";
  return `${v.approx ? `<span class="mark mark--approx" title="Tạm tính = tổng view / số giờ từ lúc đăng. Sau ≥ 6 tiếng sẽ đo tốc độ thật.">~</span> ` : ""}<span title="VPH${win}">${fmt(v.viewsPerHour)}</span> <small>VPH</small>`;
}

function geoNote(v) {
  if (v.geo.source === "tags") return ` <span class="mark mark--approx" title="Tiêu đề không nhắc tên nước, lấy từ tag của video">≈</span>`;
  if (v.geo.source === "description") return ` <span class="mark mark--approx" title="Tiêu đề không nhắc tên nước, lấy từ mô tả video">≈</span>`;
  return "";
}

function videoItemHtml(v) {
  const thumb = v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" width="72" height="40">` : `<span class="vitem__thumb"></span>`;
  const pub = v.publishedAt ? new Date(v.publishedAt).toLocaleDateString("vi-VN") : "";
  const flags = [
    v.edited ? `<span class="mark mark--edit" title="Phân loại đã được sửa tay">sửa tay</span>` : "",
    v.needsReview ? `<span class="mark mark--warn" title="Điểm 2 tuyến gần bằng nhau: ${esc(JSON.stringify(v.auto.scores))}">?</span>` : "",
  ].join("");
  const editing = state.editing === v.videoId;
  return `<li class="vitem" data-id="${esc(v.videoId)}">
    ${thumb}
    <div>
      <a class="vitem__title" href="https://www.youtube.com/watch?v=${esc(v.videoId)}" target="_blank" rel="noopener">${esc(v.title)}</a>
      <div class="vitem__meta">
        <span>${esc(v.channelTitle || "")}</span>
        <span>${fmt(v.viewCount)} view</span>
        <span>${pub}</span>
        <span>${esc(v.geo.country)}${geoNote(v)}</span>
        ${flags}
      </div>
    </div>
    <div class="vitem__right">
      <span class="vitem__vph">${vphText(v)}</span>
      <button type="button" class="btn btn--small" data-act="edit">${editing ? "Đóng" : "Sửa phân loại"}</button>
    </div>
    ${editing ? editorHtml(v) : ""}
  </li>`;
}

let COUNTRY_OPTIONS = null;
function editorHtml(v) {
  COUNTRY_OPTIONS ??= countryList().map((c) => `<option value="${c.code}">${esc(c.name)}</option>`).join("");
  const ovTopic = v.override?.topic || "";
  const ovCountry = v.override?.country || "";
  const topicOpts = TOPICS.filter((t) => t.id !== "t0")
    .map((t) => `<option value="${t.id}"${ovTopic === t.id ? " selected" : ""}>${esc(topicLabel(t.id))}</option>`)
    .join("");
  const why = Object.entries(v.auto.matched)
    .filter(([, m]) => m.length)
    .map(([id, m]) => `Tuyến ${TOPIC_BY_ID[id].no} (${v.auto.scores[id]} điểm): ${m.map(esc).join(", ")}`)
    .join(" · ");
  return `<div class="editor">
    <select data-field="topic" aria-label="Tuyến đề">
      <option value="">Tự động: ${esc(topicLabel(v.auto.topic))}</option>${topicOpts}
    </select>
    <select data-field="country" aria-label="Quốc gia">
      <option value="">Tự động</option>${COUNTRY_OPTIONS.replace(`value="${ovCountry}"`, `value="${ovCountry}" selected`)}
    </select>
    <button type="button" class="btn btn--small btn--primary" data-act="save">Lưu phân loại</button>
    <button type="button" class="btn btn--small btn--danger" data-act="remove">Xoá video</button>
    <span class="editor__why">${why ? `App dựa vào: ${why}` : "Tiêu đề không chứa từ khoá của tuyến nào."}</span>
  </div>`;
}

function renderLibrary() {
  const q = els.librarySearch.value.trim().toLowerCase();
  const pending = [...state.pendingIds];
  els.libraryCount.textContent = `(${state.videos.length}${pending.length ? ` + ${pending.length} đang chờ` : ""})`;
  const notFound = new Set(state.meta.notFound || []);
  const items = state.videos
    .filter((v) => !q || `${v.title} ${v.channelTitle} ${v.geo.country}`.toLowerCase().includes(q))
    .slice()
    .reverse() // mới thêm lên đầu
    .map((v) => {
      const t = TOPIC_BY_ID[v.topic];
      return `<li class="vitem" data-id="${esc(v.videoId)}">
        ${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" width="72" height="40">` : `<span class="vitem__thumb"></span>`}
        <div>
          <a class="vitem__title" href="https://www.youtube.com/watch?v=${esc(v.videoId)}" target="_blank" rel="noopener">${esc(v.title)}</a>
          <div class="vitem__meta">
            <span class="topic-pill"><i style="background:${t.color}"></i>${esc(topicLabel(v.topic))}</span>
            <span>${esc(v.geo.country)} · ${esc(v.geo.continent)}</span>
            ${notFound.has(v.videoId) || v.available === false ? `<span class="tag-unavailable">Không còn trên YouTube</span>` : ""}
          </div>
        </div>
        <div class="vitem__right">
          <span class="vitem__vph">${vphText(v)}</span>
          <button type="button" class="btn btn--small btn--danger" data-act="remove">Xoá</button>
        </div>
      </li>`;
    });
  const pendingItems = pending.map(
    (id) => `<li class="vitem"><span class="vitem__thumb"></span><div><span class="pending">Đang chờ dữ liệu</span><div class="vitem__meta">${esc(id)}</div></div></li>`
  );
  els.libraryList.innerHTML = pendingItems.concat(items).join("") || `<li class="vitem"><span></span><span class="muted">Không có video nào khớp.</span></li>`;
}

// ---------- tương tác: bảng ----------
els.sortKey.addEventListener("change", () => {
  state.sortKey = els.sortKey.value;
  // Chọn biến mới -> chiều mặc định hợp lý: VPH giảm dần, chữ tăng dần.
  state.sortDir = state.sortKey === "vph" ? "desc" : "asc";
  render();
});
els.dirButtons.forEach((b) =>
  b.addEventListener("click", () => {
    state.sortDir = b.dataset.dir;
    render();
  })
);
els.gridHead.addEventListener("click", (e) => {
  const th = e.target.closest("th[data-sort]");
  if (!th) return;
  if (state.sortKey === th.dataset.sort) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  else {
    state.sortKey = th.dataset.sort;
    state.sortDir = state.sortKey === "vph" ? "desc" : "asc";
  }
  render();
});
els.dimBar.addEventListener("click", (e) => {
  const chip = e.target.closest(".dim-chip");
  if (!chip) return;
  state.dim = state.dim === chip.dataset.dim ? null : chip.dataset.dim;
  state.openRow = null;
  render();
});
els.shareLegend.addEventListener("click", (e) => {
  const item = e.target.closest(".legend-item");
  if (!item) return;
  const id = item.dataset.topic;
  state.topicFilter.has(id) ? state.topicFilter.delete(id) : state.topicFilter.add(id);
  state.openRow = null;
  render();
});

function toggleRow(tr) {
  state.openRow = state.openRow === tr.dataset.key ? null : tr.dataset.key;
  state.editing = null;
  renderTable();
}
els.gridBody.addEventListener("click", (e) => {
  if (e.target.closest("a, select, button, .editor")) return handleVideoAction(e);
  const tr = e.target.closest("tr.row");
  if (tr) toggleRow(tr);
});
els.gridBody.addEventListener("keydown", (e) => {
  const tr = e.target.closest("tr.row");
  if (tr && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    toggleRow(tr);
  }
});
els.libraryList.addEventListener("click", handleVideoAction);

async function handleVideoAction(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const li = btn.closest("[data-id]");
  const id = li?.dataset.id;
  if (!id) return;
  const act = btn.dataset.act;

  if (act === "edit") {
    state.editing = state.editing === id ? null : id;
    renderTable();
    return;
  }
  if (act === "remove") {
    if (!confirm("Xoá video này khỏi danh sách phân tích?")) return;
    btn.disabled = true;
    const r = await callApi("api/manage-videos", { action: "remove", videoId: id });
    if (!r.ok) {
      btn.disabled = false;
      return setStatus(r.error, "error");
    }
    state.raw = state.raw.filter((v) => v.videoId !== id);
    state.editing = null;
    classifyAll();
    render();
    setStatus("Đã xoá video. Dữ liệu trên server sẽ đồng bộ sau 1–3 phút.", "ok");
    return;
  }
  if (act === "save") {
    const topic = li.querySelector('select[data-field="topic"]').value || null;
    const country = li.querySelector('select[data-field="country"]').value || null;
    btn.disabled = true;
    const r = await callApi("api/manage-videos", { action: "override", videoId: id, topic, country });
    if (!r.ok) {
      btn.disabled = false;
      return setStatus(r.error, "error");
    }
    state.localOverrides[id] = topic || country ? { ...(topic ? { topic } : {}), ...(country ? { country } : {}) } : null;
    state.editing = null;
    state.openRow = null; // video có thể đã chuyển sang dòng khác
    classifyAll();
    render();
    setStatus(topic || country ? "Đã lưu phân loại sửa tay." : "Đã trả video về phân loại tự động.", "ok");
  }
}

els.librarySearch.addEventListener("input", renderLibrary);

// ---------- nhập link ----------
function setStatus(msg, kind = "") {
  els.intakeStatus.className = `intake__status${kind ? ` is-${kind}` : ""}`;
  els.intakeStatus.innerHTML = kind === "busy" ? `<span class="spinner"></span>${esc(msg)}` : esc(msg);
}

async function callApi(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error:
          json.error ||
          (res.status === 404
            ? "Không tìm thấy API. Trang phải chạy trên Vercel (thư mục api/) mới dùng được nút này."
            : `Lỗi máy chủ (HTTP ${res.status}).`),
      };
    }
    return { ok: true, ...json };
  } catch (err) {
    return { ok: false, error: `Không kết nối được máy chủ: ${err.message}` };
  }
}

els.linksInput.addEventListener("input", () => {
  const { ids, invalid } = parseVideoLinks(els.linksInput.value);
  if (!els.linksInput.value.trim()) return setStatus("");
  setStatus(`Nhận ra ${ids.length} video${invalid.length ? `, ${invalid.length} dòng không phải link video` : ""}.`, invalid.length && !ids.length ? "error" : "");
});

els.addBtn.addEventListener("click", async () => {
  const { ids, invalid } = parseVideoLinks(els.linksInput.value);
  if (!ids.length) return setStatus(invalid.length ? "Không có link video hợp lệ nào." : "Hãy dán ít nhất 1 link video.", "error");
  els.addBtn.disabled = true;
  setStatus(`Đang gửi ${ids.length} video…`, "busy");
  const r = await callApi("api/manage-videos", { action: "add", links: els.linksInput.value });
  els.addBtn.disabled = false;
  if (!r.ok) return setStatus(r.error, "error");

  const added = r.added || [];
  const dup = (r.duplicates || []).length;
  const bad = (r.invalid || []).length;
  const extra = [dup ? `${dup} video đã có sẵn` : "", bad ? `${bad} dòng lỗi` : ""].filter(Boolean).join(", ");
  els.linksInput.value = "";
  if (!added.length) return setStatus(`Không có video mới${extra ? ` (${extra})` : ""}.`, "ok");
  added.forEach((id) => state.pendingIds.add(id));
  renderLibrary();
  waitForData(added, `Đã thêm ${added.length} video${extra ? ` (${extra})` : ""}. Đang lấy dữ liệu từ YouTube, bảng tự cập nhật sau khoảng 1–3 phút…`);
});

els.refreshBtn.addEventListener("click", async () => {
  els.refreshBtn.disabled = true;
  const r = await callApi("api/trigger-fetch", {});
  els.refreshBtn.disabled = false;
  if (!r.ok) return setStatus(r.error, "error");
  waitForData([], "Đã yêu cầu cập nhật. Đang chờ GitHub Actions lấy số liệu mới…");
});

// Chờ GitHub Actions chạy xong + Vercel deploy lại: hỏi meta.json mỗi 15 giây, tối đa 10 phút.
let pollTimer = null;
function waitForData(ids, message) {
  clearInterval(pollTimer);
  const since = Date.now() - 30_000; // lệch giờ máy khách/GitHub
  const startedAt = Date.now();
  setStatus(message, "busy");
  pollTimer = setInterval(async () => {
    const meta = await fetch(`data/meta.json?t=${Date.now()}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const fresh = meta.lastUpdated && new Date(meta.lastUpdated).getTime() > since;
    if (fresh) {
      await loadData();
      const notFound = meta.notFound || [];
      notFound.forEach((id) => state.pendingIds.delete(id));
      const missing = ids.filter((id) => !state.raw.some((v) => v.videoId === id) && !notFound.includes(id));
      if (!missing.length) {
        clearInterval(pollTimer);
        renderLibrary();
        const nf = notFound.filter((id) => ids.includes(id)).length;
        return setStatus(`Đã cập nhật xong${nf ? `. ${nf} video không tìm thấy trên YouTube (đã xoá hoặc riêng tư)` : ""}.`, "ok");
      }
    }
    if (Date.now() - startedAt > 10 * 60_000) {
      clearInterval(pollTimer);
      setStatus("Sau 10 phút vẫn chưa thấy dữ liệu mới. Kiểm tra tab Actions trên GitHub xem workflow có lỗi không (thường do thiếu YOUTUBE_API_KEY).", "error");
    }
  }, 15_000);
}

loadData();
