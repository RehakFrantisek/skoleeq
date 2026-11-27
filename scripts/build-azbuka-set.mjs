#!/usr/bin/env node
// Generátor vestavěné sady písmen „Písanka Školeeq“ pro Psací azbuku.
// Písmena jsou vlastní: každé je popsané několika body tahu pera (středová čára) na pomocných linkách
// bez sklonu, skript je vyhladí (Catmull–Rom → kubické Bézierovy křivky), nakloní a dopočítá
// body napojení, profily pro proklad a rozměry. Tvary a pravidla napojení vycházejí z ruských
// písanek a fontu Propisi (postup a pravidla jsou v soukromém repozitáři skoleeq-lab, PSACI_AZBUKA_UCENI.md), body jsou ale nakreslené ručně –
// nic se nekopíruje z fontu.
//
//   node scripts/build-azbuka-set.mjs   → public/vyklad/psaci-azbuka/sada-skoleeq.json
//
// Souřadnice v návrhu: střední výška = 1, účaří y = 0, nahoru záporné y (horní dotažnice −2,
// dolní +0,85). „|“ v seznamu bodů = ostrý bod (tah se obrací, např. vršek и).
//
// Napojení jako v Propisi: spojovací tah je součástí písmene. Malé písmeno začíná náběhem
// v bodě JL (výška 0,3) ve směru DL a dolní ocásek končí ve stejném bodě a směru – písmena
// se proto jen položí za sebe (sada má joins: 'touch'). о a ю končí nahoře (JH), в, ь, ъ
// uprostřed; za nimi má písmeno variantu after: 'high', která začíná shora.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SLANT = 0.36;   // sklon písma (posun x na jednotku výšky)
export const PEN = 0.075;    // šířka pera v jednotkách střední výšky
const GRID = [-2.2, 0.1, 37];
export const JL = -0.3;      // výška dolního napojení
export const DL = [0.1, -0.18]; // směr tahu v dolním napojení (náběh i ocásek)
export const JH = -0.95;     // výška horního napojení (о, ю)

