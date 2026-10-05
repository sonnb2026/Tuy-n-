// public/lib/geo.js
//
// Từ điển quốc gia -> châu lục, dùng để trích xuất Quốc gia / Châu lục từ TIÊU ĐỀ video.
// Tiêu đề của các tuyến đề chủ yếu là tiếng Tây Ban Nha, nên alias chính là tên tiếng TBN
// (đã bỏ dấu, viết thường), kèm tên tiếng Anh và vài thành phố/vùng nổi tiếng chỉ thuộc 1 nước.
//
// Định dạng mỗi dòng:  MÃ | Tên tiếng Việt | Châu lục | alias1; alias2; ...
// Châu lục: AS Châu Á, EU Châu Âu, AF Châu Phi, NA Bắc Mỹ (gồm Trung Mỹ + Caribe),
//           SA Nam Mỹ, OC Châu Đại Dương, AN Châu Nam Cực.
//
// Muốn thêm/sửa: chỉ cần thêm 1 dòng hoặc thêm alias (viết thường, KHÔNG dấu).
// Tránh thêm alias là từ thông dụng trong tiếng TBN (vd "lima" = quả chanh, "la paz" = hoà bình,
// "lagos" = những cái hồ, "granada", "roma"...) vì sẽ nhận diện nhầm.

export const CONTINENTS = {
  AS: "Châu Á",
  EU: "Châu Âu",
  AF: "Châu Phi",
  NA: "Bắc Mỹ",
  SA: "Nam Mỹ",
  OC: "Châu Đại Dương",
  AN: "Châu Nam Cực",
};

