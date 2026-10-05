// public/lib/topics.js
//
// Xếp video vào 5 tuyến đề dựa trên TIÊU ĐỀ (chủ yếu tiếng Tây Ban Nha, có hỗ trợ một phần
// tiếng Anh). Cách làm: mỗi tuyến có 1 bộ "tín hiệu" (cụm từ + trọng số). Cộng điểm từng tuyến,
// tuyến điểm cao nhất thắng. Hoà điểm -> theo thứ tự ưu tiên TIE_ORDER.
//
// Lưu ý quan trọng: Tuyến 2 (Mỹ Latinh) được định nghĩa theo ĐỊA LÝ, 4 tuyến còn lại theo CHỦ ĐỀ,
// nên 1 video Mỹ Latinh nói về tiền thuê nhà sẽ có điểm ở cả Tuyến 1 lẫn Tuyến 2. Quy ước ở đây
// (khớp với các ví dụ bạn đưa): chủ đề rõ ràng thắng địa lý -> video Argentina có số tiền thuê nhà
// vào Tuyến 1, video Argentina chung chung vào Tuyến 2.
//
// Muốn chỉnh: sửa trọng số / thêm cụm từ trong SIGNALS. Chạy `node --test scripts/` để kiểm tra
// lại toàn bộ ví dụ mẫu sau khi sửa.

import { LATAM } from "./geo.js";

export const TOPICS = [
  { id: "t1", no: 1, name: "Lương & Chi Phí Sinh Hoạt", color: "#ffd166" },
  { id: "t2", no: 2, name: "Mỹ Latinh", color: "#ff7a52" },
  { id: "t3", no: 3, name: "Phụ Nữ & Xã Hội", color: "#f472b6" },
  { id: "t4", no: 4, name: "Bộ Tộc & Biệt Lập", color: "#4ade80" },
  { id: "t5", no: 5, name: "Du Lịch - Tích/Tiêu Cực", color: "#22d3ee" },
  { id: "t0", no: 99, name: "Chưa phân loại", color: "#8b8fb8" },
];
export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
export const topicLabel = (id) => {
  const t = TOPIC_BY_ID[id] || TOPIC_BY_ID.t0;
  return t.id === "t0" ? t.name : `Tuyến ${t.no}: ${t.name}`;
};

// Khi hoà điểm: chủ đề "con người" cụ thể được ưu tiên hơn chủ đề rộng.
const TIE_ORDER = ["t3", "t4", "t1", "t5", "t2"];
// Dưới ngưỡng này coi như không đủ tín hiệu -> "Chưa phân loại".
const MIN_SCORE = 2;

const CURRENCY =
  "usd|dolares|dolar|pesos|peso|euros|euro|eur|soles|bolivares|reales|guaranies|rupias|yuanes|yuan|yenes|yen|libras|dinares|riales|quetzales|lempiras|colones|cordobas|dong|baht|bath|kip|rieles|riel|dollars|dollar|rupees";