// ---------- stavební kameny (malá písmena) ----------
const lead = (x) => [[x - 0.32, JL], [x - 0.22, JL - 0.18], [x - 0.1, -0.78], [x, -1], '|'];   // náběh z bodu napojení k vršku tahu
const tail = (x) => [[x, -1], [x, -0.5], [x + 0.02, -0.2], [x + 0.14, -0.01], [x + 0.3, -0.05], [x + 0.42, -0.15], [x + 0.5, JL]]; // tah dolů s kulatým dnem a ocásek do bodu napojení
const hookUp = (x, nx) => [[x, -1], [x, -0.5], [x + 0.02, -0.2], [x + 0.14, -0.01], [x + 0.3, -0.06], [(x + nx) / 2 + 0.12, -0.36], [nx - 0.06, -0.78], [nx, -1], '|']; // kulaté dno a šikmý tah k dalšímu vršku
const down = (x, to = 0) => [[x, -1], [x, -0.5], [x, to], '|'];
const arch = (x, nx) => [[x, -0.5], [x + 0.02, -0.82], [x + (nx - x) * 0.4, -1], [nx - 0.04, -0.9], [nx, -0.7]];   // oblouček nahoře (п, т, р)
const archTail = (x, nx) => [...arch(x, nx), [nx, -0.4], [nx + 0.005, -0.15], [nx + 0.1, 0], [nx + 0.26, -0.12], [nx + 0.36, JL]];
// Ovál proti směru hodinových ručiček od pravého horního okraje (а, о, д, б). Široký a kulatý jako v Propisi.
const ovalBody = (x0, w) => [[x0 + w * 0.9, -0.86], [x0 + w * 0.62, -1], [x0 + w * 0.25, -0.92], [x0, -0.5], [x0 + w * 0.2, -0.06], [x0 + w * 0.55, 0], [x0 + w * 0.88, -0.3]];
// Náběh do oválu jako v Propisi („ка“): samostatný krátký tah z bodu napojení, který se k oválu
// přimkne v jeho nejlevějším místě a pokračuje s ním v jedné čáře (nepřetíná ovál, nevede vedle něj).
// Shora (za о, в …) přijde vodorovně a přimkne se k vršku oválu.
const ovalConn = (x0) => [[x0 - 0.14, JL], [x0 - 0.04, -0.48], [x0, -0.6]];
const ovalConnHi = (x0, w) => [[x0 - 0.14, JH], [x0 + 0.04, -0.97], [x0 + w * 0.45, -1.0]];
const dropLoop = (x) => [[x, -1], [x - 0.02, -0.4], [x - 0.08, 0.4], [x - 0.22, 0.8], [x - 0.38, 0.84], [x - 0.42, 0.68], [x - 0.22, 0.36], [x + 0.06, 0.1], [x + 0.28, -0.12], [x + 0.38, JL]]; // dolní klička (д, у, з)
const smallLoop = (x) => [[x, -1], [x, -0.5], [x + 0.02, -0.16], [x + 0.12, 0.01], [x + 0.22, 0.06], [x + 0.22, 0.3], [x + 0.14, 0.42], [x + 0.1, 0.3], [x + 0.22, 0.1], [x + 0.38, -0.1], [x + 0.5, JL]]; // ocásek ц, щ
const bowl = (x) => [[x, -0.5], [x, -0.12], [x + 0.12, 0], [x + 0.32, -0.08], [x + 0.36, -0.3], [x + 0.22, -0.48], [x + 0.04, -0.42]]; // bříško ь, ъ, ы
const midExit = (x) => [[x - 0.12, -0.36], [x + 0.1, -0.38], [x + 0.32, -0.46], [x + 0.48, -0.55]];  // výstup ь, ъ uprostřed
// л, м, я: z bodu napojení malý oblouček dolů do háčku na účaří (jako „ам“, „яя“ v Propisi)
const hookArch = (x) => [[x, JL], [x + 0.06, -0.4], [x + 0.13, -0.4], [x + 0.17, -0.22], [x + 0.24, -0.03], [x + 0.34, -0.05]];
// л, м (Propisi): kulatý háček dolů na účaří a z něj šikmý tah nahoru k vršku
const hookRound = (x) => [[x, JL], [x + 0.07, -0.41], [x + 0.15, -0.4], [x + 0.2, -0.22], [x + 0.27, -0.05], [x + 0.38, 0], [x + 0.48, -0.08]];
// velká písmena: háček na účaří a háček nahoře
const capBase = (x) => [[x, -0.14], [x + 0.08, -0.01], [x + 0.2, -0.04]];
const capHook = (x) => [[x - 0.35, -1.7], [x - 0.15, -2], [x, -1.82]];
const capStemTail = (x) => [[x, -2], [x - 0.02, -1], [x + 0.005, -0.16], [x + 0.12, 0], [x + 0.3, -0.12], [x + 0.4, JL]];
const capStemLeft = (x) => [[x, -1.8], [x, -1], [x - 0.04, -0.16], [x - 0.15, 0], [x - 0.3, -0.08]];
// Propisi: vodorovný tah nahoře (Б, Г, П, Т, Р) začíná zatočením dolů vlevo
const capCurl = (x0) => [[x0 + 0.2, -1.3], [x0 + 0.03, -1.47], [x0 + 0.04, -1.78], [x0 + 0.32, -1.95]];
// dřík shora dolů s háčkem doleva na účaří (Г, П, Р)
const capFootLeft = (x) => [[x, -1.75], [x - 0.03, -1.0], [x - 0.1, -0.32], [x - 0.26, -0.04], [x - 0.44, -0.01], [x - 0.62, -0.12], [x - 0.7, -0.25]];
// výstupní tah ze spodku písmene do bodu napojení
const capExit = (x) => [[x, -0.01], [x + 0.26, -0.06], [x + 0.48, -0.18], [x + 0.6, JL]];

/** Nahradí prvních n bodů prvního tahu jinými (začátek písmene shora). */
const withStart = (strokes, n, pts) => [[...pts, ...strokes[0].slice(n)], ...strokes.slice(1)];

// Malá písmena: s = tvar se začátkem v dolním bodě napojení, out = konec (low / high / none),
// final = tvar na konci slova, hi = začátek shora (za о, в, ю, ь, ъ), low = о napojené zdola (před л, м).
const LOWER = {};
const def = (ch, spec) => { LOWER[ch] = spec; };

/** Písmeno s oválem: náběh (zdola, nebo shora) + zbytek tahů. */
const ovalLetter = (w, ...rest) => ({ s: [ovalConn(0), ...rest], hi: [ovalConnHi(0, w), ...rest] });
const A = ovalLetter(0.74, [...ovalBody(0, 0.74), [0.72, -0.7], [0.76, -1], '|', ...tail(0.76).slice(1)]);
def('а', { out: 'low', ...A });
// б: ovál, z něj nahoru vlajka; na další písmeno se napojuje zespodu oválu (jako v Propisi „бо“, „ба“)
const B = ovalLetter(0.6, [...ovalBody(0, 0.6), [0.6, -0.55], [0.58, -0.95], [0.62, -1.5], [0.76, -1.9], [0.98, -2.02], [1.2, -2]],
  [[0.2, -0.02], [0.33, 0], [0.5, -0.04], [0.62, -0.12], [0.72, JL]]);