const RAW = `
AF|Afghanistan|AS|afganistan;afghanistan;kabul
AM|Armenia|AS|armenia;erevan
AZ|Azerbaijan|AS|azerbaiyan;azerbaijan;baku
BH|Bahrain|AS|bahrein;barein;bahrain
BD|Bangladesh|AS|bangladesh;banglades;dhaka;daca
BT|Bhutan|AS|butan;bhutan
BN|Brunei|AS|brunei
KH|Campuchia|AS|camboya;cambodia;phnom penh;angkor
CN|Trung Quốc|AS|china;pekin;beijing;shanghai;shangai;shenzhen
HK|Hồng Kông|AS|hong kong;kowloon
MO|Ma Cao|AS|macao;macau
TW|Đài Loan|AS|taiwan;taipei
XT|Tây Tạng|AS|tibet;lhasa
GE|Gruzia|AS|georgia;tiflis;tbilisi
IN|Ấn Độ|AS|india;mumbai;bombay;nueva delhi;delhi;calcuta;kolkata;varanasi;benares;rajastan;rajasthan;new delhi
ID|Indonesia|AS|indonesia;yakarta;jakarta;bali;sumatra;java
IR|Iran|AS|iran;teheran;tehran;persia
IQ|Iraq|AS|irak;iraq;bagdad;baghdad
IL|Israel|AS|israel;jerusalen;jerusalem;tel aviv
PS|Palestine|AS|palestina;palestine;gaza;cisjordania
JP|Nhật Bản|AS|japon;japan;tokio;tokyo;osaka;kioto;kyoto
JO|Jordan|AS|jordania;jordan;amman
KZ|Kazakhstan|AS|kazajistan;kazajstan;kazakhstan
KG|Kyrgyzstan|AS|kirguistan;kirguizistan;kyrgyzstan
LA|Lào|AS|laos;vientian;vientiane
LB|Liban|AS|libano;lebanon;beirut
MY|Malaysia|AS|malasia;malaysia;kuala lumpur
MV|Maldives|AS|maldivas;maldives
MN|Mông Cổ|AS|mongolia;ulan bator;ulaanbaatar
MM|Myanmar|AS|myanmar;birmania;burma;rangun;yangon
NP|Nepal|AS|nepal;katmandu;kathmandu
KP|Triều Tiên|AS|corea del norte;north korea;pyongyang;norcorea
KR|Hàn Quốc|AS|corea del sur;south korea;seul;seoul;corea;korea
OM|Oman|AS|oman;mascate
PK|Pakistan|AS|pakistan;karachi;lahore;islamabad
PH|Philippines|AS|filipinas;philippines;manila
QA|Qatar|AS|qatar;catar;doha
SA|Ả Rập Xê Út|AS|arabia saudita;arabia saudi;saudi arabia;riad;riyadh;la meca;meca;mecca
SG|Singapore|AS|singapur;singapore
LK|Sri Lanka|AS|sri lanka;ceilan
SY|Syria|AS|siria;syria;damasco
TJ|Tajikistan|AS|tayikistan;tajikistan
TH|Thái Lan|AS|tailandia;thailand;bangkok;phuket;chiang mai;pattaya
TL|Đông Timor|AS|timor oriental;east timor;timor leste
TR|Thổ Nhĩ Kỳ|AS|turquia;turkey;turkiye;estambul;istanbul;capadocia
TM|Turkmenistan|AS|turkmenistan;asjabad
AE|UAE|AS|emiratos arabes unidos;emiratos arabes;emiratos;uae;dubai;abu dabi;abu dhabi
UZ|Uzbekistan|AS|uzbekistan;samarcanda;samarkand
VN|Việt Nam|AS|vietnam;viet nam;hanoi;saigon;ho chi minh
YE|Yemen|AS|yemen
AL|Albania|EU|albania;tirana
AD|Andorra|EU|andorra
AT|Áo|EU|austria;viena;vienna
BY|Belarus|EU|bielorrusia;belarus;minsk
BE|Bỉ|EU|belgica;belgium;bruselas;brussels
BA|Bosnia|EU|bosnia;sarajevo
BG|Bulgaria|EU|bulgaria
HR|Croatia|EU|croacia;croatia
CY|Síp|EU|chipre;cyprus
CZ|Séc|EU|chequia;republica checa;czech;praga;prague
DK|Đan Mạch|EU|dinamarca;denmark;copenhague;copenhagen
EE|Estonia|EU|estonia
FI|Phần Lan|EU|finlandia;finland;laponia;lapland
FR|Pháp|EU|francia;france;paris;marsella
DE|Đức|EU|alemania;germany;berlin;munich
GR|Hy Lạp|EU|grecia;greece;atenas;athens
HU|Hungary|EU|hungria;hungary;budapest
IS|Iceland|EU|islandia;iceland;reikiavik
IE|Ireland|EU|irlanda;ireland;dublin
IT|Ý|EU|italia;italy;venecia;venice;napoles;sicilia;milan
XK|Kosovo|EU|kosovo
LV|Latvia|EU|letonia;latvia
LI|Liechtenstein|EU|liechtenstein
LT|Lithuania|EU|lituania;lithuania
LU|Luxembourg|EU|luxemburgo;luxembourg
MT|Malta|EU|malta
MD|Moldova|EU|moldavia;moldova;transnistria
MC|Monaco|EU|monaco;montecarlo
ME|Montenegro|EU|montenegro
NL|Hà Lan|EU|paises bajos;holanda;netherlands;holland;amsterdam
MK|Bắc Macedonia|EU|macedonia del norte;macedonia
NO|Na Uy|EU|noruega;norway;oslo
PL|Ba Lan|EU|polonia;poland;varsovia;warsaw
PT|Bồ Đào Nha|EU|portugal;lisboa;lisbon;oporto
RO|Romania|EU|rumania;romania;transilvania;bucarest
RU|Nga|EU|rusia;russia;moscu;moscow;siberia;yakutia;yakutsk;san petersburgo;chechenia
SM|San Marino|EU|san marino
RS|Serbia|EU|serbia;belgrado
SK|Slovakia|EU|eslovaquia;slovakia
SI|Slovenia|EU|eslovenia;slovenia
ES|Tây Ban Nha|EU|espana;spain;madrid;barcelona;canarias
SE|Thụy Điển|EU|suecia;sweden;estocolmo;stockholm
CH|Thụy Sĩ|EU|suiza;switzerland
UA|Ukraina|EU|ucrania;ukraine;kiev;kyiv;chernobyl
GB|Anh|EU|reino unido;united kingdom;inglaterra;england;escocia;scotland;londres;london
VA|Vatican|EU|vaticano;vatican
FO|Quần đảo Faroe|EU|islas feroe;feroe;faroe
DZ|Algeria|AF|argelia;algeria
AO|Angola|AF|angola;luanda
BJ|Benin|AF|benin
BW|Botswana|AF|botsuana;botswana
BF|Burkina Faso|AF|burkina faso
BI|Burundi|AF|burundi
CV|Cabo Verde|AF|cabo verde;cape verde
CM|Cameroon|AF|camerun;cameroon
CF|CH Trung Phi|AF|republica centroafricana;central african republic;centroafrica
TD|Chad|AF|chad
KM|Comoros|AF|comoras;comoros
CD|CHDC Congo|AF|republica democratica del congo;congo democratico;rd congo;rdc;democratic republic of the congo;dr congo;kinshasa
CG|Congo|AF|republica del congo;congo;brazzaville
CI|Bờ Biển Ngà|AF|costa de marfil;ivory coast
DJ|Djibouti|AF|yibuti;djibouti
EG|Ai Cập|AF|egipto;egypt;el cairo;cairo
GQ|Guinea Xích Đạo|AF|guinea ecuatorial;equatorial guinea
ER|Eritrea|AF|eritrea
SZ|Eswatini|AF|esuatini;eswatini;suazilandia;swaziland
ET|Ethiopia|AF|etiopia;ethiopia;adis abeba;addis ababa
GA|Gabon|AF|gabon
GM|Gambia|AF|gambia
GH|Ghana|AF|ghana;accra
GN|Guinea|AF|guinea;conakry
GW|Guinea-Bissau|AF|guinea bisau;guinea bissau
KE|Kenya|AF|kenia;kenya;nairobi;kibera
LS|Lesotho|AF|lesoto;lesotho
LR|Liberia|AF|liberia;monrovia
LY|Libya|AF|libia;libya;tripoli
MG|Madagascar|AF|madagascar
MW|Malawi|AF|malaui;malawi
ML|Mali|AF|mali;tombuctu;timbuktu
MR|Mauritania|AF|mauritania
MU|Mauritius|AF|mauricio;mauritius
MA|Ma-rốc|AF|marruecos;morocco;marrakech;marrakesh
MZ|Mozambique|AF|mozambique
NA|Namibia|AF|namibia
NE|Niger|AF|niger
NG|Nigeria|AF|nigeria
RW|Rwanda|AF|ruanda;rwanda
ST|São Tomé và Príncipe|AF|santo tome;sao tome
SN|Senegal|AF|senegal;dakar
SC|Seychelles|AF|seychelles
SL|Sierra Leone|AF|sierra leona;sierra leone
SO|Somalia|AF|somalia;mogadiscio;mogadishu
ZA|Nam Phi|AF|sudafrica;south africa;johannesburgo;johannesburg;ciudad del cabo
SS|Nam Sudan|AF|sudan del sur;south sudan
SD|Sudan|AF|sudan;jartum
TZ|Tanzania|AF|tanzania;zanzibar;serengeti
TG|Togo|AF|togo
TN|Tunisia|AF|tunez;tunisia
UG|Uganda|AF|uganda;kampala
ZM|Zambia|AF|zambia
ZW|Zimbabwe|AF|zimbabue;zimbabwe
US|Mỹ|NA|estados unidos;eeuu;ee uu;united states;nueva york;new york;los angeles;california;texas;florida;alaska;hawai;hawaii;las vegas;chicago
CA|Canada|NA|canada;toronto;vancouver
MX|Mexico|NA|mexico;ciudad de mexico;cdmx;cancun;oaxaca;chiapas;yucatan;tijuana;guadalajara
GT|Guatemala|NA|guatemala
BZ|Belize|NA|belice;belize
SV|El Salvador|NA|el salvador
HN|Honduras|NA|honduras;tegucigalpa
NI|Nicaragua|NA|nicaragua;managua
CR|Costa Rica|NA|costa rica
PA|Panama|NA|panama
CU|Cuba|NA|cuba;la habana;habana;havana
DO|CH Dominica|NA|republica dominicana;dominican republic;santo domingo;punta cana
HT|Haiti|NA|haiti;puerto principe
JM|Jamaica|NA|jamaica
PR|Puerto Rico|NA|puerto rico
BS|Bahamas|NA|bahamas
BB|Barbados|NA|barbados
TT|Trinidad và Tobago|NA|trinidad y tobago;trinidad and tobago
DM|Dominica|NA|dominica
GL|Greenland|NA|groenlandia;greenland
AR|Argentina|SA|argentina;buenos aires;patagonia
BO|Bolivia|SA|bolivia;uyuni;santa cruz de la sierra
BR|Brazil|SA|brasil;brazil;rio de janeiro;sao paulo
CL|Chile|SA|chile;santiago de chile
CO|Colombia|SA|colombia;bogota;medellin
EC|Ecuador|SA|ecuador;quito;galapagos;guayaquil
GY|Guyana|SA|guyana
PY|Paraguay|SA|paraguay
PE|Peru|SA|peru;cusco;cuzco;machu picchu
SR|Suriname|SA|surinam;suriname
UY|Uruguay|SA|uruguay;montevideo
VE|Venezuela|SA|venezuela;caracas;maracaibo
GF|Guyane thuộc Pháp|SA|guayana francesa;french guiana
AU|Australia|OC|australia;sidney;sydney;melbourne
NZ|New Zealand|OC|nueva zelanda;new zealand
PG|Papua New Guinea|OC|papua nueva guinea;papua new guinea;papua
FJ|Fiji|OC|fiyi;fiji
SB|Quần đảo Solomon|OC|islas salomon;solomon islands
VU|Vanuatu|OC|vanuatu
WS|Samoa|OC|samoa
TO|Tonga|OC|tonga
KI|Kiribati|OC|kiribati
TV|Tuvalu|OC|tuvalu
NR|Nauru|OC|nauru
FM|Micronesia|OC|micronesia
MH|Quần đảo Marshall|OC|islas marshall;marshall islands
PW|Palau|OC|palau
AQ|Nam Cực|AN|antartida;antarctica;antartico
`;

