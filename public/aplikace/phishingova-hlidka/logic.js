/* Phishingová hlídka – čistá logika hry (bez DOM).
   Obsah úloh (e-maily, SMS, chaty, příspěvky, hesla), generátor misí ze seedu varianty A/B/C,
   vyhodnocení s věcným „proč“, řešení a odhad síly hesla.
   Stejný soubor importují unit testy (node --test) i E2E testy – žádný přístup k window/document.

   Všechny adresy, firmy, hry a sociální sítě jsou VYMYŠLENÉ. Domény končí na .test
   (rezervovaná doména, která na internetu nikdy nebude existovat). Žádná skutečná jména ani čísla. */

/* ================= Seedovatelná náhoda ================= */
export const VARIANTS = { A: 4101, B: 5202, C: 6303 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, next) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ================= Verdikty a dovednosti ================= */
export const VERDICTS = {
  bezpecne: { label: 'Bezpečné', desc: 'Zpráva je v pořádku, můžu s ní normálně pracovat.' },
  podvod: { label: 'Podvod', desc: 'Jasné stopy podvodu. Na nic nekliknu, nic nepošlu, nahlásím to.' },
  overit: { label: 'Ověřit jinou cestou', desc: 'Může to být pravda, ale chce to něco neobvyklého. Ověřím si to jinak – telefonem nebo osobně.' },
  zverejnit: { label: 'Zveřejnit takhle', desc: 'Příspěvek o mně neprozrazuje nic, co by mohl někdo zneužít.' },
  upravit: { label: 'Nejdřív upravit', desc: 'Něco z příspěvku bych měl(a) smazat nebo omezit, než ho pošlu.' }
};
const MAIL_VERDICTS = ['bezpecne', 'podvod', 'overit'];
const POST_VERDICTS = ['zverejnit', 'upravit'];
/** Verdikty, které znamenají „v pořádku“ – každá úroveň s více zprávami má aspoň jednu takovou. */
const CALM = new Set(['bezpecne', 'zverejnit', 'overit']);

export const SKILLS = {
  odesilatel: 'Ověřím odesílatele podle domény za zavináčem',
  odkaz: 'Než kliknu, zjistím, kam odkaz opravdu vede',
  priloha: 'Poznám nebezpečnou přílohu (.exe a dvojitá přípona)',
  natlak: 'Poznám nátlak, strašení a „výhru“, která je návnadou',
  udaje: 'Heslo, kód z SMS a číslo karty nikomu nesděluji',
  overeni: 'Neobvyklou žádost ověřím jinou cestou',
  heslo: 'Vytvořím silné heslo a chráním účet druhým krokem',
  sdileni: 'Rozmyslím si, co o sobě zveřejním'
};

export const LEVEL_INFO = [
  { name: 'Podezřelé e-maily', icon: '✉️', focus: 'Kdo zprávu doopravdy poslal? Kam vede odkaz? Co je to za přílohu? Hledej stopy v adrese, textu i přílohách.' },
  { name: 'SMS a chaty', icon: '💬', focus: 'Podvodníci píšou i do mobilu a do herního chatu. Často se vydávají za kamaráda, rodinu nebo podporu hry.' },
  { name: 'Hesla a přihlášení', icon: '🔑', focus: 'Silné heslo je hlavně dlouhé. Vytvoř si heslo, které útočník neuhodne, a zjisti, k čemu je druhý krok přihlášení.' },
  { name: 'Co o sobě sdílím', icon: '📣', focus: 'Než něco zveřejníš, rozmysli si, kdo to uvidí a co se z toho o tobě dozví. Najdi, co by do příspěvku nemělo.' }
];

/* ================= Pomocníci pro zápis obsahu ================= */
const FINE = 'Tahle část sama o sobě nic podezřelého neobsahuje.';
const bad = (id, text, why) => ({ id, text, clue: why });
const ok = (id, text, why = FINE) => ({ id, text, ok: why });
/** Odkaz: text, který vidíš, a adresa, kam opravdu vede (zobrazí se po najetí / fokusu). */
const link = (id, text, href, why, isClue = true) => ({ id, text, href, ...(isClue ? { clue: why } : { ok: why }) });

const SCHOOL = 'zs-lipova.test';
const HINT_DOMAIN = 'Podívej se na adresu odesílatele: co je za zavináčem @? Škola používá jen @' + SCHOOL + '.';
const HINT_LINK = 'Najeď myší na odkaz (nebo na něj přejdi klávesou Tab). Dole se ukáže, kam opravdu vede. Rozhoduje konec adresy před prvním lomítkem.';

/* ================= Ukázka ================= */
const TUTORIAL = {
  id: 'ukazka', type: 'inspect', level: -1, skill: 'udaje',
  title: 'Ředitel potřebuje dárkové karty?',
  prompt: 'Klikni na části zprávy, které jsou podezřelé – označí se vlaječkou. Pak vyber verdikt a stiskni Zkontrolovat.',
  verdicts: MAIL_VERDICTS, accept: ['podvod'], need: 2,
  msg: {
    kind: 'email', time: 'Dnes 7:42',
    from: bad('from', 'Ředitel školy <reditel.lipova@posta-zdarma.test>', 'Ředitel by psal ze školní adresy @' + SCHOOL + ', ne z bezplatné schránky, kterou si může založit kdokoli.'),
    subject: ok('subject', 'Rychlá prosba', 'Předmět je krátký a obyčejný. Stopy jsou jinde.'),
    body: [
      [ok('b1', 'Ahoj,')],
      [ok('b2', 'jsem zrovna na poradě a nemůžu telefonovat.', 'Sama o sobě nevinná věta. Podvodníci ji ale používají, abys nemohl(a) zavolat a ověřit si to.'),
        bad('b3', 'Potřebuji, abys rychle koupil(a) tři dárkové karty do herního obchodu a poslal(a) mi jejich kódy.', 'Kódy z dárkových karet jsou jako hotové peníze. Nikdo ze školy po žácích nic takového nechce.'),
        bad('b4', 'Nikomu to neříkej, je to překvapení pro učitele.', 'Prosba o tajnost má zabránit, aby ses někoho zeptal(a). To je silná stopa podvodu.')],
      [ok('b5', 'Díky, ředitel')]
    ]
  },
  verdictWhy: {
    podvod: 'Cizí adresa, žádost o kódy z dárkových karet a prosba o tajnost – učebnicový podvod.',
    bezpecne: 'Zpráva po tobě chce kódy z dárkových karet a ještě to máš tajit. To v pořádku není.',
    overit: 'Ověřit je dobrý nápad, ale tady je stop tolik, že jde jasně o podvod. Nekupuj nic a ukaž zprávu dospělému.'
  },
  hints: [HINT_DOMAIN, 'Co po tobě zpráva chce? A proč to máš držet v tajnosti?'],
  lesson: 'Ve hře jsou všechny adresy smyšlené a končí na .test. Ve skutečnosti si stejně pečlivě čti, co je za zavináčem.'
};