def('б', { out: 'low', ...B });
const V = [[[0, JL], [0.1, -0.48], [0.24, -1.0], [0.36, -1.5], [0.46, -1.9], [0.42, -2.02], [0.32, -1.85], [0.3, -1.2], [0.28, -0.5], [0.29, -0.12], [0.42, 0], [0.64, -0.12], [0.72, -0.5], [0.62, -0.86], [0.44, -0.88], [0.42, -0.7], [0.56, -0.6], [0.74, -0.6], [0.88, -0.64]]];
const Vf = [[...V[0].slice(0, 14), [0.42, -0.84]]];
const V_HI = [[0, JH], [0.14, -0.985], [0.28, -1.2]];
def('в', { out: 'high', s: V, final: Vf, hi: withStart(V, 3, V_HI), hiFinal: withStart(Vf, 3, V_HI) });
const G = [[[0, JL], [0.1, -0.48], [0.2, -0.8], [0.32, -0.97], [0.48, -0.97], [0.56, -0.78], [0.53, -0.4], [0.53, -0.14], [0.63, 0], [0.78, -0.12], [0.88, JL]]];
def('г', { out: 'low', s: G, hi: withStart(G, 3, [[0.04, JH], [0.18, -0.975]]) });
def('д', { out: 'low', ...ovalLetter(0.72, [...ovalBody(0, 0.72), [0.7, -0.7], [0.74, -1], '|', ...dropLoop(0.74).slice(1)]) });
const E = [[[0, JL], [0.1, -0.48], [0.3, -0.62], [0.44, -0.78], [0.4, -0.96], [0.22, -0.96], [0.06, -0.64], [0.05, -0.24], [0.2, 0], [0.44, -0.04], [0.56, -0.12], [0.66, JL]]];
// е shora jen za в, ь, ъ (weak): za о se е napojuje zdola („ое“)
def('е', { out: 'low', s: E, hi: withStart(E, 2, [[0.06, -0.56], [0.2, -0.6]]), weak: true });
const ZH = [[[0, JL], [0.08, -0.48], [0.15, -0.8], [0.26, -0.98], [0.38, -0.88], [0.43, -0.55], [0.35, -0.14], [0.19, 0], [0.08, -0.1]],
  [[0.54, -1], [0.54, -0.5], [0.54, 0]],
  [[1.02, -0.82], [0.92, -0.99], [0.76, -0.9], [0.66, -0.55], [0.71, -0.14], [0.88, 0], [1.04, -0.12], [1.14, JL]]];
def('ж', { out: 'low', s: ZH, hi: withStart(ZH, 3, [[0.04, JH], [0.16, -0.98]]) });
// з: horní oblouk přes celou střední výšku, „zub“ (spojení obou částí) těsně nad řádkem, dolní klička pod řádkem
const Z = [[[0, JL], [0.1, -0.48], [0.2, -0.8], [0.36, -0.98], [0.52, -0.94], [0.6, -0.72], [0.5, -0.4], [0.3, -0.1], '|', [0.48, 0.06], [0.56, 0.34], [0.46, 0.68], [0.28, 0.84], [0.12, 0.74], [0.2, 0.5], [0.46, 0.22], [0.74, 0.02], [0.88, -0.12], [0.98, JL]]];
def('з', { out: 'low', s: Z, hi: withStart(Z, 3, [[0.06, JH], [0.22, -0.99]]) });
def('и', { out: 'low', s: [[...lead(0.3), ...hookUp(0.3, 0.82), ...tail(0.82).slice(1)]] });
// к (Propisi): dřík; rameno jedním tahem – háček vpravo nahoře, oblouk k dříku a hned nožička do ocásku
def('к', { out: 'low', s: [[...lead(0.3), ...down(0.3)], [[0.72, -0.86], [0.68, -0.98], [0.58, -0.94], [0.52, -0.76], [0.36, -0.5], '|', [0.5, -0.38], [0.58, -0.12], [0.7, 0], [0.88, -0.12], [0.98, JL]]] });
def('л', { out: 'low', s: [[...hookRound(0), [0.6, -0.35], [0.74, -0.78], [0.84, -1], '|', ...tail(0.84).slice(1)]] });
def('м', { out: 'low', s: [[...hookRound(0), [0.6, -0.35], [0.74, -0.78], [0.84, -1], '|', ...hookUp(0.84, 1.36), ...tail(1.36).slice(1)]] });
def('н', { out: 'low', s: [[...lead(0.3), ...down(0.3), [0.3, -0.48], [0.5, -0.52], [0.66, -0.6], [0.74, -0.82], [0.76, -1], '|', ...tail(0.76).slice(1)]] });
const O = ovalLetter(0.7, [...ovalBody(0, 0.7), [0.7, -0.62], [0.7, -0.86], [0.8, -0.94], [0.95, JH]]);
const Of = ovalLetter(0.7, [...ovalBody(0, 0.7), [0.7, -0.62], [0.66, -0.9], [0.54, -0.98]]);
// о před л, м, е: napojení zdola – ovál začne i skončí dole, ocásek vychází ze spodku stejnou čarou
const Olow = ovalLetter(0.7, [[0.42, 0], [0.63, -0.1], [0.72, -0.5], [0.64, -0.88], [0.46, -1], [0.17, -0.9], [0.02, -0.5], [0.14, -0.08], [0.42, 0], [0.63, -0.1], [0.8, -0.12], [0.9, JL]]);
def('о', { out: 'high', s: O.s, final: Of.s, low: Olow.s, hi: O.hi, hiFinal: Of.hi, hiLow: Olow.hi });
def('п', { out: 'low', s: [[...lead(0.3), ...down(0.3), ...archTail(0.3, 0.74)]] });
def('р', { out: 'low', s: [[...lead(0.3), ...down(0.3, 0.85), [0.3, 0.2], ...archTail(0.3, 0.74)]] });
const S = [[0.5, -0.78], [0.52, -0.94], [0.38, -1], [0.16, -0.9], [0.03, -0.52], [0.1, -0.12], [0.3, 0], [0.52, -0.12], [0.62, JL]];
def('с', { out: 'low', s: [ovalConn(0.03), S], hi: [[[-0.12, JH], [0.04, -0.97], [0.26, -1.0]], S] });
def('т', { out: 'low', s: [[...lead(0.3), ...down(0.3), ...arch(0.3, 0.62), [0.62, -0.4], [0.62, 0], '|', ...archTail(0.62, 0.96)]] });
def('у', { out: 'low', s: [[...lead(0.3), ...hookUp(0.3, 0.82), ...dropLoop(0.82).slice(1)]] });
// ф (Propisi): dva kulaté ovály, které se dříku dotknou jen uprostřed (nevedou podél něj), výstup ze spodku pravého oválu
const F = [ovalConn(0.06), [...ovalBody(0.06, 0.5), [0.56, -0.58], [0.54, -0.8], [0.47, -0.92]], [[0.66, -1.05], [0.64, -0.3], [0.6, 0.85]],
  [[0.7, -0.86], [0.86, -1.0], [1.08, -0.92], [1.17, -0.58], [1.08, -0.18], [0.88, 0], [0.74, -0.08]], [[0.9, 0], [1.1, -0.07], [1.24, -0.18], [1.32, JL]]];