// Tên dân tộc / bộ tộc chỉ sống ở 1 quốc gia -> quy về quốc gia đó.
// Chỉ dùng khi tiêu đề KHÔNG nhắc trực tiếp tên nước nào (ưu tiên thấp hơn tên nước).
const PEOPLE = `
TZ|hadzabe;hadza;datoga
KE|maasai;masai;turkana;samburu
NA|himba
ET|mursi;hamer;hamar;suri
RU|nenets;chukchi;evenki;yakutos
IN|sentinel;sentineleses;sentineles
BR|yanomami;awa guaja
ID|korowai;mentawai
EC|huaorani;waorani
BW|bosquimanos
PK|kalash
`;

// Từ chỉ người (demonym) -> quốc gia. Ưu tiên thấp nhất (sau tên nước, sau bộ tộc).
// Gốc từ + đuôi o/a/os/as. Cố ý KHÔNG có "espanol" (vì hay xuất hiện với nghĩa "tiếng Tây Ban Nha"),
// "indio" (người bản địa châu Mỹ), "americano".
const DEMONYM_OA = `
AF|afgan
KP|norcorean
VE|venezolan
CU|cuban
MX|mexican
CO|colombian
AR|argentin
PE|peruan
BO|bolivian
HT|haitian
UA|ucranian
KH|camboyan
PH|filipin
KR|surcorean;corean
BR|brasilen
CL|chilen
NG|nigerian
KE|kenian
RU|rus
CN|chin
DO|dominican
PY|paraguay
UY|uruguay
EC|ecuatorian
NI|nicaraguens
HN|hondurens
GT|guatemaltec
SV|salvadoren
`;
const DEMONYM_ES = `
TH|tailand
JP|japon
VN|vietnamit
IR|irani
`;

