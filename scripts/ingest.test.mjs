// Chạy: node --test scripts/classify.test.mjs scripts/ingest.test.mjs
// Kiểm tra phần đọc file: nhận cột, đọc số / ngày, gộp trùng, đọc ô Quốc gia / Châu lục.
import test from "node:test";
import assert from "node:assert/strict";
import { detectColumns, findHeaderRow, buildRecords, dedupeRecords, parseNumber, parseDate } from "../public/lib/ingest.js";
import { countryFromCell, specialCountryCell, continentFromCell } from "../public/lib/geo.js";

const HEAD = ["STT", "Video", "Dịch", "Kênh", "Ngày đăng", "Lượt xem", "Tương tác", "View/giờ", "Link video", "Tuyến đề", "Chủ thể chính", "Quốc gia", "Châu lục", "Danh từ 1", "Danh từ 2", "Tính chất"];

test("nhận đúng mọi cột của file xuất từ app theo dõi kênh + cột tự điền", () => {
  const c = detectColumns(HEAD, []);
  assert.deepEqual(
    { title: c.title, translation: c.translation, channel: c.channel, date: c.date, views: c.views, engagement: c.engagement, vph: c.vph, link: c.link, topic: c.topic, subject: c.subject, country: c.country, continent: c.continent, noun1: c.noun1, noun2: c.noun2, nature: c.nature },
    { title: 1, translation: 2, channel: 3, date: 4, views: 5, engagement: 6, vph: 7, link: 8, topic: 9, subject: 10, country: 11, continent: 12, noun1: 13, noun2: 14, nature: 15 }
  );
});

test("'Lượt xem' không bị nhầm với 'View/giờ', 'Chủ thể chính' không nhầm với 'Chủ đề'", () => {
  const c = detectColumns(["Video", "View/giờ", "Lượt xem", "Chủ đề", "Chủ thể chính"], []);
  assert.equal(c.vph, 1);
  assert.equal(c.views, 2);
  assert.equal(c.topic, 3);
  assert.equal(c.subject, 4);
});

test("Tương tác = (Like + Bình luận) / Lượt xem", () => {
  const aoa = [["Video", "View/giờ", "Lượt xem", "Like", "Bình luận"], ["A", 10, "100.000", "1.200", 30], ["B", 5, 0, 10, 2], ["C", 5, "", 10, 2]];
  const cols = detectColumns(aoa[0], aoa.slice(1));
  const { records } = buildRecords(aoa, findHeaderRow(aoa), cols);
  assert.equal(records[0].engagement, 0.0123);
  assert.equal(records[1].engagement, null); // 0 lượt xem -> không chia được
  assert.equal(records[2].engagement, null);
});
test("không có Like/Bình luận -> dùng cột Tương tác có sẵn", () => {
  const aoa = [["Video", "View/giờ", "Tương tác"], ["A", 10, "2,5%"], ["B", 10, 0.03], ["C", 10, 4]];
  const { records } = buildRecords(aoa, 0, detectColumns(aoa[0], []));
  assert.deepEqual(records.map((r) => r.engagement), [0.025, 0.03, 0.04]);
});

test("đọc số", () => {
  assert.equal(parseNumber("1.234"), 1234);
  assert.equal(parseNumber("1,234"), 1234);
  assert.equal(parseNumber("12,5"), 12.5);
  assert.equal(parseNumber("1.234,5"), 1234.5);
  assert.equal(parseNumber("1,234.5"), 1234.5);
  assert.equal(parseNumber("~300"), 300);
  assert.equal(parseNumber("Live"), null);
});

test("đọc ngày đăng", () => {
  const d = (t) => {
    const x = new Date(t);
    return [x.getFullYear(), x.getMonth() + 1, x.getDate(), x.getHours(), x.getMinutes()];
  };
  assert.deepEqual(d(parseDate("05/10/2026")), [2026, 10, 5, 0, 0]);
  assert.deepEqual(d(parseDate("5/10/26 14:30")), [2026, 10, 5, 14, 30]);
  assert.deepEqual(d(parseDate("10/25/2026")), [2026, 10, 25, 0, 0]);
  assert.deepEqual(d(parseDate("2026-10-05 09:15")), [2026, 10, 5, 9, 15]);
  assert.deepEqual(d(parseDate(46000.5)), [2025, 12, 9, 12, 0]); // ô ngày của Excel
  assert.equal(parseDate("31/02/2026"), null);
  assert.equal(parseDate("abc"), null);
  assert.equal(parseDate(""), null);
});

test("gộp trùng: giữ bản sau, ô trống lấy từ bản trước (không mất tuyến đề)", () => {
  const aoa1 = [HEAD, [1, "Video A", "", "Kênh X", "01/10/2026", 100, 5, 10, "https://youtu.be/aaaaaaaaaaa", "Chi Phí Sống", "Phụ nữ", "", "", "", "", ""]];
  const aoa2 = [HEAD, [1, "Video A", "", "Kênh X", "01/10/2026", 500, 9, 50, "https://www.youtube.com/watch?v=aaaaaaaaaaa", "", "", "", "", "", "", ""]];
  const cols = detectColumns(HEAD, []);
  const all = [...buildRecords(aoa1, 0, cols).records, ...buildRecords(aoa2, 0, cols).records];
  const { records, duplicates } = dedupeRecords(all);
  assert.equal(duplicates, 1);
  assert.equal(records[0].vph, 50);
  assert.equal(records[0].views, 500);
  assert.equal(records[0].topicRaw, "Chi Phí Sống");
  assert.equal(records[0].subjectRaw, "Phụ nữ");
});

test("ô Quốc gia / Châu lục tự điền", () => {
  assert.equal(countryFromCell("USA"), "US");
  assert.equal(countryFromCell("Mỹ"), "US");
  assert.equal(specialCountryCell("Nhiều quốc gia"), "MULTI");
  assert.equal(specialCountryCell("Multiple countries"), "MULTI");
  assert.equal(specialCountryCell("Worldwide"), "WW");
  assert.equal(specialCountryCell("Không xác định"), "UNK");
  assert.equal(specialCountryCell("Peru"), null);
  assert.equal(continentFromCell("Asia"), "AS");
  assert.equal(continentFromCell("châu á"), "AS");
  assert.equal(continentFromCell("Nam Mỹ"), "AMR");
  assert.equal(continentFromCell("Toàn cầu"), "WW");
  assert.equal(continentFromCell("Bắc Cực"), null);
});