def('ф', { out: 'low', s: F, hi: [[[-0.12, JH], [0.04, -0.97], [0.2, -1.0]], ...F.slice(1)] });
const H = [[[0, JL], [0.1, -0.48], [0.2, -0.82], [0.3, -0.98], [0.38, -0.88], [0.44, -0.55], [0.5, -0.16], [0.66, 0], [0.84, -0.12], [0.94, JL]],
  [[0.9, -0.84], [0.8, -1], [0.64, -0.9], [0.52, -0.5], [0.42, -0.12], [0.26, 0], [0.1, -0.08]]];
def('х', { out: 'low', s: H, hi: withStart(H, 3, [[0.06, JH], [0.2, -0.98]]) });
def('ц', { out: 'low', s: [[...lead(0.3), ...hookUp(0.3, 0.82), ...smallLoop(0.82).slice(1)]] });
def('ч', { out: 'low', s: [[...lead(0.28), [0.27, -0.6], [0.4, -0.46], [0.6, -0.52], [0.68, -0.76], [0.72, -1], '|', ...tail(0.72).slice(1)]] });
def('ш', { out: 'low', s: [[...lead(0.3), ...hookUp(0.3, 0.82), ...hookUp(0.82, 1.34), ...tail(1.34).slice(1)]] });
def('щ', { out: 'low', s: [[...lead(0.3), ...hookUp(0.3, 0.82), ...hookUp(0.82, 1.34), ...smallLoop(1.34).slice(1)]] });
const HARD = [[0, JL], [0.1, -0.48], [0.18, -0.84], [0.26, -0.98], [0.36, -1], '|', [0.36, -0.5], ...bowl(0.36).slice(1)];
const HARD_HI = [[0.08, JH], [0.22, -0.98]];
def('ъ', { out: 'high', s: [[...HARD, ...midExit(0.36)]], final: [HARD], hi: [[...HARD_HI, ...HARD.slice(3), ...midExit(0.36)]], hiFinal: [[...HARD_HI, ...HARD.slice(3)]] });
def('ы', { out: 'low', s: [[...lead(0.3), [0.3, -0.5], ...bowl(0.3).slice(1), [0.5, -0.6], [0.7, -0.86], [0.82, -1], '|', ...tail(0.82).slice(1)]] });
const SOFT = [...lead(0.3), [0.3, -0.5], ...bowl(0.3).slice(1)];
def('ь', { out: 'high', s: [[...SOFT, ...midExit(0.3)]], final: [SOFT] });
// э (Propisi): náběh strmě nahoru k vršku, dole jen krátký háček – začátek a konec nejsou vedle sebe
const EE = [[[0, JL], [0.1, -0.5], [0.24, -0.82], [0.45, -0.99], [0.68, -0.9], [0.8, -0.55], [0.72, -0.18], [0.54, -0.01], [0.38, -0.04], [0.3, -0.16]], [[0.42, -0.52], [0.6, -0.52], [0.78, -0.52]]];
def('э', { out: 'none', s: EE, hi: withStart(EE, 3, [[0.12, JH], [0.28, -0.99]]) });
const YU = [...lead(0.3), ...down(0.3), [0.3, -0.5], [0.46, -0.52], [0.6, -0.56], '|', [0.66, -0.88], [0.84, -1], [1.02, -0.86], [1.06, -0.45], [0.94, -0.06], [0.78, 0], [0.64, -0.2], [0.64, -0.56], [0.76, -0.9]];
def('ю', { out: 'high', s: [[...YU, [0.92, -0.955], [1.07, -0.965]]], final: [[...YU, [0.86, -0.98]]] });
// я (vzor „Галя“ v Propisi): z háčku rovný šikmý tah až k dříku, odtud velké kulaté bříško
// doleva, nahoru a přes vršek zpět k dříku, dřík dolů do ocásku (bříško se dříkem uzavře)
const YA = [[...hookArch(0), [0.48, -0.26], [0.62, -0.42], [0.7, -0.47], '|', [0.5, -0.44], [0.28, -0.5], [0.15, -0.72], [0.25, -0.95], [0.48, -1.0], [0.64, -0.98], [0.7, -1], '|', ...tail(0.7).slice(1)]];
def('я', { out: 'low', s: YA, hi: withStart(YA, 4, [[-0.08, JH], [0.06, -0.93], [0.15, -0.66], [0.17, -0.22]]), weak: true });

