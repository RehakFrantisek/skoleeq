/* Robotí dílna: Záchrana sondy – obsah misí. Učitel může upravit texty a mapy bez zásahu do interpretu.
   Mapa = řádky znaků (legenda v engine.js), dir = počáteční směr robota (N/E/S/W).
   Cíle (goals): reach (dojet na G), face (dívat se na anténu A), collectAll (posbírat B/V),
   visitAll (projet všemi K), returnStart (vrátit se na start), deliver (položit baterie na D).
   requires: repeat / if / maxBlocks – co mise výslovně vyžaduje (musí být uvedeno i v zadání).
   reference: autorské řešení (zkratky: F vpřed, L vlevo, R vpravo, T vezmi, P polož,
   ['R', n, ...] opakuj, ['IF', podmínka, [pak], [jinak]] když). Testy ověří, že řešení projde
   na všech mapách – po úpravě spusť `npm run test:unit`. */
import { P } from './engine.js';

const BASIC = ['forward', 'left', 'right'];

export const CHAPTERS = {
  1: 'Kapitola 1 – Posloupnost',
  2: 'Kapitola 2 – Opakování',
  3: 'Kapitola 3 – Podmínky a ladění'
};

export const MISSIONS = [
  /* ================= Kapitola 1: Posloupnost ================= */
  {
    id: 'start-motoru', chapter: 1, title: 'Start motorů', grades: [6, 7],
    story: 'Servisní robot se právě probudil. Než začne opravovat sondu, musí zkontrolovat anténu.',
    task: 'Popojeď 3 políčka vpřed a natoč se k anténě.',
    blocks: BASIC,
    maps: [{ dir: 'E', rows: [
      '#######',
      '#...A.#',
      '#S....#',
      '#######'
    ] }],
    goals: [{ type: 'face' }],
    reference: P('F F F L'),
    hints: [
      'Program je posloupnost příkazů – robot je provede jeden po druhém, shora dolů.',
      'Anténa je nad políčkem, na které dojedeš po třech krocích. Robot se pak musí otočit k ní.',
      'Přidej 3× „Jdi vpřed“ a pak „Otoč vlevo“ (robot se dívá doprava, vlevo od něj je sever).'
    ]
  },
  {
    id: 'sber-baterie', chapter: 1, title: 'Sběr baterie', grades: [6, 7],
    story: 'Sonda potřebuje energii. Kousek od robota leží záložní baterie.',
    task: 'Dojeď k baterii a seber ji příkazem „Vezmi“.',
    blocks: [...BASIC, 'pick'],
    maps: [{ dir: 'E', rows: [
      '########',
      '#S.....#',
      '#....B.#',
      '########'
    ] }],
    goals: [{ type: 'collectAll', item: 'B' }],
    reference: P('F F F F R F T'),
    hints: [
      '„Vezmi“ funguje jen tehdy, když robot stojí přímo na baterii.',
      'Baterie je o řádek níž, ve sloupci 6. Robot musí dojet nad ni a pak dolů.',
      '4× „Jdi vpřed“, „Otoč vpravo“, „Jdi vpřed“, „Vezmi“.'
    ]
  },
  {
    id: 'pozor-stena', chapter: 1, title: 'Pozor, stěna!', grades: [6, 7],
    story: 'Cestu k cíli přehradil kus zdi. Robot ji musí objet – narazit nesmí.',
    task: 'Objeď zeď a dojeď na cíl.',
    blocks: BASIC,
    maps: [{ dir: 'E', rows: [
      '#########',
      '#.......#',
      '#S..#..G#',
      '#.......#',
      '#########'
    ] }],
    goals: [{ type: 'reach' }],
    reference: P('F F L F R F F R F L F F'),
    hints: [
      'Překážku obejdeš tak, že uhneš, projedeš kolem a vrátíš se zpátky do řádku.',
      'Zeď je ve sloupci 5. Uhni nahoru (nebo dolů) těsně před ní.',
      '2× vpřed, vlevo, vpřed, vpravo, 2× vpřed, vpravo, vpřed, vlevo, 2× vpřed.'
    ]
  },
  {
    id: 'nejkratsi-trasa', chapter: 1, title: 'Nejkratší servisní trasa', grades: [6, 7, 8],
    story: 'Baterie robota dochází. Do servisu se musí dostat co nejúsporněji.',
    task: 'Dojeď do cíle programem, který má nejvýš 9 příkazů. Cesty jsou dvě – vyber kteroukoli.',
    blocks: BASIC,
    requires: { maxBlocks: 9 },
    maps: [{ dir: 'E', rows: [
      '#######',
      '#S....#',
      '#.###.#',
      '#.###.#',
      '#....G#',
      '#######'
    ] }],
    goals: [{ type: 'reach' }],
    reference: P('F F F F R F F F'),
    alternatives: [P('R F F F L F F F F')],
    hints: [
      'Každý příkaz stojí energii. Nejkratší program nemá žádné zbytečné otočky.',
      'Můžeš jet nejdřív doprava a pak dolů, nebo nejdřív dolů a pak doprava.',
      '4× vpřed, vpravo, 3× vpřed (8 příkazů).'
    ]
  },

  /* ================= Kapitola 2: Opakování ================= */
  {
    id: 'dlouha-chodba', chapter: 2, title: 'Dlouhá chodba', grades: [6, 7],
    story: 'Na konci dlouhé chodby leží baterie. Psát pětkrát „Jdi vpřed“ je zbytečné.',
    task: 'Použij blok „Opakuj 5×“ a seber baterii. Program smí mít nejvýš 3 bloky.',
    blocks: [...BASIC, 'pick', 'repeat'],
    requires: { repeat: true, maxBlocks: 3 },
    maps: [{ dir: 'E', rows: [
      '########',
      '#S....B#',
      '########'
    ] }],
    goals: [{ type: 'collectAll', item: 'B' }],
    reference: P(['R', 5, 'F'], 'T'),
    hints: [
      'Cyklus opakuje příkazy uvnitř sebe. Co je uvnitř, provede se tolikrát, kolik je napsáno.',
      'Uvnitř opakování má být jen to, co se opakuje. „Vezmi“ patří až za cyklus.',
      'Přidej „Opakuj“, nastav 5, vlož do něj „Jdi vpřed“. Za cyklus dej „Vezmi“.'
    ]
  },
  {
    id: 'ctvercova-kontrola', chapter: 2, title: 'Čtvercová kontrola', grades: [6, 7, 8],
    story: 'Kolem skladu jsou čtyři kontrolní body. Robot musí objet celý čtverec a vrátit se.',
    task: 'Projeď všemi kontrolními body a vrať se na start natočený doprava. Použij Opakuj, program smí mít nejvýš 6 bloků.',
    blocks: [...BASIC, 'repeat'],
    requires: { repeat: true, maxBlocks: 6 },
    maps: [{ dir: 'E', rows: [
      '######',
      '#S..K#',
      '#.oo.#',
      '#.oo.#',
      '#K..K#',
      '######'
    ] }],
    goals: [{ type: 'visitAll' }, { type: 'returnStart', dir: true }],
    reference: P(['R', 4, 'F F F R']),
    hints: [
      'Čtverec má 4 stejné strany. Co robot dělá na jedné straně, opakuje 4×.',
      'Jedna strana = 3 kroky vpřed a otočení na rohu.',
      'Opakuj 4×: Jdi vpřed, Jdi vpřed, Jdi vpřed, Otoč vpravo.'
    ]
  },
  {
    id: 'sber-vzorku', chapter: 2, title: 'Sběr vzorků', grades: [6, 7],
    story: 'Vědci chtějí vzorky půdy. Leží pravidelně – na každém druhém políčku.',
    task: 'Seber všechny tři vzorky. Použij Opakuj.',
    blocks: [...BASIC, 'pick', 'repeat'],
    requires: { repeat: true },
    maps: [{ dir: 'E', rows: [
      '#########',
      '#S.V.V.V#',
      '#########'
    ] }],
    goals: [{ type: 'collectAll', item: 'V' }],
    reference: P(['R', 3, 'F F T']),
    hints: [
      'Najdi část programu, která se pravidelně opakuje.',
      'Mezi vzorky jsou vždy 2 kroky. Pak „Vezmi“.',
      'Opakuj 3×: Jdi vpřed, Jdi vpřed, Vezmi.'
    ]
  },
  {
    id: 'zkraceni-programu', chapter: 2, title: 'Zkrácení programu', grades: [6, 7, 8],
    story: 'Technik napsal program na schody. Funguje, ale je zbytečně dlouhý a robotova paměť je malá.',
    task: 'Program už robota do cíle dovede. Zkrať ho pomocí Opakuj na nejvýš 6 bloků.',
    blocks: [...BASIC, 'repeat'],
    requires: { repeat: true, maxBlocks: 6 },
    maps: [{ dir: 'E', rows: [
      '#######',
      '#S.####',
      '##..###',
      '###..##',
      '####..#',
      '#####G#',
      '#######'
    ] }],
    goals: [{ type: 'reach' }],
    initialProgram: P('F R F L F R F L F R F L F R F L'),
    reference: P(['R', 4, 'F R F L']),
    hints: [
      'Dlouhý program, ve kterém se opakuje stejná skupina příkazů, jde zkrátit cyklem.',
      'Skupina „vpřed, vpravo, vpřed, vlevo“ se opakuje čtyřikrát.',
      'Smaž program (nebo jeho části) a postav: Opakuj 4×: Jdi vpřed, Otoč vpravo, Jdi vpřed, Otoč vlevo.'
    ]
  },

  /* ================= Kapitola 3: Podmínky a ladění ================= */
  {
    id: 'dvere-a-senzor', chapter: 3, title: 'Dveře a senzor', grades: [7, 8, 9],
    story: 'Mezi robotem a cílem jsou dveře. Někdy jsou otevřené, jindy zavřené – předem to nevíš.',
    task: 'Jeden program musí fungovat pro otevřené i zavřené dveře. Použij blok „Když před tebou překážka“.',
    blocks: [...BASIC, 'if'],
    requires: { if: true },
    maps: [
      { name: 'Dveře otevřené', dir: 'E', rows: [
        '#######',
        '#S...G#',
        '#.....#',
        '#######'
      ] },
      { name: 'Dveře zavřené', dir: 'E', rows: [
        '#######',
        '#S.o.G#',
        '#.....#',
        '#######'
      ] }
    ],
    goals: [{ type: 'reach' }],
    reference: P('F', ['IF', 'wallAhead', ['R F L F F L F R'], ['F F']], 'F'),
    hints: [
      'Senzor se ptá za běhu: „Je přede mnou překážka?“ Podle odpovědi robot udělá jednu, nebo druhou větev.',
      'Rozhodnutí potřebuješ, až robot stojí těsně před dveřmi (po 1 kroku).',
      'Jdi vpřed. Když překážka: vpravo, vpřed, vlevo, 2× vpřed, vlevo, vpřed, vpravo. Jinak: 2× vpřed. Nakonec Jdi vpřed.'
    ]
  },
  {
    id: 'dve-cesty', chapter: 3, title: 'Dvě možné cesty', grades: [7, 8, 9],
    story: 'Chodby k sondě se po bouři změnily. Robot neví, kde přesně je zatáčka.',
    task: 'Napiš jeden program, který dojede do cíle na obou mapách. Použij Opakuj a v něm „Když před tebou překážka“.',
    blocks: [...BASIC, 'repeat', 'if'],
    requires: { repeat: true, if: true },
    maps: [
      { name: 'Zatáčka za 3 kroky', dir: 'E', rows: [
        '#######',
        '#S...##',
        '####.##',
        '####.##',
        '####G##',
        '#######'
      ] },
      { name: 'Zatáčka za 2 kroky', dir: 'E', rows: [
        '#######',
        '#S..###',
        '###.###',
        '###.###',
        '###.###',
        '###G###',
        '#######'
      ] }
    ],
    goals: [{ type: 'reach' }],
    reference: P(['R', 7, ['IF', 'wallAhead', ['R'], ['F']]]),
    hints: [
      'Obecný algoritmus nepočítá kroky do zatáčky – v každém kroku se podívá, jestli může jet dál.',
      'Na obou mapách je cesta dlouhá 7 akcí (pohyby + jedna otočka). Zatáčka je vždy doprava.',
      'Opakuj 7×: Když před tebou překážka → Otoč vpravo, jinak → Jdi vpřed.'
    ]
  },
  {
    id: 'oprav-program', chapter: 3, title: 'Oprav chybný program', grades: [7, 8, 9],
    story: 'Kolega napsal program na doručení baterie do sondy, ale robot se ztratil. Najdi chyby.',
    task: 'Program obsahuje dvě chyby. Krokuj ho, najdi, kde se robot chová jinak, a oprav ho.',
    blocks: [...BASIC, 'pick', 'drop', 'repeat'],
    maps: [{ dir: 'E', rows: [
      '#######',
      '#S..B.#',
      '#.....#',
      '#D....#',
      '#######'
    ] }],
    goals: [{ type: 'deliver', count: 1 }],
    initialProgram: P(['R', 4, 'F'], 'T R F F L', ['R', 3, 'F'], 'P'),
    reference: P(['R', 3, 'F'], 'T R F F R', ['R', 3, 'F'], 'P'),
    hints: [
      'Krokování ukazuje, co robot dělá po jednotlivých příkazech. Sleduj, kde se poprvé liší od plánu.',
      'První chyba je v počtu opakování (baterie je ve sloupci 5). Druhá je v jednom otočení.',
      'Změň „Opakuj 4×“ na 3× a druhé „Otoč vlevo“ na „Otoč vpravo“ (robot jede dolů a pak doleva).'
    ]
  },
  {
    id: 'zachrana-sondy', chapter: 3, title: 'Záchrana sondy', grades: [8, 9],
    story: 'Poslední mise: posbírej rozházené baterie a doruč je do sondy. Kde baterie leží, se mapa od mapy liší.',
    task: 'Jeden program pro obě mapy: projeď chodbou, seber baterie („Když stojíš na baterii“), dojeď do doku a polož 2 baterie. Použij Opakuj i Když.',
    blocks: [...BASIC, 'pick', 'drop', 'repeat', 'if'],
    requires: { repeat: true, if: true },
    maps: [
      { name: 'Bouře A', dir: 'E', rows: [
        '#########',
        '#S.B..B.#',
        '#######.#',
        '#D......#',
        '#########'
      ] },
      { name: 'Bouře B', dir: 'E', rows: [
        '#########',
        '#SB..B..#',
        '#######.#',
        '#D......#',
        '#########'
      ] }
    ],
    goals: [{ type: 'collectAll', item: 'B' }, { type: 'deliver', count: 2 }],
    reference: P(['R', 6, 'F', ['IF', 'onBattery', ['T'], []]], 'R F F R', ['R', 6, 'F'], ['R', 2, 'P']),
    hints: [
      'Když nevíš, kde baterie leží, ptej se na každém políčku: „Stojím na baterii?“',
      'Horní chodba má 6 kroků. Po každém kroku se zeptej a případně vezmi. Pak dolů a doleva do doku.',
      'Opakuj 6×: Jdi vpřed; Když stojíš na baterii → Vezmi. Pak vpravo, 2× vpřed, vpravo, Opakuj 6× vpřed, Opakuj 2× Polož.'
    ]
  }
];
