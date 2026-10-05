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

// Khi hoà điểm: chủ đề cụ thể được ưu tiên hơn chủ đề rộng. Bộ tộc đứng trước Phụ nữ vì tiêu đề kiểu
// "Mujeres Himba / Mujeres del Sahara (Tuareg)" là phim về bộ tộc.
const TIE_ORDER = ["t4", "t3", "t1", "t5", "t2"];
// Dưới ngưỡng này coi như không đủ tín hiệu -> "Chưa phân loại".
const MIN_SCORE = 2;

const CURRENCY =
  "usd|dolares|dolar|pesos|peso|euros|euro|eur|soles|bolivares|reales|guaranies|rupias|yuanes|yuan|yenes|yen|libras|dinares|riales|quetzales|lempiras|colones|cordobas|dong|baht|bath|kip|rieles|riel|dollars|dollar|rupees";

const WOMEN = /\bmujer(?:es)?\b|\bmulher(?:es)?\b|\bfemmes?\b|\bchicas?\b|\bnovias?\b|\besposas?\b|\bwom[ae]n\b|\bgirls?\b|\bwi(?:fe|ves)\b/;
// "Mujeres bellas / hermosas / deslumbrantes..." là câu câu khách trong phim du lịch (vd ví dụ Venezuela
// ở Tuyến 2), không phải phim về thân phận phụ nữ. Khi gặp: Tuyến 3 chỉ +1, Tuyến 5 +2.
const BEAUTY_BAIT = /\b(?:bell[ao]s?|bellisim|hermos|preciosa|guapa|lind[ao]s|bonit|deslumbrant|cautivador|ardiente|atractiv|belleza|angel|sexy|lindas|belles|carinos|hipnotiz|seductor|exotic|rubias|pelirroj)/;

const TRIBE_CORE = /\btribus?\b|\btribos?\b|\btribes?\b|\bnomad|\bhimba\b|\btuaregs?\b|\bhadza|\bnenets\b|\bmaasai\b|\bmursi\b|\besquimales\b|\binuit\b/;