const UPPER = {
  А: { out: 'low', s: [[...capBase(0), [0.4, -0.4], [0.8, -1.3], [1.06, -2], '|', ...capStemTail(1.06).slice(1)], [[0.5, -0.8], [0.8, -0.86], [1.12, -0.86]]] },
  Б: { out: 'low', s: [[...capCurl(0.12), [0.7, -1.96], [1.1, -1.95], [1.55, -1.96]], [[0.75, -1.72], [0.73, -1.2], [0.69, -0.6], [0.64, -0.15], [0.55, 0], [0.42, -0.1], [0.44, -0.42], [0.6, -0.75], [0.8, -0.95], [1.02, -1.0], [1.24, -0.88], [1.36, -0.55], [1.26, -0.18], [1.02, 0], [0.8, -0.08]], capExit(0.98)] },
  В: { out: 'low', s: [[[0.64, -1.95], [0.56, -1.5], [0.44, -0.85], [0.37, -0.32], [0.42, -0.03], [0.53, -0.06], [0.6, -0.45], [0.62, -1.2], [0.65, -1.82], [0.78, -1.97], [0.98, -1.92], [1.08, -1.65], [0.98, -1.3], [0.78, -1.08], '|', [1.05, -1.02], [1.3, -0.78], [1.34, -0.42], [1.18, -0.1], [0.94, 0], [0.74, -0.1]], capExit(0.92)] },
  Г: { out: 'low', s: [[...capCurl(0.12), [0.7, -1.97], [1.5, -1.98]], capFootLeft(0.8), capExit(0.4)] },
  Д: { out: 'low', s: [[[0.82, -1.72], [0.8, -1.0], [0.75, -0.35], [0.63, -0.07], [0.42, -0.01], [0.2, -0.08], [0.12, -0.2], [0.28, -0.3], [0.58, -0.2], [0.84, -0.05], [1.06, -0.01], [1.32, -0.3], [1.43, -0.85], [1.36, -1.45], [1.12, -1.86], [0.82, -1.97], [0.5, -1.9], [0.26, -1.68], [0.2, -1.45], [0.3, -1.3]], capExit(1.0)] },
  Е: { out: 'low', s: [[[0.96, -1.76], [0.82, -2], [0.52, -1.9], [0.42, -1.55], [0.62, -1.12], '|', [0.3, -0.92], [0.12, -0.46], [0.32, 0], [0.7, 0], [0.96, -0.14], [1.1, -0.3]]] },
  Ж: {
    out: 'low',
    s: [[[0.06, -1.7], [0.26, -2], [0.54, -1.8], [0.7, -1.0], [0.56, -0.2], [0.32, 0], [0.12, -0.14]], [[0.88, -2], [0.88, -1], [0.88, 0]],
      [[1.7, -1.7], [1.52, -2], [1.22, -1.8], [1.06, -1.0], [1.18, -0.2], [1.42, 0], [1.64, -0.12], [1.76, -0.3]]]
  },
  З: { out: 'none', s: [[[0.16, -1.7], [0.42, -2], [0.86, -1.94], [1.0, -1.56], [0.66, -1.12], '|', [1.04, -0.86], [1.06, -0.3], [0.72, 0], [0.32, -0.04], [0.12, -0.3]]] },
  И: { out: 'low', s: [[...capHook(0.48), [0.48, -0.8], [0.5, -0.16], [0.64, 0], [0.88, -0.2], [1.08, -1.0], [1.22, -2], '|', ...capStemTail(1.22).slice(1)]] },
  К: { out: 'low', s: [[...capHook(0.48), ...capStemLeft(0.48).slice(1)], [[1.36, -1.9], [1.2, -2], [1.0, -1.72], [0.76, -1.16], [0.5, -1.0], '|', [0.78, -0.9], [0.96, -0.4], [1.1, 0], [1.3, -0.1], [1.42, -0.3]]] },
  Л: { out: 'low', s: [[...capBase(0), [0.44, -0.4], [0.76, -1.1], [1.04, -1.9], [1.16, -2], '|', ...capStemTail(1.16).slice(1)]] },
  М: { out: 'low', s: [[...capBase(0), [0.4, -0.4], [0.66, -1.1], [0.92, -2], '|', [0.96, -1.0], [1.0, 0], '|', [1.18, -1.0], [1.46, -2], '|', ...capStemTail(1.46).slice(1)]] },
  Н: { out: 'low', s: [[[0.28, -1.68], [0.55, -1.82], [0.8, -1.92], '|', [0.78, -1.2], [0.7, -0.45], [0.56, -0.06], [0.38, 0], [0.24, -0.14], [0.32, -0.38], [0.6, -0.74], [1.0, -1.08], [1.34, -1.44], [1.52, -1.8], [1.46, -1.98], [1.34, -1.82], [1.3, -1.2], [1.27, -0.5], [1.29, -0.1], [1.42, 0], [1.62, -0.14], [1.74, JL]]] },
  О: { out: 'low', s: [[[0.9, -0.08], [1.12, -0.5], [1.22, -1.3], [1.02, -1.85], [0.7, -1.96], [0.36, -1.72], [0.18, -1.0], [0.28, -0.25], [0.62, 0], [0.92, -0.05], [1.14, -0.13], [1.3, JL]]] },
  П: { out: 'low', s: [[...capCurl(0.35), [0.7, -1.97], [1.3, -1.98], [2.05, -1.99]], capFootLeft(0.95), [[1.55, -1.75], [1.52, -1.0], [1.5, -0.2], [1.6, -0.01], [1.82, -0.08], [1.98, -0.18], [2.08, JL]]] },
  Р: { out: 'low', s: [[...capCurl(0.22), [0.7, -1.97], [1.2, -1.95], [1.55, -1.78], [1.65, -1.5], [1.52, -1.28], [1.35, -1.2]], capFootLeft(0.95), capExit(0.55)] },
  С: { out: 'low', s: [[[1.0, -1.62], [1.06, -1.9], [0.82, -2], [0.36, -1.76], [0.1, -1.0], [0.24, -0.16], [0.6, 0], [0.96, -0.14], [1.1, -0.34]]] },
  Т: { out: 'low', s: [[...capCurl(0.35), [0.7, -1.97], [1.6, -1.98], [2.6, -1.99]], capFootLeft(0.95), [[1.52, -1.75], [1.5, -1.0], [1.48, 0]], [[2.1, -1.75], [2.07, -1.0], [2.05, -0.2], [2.15, -0.01], [2.37, -0.08], [2.53, -0.18], [2.63, JL]]] },
  У: { out: 'none', s: [[...capHook(0.48), [0.48, -1.2], [0.58, -0.96], [0.84, -0.96], [1.08, -1.3], [1.22, -2], '|', [1.18, -1.0], [1.06, -0.26], [0.8, 0], [0.46, 0], [0.26, -0.2]]] },
  Ф: { out: 'low', s: [[[1.0, -1.42], [0.7, -1.2], [0.36, -1.34], [0.3, -1.74], [0.58, -2.0], [0.96, -1.9]], [[1.06, -2.1], [0.98, -1.2], [0.9, -0.3], [0.92, -0.04], [1.08, 0], [1.24, -0.12], [1.34, JL]], [[1.02, -1.84], [1.3, -2.05], [1.66, -1.9], [1.66, -1.46], [1.36, -1.2], [1.02, -1.26]]] },
  Х: {
    out: 'low',
    s: [[[1.42, -1.8], [1.26, -2], [1.0, -1.8], [0.76, -1.0], [0.56, -0.2], [0.32, 0], [0.12, -0.14]],
      [[0.1, -1.7], [0.3, -2], [0.56, -1.8], [0.76, -1.0], [0.96, -0.2], [1.2, 0], [1.42, -0.12], [1.54, -0.3]]]
  },
  Ц: { out: 'low', s: [[...capHook(0.48), [0.48, -0.8], [0.5, -0.16], [0.64, 0], [0.88, -0.2], [1.08, -1.0], [1.22, -2], '|', ...smallLoop(1.22).map(p => (p === '|' ? p : [p[0], p[1] < -0.9 ? -2 : p[1]])).slice(1)]] },
  Ч: { out: 'low', s: [[...capHook(0.48), [0.48, -1.26], [0.66, -0.96], [1.0, -1.0], [1.14, -1.4], [1.24, -2], '|', ...capStemTail(1.24).slice(1)]] },
  Ш: { out: 'low', s: [[...capHook(0.48), [0.48, -0.8], [0.5, -0.16], [0.62, 0], [0.8, -0.2], [0.92, -1.0], [1.0, -2], '|', [1.0, -1.0], [1.02, -0.16], [1.14, 0], [1.32, -0.2], [1.44, -1.0], [1.52, -2], '|', ...capStemTail(1.52).slice(1)]] },
  Щ: { out: 'low', s: [[...capHook(0.48), [0.48, -0.8], [0.5, -0.16], [0.62, 0], [0.8, -0.2], [0.92, -1.0], [1.0, -2], '|', [1.0, -1.0], [1.02, -0.16], [1.14, 0], [1.32, -0.2], [1.44, -1.0], [1.52, -2], '|', [1.52, -1.0], ...smallLoop(1.52).slice(2)]] },
  Э: { out: 'none', s: [[[0.16, -1.7], [0.42, -2], [0.86, -1.9], [1.16, -1.2], [1.0, -0.3], [0.6, 0], [0.26, -0.1], [0.1, -0.36]], [[0.5, -1.0], [0.8, -1.0], [1.12, -1.0]]] },
  Ю: { out: 'none', s: [[...capHook(0.48), ...capStemLeft(0.48).slice(1)], [[0.48, -1.0], [0.62, -1.0], [0.78, -1.0]], [[1.32, -1.86], [1.06, -2], [0.8, -1.6], [0.76, -0.6], [0.96, 0], [1.3, -0.14], [1.5, -1.0], [1.42, -1.8], [1.16, -1.96]]] },
  Я: { out: 'low', s: [[...capBase(0), [0.5, -0.4], [1.0, -0.84], [1.24, -0.96], '|', [0.9, -0.92], [0.5, -1.02], [0.28, -1.44], [0.46, -1.88], [0.86, -2.02], [1.18, -1.98], [1.3, -2], '|', ...capStemTail(1.3).slice(1)]] }
};

