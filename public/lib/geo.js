// public/lib/geo.js
//
// Từ điển quốc gia -> châu lục, dùng để trích xuất Quốc gia / Châu lục từ TIÊU ĐỀ video.
// Tiêu đề của các tuyến đề chủ yếu là tiếng Tây Ban Nha, nên alias chính là tên tiếng TBN
// (đã bỏ dấu, viết thường), kèm tên tiếng Anh và vài thành phố/vùng nổi tiếng chỉ thuộc 1 nước.
//
// Định dạng mỗi dòng:  MÃ | Tên hiển thị (tiếng Anh) | Châu lục | alias1; alias2; ...
// Châu lục: AS Châu Á, EU Châu Âu, AF Châu Phi, AMR Châu Mỹ (Bắc + Trung + Nam Mỹ + Caribe),
//           OC Châu Đại Dương, AN Châu Nam Cực.
//
// Muốn thêm/sửa: chỉ cần thêm 1 dòng hoặc thêm alias (viết thường, KHÔNG dấu).
// Tránh thêm alias là từ thông dụng trong tiếng TBN (vd "lima" = quả chanh, "la paz" = hoà bình,
// "lagos" = những cái hồ, "granada", "roma"...) vì sẽ nhận diện nhầm.

export const CONTINENTS = {
  AS: "Châu Á",
  EU: "Châu Âu",
  AF: "Châu Phi",
  AMR: "Châu Mỹ",
  OC: "Châu Đại Dương",
  AN: "Châu Nam Cực",
};