export const COUNTRIES = {}; // code -> { code, name, continent }
const ALIASES = []; // { alias, code, tier }  tier: 0 = tên nước/thành phố, 1 = bộ tộc, 2 = demonym

for (const line of RAW.trim().split("\n")) {
  const [code, name, continent, aliases] = line.split("|");
  COUNTRIES[code] = { code, name, continent };
  for (const a of aliases.split(";")) ALIASES.push({ alias: a.trim(), code, tier: 0 });
}
for (const line of PEOPLE.trim().split("\n")) {
  const [code, aliases] = line.split("|");
  for (const a of aliases.split(";")) ALIASES.push({ alias: a.trim(), code, tier: 1 });
}
for (const line of DEMONYM_OA.trim().split("\n")) {
  const [code, stems] = line.split("|");
  for (const s of stems.split(";")) {
    for (const suf of ["o", "a", "os", "as"]) ALIASES.push({ alias: s + suf, code, tier: 2 });
  }
}
for (const line of DEMONYM_ES.trim().split("\n")) {
  const [code, stems] = line.split("|");
  for (const s of stems.split(";")) {
    for (const suf of ["es", "esa", "eses", "esas", "a", "as", "o", "os"]) ALIASES.push({ alias: s + suf, code, tier: 2 });
  }
}
// "vietnamita" / "irani" có đuôi riêng, thêm vài dạng phổ biến.
ALIASES.push({ alias: "irani", code: "IR", tier: 2 }, { alias: "iranies", code: "IR", tier: 2 });

// Alias dài khớp trước, để "papua nueva guinea" không bị tách thành "guinea",
// "republica dominicana" không thành "dominica", "corea del norte" không thành "corea"...
ALIASES.sort((a, b) => b.alias.length - a.alias.length);