/* ================= Úroveň 1: e-maily ================= */
const L1 = [
  {
    id: 'e-plna-schranka', type: 'inspect', skill: 'odkaz',
    title: 'Vaše schránka je plná',
    prompt: 'Do školní pošty přišlo upozornění od „IT podpory“. Označ všechny podezřelé části a rozhodni.',
    verdicts: MAIL_VERDICTS, accept: ['podvod'], need: 3,
    msg: {
      kind: 'email', time: 'Dnes 6:58',
      from: bad('from', 'Školní IT podpora <it-podpora@zs-lipova-schranka.test>', 'Škola posílá poštu z adres končících @' + SCHOOL + '. Tady je za „zs-lipova“ ještě „-schranka“ – to je úplně jiná doména, kterou si mohl založit kdokoli.'),
      subject: ok('subject', 'Upozornění: limit schránky', 'Podobný předmět může mít i skutečné upozornění. Rozhodují další stopy.'),
      body: [
        [bad('b1', 'Vážený uživateli,', 'Škola tě zná jménem. Neosobní oslovení je typické pro podvody rozesílané tisícům lidí najednou.')],
        [bad('b2', 'Vaše schránka překročila limit a do 24 hodin bude smazána i se všemi zprávami.', 'Strašení a krátký termín mají zabránit, abys v klidu přemýšlel(a).'),
          ok('b3', 'Pro zachování dat se přihlaste zde:'),
          link('b4', 'https://' + SCHOOL + '/posta', 'http://' + SCHOOL + '.overeni-uctu.test/prihlaseni', 'Text odkazu ukazuje školní adresu, ale odkaz vede na doménu overeni-uctu.test. Vždy čti konec adresy před prvním lomítkem.')],
        [bad('b5', 'Na stránce zadejte své uživatelské jméno a heslo.', 'Žádný správce po tobě heslo nikdy nechce – ani e-mailem, ani přes odkaz.')],
        [ok('b6', 'Děkujeme za pochopení, tým IT')]
      ]
    },
    verdictWhy: {
      podvod: 'Falešná doména, strašení, odkaz na cizí stránku a žádost o heslo. Takový e-mail nahlas a smaž.',
      bezpecne: 'Odkaz vede jinam, než tvrdí, a zpráva chce tvoje heslo. To bezpečné není.',
      overit: 'Pochybnost je správná, ale stop je tu tolik, že jde jasně o podvod. Na odkaz neklikej a zprávu nahlas.'
    },
    hints: [HINT_DOMAIN, HINT_LINK, 'Co po tobě stránka za odkazem chce zadat?']
  },
  {
    id: 'e-skola-v-prirode', type: 'inspect', skill: 'odesilatel',
    title: 'Program školy v přírodě',
    prompt: 'Třídní učitelka poslala informace ke škole v přírodě, na kterou se chystáte. Je všechno v pořádku?',
    verdicts: MAIL_VERDICTS, accept: ['bezpecne'], need: 0,
    msg: {
      kind: 'email', time: 'Včera 15:20',
      from: ok('from', 'Třídní učitelka 7.B <tridni.7b@' + SCHOOL + '>', 'Adresa končí správnou školní doménou @' + SCHOOL + '.'),
      subject: ok('subject', 'Škola v přírodě – program a seznam věcí'),
      body: [
        [ok('b1', 'Dobrý den, milá 7.B,')],
        [ok('b2', 'v příloze posílám program školy v přírodě a seznam věcí s sebou.'),
          ok('b3', 'Vše najdete i na školním webu:'),
          link('b4', SCHOOL + '/skola-v-prirode', 'https://' + SCHOOL + '/skola-v-prirode', 'Text odkazu i skutečná adresa vedou na školní web.', false)],
        [ok('b5', 'Nic nevyplňujte, jen si seznam projděte s rodiči.', 'Zpráva po tobě nechce žádné údaje ani platbu.')],
        [ok('b6', 'Těším se na vás!')]
      ],
      attachments: [ok('a1', 'program-skola-v-prirode.pdf', 'Obyčejný dokument PDF, který jsi čekal(a). Pozor by sis měl(a) dát na přípony .exe, .scr nebo .bat.')]
    },
    verdictWhy: {
      bezpecne: 'Známá školní adresa, očekávaná zpráva, odkaz vede na školní web a nic po tobě nechce. Je v pořádku.',
      podvod: 'Zkus najít konkrétní stopu – žádnou tu nenajdeš. Adresa i odkaz vedou na školní doménu a nikdo nechce heslo ani peníze.',
      overit: 'Ověřovat neobvyklé žádosti je dobrý zvyk. Tahle zpráva ale nic neobvyklého nechce: znáš odesílatele a zprávu jsi čekal(a).'
    },
    hints: ['Ne každá zpráva je podvod. Zkontroluj odesílatele i odkaz stejně pečlivě jako jindy.', HINT_LINK, 'Chce po tobě zpráva heslo, peníze nebo spěch? Pokud ne a adresy sedí, je v pořádku.']
  },
  {
    id: 'e-vyhra', type: 'inspect', skill: 'natlak',
    title: 'Vyhrál(a) jsi 10 000 kostek!',
    prompt: 'Hraješ Kostkový svět (oficiální web hry je kostkovy-svet.test). Do pošty ti přišla tahle zpráva.',
    verdicts: MAIL_VERDICTS, accept: ['podvod'], need: 3,
    msg: {
      kind: 'email', time: 'Dnes 18:03',
      from: bad('from', 'Kostkový svět <odmeny@kostkovy-svet-vyhry.test>', 'Oficiální doména hry je kostkovy-svet.test. „kostkovy-svet-vyhry.test“ je jiná doména, která jen podobně zní.'),
      subject: bad('subject', '🎉 GRATULUJEME! Vyhrál(a) jsi 10 000 kostek!', 'Výhra v soutěži, do které ses nepřihlásil(a), je nejčastější návnada.'),
      body: [
        [ok('b1', 'Ahoj hráči,')],
        [ok('b2', 'byl(a) jsi vylosován(a) jako jeden z pěti šťastlivců.', 'Tahle věta jen rozvádí „výhru“ z předmětu. Hlavní stopy jsou jinde.'),
          bad('b3', 'Výhru si vyzvedni do 30 minut, jinak propadne.', 'Krátký termín je nátlak – máš jednat dřív, než začneš přemýšlet.')],
        [bad('b4', 'Stačí zadat přihlašovací jméno, heslo a kód, který ti přijde v SMS.', 'Heslo a kód z SMS dohromady = klíče od tvého účtu. Útočník by ti účet ukradl.'),
          link('b5', 'Vyzvednout výhru', 'http://kostkovy-svet-vyhry.test/vyzvednout', 'Odkaz nevede na oficiální kostkovy-svet.test, ale na podvodnou doménu.')],
        [ok('b6', 'Tvůj tým Kostkového světa')]
      ]
    },
    verdictWhy: {
      podvod: 'Podobná, ale cizí doména, výhra z ničeho, spěch a žádost o heslo a kód. Klasická krádež herního účtu.',
      bezpecne: 'Zpráva chce tvoje heslo i kód z SMS. Skutečná hra po tobě nikdy nic takového nechce.',
      overit: 'Pochybnost je správná. Stop je tu ale dost na jasný verdikt: podvod. Neklikej a zprávu smaž.'
    },
    hints: ['Porovnej doménu odesílatele s oficiálním webem hry ze zadání.', 'Které věty tě tlačí, abys jednal(a) hned?', 'Co přesně máš na stránce zadat?']
  },
  {
    id: 'e-zasilka', type: 'inspect', skill: 'priloha',
    title: 'Nedoručená zásilka',
    prompt: 'Rodiče čekají balík od přepravce BalíkExpres (web balikexpres.test). Přišel tenhle e-mail.',
    verdicts: MAIL_VERDICTS, accept: ['podvod'], need: 3,
    msg: {
      kind: 'email', time: 'Dnes 9:14',
      from: bad('from', 'BalíkExpres <info@ba1ikexpres.test>', 'Místo písmene „l“ je tu číslice „1“: ba1ikexpres. Podvodníci si registrují adresy, které se od skutečných liší jediným znakem.'),
      subject: ok('subject', 'Zásilka č. 48210 nebyla doručena', 'Skutečný přepravce posílá podobná oznámení. Rozhodují další stopy.'),
      body: [
        [ok('b1', 'Dobrý den,')],
        [ok('b2', 'vaši zásilku se nepodařilo doručit.', 'Tahle věta by mohla být i ve skutečném oznámení.'),
          ok('b3', 'Podrobnosti najdete v příloze.')],
        [bad('b4', 'Pokud do 2 dnů nezaplatíte poplatek 39 Kč kartou, zásilka se vrátí odesílateli.', 'Malá částka a termín. Podvodníkům nejde o 39 Kč, ale o číslo platební karty.')],
        [ok('b5', 'S pozdravem, zákaznická podpora')]
      ],
      attachments: [bad('a1', 'zasilka_48210.pdf.exe', 'Soubor končí na .exe – je to program, ne dokument. Dvojitá přípona „.pdf.exe“ ho má zamaskovat. Spuštěním by sis mohl(a) nakazit počítač.')]
    },
    verdictWhy: {
      podvod: 'Doména s číslicí místo písmene, program maskovaný jako PDF a požadavek na platbu kartou.',
      bezpecne: 'Příloha je ve skutečnosti program (.exe) a adresa odesílatele je podvržená. Nebezpečné.',
      overit: 'Rodiče si mohou stav zásilky ověřit přímo na webu přepravce. Tahle zpráva sama je ale jasný podvod – přílohu neotvírej.'
    },
    hints: ['Přečti adresu odesílatele písmeno po písmenu a porovnej ji s webem ze zadání.', 'Jak končí název přílohy? Co znamená poslední přípona?', 'Proč by někdo chtěl číslo karty kvůli 39 Kč?']
  },
  {
    id: 'e-novy-ucet', type: 'inspect', skill: 'overeni',
    title: 'Nové číslo účtu na výlet',
    prompt: 'Zprávu dostali i rodiče. Přišla opravdu ze školní adresy. Je to v pořádku?',
    verdicts: MAIL_VERDICTS, accept: ['overit'], need: 2,
    msg: {
      kind: 'email', time: 'Dnes 21:47',
      from: ok('from', 'Hospodářka školy <hospodarka@' + SCHOOL + '>', 'Adresa je opravdu školní. Jenže i skutečný účet může někdo ovládnout – proto rozhoduje obsah.'),
      subject: ok('subject', 'Výlet 7.B – platba'),
      body: [
        [ok('b1', 'Dobrý den,')],
        [bad('b2', 'platbu za výlet prosím pošlete na nové číslo účtu 000000-1234567890/0000, staré už neplatí.', 'Změna čísla účtu e-mailem je přesně to, co dělají podvodníci, kteří ovládli cizí schránku.'),
          bad('b3', 'Peníze musí přijít ještě dnes.', 'Nečekaný spěch, a ještě pozdě večer.')],
        [bad('b4', 'Kvůli kontrole prosím do školy nevolejte, vše vyřídíme e-mailem.', 'Zákaz ověření je velmi podezřelý. Skutečná škola se telefonátu nebojí.')],
        [ok('b5', 'Děkuji, hospodářka')]
      ]
    },
    verdictWhy: {
      overit: 'Adresa je školní, ale zpráva chce peníze na nový účet, spěchá a zakazuje ověření. Rodiče mají zavolat do školy na číslo ze školního webu – ne na číslo ze zprávy.',
      podvod: 'Hodně stop ukazuje na podvod. Adresa je ale opravdu školní – nevíš, jestli schránku někdo ovládl. Správný krok: ověřit jinou cestou (zavolat do školy na číslo z webu).',
      bezpecne: 'Změna čísla účtu, spěch a zákaz telefonátu – to rozhodně nejde zaplatit bez ověření.'
    },
    hints: ['Adresa je správná. Čti pozorně, co po rodičích zpráva chce.', 'Proč by škola zakazovala zavolat?', 'Když odesílatel vypadá skutečně, ale žádost je neobvyklá, ověř si ji jinou cestou.']
  }
];