const RAW = `
AF|Afghanistan|AS|afganistan;afghanistan;kabul;afeganistao
AM|Armenia|EU|armenia;erevan
AZ|Azerbaijan|EU|azerbaiyan;azerbaijan;baku
BH|Bahrain|AS|bahrein;barein;bahrain
BD|Bangladesh|AS|bangladesh;banglades;dhaka;daca
BT|Bhutan|AS|butan;bhutan;butao;bhoutan
BN|Brunei|AS|brunei
KH|Cambodia|AS|camboya;cambodia;phnom penh;angkor;camboja;cambodge
CN|China|AS|china;pekin;beijing;shanghai;shangai;shenzhen;chine;baishizhou
HK|Hong Kong|AS|hong kong;kowloon
MO|Macau|AS|macao;macau
TW|Taiwan|AS|taiwan;taipei
XT|Tibet|AS|tibet;lhasa;tibete
GE|Georgia|EU|georgia;tiflis;tbilisi
IN|India|AS|india;mumbai;bombay;nueva delhi;delhi;calcuta;kolkata;varanasi;benares;rajastan;rajasthan;new delhi;inde
ID|Indonesia|AS|indonesia;yakarta;jakarta;bali;sumatra;java;indonesie
IR|Iran|AS|iran;teheran;tehran;persia;ira;ormuz;hormuz
IQ|Iraq|AS|irak;iraq;bagdad;baghdad;iraque
IL|Israel|AS|israel;jerusalen;jerusalem;tel aviv
PS|Palestine|AS|palestina;palestine;gaza;cisjordania
JP|Japan|AS|japon;japan;tokio;tokyo;osaka;kioto;kyoto;japao
JO|Jordan|AS|jordania;jordan;amman
KZ|Kazakhstan|AS|kazajistan;kazajstan;kazakhstan;cazaquistao
KG|Kyrgyzstan|AS|kirguistan;kirguizistan;kyrgyzstan
LA|Laos|AS|laos;vientian;vientiane
LB|Lebanon|AS|libano;lebanon;beirut
MY|Malaysia|AS|malasia;malaysia;kuala lumpur;malaisie
MV|Maldives|AS|maldivas;maldives
MN|Mongolia|AS|mongolia;ulan bator;ulaanbaatar;mongolie
MM|Myanmar|AS|myanmar;birmania;burma;rangun;yangon;birmanie
NP|Nepal|AS|nepal;katmandu;kathmandu
KP|North Korea|AS|corea del norte;north korea;pyongyang;norcorea;coreia do norte;coree du nord
KR|South Korea|AS|corea del sur;south korea;seoul;corea;korea;coreia do sul;coree du sud;coreia;coree
OM|Oman|AS|oman;mascate
PK|Pakistan|AS|pakistan;karachi;lahore;islamabad;paquistao
PH|Philippines|AS|filipinas;philippines;manila
QA|Qatar|AS|qatar;catar;doha
SA|Saudi Arabia|AS|arabia saudita;arabia saudi;saudi arabia;riad;riyadh;la meca;meca;mecca;arabie saoudite
SG|Singapore|AS|singapur;singapore;singapura;singapour
LK|Sri Lanka|AS|sri lanka;ceilan
SY|Syria|AS|siria;syria;damasco;syrie
TJ|Tajikistan|AS|tayikistan;tajikistan
TH|Thailand|AS|tailandia;thailand;bangkok;phuket;chiang mai;pattaya;thailande
TL|Timor-Leste|AS|timor oriental;east timor;timor leste
TR|Turkey|AS|turquia;turkey;turkiye;estambul;istanbul;capadocia;turquie
TM|Turkmenistan|AS|turkmenistan;asjabad
AE|United Arab Emirates|AS|emiratos arabes unidos;emiratos arabes;emiratos;uae;dubai;abu dabi;abu dhabi;emirados;emirats
UZ|Uzbekistan|AS|uzbekistan;samarcanda;samarkand;uzbequistao
VN|Vietnam|AS|vietnam;viet nam;hanoi;saigon;ho chi minh;vietna
YE|Yemen|AS|yemen
AL|Albania|EU|albania;tirana
AD|Andorra|EU|andorra
AT|Austria|EU|austria;viena;vienna;autriche
BY|Belarus|EU|bielorrusia;belarus;minsk;bielorrussia
BE|Belgium|EU|belgica;belgium;bruselas;brussels;belgique
BA|Bosnia and Herzegovina|EU|bosnia;sarajevo
BG|Bulgaria|EU|bulgaria;bulgarie
HR|Croatia|EU|croacia;croatia;croatie
CY|Cyprus|EU|chipre;cyprus
CZ|Czech Republic|EU|chequia;republica checa;czech;praga;prague
DK|Denmark|EU|dinamarca;denmark;copenhague;copenhagen;danemark
EE|Estonia|EU|estonia
FI|Finland|EU|finlandia;finland;laponia;lapland;finlande
FR|France|EU|francia;france;paris;marsella;franca
DE|Germany|EU|alemania;germany;berlin;munich;alemanha;allemagne
GR|Greece|EU|grecia;greece;atenas;athens;grece
HU|Hungary|EU|hungria;hungary;budapest;hongrie
IS|Iceland|EU|islandia;iceland;reikiavik;islande
IE|Ireland|EU|irlanda;ireland;dublin;irlande
IT|Italy|EU|italia;italy;venecia;venice;napoles;sicilia;milan;italie
XK|Kosovo|EU|kosovo
LV|Latvia|EU|letonia;latvia
LI|Liechtenstein|EU|liechtenstein
LT|Lithuania|EU|lituania;lithuania
LU|Luxembourg|EU|luxemburgo;luxembourg
MT|Malta|EU|malta
MD|Moldova|EU|moldavia;moldova;transnistria
MC|Monaco|EU|monaco;montecarlo
ME|Montenegro|EU|montenegro
NL|Netherlands|EU|paises bajos;holanda;netherlands;holland;amsterdam;pays bas
MK|North Macedonia|EU|macedonia del norte;macedonia
NO|Norway|EU|noruega;norway;oslo;norvege
PL|Poland|EU|polonia;poland;varsovia;warsaw;pologne
PT|Portugal|EU|portugal;lisboa;lisbon;oporto
RO|Romania|EU|rumania;romania;transilvania;bucarest;romenia;roumanie
RU|Russia|EU|rusia;russia;moscu;moscow;siberia;yakutia;yakutsk;san petersburgo;chechenia;russie
SM|San Marino|EU|san marino
RS|Serbia|EU|serbia;belgrado;servia;serbie
SK|Slovakia|EU|eslovaquia;slovakia
SI|Slovenia|EU|eslovenia;slovenia
ES|Spain|EU|espana;spain;madrid;barcelona;canarias;espanha;espagne
SE|Sweden|EU|suecia;sweden;estocolmo;stockholm;suede
CH|Switzerland|EU|suiza;switzerland;suica;suisse
UA|Ukraine|EU|ucrania;ukraine;kiev;kyiv;chernobyl
GB|United Kingdom|EU|reino unido;united kingdom;inglaterra;england;escocia;scotland;londres;london;angleterre;ecosse
VA|Vatican City|EU|vaticano;vatican
FO|Faroe Islands|EU|islas feroe;feroe;faroe
DZ|Algeria|AF|argelia;algeria;algerie
AO|Angola|AF|angola;luanda
BJ|Benin|AF|benin
BW|Botswana|AF|botsuana;botswana
BF|Burkina Faso|AF|burkina faso
BI|Burundi|AF|burundi
CV|Cape Verde|AF|cabo verde;cape verde
CM|Cameroon|AF|camerun;cameroon
CF|Central African Republic|AF|republica centroafricana;central african republic;centroafrica
TD|Chad|AF|chad
KM|Comoros|AF|comoras;comoros
CD|DR Congo|AF|republica democratica del congo;congo democratico;rd congo;rdc;democratic republic of the congo;dr congo;kinshasa
CG|Republic of the Congo|AF|republica del congo;congo;brazzaville
CI|Ivory Coast|AF|costa de marfil;ivory coast
DJ|Djibouti|AF|yibuti;djibouti
EG|Egypt|AF|egipto;egypt;el cairo;cairo;egito;egypte
GQ|Equatorial Guinea|AF|guinea ecuatorial;equatorial guinea
ER|Eritrea|AF|eritrea
SZ|Eswatini|AF|esuatini;eswatini;suazilandia;swaziland
ET|Ethiopia|AF|etiopia;ethiopia;adis abeba;addis ababa;ethiopie
GA|Gabon|AF|gabon
GM|Gambia|AF|gambia
GH|Ghana|AF|ghana;accra
GN|Guinea|AF|guinea;conakry
GW|Guinea-Bissau|AF|guinea bisau;guinea bissau
KE|Kenya|AF|kenia;kenya;nairobi;kibera;quenia;migingo
LS|Lesotho|AF|lesoto;lesotho
LR|Liberia|AF|liberia;monrovia
LY|Libya|AF|libia;libya;tripoli;libye
MG|Madagascar|AF|madagascar
MW|Malawi|AF|malaui;malawi
ML|Mali|AF|mali;tombuctu;timbuktu
MR|Mauritania|AF|mauritania
MU|Mauritius|AF|mauricio;mauritius
MA|Morocco|AF|marruecos;morocco;marrakech;marrakesh;marrocos;maroc
MZ|Mozambique|AF|mozambique;mocambique
NA|Namibia|AF|namibia;namibie
NE|Niger|AF|niger
NG|Nigeria|AF|nigeria
RW|Rwanda|AF|ruanda;rwanda
ST|Sao Tome and Principe|AF|santo tome;sao tome
SN|Senegal|AF|senegal;dakar
SC|Seychelles|AF|seychelles
SL|Sierra Leone|AF|sierra leona;sierra leone
SO|Somalia|AF|somalia;mogadiscio;mogadishu;somalie
ZA|South Africa|AF|sudafrica;south africa;johannesburgo;johannesburg;ciudad del cabo;africa do sul;afrique du sud
SS|South Sudan|AF|sudan del sur;south sudan
SD|Sudan|AF|sudan;jartum;sudao;soudan
TZ|Tanzania|AF|tanzania;zanzibar;serengeti;tanzanie
TG|Togo|AF|togo
TN|Tunisia|AF|tunez;tunisia;tunisie
UG|Uganda|AF|uganda;kampala;ouganda
ZM|Zambia|AF|zambia
ZW|Zimbabwe|AF|zimbabue;zimbabwe
US|United States|AMR|estados unidos;eeuu;ee uu;united states;nueva york;new york;los angeles;california;texas;florida;alaska;hawai;hawaii;las vegas;chicago;eua;etats unis
CA|Canada|AMR|canada;toronto;vancouver
MX|Mexico|AMR|mexico;ciudad de mexico;cdmx;cancun;oaxaca;chiapas;yucatan;tijuana;guadalajara;mexique
GT|Guatemala|AMR|guatemala
BZ|Belize|AMR|belice;belize
SV|El Salvador|AMR|el salvador
HN|Honduras|AMR|honduras;tegucigalpa
NI|Nicaragua|AMR|nicaragua;managua
CR|Costa Rica|AMR|costa rica
PA|Panama|AMR|panama
CU|Cuba|AMR|cuba;la habana;habana;havana
DO|Dominican Republic|AMR|republica dominicana;dominican republic;santo domingo;punta cana;republique dominicaine
HT|Haiti|AMR|haiti;puerto principe
JM|Jamaica|AMR|jamaica;jamaique
PR|Puerto Rico|AMR|puerto rico;porto rico
BS|Bahamas|AMR|bahamas
BB|Barbados|AMR|barbados
TT|Trinidad and Tobago|AMR|trinidad y tobago;trinidad and tobago
DM|Dominica|AMR|dominica
GL|Greenland|AMR|groenlandia;greenland;groenland
AR|Argentina|AMR|argentina;buenos aires;patagonia;argentine
BO|Bolivia|AMR|bolivia;uyuni;santa cruz de la sierra;bolivie
BR|Brazil|AMR|brasil;brazil;rio de janeiro;sao paulo;bresil;manaus
CL|Chile|AMR|chile;santiago de chile;chili
CO|Colombia|AMR|colombia;bogota;medellin;colombie
EC|Ecuador|AMR|ecuador;quito;galapagos;guayaquil;equador;equateur
GY|Guyana|AMR|guyana;guiana
PY|Paraguay|AMR|paraguay;paraguai
PE|Peru|AMR|peru;cusco;cuzco;machu picchu;perou
SR|Suriname|AMR|surinam;suriname
UY|Uruguay|AMR|uruguay;montevideo;uruguai
VE|Venezuela|AMR|venezuela;caracas;maracaibo
GF|French Guiana|AMR|guayana francesa;french guiana;guiana francesa;guyane
AU|Australia|OC|australia;sidney;sydney;melbourne;australie
NZ|New Zealand|OC|nueva zelanda;new zealand;nova zelandia;nouvelle zelande
PG|Papua New Guinea|OC|papua nueva guinea;papua new guinea;papua;nueva guinea;new guinea;nova guine;papua nova guine;papouasie
FJ|Fiji|OC|fiyi;fiji
SB|Solomon Islands|OC|islas salomon;solomon islands
VU|Vanuatu|OC|vanuatu
WS|Samoa|OC|samoa
TO|Tonga|OC|tonga
KI|Kiribati|OC|kiribati
TV|Tuvalu|OC|tuvalu
NR|Nauru|OC|nauru
FM|Micronesia|OC|micronesia
MH|Marshall Islands|OC|islas marshall;marshall islands
PW|Palau|OC|palau
AQ|Antarctica|AN|antartida;antarctica;antartico
CW|Curaçao|AMR|curazao;curacao
BM|Bermuda|AMR|bermuda;bermudas
TA|Tristan da Cunha|AF|tristan da cunha;tristan
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
RU|janti;khanty;nganasanes;kamchatka
BR|amazonas
BR|piraha;amazonia;amazonie
KP|kim jong un
NG|hombres hiena
US|grandes llanuras;amish
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
  const list = new Set(aliases.split(";").map((a) => a.trim()));
  list.add(normalize(name)); // tên hiển thị tiếng Anh cũng là 1 alias ("Dominican Republic", "Ivory Coast"...)
  for (const a of list) ALIASES.push({ alias: a, code, tier: 0 });
}
// Tên tiếng Việt - chỉ dùng khi đọc cột "Quốc gia" trong file (không dùng để quét tiêu đề).
const VI_NAMES = "AF:Afghanistan;AM:Armenia;AZ:Azerbaijan;BH:Bahrain;BD:Bangladesh;BT:Bhutan;BN:Brunei;KH:Campuchia;CN:Trung Quốc;HK:Hồng Kông;MO:Ma Cao;TW:Đài Loan;XT:Tây Tạng;GE:Gruzia;IN:Ấn Độ;ID:Indonesia;IR:Iran;IQ:Iraq;IL:Israel;PS:Palestine;JP:Nhật Bản;JO:Jordan;KZ:Kazakhstan;KG:Kyrgyzstan;LA:Lào;LB:Liban;MY:Malaysia;MV:Maldives;MN:Mông Cổ;MM:Myanmar;NP:Nepal;KP:Triều Tiên;KR:Hàn Quốc;OM:Oman;PK:Pakistan;PH:Philippines;QA:Qatar;SA:Ả Rập Xê Út;SG:Singapore;LK:Sri Lanka;SY:Syria;TJ:Tajikistan;TH:Thái Lan;TL:Đông Timor;TR:Thổ Nhĩ Kỳ;TM:Turkmenistan;AE:UAE;UZ:Uzbekistan;VN:Việt Nam;YE:Yemen;AL:Albania;AD:Andorra;AT:Áo;BY:Belarus;BE:Bỉ;BA:Bosnia;BG:Bulgaria;HR:Croatia;CY:Síp;CZ:Séc;DK:Đan Mạch;EE:Estonia;FI:Phần Lan;FR:Pháp;DE:Đức;GR:Hy Lạp;HU:Hungary;IS:Iceland;IE:Ireland;IT:Ý;XK:Kosovo;LV:Latvia;LI:Liechtenstein;LT:Lithuania;LU:Luxembourg;MT:Malta;MD:Moldova;MC:Monaco;ME:Montenegro;NL:Hà Lan;MK:Bắc Macedonia;NO:Na Uy;PL:Ba Lan;PT:Bồ Đào Nha;RO:Romania;RU:Nga;SM:San Marino;RS:Serbia;SK:Slovakia;SI:Slovenia;ES:Tây Ban Nha;SE:Thụy Điển;CH:Thụy Sĩ;UA:Ukraina;GB:Anh;VA:Vatican;FO:Quần đảo Faroe;DZ:Algeria;AO:Angola;BJ:Benin;BW:Botswana;BF:Burkina Faso;BI:Burundi;CV:Cabo Verde;CM:Cameroon;CF:CH Trung Phi;TD:Chad;KM:Comoros;CD:CHDC Congo;CG:Congo;CI:Bờ Biển Ngà;DJ:Djibouti;EG:Ai Cập;GQ:Guinea Xích Đạo;ER:Eritrea;SZ:Eswatini;ET:Ethiopia;GA:Gabon;GM:Gambia;GH:Ghana;GN:Guinea;GW:Guinea-Bissau;KE:Kenya;LS:Lesotho;LR:Liberia;LY:Libya;MG:Madagascar;MW:Malawi;ML:Mali;MR:Mauritania;MU:Mauritius;MA:Ma-rốc;MZ:Mozambique;NA:Namibia;NE:Niger;NG:Nigeria;RW:Rwanda;ST:São Tomé và Príncipe;SN:Senegal;SC:Seychelles;SL:Sierra Leone;SO:Somalia;ZA:Nam Phi;SS:Nam Sudan;SD:Sudan;TZ:Tanzania;TG:Togo;TN:Tunisia;UG:Uganda;ZM:Zambia;ZW:Zimbabwe;US:Mỹ;CA:Canada;MX:Mexico;GT:Guatemala;BZ:Belize;SV:El Salvador;HN:Honduras;NI:Nicaragua;CR:Costa Rica;PA:Panama;CU:Cuba;DO:CH Dominica;HT:Haiti;JM:Jamaica;PR:Puerto Rico;BS:Bahamas;BB:Barbados;TT:Trinidad và Tobago;DM:Dominica;GL:Greenland;AR:Argentina;BO:Bolivia;BR:Brazil;CL:Chile;CO:Colombia;EC:Ecuador;GY:Guyana;PY:Paraguay;PE:Peru;SR:Suriname;UY:Uruguay;VE:Venezuela;GF:Guyane thuộc Pháp;AU:Australia;NZ:New Zealand;PG:Papua New Guinea;FJ:Fiji;SB:Quần đảo Solomon;VU:Vanuatu;WS:Samoa;TO:Tonga;KI:Kiribati;TV:Tuvalu;NR:Nauru;FM:Micronesia;MH:Quần đảo Marshall;PW:Palau;AQ:Nam Cực";
for (const pair of VI_NAMES.split(";")) {
  const [code, name] = pair.split(":");
  ALIASES.push({ alias: normalize(name), code, tier: 3 });
}
// Viết tắt hay gặp trong cột "Quốc gia" tự gõ tay.
for (const [alias, code] of [["dominican rep", "DO"], ["dr", "DO"], ["uk", "GB"], ["u s", "US"], ["u s a", "US"], ["drc", "CD"], ["png", "PG"], ["czechia", "CZ"]]) {
  ALIASES.push({ alias, code, tier: 3 });
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

// Alias tầng 3 (tên tiếng Việt, viết tắt "uk", "dr"...) chỉ dùng cho ô "Quốc gia", không quét tiêu đề.
const ALIAS_RE = ALIASES.filter((a) => a.tier < 3).map((a) => ({
  ...a,
  re: new RegExp(`(?<![a-z0-9])${a.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "g"),
}));