const ALIAS_RE = ALIASES.map((a) => ({
  ...a,
  re: new RegExp(`(?<![a-z0-9])${a.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "g"),
}));

// Mỹ Latinh: dùng cho Tuyến 2. Gồm các nước nói TBN/BĐN ở châu Mỹ + Haiti, Puerto Rico,
// và Belize (theo đúng ví dụ của bạn, dù Belize nói tiếng Anh).
export const LATAM = new Set([
  "MX", "GT", "BZ", "SV", "HN", "NI", "CR", "PA", "CU", "DO", "HT", "PR",
  "AR", "BO", "BR", "CL", "CO", "EC", "PY", "PE", "UY", "VE",
]);

export function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Cờ quốc gia dạng emoji (🇺🇬 = 2 ký tự "regional indicator") -> mã nước.
function flagCodes(text) {
  const out = [];
  const re = /([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/gu;
  let m;
  while ((m = re.exec(String(text || "")))) {
    const code =
      String.fromCharCode(m[1].codePointAt(0) - 0x1f1e6 + 65) + String.fromCharCode(m[2].codePointAt(0) - 0x1f1e6 + 65);
    if (COUNTRIES[code]) out.push(code);
  }
  return out;
}

// Trả về danh sách mã nước tìm thấy trong 1 đoạn text, theo thứ tự xuất hiện, không trùng.
// Tầng ưu tiên: nếu có tên nước (tier 0) thì bỏ qua bộ tộc/demonym.
export function findCountries(text) {
  const norm = " " + normalize(text) + " ";
  const taken = new Array(norm.length).fill(false);
  const hits = [];
  for (const a of ALIAS_RE) {
    a.re.lastIndex = 0;
    let m;
    while ((m = a.re.exec(norm))) {
      const s = m.index;
      const e = s + m[0].length;
      let free = true;
      for (let i = s; i < e; i++) if (taken[i]) { free = false; break; }
      if (!free) continue;
      for (let i = s; i < e; i++) taken[i] = true;
      hits.push({ code: a.code, pos: s, tier: a.tier });
    }
  }
  for (const code of flagCodes(text)) hits.push({ code, pos: -1, tier: 0 });
  if (!hits.length) return [];
  const bestTier = Math.min(...hits.map((h) => h.tier));
  const ordered = hits.filter((h) => h.tier === bestTier).sort((a, b) => a.pos - b.pos);
  return [...new Set(ordered.map((h) => h.code))];
}

export const MULTI_COUNTRY = { code: "MULTI", name: "Nhiều quốc gia" };
export const UNKNOWN_COUNTRY = { code: "UNK", name: "Không xác định" };
export const MULTI_CONTINENT = "Nhiều châu lục";
export const UNKNOWN_CONTINENT = "Không xác định";

// Xác định quốc gia + châu lục cho 1 video.
// 1) Tiêu đề (gồm cả cờ emoji). 2) Nếu tiêu đề không có nước nào: tags, rồi 300 ký tự đầu mô tả
//    (đánh dấu source để giao diện hiện "≈", nghĩa là suy ra ngoài tiêu đề).
export function extractGeo({ title, tags, description }) {
  const sources = [
    ["title", title],
    ["tags", Array.isArray(tags) ? tags.join(" , ") : ""],
    ["description", String(description || "").slice(0, 300)],
  ];
  for (const [source, text] of sources) {
    const codes = findCountries(text);
    if (!codes.length) continue;
    // Ngoài tiêu đề, mô tả/tag hay liệt kê nhiều nước (link video khác...) -> chỉ nhận khi có đúng 1 nước.
    if (source !== "title" && codes.length > 1) continue;
    return geoFromCodes(codes, source);
  }
  return {
    countryCode: UNKNOWN_COUNTRY.code,
    country: UNKNOWN_COUNTRY.name,
    continentCode: "UNK",
    continent: UNKNOWN_CONTINENT,
    source: "none",
    codes: [],
  };
}

export function geoFromCodes(codes, source) {
  if (codes.length === 1) {
    const c = COUNTRIES[codes[0]];
    return {
      countryCode: c.code,
      country: c.name,
      continentCode: c.continent,
      continent: CONTINENTS[c.continent],
      source,
      codes,
    };
  }
  const conts = [...new Set(codes.map((c) => COUNTRIES[c].continent))];
  return {
    countryCode: MULTI_COUNTRY.code,
    country: MULTI_COUNTRY.name,
    continentCode: conts.length === 1 ? conts[0] : "MULTI",
    continent: conts.length === 1 ? CONTINENTS[conts[0]] : MULTI_CONTINENT,
    source,
    codes,
  };
}

export function countryList() {
  return Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