/* ================= Úroveň 2: SMS a chaty ================= */
const L2 = [
  {
    id: 's-doplatek', type: 'inspect', skill: 'odkaz',
    title: 'Doplatek za zásilku',
    prompt: 'Na mobil ti přišla SMS. Žádný balík nečekáš.',
    verdicts: MAIL_VERDICTS, accept: ['podvod'], need: 2,
    msg: {
      kind: 'sms', time: '14:22',
      from: ok('from', 'Neznámé číslo', 'SMS z neznámého čísla sama o sobě nic neznamená – firmy posílají zprávy z různých čísel.'),
      body: [
        [bad('b1', 'BalikExpres: Vase zasilka ceka na doplaceni 15 Kc.', 'Žádný balík nečekáš. Malý doplatek je nejčastější podvodná SMS.'),
          link('b2', 'balikexpres.doplatek.test/platba', 'http://balikexpres.doplatek.test/platba', 'Konec domény je doplatek.test, ne balikexpres.test. Začátek „balikexpres.“ tě má jen zmást.'),
          bad('b3', 'Plaťte do dnes 23:59.', 'Spěch a termín – typický nátlak.')]
      ]
    },
    verdictWhy: {
      podvod: 'Nečekaný doplatek, odkaz na cizí doménu a spěch. SMS smaž a na odkaz neklikej.',
      bezpecne: 'Balík nečekáš a odkaz nevede na web přepravce. To není bezpečné.',
      overit: 'Ověřit stav balíku na oficiálním webu je rozumné. Tahle SMS je ale jasný podvod.'
    },
    hints: ['Čekáš vůbec nějaký balík?', 'Doména se čte od konce: co je těsně před prvním lomítkem?']
  },
  {
    id: 's-mama', type: 'inspect', skill: 'udaje',
    title: 'Ahoj, tady máma',
    prompt: 'Píše ti někdo z čísla, které nemáš uložené.',
    verdicts: MAIL_VERDICTS, accept: ['overit', 'podvod'], need: 2,
    msg: {
      kind: 'chat', time: '16:05',
      from: ok('from', 'Neznámé číslo', 'Že číslo neznáš, je důležité. Proto si nemůžeš být jistý(á), kdo píše.'),
      body: [
        [bad('b1', 'Ahoj, to jsem já, máma. Rozbil se mi mobil, tohle je moje nové číslo.', '„Nové číslo“ znamená, že nevíš, kdo doopravdy píše. Tímhle začíná většina podvodů „ahoj mami/tati“.')],
        [bad('b2', 'Přišel ti teď kód v SMS? Pošli mi ho, potřebuju se přihlásit.', 'Kód z SMS nikdy nikomu nepřeposílej – ani někomu, kdo tvrdí, že je z rodiny. Kód je klíč k tvému účtu.')],
        [bad('b3', 'Ale nevolej mi, teď nemůžu mluvit.', 'Podvodník se bojí hovoru – podle hlasu by se prozradil.')],
        [ok('b4', 'Díky, pusa ❤️', 'Milý pozdrav má působit důvěryhodně, sám o sobě ale nic neprozrazuje.')]
      ]
    },
    verdictWhy: {
      overit: 'Přesně tak. Zavolej mámě na její staré, uložené číslo nebo se zeptej osobně. Kód z SMS nikomu neposílej.',
      podvod: 'Ano, má to všechny znaky podvodu. Kód neposílej a zavolej mámě na číslo, které máš uložené.',
      bezpecne: 'Neznámé číslo, žádost o kód z SMS a zákaz volání. Kód rozhodně neposílej!'
    },
    hints: ['Jak víš, že píše opravdu máma?', 'K čemu se dá použít kód, který ti přijde v SMS?', 'Proč ti píše, ať jí nevoláš?']
  },
  {
    id: 's-spoluzak', type: 'inspect', skill: 'overeni',
    title: 'Zpráva od spolužáka',
    prompt: 'V chatu ti píše spolužák. Jeho číslo máš uložené už dva roky.',
    verdicts: MAIL_VERDICTS, accept: ['bezpecne'], need: 0,
    msg: {
      kind: 'chat', time: '19:31',
      from: ok('from', 'Bobr (spolužák)', 'Uložený kontakt, se kterým si píšeš dlouho.'),
      body: [
        [ok('b1', 'Ahoj, nezapomeň zítra vodovky na výtvarku 🎨')],
        [ok('b2', 'Paní učitelka říkala, že budeme malovat venku.')],
        [ok('b3', 'Úkol z matiky je v učebnici na straně 42.', 'Obyčejná informace. Nechce po tobě žádné údaje ani kliknutí.')]
      ]
    },
    verdictWhy: {
      bezpecne: 'Známý kontakt, běžná zpráva, žádný odkaz ani žádost o údaje. V pořádku.',
      podvod: 'Najdeš tu konkrétní stopu? Kontakt znáš, zpráva nic nechce a nikam neodkazuje.',
      overit: 'Ověřovat má smysl, když zpráva chce něco neobvyklého. Tahle jen připomíná vodovky.'
    },
    hints: ['Ne každá zpráva je podvod.', 'Chce po tobě zpráva heslo, kód, peníze nebo kliknutí na odkaz?']
  },
  {
    id: 's-admin', type: 'inspect', skill: 'udaje',
    title: 'Podpora hry ti píše',
    prompt: 'V herním chatu Kostkového světa ti napsal hráč, který vypadá jako podpora.',
    verdicts: MAIL_VERDICTS, accept: ['podvod'], need: 3,
    msg: {
      kind: 'chat', time: '20:12',
      from: bad('from', 'Hráč: Admin_Podpora_0ficial', 'Skutečná podpora nepíše přes herní chat jako běžný hráč. A v přezdívce je nula místo písmene „O“.'),
      body: [
        [bad('b1', 'Dobrý den, váš účet byl nahlášen za podvádění.', 'Strašení – máš se bát, že přijdeš o účet.')],
        [bad('b2', 'Abychom ho nezablokovali, potřebujeme ověřit vaše heslo.', 'Nikdo z podpory nikdy nepotřebuje tvoje heslo.'),
          bad('b3', 'Napište ho sem do chatu do 10 minut.', 'Krátký termín je nátlak.')],
        [ok('b4', 'Děkujeme za spolupráci.')]
      ]
    },
    verdictWhy: {
      podvod: 'Falešná přezdívka, strašení, žádost o heslo a spěch. Hráče nahlas přes tlačítko ve hře a nic mu nepiš.',
      bezpecne: 'Někdo chce tvoje heslo do chatu. To nikdy není bezpečné.',
      overit: 'Pochybnost je správná, ale tady jde jasně o podvod. Heslo nikomu nepiš a hráče nahlas.'
    },
    hints: ['Přečti si pozorně přezdívku – písmeno po písmenu.', 'Kdo všechno smí znát tvoje heslo?']
  },
  {
    id: 's-anketa', type: 'inspect', skill: 'natlak',
    title: 'Telefon za 1 Kč',
    prompt: 'Přišla ti SMS o odměně za anketu. Žádnou anketu jsi nevyplňoval(a).',
    verdicts: MAIL_VERDICTS, accept: ['podvod'], need: 2,
    msg: {
      kind: 'sms', time: '11:48',
      from: ok('from', 'ODMENA', 'Název místo čísla si odesílatel může nastavit sám. Nic to nedokazuje – ani dobré, ani špatné.'),
      body: [
        [bad('b1', 'Gratulujeme! Tvé číslo bylo vybráno a vyhrálo nový telefon za 1 Kč.', 'Výhra v anketě, kterou jsi nevyplňoval(a), je návnada.'),
          link('b2', 'odmena-anketa.test/telefon', 'http://odmena-anketa.test/telefon', 'Neznámá doména, kterou nikdo neověřil. Na odkazy z nevyžádaných SMS neklikej.')],
        [bad('b3', 'Pro zaplacení poštovného zadej číslo karty rodičů.', 'Číslo platební karty nikdy nezadávej kvůli „výhře“. A karta rodičů vůbec není tvoje.')]
      ]
    },
    verdictWhy: {
      podvod: 'Výhra z ničeho, neznámý odkaz a žádost o číslo karty. SMS smaž.',
      bezpecne: 'Někdo chce číslo platební karty. To není bezpečné.',
      overit: 'Tady není co ověřovat – nevyplnil(a) jsi žádnou anketu a zpráva chce kartu. Je to podvod.'
    },
    hints: ['Vyplnil(a) jsi nějakou anketu?', 'Co po tobě zpráva chce zadat?']
  }
];