// [regex chạy trên tiêu đề đã bỏ dấu + viết thường (giữ ký hiệu $ € £), trọng số]
const SIGNALS = {
  t1: [
    [new RegExp(`(?:\\$|€|£|¥|₹)\\s?\\d|\\d[\\d.,]*\\s?(?:\\$|€|(?:${CURRENCY})\\b)|\\bgs\\.?\\s?\\d`), 3],
    [/\b(?:alquiler|alquileres|arriendo|renta mensual|rent|aluguel|loyer)\b/, 3],
    [/\b(?:sueldos?|salarios?|ingresos?|salary|salaries|wages?|income|salaire|renda)\b/, 3],
    [/\b(?:costo|coste|cost|custo|cout) (?:de (?:la )?vida|of living|de vida|de la vie)\b/, 3],
    [/\b(?:al|por) (?:dia|mes)\b|\ba (?:day|month)\b|\bper (?:day|month)\b|\bpar jour\b/, 2],
    [/\b(?:mas )?barat[oa]s?\b|\bcheap(?:est)?\b/, 2],
    [/\bgratis\b|\bfree\b|\bregala\b|\bgratuit/, 2],
    [/\bmas car[oa]s?\b|\bexpensive\b/, 2],
    [/\bprecios?\b|\bcuesta\b|\bprices?\b|\bprecos?\b/, 2],
    [/\b(?:cuartos?|habitaciones?|celdas?|jaulas?|vivienda|casas vacias|quartos?)\b/, 2],
    [/\bdinero\b|\bmoney\b|\bmillonari|\bdinheiro\b/, 1],
  ],
  t2_hooks: [
    [/\bpor que\b|\bwhy\b|\bpourquoi\b/, 1],
    [/\bnadie quiere\b|\bnobody wants\b|\bninguem quer\b/, 1],
    [/\bvaci[oa]\b|\bempty\b/, 1],
    [/\bmas ric[oa]\b|\bmas pobre\b|\bric[oa] y pobre\b/, 1],
    [/\bcultura\b|\bculture\b|\bidioma\b|\bespanol\b|\bingles\b|\bholandes\b|\bsorprendente\b|\bmejor\b|\bunico pais\b|\blangue\b/, 1],
  ],
  t3: [
    // "mujeres" được 3 điểm - nhưng nếu đi kèm tính từ khen ngoại hình thì chỉ còn 1 (xem BEAUTY_BAIT).
    [WOMEN, 3],
    [/\btrabajadoras\b/, 3],
    [/\bsolter[oa]s\b|\bmatrimonio|\bcasamento|\bcasarse\b|\bse casa\b|\bdivorci|\bpoligam|\bharen\b|\bdote\b|\bviudas?\b/, 2],
    [/\bfeminis|\bmachis|\bgenero\b|\bmadres?\b|\bembaraz|\bprostitu|\bburdel|\bvenden mujeres|\bcompran mujeres|\ben venta\b|\besclavitud|\bvirgen\b|\bvirginidad/, 2],
    // Hoàn cảnh / thân phận của phụ nữ (phân biệt với tiêu đề chỉ khen phụ nữ đẹp).
    [/\bvida imposible\b|\batrapad|\breglas\b|\bdura realidad\b|\bla sombra\b|\bderechos\b|\bse niega\b|\bobligad|\bcontrolad|\beligen\b|\bdirigen\b/, 2],
    [/\bbodas?\b|\bwedding/, 1],
  ],
  t4: [
    [/\btribus?\b|\btribal(?:es)?\b|\btribes?\b|\btribos?\b/, 3],
    [/\bnomad/, 3],
    [/\baislad[oa]s?\b|\bisolated\b|\bisolad[oa]s?\b|\bisole(?:e|es)?\b|\bsin contacto\b|\bincomunicad|\bremot[oa]s?\b|\bmas alejad[oa]\b/, 3],
    [/\bhadzabe|\bhadza\b|\bnenets\b|\bhimba\b|\bmaasai\b|\bmasai\b|\bmursi\b|\bhamer\b|\byanomami|\bkorowai|\bhuaorani|\bwaorani|\bsentinel|\bkalash\b|\bchukchi|\bevenki|\bbosquimanos|\bpigmeos|\btuaregs?\b|\bbeduinos?\b|\binuit\b|\besquimales\b|\bbajau\b|\bmoken\b|\bjanti\b|\bkhanty\b|\bpiraha\b|\bhombres hiena\b/, 3],
    [/\bcazador|\bcaza\b|\bcazar\b|\bhunt(?:ers?|ing)\b|\brecolector|\bcacadores\b/, 2],
    [/\bsupervivencia\b|\bsobreviv|\bsurviv|\bsalvaj|\bselvagem|\bprimitiv|\bindigena/, 2],
    [/\bsancion|\bsanction|\bmas aislado\b|\bmas cerrado\b|\bhermetic|\bsin internet\b|\bmas vigilado\b/, 2],
    [/\bviking|\bedad de piedra\b|\bstone age\b/, 2],
    [/\bcarne cruda\b|\bselva\b|\bjungla\b|\bartic[oa]\b|\btundra\b|\btaiga\b|\bmisterios[oa]\b|\bancestral(?:es)?\b/, 1],
  ],
  t5: [
    [/\b(?:los|las|top|os|as|les)\s+\d{1,3}\b|\b\d{1,3}\s+(?:lugares|paises|ciudades|destinos|sitios|cosas|razones|playas|islas|places|countries|cities|mejores|peores)\b/, 3],
    [/\blugares\b|\bdestinos?\b|\bturist|\btourist|\bviajer|\bplaces\b|\blieux\b/, 2],
    [/\bpeores?\b|\bpeligros[oa]s?\b|\bworst\b|\bdangerous\b|\bpior(?:es)?\b|\bperigos[oa]s?\b|\bpire\b|\bdangereu/, 2],
    [/\bdecepcion|\bla verdad detras\b|\bverdad oculta\b|\bestafa|\bthe truth\b/, 2],
    [/\binfierno\b|\bcaotic|\bcaos\b|\barrepentir|\bnunca ponen un pie\b|\bno vayas\b|\bnunca vayas\b|\bque nadie te cuenta\b|\bhell\b|\binsan[oa]s?\b/, 2],
    [/\bvida nocturna\b|\bnightlife\b|\bnoche salvaje\b/, 2],
    // Mặt tiêu cực / mặt khuất của 1 điểm đến.
    [/\bpecamin|\bpecador|\bpecado\b|\bsin verguenza|\bsem vergonha|\bsin censura|\bsin filtros?\b/, 2],
    [/\bsecretos?\b|\bsegredos?\b|\bocult[oa]s?\b|\boscur[oa]s?\b|\bsombri[oa]\b|\bque pocos conocen\b|\bnunca (?:mostro|muestra)\b|\bno muestra\b|\bchocante|\bchocan|\bassusta|\bimpactante|\bextran[oa]s?\b|\braros?\b|\bbizarr|\bal descubierto\b|\bla verdad\b|\bbrutal\b/, 1, 2],
    // Mặt tích cực: điểm đến đáng sống / đáng đến.
    [/\bparaiso\b|\bparadise\b|\bmejores paises\b|\bfavorit|\bjubilad|\bcalidad de vida\b|\bdocumental de viajes?\b|\bmas (?:hermos|bonit|feliz|segur|exotic|popular|limpi)/, 2],
    [/\bexotic[oa]\b|\blujo\b|\briqueza\b|\bturismo\b|\bpaisajes?\b|\bhospitalidad\b|\bnaturaleza\b|\bse enamora|\bmajestuos|\bencantador|\bmas ric[oa]\b|\bmas pequen[oa]\b|\bsorprend/, 1, 2],
    [/\bbarrios?\b|\bfavelas?\b|\bguetos?\b|\bmala reputacion\b|\bpeligro\b|\bslums?\b|\bmarginal\b/, 1, 2],
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

// Mỗi nhóm cụm từ cộng điểm 1 lần. Nhóm có "cap" (tham số thứ 3) thì mỗi cụm KHÁC NHAU khớp được
// cộng riêng, tối đa bằng cap - dùng cho các tín hiệu yếu, cần 2 tín hiệu yếu mới đủ xếp tuyến.
function score(rules, text, hits) {
  let s = 0;
  for (const [re, w, cap] of rules) {
    if (cap) {
      const g = new RegExp(re.source, "g");
      const found = [...new Set([...text.matchAll(g)].map((m) => m[0].trim()))];
      if (found.length) {
        s += Math.min(cap, found.length * w);
        hits.push(...found);
      }
      continue;
    }
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
  // Câu khách "mujeres bellas": chỉ coi là câu khách khi tiêu đề KHÔNG có tín hiệu nào khác về
  // thân phận phụ nữ (vd "Mujeres Hermosas… Pero Atrapadas En Reglas" vẫn là Tuyến 3).
  // Nếu là phim bộ tộc ("La Tribu ... y sus mujeres Bellas") thì không đẩy sang du lịch.
  if (WOMEN.test(text) && BEAUTY_BAIT.test(text) && matched.t3.length === 1) {
    scores.t3 -= 2;
    if (!TRIBE_CORE.test(text)) {
      scores.t5 += 2;
      matched.t5.push("phụ nữ đẹp (câu khách)");
    }
  }
  scores.t5 += score(SIGNALS.t5, text, matched.t5);

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
