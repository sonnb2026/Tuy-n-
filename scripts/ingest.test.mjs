// Chạy: node --test scripts/classify.test.mjs scripts/ingest.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { findHeaderRow, detectColumns, parseNumber, buildRecords, dedupeRecords, videoKey } from "../public/lib/ingest.js";
import { pivot, totals } from "../public/lib/pivot.js";

// Giống file "Xuất Excel" của app theo dõi kênh (có cột Dịch, Link video, Loại video...).
const EXPORT = [
  ["Video", "Dịch", "Kênh", "Ngày đăng", "Thời lượng", "Lượt xem", "Sub kênh", "View/giờ", "Lịch sử đăng", "Loại video", "Link video"],
  ["Vida en Rusia", "Cuộc sống ở Nga", "A", "01/09/2026", "20:00", 1000, 50, 120, 4, "Video", "https://www.youtube.com/watch?v=AAAAAAAAAAA"],
  ["Vida en Perú", "", "B", "", "", 500, 10, "Live", 1, "Live", "https://www.youtube.com/watch?v=BBBBBBBBBBB"],
  ["Vida en Rusia (bản cũ)", "", "A", "", "", 900, 50, 100, 4, "Video", "https://youtu.be/AAAAAAAAAAA"],
  ["", "", "", "", "", "", "", "", "", "", ""],
  ["Tổng cộng", "", "", "", "", "", "", 220, "", "", ""],
];

test("nhận đúng cột của file xuất từ app theo dõi kênh", () => {
  const h = findHeaderRow(EXPORT);
  assert.equal(h, 0);
  const cols = detectColumns(EXPORT[h], EXPORT.slice(1));
  assert.equal(EXPORT[0][cols.title], "Video"); // không nhầm sang "Dịch" / "Loại video" / "Link video"
  assert.equal(EXPORT[0][cols.vph], "View/giờ");
  assert.equal(EXPORT[0][cols.link], "Link video");
});

test("bỏ dòng tổng, ô 'Live' không cộng vào SUM, gộp video trùng link", () => {
  const cols = detectColumns(EXPORT[0], EXPORT.slice(1));
  const { records, skipped } = buildRecords(EXPORT, 0, cols);
  assert.equal(records.length, 3);
  assert.equal(skipped.total, 1);
  const { records: uniq, duplicates } = dedupeRecords(records);
  assert.equal(duplicates, 1);
  assert.equal(uniq.length, 2);
  const t = totals(pivot(uniq, () => "all", () => "all"));
  assert.equal(t.count, 2); // COUNTA: 2 video
  assert.equal(t.sum, 100); // bản sau cùng của video trùng (100), "Live" bị bỏ qua
  assert.equal(t.vphCount, 1);
});

test("hàng tiêu đề không nằm ở dòng 1", () => {
  const aoa = [["Báo cáo tháng 9"], [], ["STT", "Tiêu đề", "VPH"], [1, "Vida en Perú", "1.234"]];
  const h = findHeaderRow(aoa);
  assert.equal(h, 2);
  const cols = detectColumns(aoa[h], aoa.slice(h + 1));
  const { records } = buildRecords(aoa, h, cols);
  assert.equal(records[0].vph, 1234);
});

test("parseNumber", () => {
  assert.equal(parseNumber(12.5), 12.5);
  assert.equal(parseNumber("1.234"), 1234);
  assert.equal(parseNumber("1,234,567"), 1234567);
  assert.equal(parseNumber("12,5"), 12.5);
  assert.equal(parseNumber("~ 300"), 300);
  assert.equal(parseNumber("Live"), null);
  assert.equal(parseNumber(""), null);
});

test("videoKey: cùng video khác dạng link", () => {
  assert.equal(videoKey("https://youtu.be/AAAAAAAAAAA?si=1"), videoKey("https://www.youtube.com/watch?v=AAAAAAAAAAA&t=3"));
});