/* ================= Úroveň 3: hesla a přihlášení ================= */
const L3_BUILD = [
  {
    id: 'h-heslo-rex', type: 'password', skill: 'heslo',
    title: 'Heslo do školního účtu',
    prompt: 'Vymysli nové heslo pro školní účet. Musí být silné a nesmí v něm být nic z profilu – to by útočník zkusil jako první.',
    profile: [['Jméno psa', 'Rex'], ['Rok narození', '2013'], ['Oblíbený tým', 'Lipová Rakety'], ['Třída', '7.B']],
    personal: ['rex', '2013', 'lipova', 'rakety', '7b'],
    solution: 'modra-zirafa-jezdi-na-kole',
    hints: ['Délka je důležitější než složité znaky. Zkus heslo ze 4 nebo více slov.', 'Spoj čtyři slova, která spolu nesouvisí, například „hrnek-oblak-tygr-polevka“. Nepoužívej nic z profilu.']
  },
  {
    id: 'h-heslo-micka', type: 'password', skill: 'heslo',
    title: 'Heslo do hry',
    prompt: 'Zakládáš si účet v Kostkovém světě. Vymysli silné heslo bez údajů z profilu.',
    profile: [['Kočka', 'Micka'], ['Ulice', 'Javorová'], ['Oblíbené jídlo', 'Pizza'], ['Přezdívka', 'Kostkař']],
    personal: ['micka', 'javorova', 'pizza', 'kostkar', 'kostkovy', 'svet'],
    solution: 'tichy-vlak-pod-mesicem-spi',
    hints: ['Krátké heslo s @ a čísly je slabší než dlouhá věta z obyčejných slov.', 'Zkus větu, kterou si zapamatuješ, například „ctyri-zluta-kola-na-strese“. Bez kočky, ulice, jídla i přezdívky.']
  }
];
const L3_CHOICE = [
  {
    id: 'h-nejsilnejsi', type: 'choice', skill: 'heslo',
    title: 'Které heslo je nejsilnější?',
    prompt: 'Vyber heslo, které by útočník prolomil nejpomaleji.',
    options: ['Heslo123!', 'P@ssw0rd', 'modry-slon-jede-tramvaji', 'Kl0b0uk#7'],
    correct: 2,
    why: [
      '„Heslo“ a „123“ jsou první, co útočník zkouší. Vykřičník na konci nepomůže.',
      'Je to slovo „password“ se zaměněnými písmeny. Útočníci tyhle záměny znají a zkoušejí je.',
      'Dlouhá fráze ze čtyř slov má přes 20 znaků. Je silná a dobře se pamatuje.',
      'Speciální znaky jsou fajn, ale heslo má jen 9 znaků. Délka je důležitější.'
    ],
    hints: ['Spočítej, kolik má každé heslo znaků.', 'Záměna o → 0 nebo a → @ útočníka nezastaví.']
  },
  {
    id: 'h-stejne-heslo', type: 'choice', skill: 'heslo',
    title: 'Jedno heslo na všechno',
    prompt: 'Máš stejné heslo do hry, do e-mailu i do školního účtu. Herní web někdo napadl a hesla unikla. Co se stane?',
    options: [
      'Nic, unikla jen hesla ze hry.',
      'Útočník zkusí stejné heslo i k e-mailu a školnímu účtu – a dostane se tam.',
      'Hesla jsou vždycky zašifrovaná, takže je nikdo nepřečte.',
      'Stačí, když si změním heslo jen ve hře.'
    ],
    correct: 1,
    why: [
      'Útočníci uniklá hesla zkoušejí i na jiných službách. Proto má mít každý účet jiné heslo.',
      'Přesně tak. Uniklé heslo vyzkouší všude. Každý účet proto potřebuje jiné heslo – pomůže správce hesel.',
      'Ne každý web hesla chrání dobře. A i zašifrovaná hesla jde někdy prolomit, hlavně ta krátká.',
      'Musíš ho změnit všude, kde jsi ho použil(a). A pak už všude používat různá hesla.'
    ],
    hints: ['Co udělá útočník s heslem, které získal?', 'Zkusí ho jen na jednom webu?']
  },
  {
    id: 'h-kod-sms', type: 'choice', skill: 'udaje',
    title: 'Kód, o který jsi nežádal(a)',
    prompt: 'Přišla ti SMS: „Váš přihlašovací kód do Fotogramu je 482 913. Nikomu ho nesdělujte.“ Ty se ale zrovna nepřihlašuješ. Co to znamená?',
    options: [
      'Nic, kód smažu a dál to neřeším.',
      'Někdo zná moje heslo a zkouší se přihlásit. Kód ho zastavil – hned si heslo změním.',
      'Pošlu kód kamarádovi, ať zjistí, co to je.',
      'Kód si uložím do poznámek, kdyby se hodil.'
    ],
    correct: 1,
    why: [
      'Kód je sice zastavil, ale někdo zná tvoje heslo. Musíš ho změnit, jinak to zkusí znovu.',
      'Přesně. Druhý krok přihlášení (kód z SMS nebo z aplikace) tě ochránil. Teď změň heslo.',
      'Kód nikdy nikomu neposílej. Kdo má tvoje heslo i kód, dostane se do účtu.',
      'Kód rychle vyprší a k ničemu ho nepotřebuješ. Důležité je změnit heslo.'
    ],
    hints: ['Kód přijde, když někdo zadá správné jméno a heslo.', 'Kdo asi zadal tvoje heslo, když jsi to nebyl(a) ty?']
  },
  {
    id: 'h-ulozeni', type: 'choice', skill: 'heslo',
    title: 'Kam s heslem?',
    prompt: 'Kde je heslo uložené nejbezpečněji?',
    options: [
      'Na papírku nalepeném na monitoru.',
      'Ve správci hesel, nebo zapamatované jako dlouhá fráze.',
      'V poznámce v telefonu s názvem „Hesla“.',
      'V e-mailu, který si pošlu sám/sama sobě.'
    ],
    correct: 1,
    why: [
      'Papírek na monitoru si přečte každý, kdo jde kolem.',
      'Správce hesel je chráněný a vymyslí za tebe silná hesla. Dlouhou frázi si zapamatuješ.',
      'Kdo získá telefon nebo zálohu poznámek, má všechna hesla najednou.',
      'Když ti někdo ukradne e-mail, najde tam i hesla ke všemu ostatnímu.'
    ],
    hints: ['Kdo všechno se k heslu na každém místě dostane?', 'Existují aplikace přímo na ukládání hesel.']
  }
];

