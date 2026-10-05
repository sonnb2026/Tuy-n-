// Chạy: node --test scripts/
// Kiểm tra bộ phân loại trên toàn bộ ví dụ mẫu của từng tuyến đề + trích xuất quốc gia.
import test from "node:test";
import assert from "node:assert/strict";
import { classifyTopic } from "../public/lib/topics.js";
import { extractGeo } from "../public/lib/geo.js";

const run = (title) => {
  const geo = extractGeo({ title });
  return { geo, ...classifyTopic(title, geo) };
};

// [tiêu đề, tuyến mong đợi, mã quốc gia mong đợi]
const CASES = [
  ["Así es la VIDA REAL en ARGENTINA: 1.196.413 pesos de alquiler, 3 sueldos mínimos – Documental", "t1", "AR"],
  ["Así es la VIDA REAL en PARAGUAY: Gs. 5.400.000 de alquiler, casi 2 sueldos mínimos – Documental", "t1", "PY"],
  ["Así es la VIDA REAL en REPÚBLICA DOMINICANA: 25.000 de alquiler, casi un sueldo mínimo y medio", "t1", "DO"],
  ["La Vida Real en Camboya: Aldeas Pobres Prohibidas para los Turistas, Ingresos de Solo 2 USD al Día", "t1", "KH"],
  ["Vida en LAOS: Vivir con $15 al Día en el País Más MISTERIOSO y sus Raras Bodas - Documental", "t1", "LA"],
  ["La Vida en Belice — El País Más Barato del Mundo, Donde Casi Todo Es Gratis, Incluso «Eso»", "t1", "BZ"],
  ["Vida Real en Hong Kong: La Ciudad Donde Cientos de Miles Viven en Cuartos Más Pequeños que una Celda", "t1", "HK"],

  ["Así Es La Vida En VENEZUELA, El País MÁS RICO Y POBRE Del MUNDO Lleno De BELLAS MUJERES", "t2", "VE"],
  ["Así es la VIDA REAL en COLOMBIA: ¿el país que habla el mejor español del mundo?", "t2", "CO"],
  ["¿Cómo es la vida en Perú? El país más barato de Sudamérica y una cultura sorprendente | Documental", "t2", "PE"],
  ["¿Por Qué PERÚ Está Tan VACÍO?", "t2", "PE"],
  ["¿Por Qué NADIE Quiere Vivir en BOLIVIA?", "t2", "BO"],
  ["¿Por Qué NADIE QUIERE Vivir en Nicaragua?", "t2", "NI"],
  ["Así es la VIDA REAL en BELICE: el único país de Centroamérica donde el inglés es el idioma oficial", "t2", "BZ"],

  ["La vida real en la India: ¿Cómo viven las mujeres en el país más poblado del mundo? – Documental", "t3", "IN"],
  ["IRÁN: Mujeres Hermosas y una Vida Imposible Bajo las Sanciones Más Duras del Mundo! Documental", "t3", "IR"],
  ["Así es la Vida Real en los Países con Más Mujeres Solteras del Mundo ¿Cómo Viven Realmente?", "t3", "UNK"],
  ["AQUÍ SE COMPRAN Y VENDEN MUJERES POR 20 CABRAS: LA ALDEA DE REFUGIADOS MÁS POBRE: CONGO DEMOCRÁTICO", "t3", "CD"],
  ["POBREZA EXTREMA, PELIGRO Y TRABAJADORAS: EL BARRIO CON MALA REPUTACIÓN DE UGANDA 🇺🇬 - DOCUMENTAL", "t3", "UG"],

  ["Vida Real En La Tribu Hadzabe: Caza Extrema Y Supervivencia Salvaje - Documental", "t4", "TZ"],
  ["La VIDA REAL de los NENETS en Rusia: ¡Los NÓMADAS RESISTENTES que SOBREVIVEN COMIENDO CARNE CRUDA!", "t4", "RU"],
  ["50.000 Viven Aisladas En Medio Del Atlántico — Son Ricas, Pero Viven Como En La Época Vikinga", "t4", "UNK"],
  ["Vida en IRÁN Cómo Vive la Gente en el País MÁS Sancionado del Mundo - Documental de viajes", "t4", "IR"],

  ["Los 10 PEORES Y MÁS PELIGROSOS Lugares del Mundo para Vivir (y Por Qué Nadie se Va)", "t5", "UNK"],
  ["La Verdad Detrás de los 12 Lugares Turísticos Más Famosos del Mundo (y Por Qué Decepcionan) | 4K", "t5", "UNK"],
  ["La Vida Real en Tailandia: Las Aldeas Pobres del Norte Donde los Turistas Nunca Ponen un Pie", "t5", "TH"],
  ["Vida Real en TAILANDIA: Barrios Brutales, Vida Nocturna Oculta y Tradiciones Ancestrales!-Documental", "t5", "TH"],
  ["El INFIERNO MÁS CAÓTICO DEL MUNDO en la TIERRA – ¡Te ARREPENTIRÁS de Ver Esto! - Documental", "t5", "UNK"],
];

for (const [title, topic, country] of CASES) {
  test(`${topic} | ${title.slice(0, 70)}`, () => {
    const r = run(title);
    assert.equal(r.topic, topic, `scores=${JSON.stringify(r.scores)} matched=${JSON.stringify(r.matched)}`);
    assert.equal(r.geo.countryCode, country);
  });
}

test("không có tín hiệu -> Chưa phân loại", () => {
  assert.equal(run("Así es la vida en Japón").topic, "t0");
});
test("'español' không bị nhận nhầm thành Tây Ban Nha", () => {
  assert.equal(extractGeo({ title: "hablan el mejor español" }).countryCode, "UNK");
});
test("nhiều nước khác châu lục -> Nhiều quốc gia / Nhiều châu lục", () => {
  const g = extractGeo({ title: "México vs Japón: ¿dónde es más barato vivir?" });
  assert.equal(g.countryCode, "MULTI");
  assert.equal(g.continent, "Nhiều châu lục");
});
test("không có nước trong tiêu đề -> lấy từ tags (đánh dấu nguồn)", () => {
  const g = extractGeo({ title: "Viven Aisladas En Medio Del Atlántico", tags: ["islas feroe", "documental"] });
  assert.equal(g.countryCode, "FO");
  assert.equal(g.source, "tags");
});