// Mỹ Latinh: dùng cho Tuyến 2. Gồm các nước nói TBN/BĐN ở châu Mỹ + Haiti, Puerto Rico,
// và Belize (theo đúng ví dụ của bạn, dù Belize nói tiếng Anh).
export const LATAM = new Set([
  "MX", "GT", "BZ", "SV", "HN", "NI", "CR", "PA", "CU", "DO", "HT", "PR",
  "AR", "BO", "BR", "CL", "CO", "EC", "PY", "PE", "UY", "VE",
  // Không nói TBN/BĐN nhưng nằm ở Nam Mỹ / Caribe và có dạng tiêu đề giống ví dụ Belize ở Tuyến 2
  // ("el único país de Sudamérica que habla inglés/holandés").
  "GY", "SR", "GF", "CW",
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
function countryHits(text) {
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
      hits.push({ code: a.code, pos: s, end: e, tier: a.tier });
    }
  }
  const flags = flagCodes(text);
  if (!hits.length && !flags.length) return { norm, hits: [] };
  // Tầng ưu tiên: nếu có tên nước (tier 0) thì bỏ qua bộ tộc/demonym.
  const bestTier = hits.length ? Math.min(...hits.map((h) => h.tier)) : 0;
  const ordered = hits.filter((h) => h.tier === bestTier).sort((a, b) => a.pos - b.pos);
  for (const code of flags) if (!ordered.some((h) => h.code === code)) ordered.push({ code, pos: Infinity, end: Infinity, tier: 0, flag: true });
  return { norm, hits: ordered };
}