/* ================= Úroveň 4: co o sobě sdílím ================= */
const AUD_PUBLIC = 'Kdo uvidí: Veřejné – kdokoli na internetu';
const L4 = [
  {
    id: 'p-dovolena', type: 'inspect', skill: 'sdileni',
    title: 'Konečně u moře',
    prompt: 'Chystáš se zveřejnit příspěvek. Označ, co do něj nepatří, a rozhodni.',
    verdicts: POST_VERDICTS, accept: ['upravit'], need: 2,
    msg: {
      kind: 'post', time: 'Koncept',
      from: ok('from', 'Tvůj profil'),
      body: [
        [ok('b1', 'Konečně prázdniny! ☀️')],
        [bad('b2', 'Celé dva týdny jsme s rodiči u moře, doma nikdo není.', 'Prozrazuješ, že je byt prázdný. Fotky z dovolené sdílej až po návratu.')]
      ],
      photo: { label: 'Fotka z letiště', items: [
        ok('f1', 'Já s kufrem', 'Fotka tebe s kufrem je v pořádku.'),
        bad('f2', 'Letenka s mým jménem a čárovým kódem', 'Z kódu na letence se dají vyčíst osobní údaje a někdy i změnit rezervace.'),
        ok('f3', 'Odletová tabule', 'Obecná tabule nic osobního neprozrazuje.')
      ] },
      footer: [bad('aud', AUD_PUBLIC, 'Veřejný příspěvek uvidí i cizí lidé. Pro kamarády stačí okruh přátel.')]
    },
    verdictWhy: {
      upravit: 'Smaž větu o prázdném bytě, letenku z fotky a změň okruh na přátele. Pak můžeš sdílet.',
      zverejnit: 'Takhle by kdokoli věděl, že je váš byt dva týdny prázdný, a viděl by tvou letenku.'
    },
    hints: ['Kdo všechno příspěvek uvidí?', 'Co by se z příspěvku dozvěděl zloděj? A co je vidět na letence?']
  },
  {
    id: 'p-turnaj', type: 'inspect', skill: 'sdileni',
    title: 'Vyhráli jsme turnaj',
    prompt: 'Chceš se pochlubit výhrou. Označ, co do příspěvku nepatří (jestli něco), a rozhodni.',
    verdicts: POST_VERDICTS, accept: ['zverejnit'], need: 0,
    msg: {
      kind: 'post', time: 'Koncept',
      from: ok('from', 'Tvůj profil'),
      body: [[ok('b1', 'Dneska jsme vyhráli florbalový turnaj! 🏆'), ok('b2', 'Díky, týme, byli jste skvělí.')]],
      photo: { label: 'Fotka z turnaje', items: [
        ok('f1', 'Pohár na stole'),
        ok('f2', 'Tým v dresech zezadu', 'Na fotce nejsou vidět obličeje ani jména – a spoluhráči souhlasili.'),
        ok('f3', 'Hala bez nápisů', 'Z fotky nejde poznat, kde přesně jste.')
      ] },
      footer: [ok('aud', 'Kdo uvidí: Přátelé', 'Příspěvek uvidí jen tvoji přátelé.')]
    },
    verdictWhy: {
      zverejnit: 'Nic osobního tu není, okruh je jen pro přátele a spoluhráči souhlasili. Klidně se pochlub!',
      upravit: 'Najdeš konkrétní věc, která by mohla někomu ublížit? Tady žádná není.'
    },
    hints: ['Ne každý příspěvek je problém.', 'Je vidět adresa, jméno, škola nebo přesná poloha? Kdo příspěvek uvidí?']
  },
  {
    id: 'p-doucovani', type: 'inspect', skill: 'sdileni',
    title: 'Hledám doučování',
    prompt: 'Píšeš veřejný příspěvek, že hledáš doučování z matiky. Označ, co do něj nepatří.',
    verdicts: POST_VERDICTS, accept: ['upravit'], need: 3,
    msg: {
      kind: 'post', time: 'Koncept',
      from: ok('from', 'Tvůj profil'),
      body: [
        [ok('b1', 'Hledám někoho na doučování matiky 📐')],
        [bad('b2', 'Chodím do 7.B na ZŠ Lipová.', 'Škola a třída říkají cizím lidem, kde tě každý den najdou.'),
          bad('b3', 'Bydlím na Javorové 7, kousek od školy.', 'Adresu bydliště veřejně nikdy nezveřejňuj.')],
        [bad('b4', 'Pište mi na moje číslo 6XX XXX XXX.', 'Telefonní číslo ve veřejném příspěvku může použít kdokoli – i podvodník.')]
      ],
      footer: [bad('aud', AUD_PUBLIC, 'Veřejně to uvidí i úplně cizí lidé. Doučování je lepší hledat přes školu nebo rodiče.')]
    },
    verdictWhy: {
      upravit: 'Škola, adresa a telefon ve veřejném příspěvku jsou moc. Požádej o pomoc rodiče nebo učitele.',
      zverejnit: 'Kdokoli by věděl, kde bydlíš, kam chodíš do školy a na jakém čísle tě zastihne.'
    },
    hints: ['Které údaje by cizímu člověku řekly, kde tě najde?', 'Jsou tu tři osobní údaje a ještě nastavení, kdo příspěvek uvidí.']
  },
  {
    id: 'p-bryle', type: 'inspect', skill: 'sdileni',
    title: 'Nové brýle',
    prompt: 'Fotíš se doma u okna v nových brýlích. Než to pošleš, prohlédni si fotku i nastavení.',
    verdicts: POST_VERDICTS, accept: ['upravit'], need: 2,
    msg: {
      kind: 'post', time: 'Koncept',
      from: ok('from', 'Tvůj profil'),
      body: [[ok('b1', 'Nové brýle, co vy na to? 😎')]],
      photo: { label: 'Selfie u okna', items: [
        ok('f1', 'Úsměv s novými brýlemi', 'Na tom nic špatného není.'),
        bad('f2', 'Za oknem cedule s názvem ulice a číslem domu', 'Podle cedule za oknem kdokoli zjistí, kde bydlíš. Fotku ořízni.'),
        ok('f3', 'Květina na parapetu')
      ] },
      footer: [
        bad('loc', 'Poloha: zapnutá – přesné místo', 'Přesná poloha u fotky z domova prozradí adresu. Polohu vypni.'),
        ok('aud', 'Kdo uvidí: Přátelé', 'Okruh přátel je rozumná volba.')
      ]
    },
    verdictWhy: {
      upravit: 'Ořízni ceduli s adresou a vypni polohu. Pak je selfie v pohodě.',
      zverejnit: 'Cedule za oknem a zapnutá poloha prozradí, kde bydlíš.'
    },
    hints: ['Podívej se i na pozadí fotky.', 'Co všechno se k fotce přidá automaticky?']
  }
];

