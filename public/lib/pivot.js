// public/lib/pivot.js
//
// Bảng tổng hợp kiểu Pivot Table của Excel: gộp video theo 1 trường, tính
//   SUM của VPH  - cộng các ô VPH là số (ô chữ / trống bị bỏ qua, giống hàm SUM)
//   COUNTA       - đếm số video trong nhóm (mỗi video luôn có nhãn nhóm, kể cả "Unknown",
//                  nên COUNTA = số dòng video, giống COUNTA trên cột đã điền đủ nhãn)
//   vphCount     - số video có VPH là số (để biết nhóm nào thiếu dữ liệu VPH)

export function pivot(records, keyOf, labelOf) {
  const map = new Map();
  for (const r of records) {
    const key = keyOf(r);
    let g = map.get(key);
    if (!g) {
      g = { key, label: labelOf(r), sum: 0, count: 0, vphCount: 0 };
      map.set(key, g);
    }
    g.count++;
    if (typeof r.vph === "number") {
      g.sum += r.vph;
      g.vphCount++;
    }
  }
  return [...map.values()];
}

export function totals(rows) {
  return rows.reduce(
    (t, r) => ({ sum: t.sum + r.sum, count: t.count + r.count, vphCount: t.vphCount + r.vphCount }),
    { sum: 0, count: 0, vphCount: 0 }
  );
}