// [regex chạy trên tiêu đề đã bỏ dấu + viết thường (giữ ký hiệu $ € £), trọng số]
const SIGNALS = {
  t1: [
    [new RegExp(`(?:\\$|€|£|¥|₹)\\s?\\d|\\d[\\d.,]*\\s?(?:\\$|€|(?:${CURRENCY})\\b)|\\bgs\\.?\\s?\\d`), 3],
    [/\b(?:alquiler|alquileres|arriendo|renta mensual|rent)\b/, 3],
    [/\b(?:sueldos?|salarios?|ingresos?|salary|salaries|wages?|income)\b/, 3],
    [/\b(?:costo|coste|cost) (?:de (?:la )?vida|of living)\b/, 3],
    [/\b(?:al|por) (?:dia|mes)\b|\ba (?:day|month)\b|\bper (?:day|month)\b/, 2],
    [/\b(?:mas )?barat[oa]s?\b|\bcheap(?:est)?\b/, 2],
    [/\bgratis\b|\bfree\b/, 2],
    [/\bmas car[oa]s?\b|\bexpensive\b/, 2],
    [/\bprecios?\b|\bcuesta\b|\bprices?\b/, 2],
    [/\b(?:cuartos?|habitaciones?|celdas?|jaulas?|vivienda)\b/, 2],
    [/\bdinero\b|\bmoney\b|\bmillonari/, 1],
  ],
  t2_hooks: [
    [/\bpor que\b|\bwhy\b/, 1],
    [/\bnadie quiere\b|\bnobody wants\b/, 1],
    [/\bvaci[oa]\b|\bempty\b/, 1],
    [/\bmas ric[oa]\b|\bmas pobre\b|\bric[oa] y pobre\b/, 1],
    [/\bcultura\b|\bculture\b|\bidioma\b|\bespanol\b|\bingles\b|\bsorprendente\b|\bmejor\b/, 1],
  ],
  t3: [
    [/\bmujer(?:es)?\b|\bchicas?\b|\bnovias?\b|\besposas?\b|\bwom[ae]n\b|\bgirls?\b|\bwi(?:fe|ves)\b/, 3],
    [/\btrabajadoras\b/, 3],
    [/\bsolter[oa]s\b|\bmatrimonio|\bcasarse\b|\bdivorci|\bpoligam|\bharen\b|\bdote\b|\bviudas?\b/, 2],
    [/\bfeminis|\bmachis|\bgenero\b|\bmadres?\b|\bembaraz|\bprostitu|\bburdel|\bvenden mujeres|\bcompran mujeres/, 2],
    [/\bbodas?\b|\bwedding/, 1],
  ],
  t4: [
    [/\btribus?\b|\btribal(?:es)?\b|\btribes?\b/, 3],
    [/\bnomad/, 3],
    [/\baislad[oa]s?\b|\bisolated\b|\bsin contacto\b|\bincomunicad|\bremot[oa]s?\b/, 3],
    [/\bhadzabe|\bhadza\b|\bnenets\b|\bhimba\b|\bmaasai\b|\bmasai\b|\bmursi\b|\bhamer\b|\byanomami|\bkorowai|\bhuaorani|\bwaorani|\bsentinel|\bkalash\b|\bchukchi|\bevenki|\bbosquimanos|\bpigmeos|\btuareg|\bbeduinos?\b|\binuit\b|\bbajau\b|\bmoken\b/, 3],
    [/\bcazador|\bcaza\b|\bcazar\b|\bhunt(?:ers?|ing)\b|\brecolector/, 2],
    [/\bsupervivencia\b|\bsobreviv|\bsurviv|\bsalvaj|\bprimitiv|\bindigena/, 2],
    [/\bsancion|\bsanction/, 2],
    [/\bviking|\bedad de piedra\b|\bstone age\b/, 2],
    [/\bcarne cruda\b|\bselva\b|\bjungla\b|\bartic[oa]\b|\btundra\b|\bmisterios[oa]\b|\bancestral(?:es)?\b/, 1],
  ],
  t5: [
    [/\b(?:los|las|top)\s+\d{1,3}\b|\b\d{1,3}\s+(?:lugares|paises|ciudades|destinos|sitios|cosas|razones|playas|islas|places|countries|cities)\b/, 3],
    [/\blugares\b|\bdestinos?\b|\bturist|\btourist|\bviajer|\bplaces\b/, 2],
    [/\bpeores?\b|\bpeligros[oa]s?\b|\bworst\b|\bdangerous\b/, 2],
    [/\bdecepcion|\bla verdad detras\b|\bverdad oculta\b|\bestafa|\bthe truth\b/, 2],
    [/\binfierno\b|\bcaotic|\bcaos\b|\barrepentir|\bnunca ponen un pie\b|\bno vayas\b|\bnunca vayas\b|\bque nadie te cuenta\b|\bhell\b/, 2],
    [/\bvida nocturna\b|\bnightlife\b/, 2],
    [/\bbarrios?\b|\bfavelas?\b|\bguetos?\b|\bbrutal|\bmala reputacion\b|\bocult[oa]s?\b|\bpeligro\b|\bslums?\b/, 1],
  ],
};

function plain(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿¡!?«»"“”'’:;|()\[\]–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function score(rules, text, hits) {
  let s = 0;
  for (const [re, w] of rules) {
    const m = text.match(re);
    if (m) {
      s += w;
      hits.push(m[0].trim());
    }
  }
  return s;
}

// geo: kết quả extractGeo() của video (dùng để biết có phải Mỹ Latinh không).
// Trả về { topic, scores, confidence: "high" | "low", matched: {t1: [...], ...} }
export function classifyTopic(title, geo) {
  const text = plain(title);
  const scores = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 };
  const matched = { t1: [], t2: [], t3: [], t4: [], t5: [] };

  scores.t1 = score(SIGNALS.t1, text, matched.t1);
  scores.t3 = score(SIGNALS.t3, text, matched.t3);
  scores.t4 = score(SIGNALS.t4, text, matched.t4);
  scores.t5 = score(SIGNALS.t5, text, matched.t5);

  // Tuyến 2 chỉ có điểm khi tiêu đề nói về (đúng 1 hoặc toàn bộ là) nước Mỹ Latinh.
  const codes = geo?.codes || [];
  if (codes.length && codes.every((c) => LATAM.has(c))) {
    scores.t2 = 3 + Math.min(2, score(SIGNALS.t2_hooks, text, matched.t2));
    matched.t2.unshift("Mỹ Latinh");
  }

  const ranked = Object.keys(scores).sort(
    (a, b) => scores[b] - scores[a] || TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b)
  );
  const best = ranked[0];
  const second = ranked[1];
  if (scores[best] < MIN_SCORE) {
    return { topic: "t0", scores, confidence: "low", matched };
  }
  // Chênh lệch ≤ 1 điểm giữa 2 tuyến đầu -> đánh dấu "cần kiểm tra" trên giao diện.
  const confidence = scores[best] - scores[second] <= 1 ? "low" : "high";
  return { topic: best, scores, confidence, matched };
}