/* ================= Odhad síly hesla =================
   Zjednodušený, ale poctivý model: entropie = délka × log2(velikost abecedy),
   za běžná slova, řady (123, qwertz) a opakování se entropie snižuje.
   Útočník zkouší 10 miliard hesel za sekundu (počítač s grafickou kartou, offline). */
export const COMMON = ['heslo', 'password', 'passw', 'qwerty', 'qwertz', 'asdf', 'admin', 'iloveyou', 'letmein', 'welcome', 'monkey', 'dragon', 'football', 'fotbal', 'skola', 'ahoj', 'tajne', 'tajny', 'login', 'secret', 'princezna', 'slunicko', 'heslicko'];
const SEQ = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertzuiop', 'qwertyuiop', 'asdfghjkl', 'yxcvbnm', 'zxcvbnm'];
export const STRENGTH = ['Velmi slabé', 'Slabé', 'Střední', 'Silné'];
export const STRONG_BITS = 60;
const GUESSES_PER_SECOND = 1e10;

/** Malá písmena, bez diakritiky, s vrácenými „hackerskými“ záměnami (0→o, @→a…). */
export function simplify(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't');
}
const plain = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function passwordReport(pw, personal = []) {
  const value = String(pw ?? '');
  const chars = [...value];
  const len = chars.length;
  let pool = 0;
  if (/[a-z]/.test(value)) pool += 26;
  if (/[A-Z]/.test(value)) pool += 26;
  if (/[0-9]/.test(value)) pool += 10;
  if (/[^A-Za-z0-9]/.test(value)) pool += 33;
  const perChar = pool ? Math.log2(pool) : 0;
  let bits = len * perChar;

  const simple = simplify(value);
  const digitsLetters = plain(value);
  const commonFound = COMMON.filter(w => simple.includes(w));
  for (const w of commonFound) bits -= Math.max(0, w.length * perChar - 8);

  const seqFound = [];
  for (const src of SEQ) {
    const w = /\d/.test(src) ? 3 : 4; // číslice od 3 (123), písmena od 4 (abcd, qwer) – ať nevadí běžná slova
    for (let i = 0; i + w <= src.length; i++) {
      const piece = src.slice(i, i + w);
      const rev = [...piece].reverse().join('');
      if (digitsLetters.includes(piece) || digitsLetters.includes(rev)) { seqFound.push(piece); }
    }
  }
  const uniqSeq = [...new Set(seqFound)];
  bits -= uniqSeq.reduce((sum, q) => sum + Math.max(0, q.length * perChar - 5), 0);

  const repeats = (value.match(/(.)\1{2,}/g) || []).reduce((s, r) => s + r.length - 1, 0);
  bits -= repeats * Math.max(0, perChar - 1);

  const personalFound = personal.filter(p => p && (simple.includes(simplify(p)) || digitsLetters.includes(plain(p))));
  for (const p of personalFound) bits -= Math.max(0, p.length * perChar - 6);

  bits = Math.max(0, Math.round(bits));
  const level = len === 0 ? 0 : bits < 30 ? 0 : bits < 45 ? 1 : bits < STRONG_BITS ? 2 : 3;
  return {
    length: len, bits, level, label: STRENGTH[level],
    common: commonFound, sequences: uniqSeq, personal: personalFound,
    crack: crackTime(bits),
    checks: {
      long: len >= 12,
      noCommon: commonFound.length === 0 && uniqSeq.length === 0,
      noPersonal: personalFound.length === 0,
      strong: level === 3
    }
  };
}