// ---------- geometrie ----------

/** Body (s „|“) → kubické Bézierovy segmenty [p0, c1, c2, p1] (Catmull–Rom, ostré body se nevyhlazují). */
export function smooth(points) {
  const chains = [[]];
  for (const p of points) {
    if (p === '|') { const last = chains.at(-1).at(-1); if (last) chains.push([last]); continue; }
    const c = chains.at(-1);
    const prev = c.at(-1);
    if (!prev || Math.hypot(prev[0] - p[0], prev[1] - p[1]) > 1e-6) c.push(p);
  }
  // Centripetální Catmull–Rom (alfa 0,5): na nestejně vzdálených bodech nedělá vlnky ani smyčky,
  // oblouky jsou pravidelné. Na koncích (zrcadlený bod) vede tečna přímo k dalšímu bodu – napojení se nemění.
  const segs = [];
  const d = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-6;
  for (const c of chains) {
    if (c.length < 2) continue;
    for (let i = 0; i < c.length - 1; i++) {
      const p0 = c[i - 1] || [2 * c[0][0] - c[1][0], 2 * c[0][1] - c[1][1]];
      const p1 = c[i], p2 = c[i + 1];
      const p3 = c[i + 2] || [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
      const d1 = d(p0, p1), d2 = d(p1, p2), d3 = d(p2, p3);
      const c1 = [0, 1].map(k => (d1 * d1 * p2[k] - d2 * d2 * p0[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) / (3 * d1 * (d1 + d2)));
      const c2 = [0, 1].map(k => (d3 * d3 * p1[k] - d2 * d2 * p3[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) / (3 * d3 * (d3 + d2)));
      segs.push([p1, c1, c2, p2]);
    }
  }
  return segs;
}

const shear = ([x, y]) => [x - SLANT * y, y];
const bez = (s, t) => {
  const u = 1 - t;
  return [0, 1].map(k => u * u * u * s[0][k] + 3 * u * u * t * s[1][k] + 3 * u * t * t * s[2][k] + t * t * t * s[3][k]);
};
const r3 = v => Math.round(v * 1000) / 1000;
const unit = ([x, y]) => { const n = Math.hypot(x, y) || 1; return [r3(x / n), r3(y / n)]; };
const pts = st => st.filter(p => p !== '|');

/** Tah s výstupním tahem: ten, který končí nejvíc vpravo; u dolního výstupu jen z tahů končících dole (ne příčka П). */
const exitIndex = (strokes, out) => {
  const endX = i => { const p = pts(strokes[i]).at(-1); return p[0] - SLANT * p[1]; };
  const low = out === 'low' ? strokes.map((_, i) => i).filter(i => pts(strokes[i]).at(-1)[1] > -0.7) : [];
  const cand = low.length ? low : strokes.map((_, i) => i);
  return cand.reduce((best, i) => (endX(i) > endX(best) ? i : best), cand[0]);
};

/** Dolní ocásek vždy končí v bodě napojení JL ve směru DL – navazuje na náběh dalšího písmene. */
function normalizeExit(strokes, out) {
  if (out !== 'low') return strokes;
  const i = exitIndex(strokes, out);
  const st = [...strokes[i]];
  const n = st.length - 1;
  const end = [st[n][0], JL];
  st[n] = end;
  st[n - 1] = [end[0] - DL[0], end[1] - DL[1]];
  return strokes.map((s, k) => (k === i ? st : s));
}

/** Jedna varianta písmene ve formátu sady. */
export function buildVariant(strokes, { inType, out }) {
  strokes = normalizeExit(strokes, out);
  const ei = exitIndex(strokes, out);
  let segStrokes = strokes.map(st => smooth(st).map(seg => seg.map(shear)));
  const samples = segStrokes.flat().flatMap(s => Array.from({ length: 25 }, (_, i) => bez(s, i / 24)));
  const minX = Math.min(...samples.map(p => p[0])) - PEN / 2;
  segStrokes = segStrokes.map(st => st.map(seg => seg.map(([x, y]) => [x - minX, y])));
  const P = samples.map(([x, y]) => [x - minX, y]);
  const firstSeg = segStrokes[0][0], lastSeg = segStrokes[ei].at(-1);
  const entry = firstSeg[0], exit = lastSeg[3];
  const maxX = Math.max(...P.map(p => p[0])) + PEN / 2;
  const L = [], R = [];
  for (let i = 0; i < GRID[2]; i++) {
    const y = GRID[0] + i * GRID[1];
    const row = P.filter(p => Math.abs(p[1] - y) <= GRID[1] / 2 + PEN / 2);
    L.push(row.length ? r3(Math.min(...row.map(p => p[0])) - PEN / 2) : null);
    R.push(row.length ? r3(Math.max(...row.map(p => p[0])) + PEN / 2) : null);
  }
  return {
    w: r3(out === 'none' ? maxX : exit[0]),
    top: r3(Math.min(...P.map(p => p[1])) - PEN / 2),
    bottom: r3(Math.max(...P.map(p => p[1])) + PEN / 2),
    in: inType, out,
    entry: entry.map(r3), exit: exit.map(r3),
    entryDir: unit([firstSeg[1][0] - entry[0], firstSeg[1][1] - entry[1]]),
    exitDir: unit([exit[0] - lastSeg[2][0], exit[1] - lastSeg[2][1]]),
    L, R,
    paths: [],
    strokes: segStrokes.map(st => {
      const a = [Math.round(st[0][0][0] * 1000), Math.round(st[0][0][1] * 1000)];
      for (const s of st) for (const p of s.slice(1)) a.push(Math.round(p[0] * 1000), Math.round(p[1] * 1000));
      return a;
    })
  };
}

/** Začátek shora pro písmena s náběhem lead(x): místo náběhu zdola krátký tah u vršku (jako „ок“, „от“ v písance). */
export function autoHigh(strokes) {
  const st = strokes?.[0];
  if (!st || st[4] !== '|' || st[3][1] !== -1 || Math.abs(st[0][1] - JL) > 1e-9 || Math.abs(st[3][0] - st[0][0] - 0.32) > 1e-9) return null;
  const x = st[3][0];
  return withStart(strokes, 4, [[x - 0.28, JH], [x - 0.13, -0.975], [x, -1]]);
}

export function buildSet() {
  const glyphs = {};
  for (const [ch, spec] of Object.entries(LOWER)) {
    const base = [[spec.s, spec.out], [spec.final, 'none'], [spec.low, 'low']].filter(([s]) => s);
    const high = [[spec.hi || autoHigh(spec.s), spec.out], [spec.hiFinal || autoHigh(spec.final), 'none'], [spec.hiLow, 'low']].filter(([s]) => s);
    glyphs[ch] = [
      ...base.map(([s, out]) => buildVariant(s, { inType: 'low', out })),
      ...high.map(([s, out]) => ({ ...buildVariant(s, { inType: 'high', out }), after: 'high', ...(spec.weak ? { weak: true } : {}) }))
    ];
  }
  for (const [ch, spec] of Object.entries(UPPER)) glyphs[ch] = [buildVariant(spec.s, { inType: 'none', out: spec.out })];
  return { format: 'psaci-azbuka-glyphs', version: 3, name: 'Písanka Školeeq', unit: 'střední výška', pen: PEN, slant: SLANT, grid: GRID, joins: 'touch', glyphs };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = new URL('../public/vyklad/psaci-azbuka/sada-skoleeq.json', import.meta.url);
  const set = buildSet();
  writeFileSync(out, JSON.stringify(set) + '\n');
  console.log(`Sada uložena: ${Object.keys(set.glyphs).length} písmen → ${fileURLToPath(out)}`);
}