// Trả về danh sách mã nước tìm thấy trong 1 đoạn text, theo thứ tự xuất hiện, không trùng.
export function findCountries(text) {
  return [...new Set(countryHits(text).hits.map((h) => h.code))];
}

// Tiêu đề nhắc nhiều nước: chỉ coi là "Multiple countries" khi các nước được nối trực tiếp với nhau
// ("Venezuela y Nicaragua", "Tayikistán e Irán", "India vs Pakistán", "Haití y RD") hoặc có ≥ 2 cờ.
// Còn lại nước nhắc ĐẦU TIÊN là chủ đề: "COREA DEL NORTE ... donde hasta EE.UU. se siente inquieto",
// "OMÁN, La Suiza Del Mundo Árabe", "Costa Rica: salarios más altos que en México".
const JOINER = /^\s*(?:y|e|and|vs|versus|et|ou|o|frente a|contra)\s+(?:la |el |los |las )?$/;
function subjectCodes(norm, hits) {
  const codes = [...new Set(hits.map((h) => h.code))];
  if (codes.length < 2) return codes;
  const flagCount = hits.filter((h) => h.flag).length;
  const named = hits.filter((h) => !h.flag);
  for (let i = 1; i < named.length; i++) {
    if (named[i].code === named[i - 1].code) continue;
    if (JOINER.test(norm.slice(named[i - 1].end, named[i].pos))) return codes;
  }
  if (flagCount >= 2) return codes;
  return [named.length ? named[0].code : codes[0]];
}