/** Orientační doba prolomení (polovina všech kombinací). */
export function crackTime(bits) {
  const sec = Math.pow(2, bits) / GUESSES_PER_SECOND / 2;
  if (sec < 1) return 'okamžitě';
  const units = [[60, ['sekundu', 'sekundy', 'sekund']], [60, ['minutu', 'minuty', 'minut']], [24, ['hodinu', 'hodiny', 'hodin']], [365, ['den', 'dny', 'dní']], [Infinity, ['rok', 'roky', 'let']]];
  let v = sec;
  for (const [k, forms] of units) {
    if (v < k) {
      const n = Math.max(1, Math.floor(v));
      if (forms[2] === 'let' && n >= 1e6) return 'víc než milion let';
      return `asi ${n.toLocaleString('cs-CZ')} ${n === 1 ? forms[0] : n <= 4 ? forms[1] : forms[2]}`;
    }
    v /= k;
  }
  return 'víc než milion let';
}

/* ================= Sestavení mise ================= */
const POOLS = [L1, L2, null, L4];
export const COUNTS = { cela: [3, 3, 3, 3], rychly: [2, 2, 1, 1] };
export const MODE_INFO = { cela: '12 úloh · asi 20 min', rychly: '6 úloh · asi 10 min' };

function pickInspect(pool, n, next) {
  const isCalm = t => t.accept.some(v => CALM.has(v));
  // jediná úloha úrovně (rychlý režim) má být jasný podvod se stopami, ne bezpečná zpráva
  let picked = n === 1 ? shuffle(pool.filter(t => !isCalm(t)), next).slice(0, 1) : shuffle(pool, next).slice(0, n);
  if (n >= 2 && !picked.some(t => t.accept.some(v => CALM.has(v)))) {
    const calm = shuffle(pool.filter(t => t.accept.some(v => CALM.has(v))), next)[0];
    if (calm) picked = [...picked.slice(0, n - 1), calm];
    picked = shuffle(picked, next);
  }
  // první úloha úrovně je „jasný podvod“ – jemnější případy (ověřit, bezpečné) přijdou až po něm
  const firstScam = picked.findIndex(t => !t.accept.some(v => CALM.has(v)));
  if (firstScam > 0) picked = [picked[firstScam], ...picked.filter((_, i) => i !== firstScam)];
  return picked;
}

export function buildGame(variant = 'A', mode = 'cela') {
  const next = mulberry32(VARIANTS[variant] ?? VARIANTS.A);
  const counts = COUNTS[mode] ?? COUNTS.cela;
  const tasks = [];
  counts.forEach((n, level) => {
    let picked;
    if (level === 2) {
      const build = shuffle(L3_BUILD, next)[0];
      picked = n === 1 ? [build] : [build, ...shuffle(L3_CHOICE, next).slice(0, n - 1)];
      if (n > 1) picked = [...picked.slice(1, 2), build, ...picked.slice(2)];
    } else picked = pickInspect(POOLS[level], n, next);
    for (const t of picked) tasks.push({ ...t, level });
  });
  return tasks;
}

export const tutorialTask = () => TUTORIAL;
export const allTasks = () => [...L1, ...L2, ...L3_BUILD, ...L3_CHOICE, ...L4];

/* ================= Vyhodnocení ================= */
/** Všechny klikací části zprávy v pořadí, jak jsou na obrazovce. */
export function spotsOf(t) {
  if (t.type !== 'inspect') return [];
  const m = t.msg;
  return [m.from, m.subject, ...(m.body || []).flat(), ...(m.attachments || []), ...(m.photo?.items || []), ...(m.footer || [])].filter(Boolean);
}
export const cluesOf = t => spotsOf(t).filter(s => s.clue);
const short = text => (text.length > 48 ? text.slice(0, 45).trimEnd() + '…' : text);
const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

/**
 * Vyhodnotí odpověď. answer:
 *  inspect  → { marks: [id…], verdict }
 *  choice   → { option }
 *  password → { value }
 * Vrací { ok, msg, incomplete?, wrong?: [id…], found?, missing? }.
 * incomplete = žák ještě nic nevybral (nepočítá se jako pokus).
 */
export function check(t, answer = {}) {
  if (t.type === 'choice') {
    if (answer.option == null) return { ok: false, incomplete: true, msg: 'Nejdřív vyber jednu možnost.' };
    return { ok: answer.option === t.correct, msg: t.why[answer.option] };
  }
  if (t.type === 'password') {
    const value = String(answer.value ?? '');
    if (!value.trim()) return { ok: false, incomplete: true, msg: 'Nejdřív napiš heslo do políčka.' };
    const r = passwordReport(value, t.personal);
    if (r.personal.length) return { ok: false, msg: `V hesle je údaj z profilu („${r.personal[0]}“). Útočník, který si prohlédne tvůj profil, ho zkusí jako první.` };
    if (r.common.length) return { ok: false, msg: `Heslo obsahuje běžné slovo „${r.common[0]}“, které útočníci zkoušejí mezi prvními.` };
    if (r.level < 3) {
      const tip = r.length < 16 ? ' Nejvíc pomůže delší heslo – zkus spojit 4 nesouvisející slova.' : ' Vyhni se řadám jako 123 nebo qwertz a opakování znaků.';
      return { ok: false, msg: `Síla: ${r.label.toLowerCase()} (útočník by ho prolomil ${r.crack}).${tip}` };
    }
    return { ok: true, msg: `Síla: silné. Útočník zkoušející 10 miliard hesel za sekundu by potřeboval ${r.crack}. Heslo si zapamatuj a nikomu ho neříkej.` };
  }
  // inspect
  const marks = new Set(answer.marks || []);
  const spots = spotsOf(t);
  const verdict = answer.verdict;
  if (!verdict) return { ok: false, incomplete: true, msg: 'Nejdřív vyber verdikt dole pod zprávou.' };
  const wrong = spots.filter(s => marks.has(s.id) && !s.clue);
  const found = spots.filter(s => marks.has(s.id) && s.clue).length;
  const verdictOk = t.accept.includes(verdict);
  const missing = Math.max(0, t.need - found);
  const parts = [];
  if (!verdictOk) parts.push(t.verdictWhy[verdict]);
  if (wrong.length) parts.push(`Tohle je v pořádku: „${short(wrong[0].text)}“ – ${wrong[0].ok}` + (wrong.length > 1 ? ` (a ${plural(wrong.length - 1, 'další označená část', 'další označené části', 'dalších označených částí')} taky).` : ''));
  if (verdictOk && missing > 0) parts.push(`Verdikt sedí, ale najdi ještě aspoň ${plural(missing, 'stopu', 'stopy', 'stop')}. Podvod je potřeba umět i zdůvodnit.`);
  const okAll = verdictOk && !wrong.length && missing === 0;
  if (okAll) parts.push(t.verdictWhy[verdict]);
  return { ok: okAll, msg: parts.join(' '), wrong: wrong.map(s => s.id), found, missing };
}

/** Správná odpověď (pro „Ukázat řešení“ a testy). */
export function solution(t) {
  if (t.type === 'choice') return { option: t.correct };
  if (t.type === 'password') return { value: t.solution };
  return { marks: cluesOf(t).map(s => s.id), verdict: t.accept[0] };
}

/** Lepší výsledek: víc napoprvé → méně nápověd → (jen se stopkami) kratší čas. */
export function isBetter(a, b) {
  if (!b) return true;
  if (a.firstTry !== b.firstTry) return a.firstTry > b.firstTry;
  if (a.hints !== b.hints) return a.hints < b.hints;
  if (a.ms != null && b.ms != null) return a.ms < b.ms;
  return false;
}