export const MULTI_COUNTRY = { code: "MULTI", name: "Multiple countries" };
export const UNKNOWN_COUNTRY = { code: "UNK", name: "Unknown" };
// Tiêu đề nói về nhiều nơi nhưng không nêu tên nước nào ("Los 10 países más seguros",
// "Lugares insanos de la Tierra"): tách riêng khỏi "Unknown" để biết đây là video dạng tổng hợp.
export const WORLDWIDE_COUNTRY = { code: "WW", name: "Worldwide" };
export const WORLDWIDE_CONTINENT = "Toàn cầu";
const WORLDWIDE_RE = /\b(?:paises|lugares|islas|ciudades|naciones|tribus|pueblos|destinos|regiones|cidades|tribos|ilhas|pays|lieux|places|countries|islands|tribes)\b|\b\d{1,3} (?:mejores|peores|mas)\b/;
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
    const { norm, hits } = countryHits(text);
    if (!hits.length) continue;
    const codes = source === "title" ? subjectCodes(norm, hits) : [...new Set(hits.map((h) => h.code))];
    // Ngoài tiêu đề, mô tả/tag hay liệt kê nhiều nước (link video khác...) -> chỉ nhận khi có đúng 1 nước.
    if (source !== "title" && codes.length > 1) continue;
    return geoFromCodes(codes, source);
  }
  if (WORLDWIDE_RE.test(normalize(title))) {
    return {
      countryCode: WORLDWIDE_COUNTRY.code,
      country: WORLDWIDE_COUNTRY.name,
      continentCode: "WW",
      continent: WORLDWIDE_CONTINENT,
      source: "title",
      codes: [],
    };
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

// ---------- Châu lục theo nội dung ----------
// Các nước nằm vắt ngang 2 châu lục được xếp theo cách khán giả nhìn nhận chứ không theo địa lý
// thuần tuý: Georgia, Armenia, Azerbaijan, Síp -> Châu Âu; Kazakhstan -> Châu Á; Nga -> Châu Âu;
// Thổ Nhĩ Kỳ -> Châu Á (đã đặt sẵn ở bảng RAW phía trên).
// Với chính các nước này, tiêu đề có thể "kéo" sang châu khác:
//   ortodoxo / cristiano / europeo / eslavo      -> Châu Âu
//   musulmán / islámico / árabe / asiático ...    -> Châu Á
// Có cả 2 loại từ khoá (hoặc không có) thì giữ mặc định.
const TRANSCONTINENTAL = new Set(["GE", "AM", "AZ", "CY", "TR", "RU", "KZ"]);
// "Europa"/"Asia" chỉ tính khi đi với "de/en/del este/central" ("el país más pobre de Europa"),
// không tính khi so sánh ("un país más grande que Europa").
const EUROPE_CUES = /\b(?:ortodox\w*|cristian\w*|christian\w*|crista[os]?|chretien\w*|europe(?:o|a|os|as|u|us|en|enne|an)|eslav\w*|slav\w*|(?:de|en|da|na|of|in) europa|europa del este|europe de l est|eastern europe)\b/;
const ASIA_CUES = /\b(?:musulman\w*|muculman\w*|muslim\w*|islam\w*|arabe?s?|asiatic\w*|asiatique\w*|(?:de|en|da|na|of|in) asia|asia central|central asia|oriente medio|medio oriente|middle east|moyen orient)\b/;

export function contentContinent(geo, title) {
  if (!geo || !TRANSCONTINENTAL.has(geo.countryCode)) return geo;
  const t = normalize(title);
  const eu = EUROPE_CUES.test(t);
  const as = ASIA_CUES.test(t);
  if (eu === as) return geo;
  const code = eu ? "EU" : "AS";
  if (code === geo.continentCode) return geo;
  return { ...geo, continentCode: code, continent: CONTINENTS[code], continentByTitle: true };
}

// Đọc giá trị ô "Quốc gia" trong file (vd "Russia", "Dominican Rep", "Nga") -> mã nước.
// Không nhận ra -> null (giao diện giữ nguyên chữ trong ô làm tên nước).
export function countryFromCell(text) {
  const n = normalize(text);
  if (!n) return null;
  // Khớp nguyên ô trước (để "dr" / "uk" chỉ được nhận khi ô chỉ có đúng chữ đó).
  const exact = ALIASES.find((a) => a.alias === n);
  if (exact) return exact.code;
  const codes = findCountries(text);
  return codes.length === 1 ? codes[0] : null;
}

export function countryList() {
  return Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name, "en"));
}
