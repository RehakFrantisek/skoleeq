/* Dokumentová záchranka – obsah misí. Učitel tu může upravit texty bez zásahu do herní logiky.
   Pravidla pro úpravy:
   - id bloků musí být v rámci mise unikátní; cíle (objectives) se na ně odkazují,
   - u cíle kind:'mark' musí zadaný text přesně existovat v bloku,
   - po úpravě spusť `npm run test:unit` – test ověří, že každá mise je řešitelná.
   Druhy cílů: viz checks.js (type, countType, align, alignOthers, mark, noMark, list, order,
   first, image, caption, typo, contains). Kontrola, že text zůstal zachovaný, se přidává automaticky. */

export const ILLUSTRATIONS = [
  { id: 'zahon', label: 'Záhon se zeleninou' },
  { id: 'knihy', label: 'Knihy v regálu' },
  { id: 'robot', label: 'Soutěžní robot' },
  { id: 'mic', label: 'Míč a branka' },
  { id: 'autobus', label: 'Školní autobus' },
  { id: 'mikroskop', label: 'Mikroskop' }
];

export const DIFFICULTIES = {
  zacatecnik: 'Začátečník',
  pokrocily: 'Pokročilý',
  expert: 'Expert'
};

export const MISSIONS = [
  /* ===================== ZAČÁTEČNÍK ===================== */
  {
    id: 'ztraceny-titulek', title: 'Ztracený titulek', grade: 7, difficulty: 'zacatecnik',
    story: 'Nové číslo časopisu Kompas jde do tisku, ale název a podtitul vypadají jako obyčejný text. Grafik potřebuje, aby měly správné styly.',
    instructions: 'Název časopisu nastav na styl Nadpis 1 a podtitul na Nadpis 2. Ostatní text nech jako odstavce. Nestačí písmo zvětšit – rozhoduje styl.',
    initialDocument: [
      { id: 'titul', text: 'Kompas – časopis naší školy', bold: ['Kompas – časopis naší školy'] },
      { id: 'podtitul', text: 'Podzimní číslo: co se u nás dělo v září a říjnu' },
      { id: 'p1', text: 'Nový školní rok začal rychleji, než jsme čekali. V tomto čísle najdete reportáž z adaptačního kurzu šestých tříd, rozhovor s novou paní kuchařkou a tipy na podzimní výlety.' },
      { id: 'p2', text: 'Redakce hledá nové posily. Pokud rádi píšete, fotíte nebo kreslíte, přijďte ve středu po vyučování do učebny 214.' }
    ],
    objectives: [
      { kind: 'type', block: 'titul', type: 'heading1', label: 'Název časopisu má styl Nadpis 1' },
      { kind: 'type', block: 'podtitul', type: 'heading2', label: 'Podtitul má styl Nadpis 2' },
      { kind: 'type', block: 'p1', type: 'paragraph', label: 'První článek zůstal odstavcem' },
      { kind: 'type', block: 'p2', type: 'paragraph', label: 'Výzva redakce zůstala odstavcem' },
      { kind: 'countType', type: 'heading1', count: 1, label: 'V dokumentu je jen jeden Nadpis 1' }
    ],
    hints: [
      'Nadpis se nepozná podle velikosti písma, ale podle stylu. Styl říká počítači i čtečce obrazovky, co je nadpis.',
      'Zaměř se na první dva řádky: název časopisu a podtitul.',
      'Klikni do prvního řádku a v nabídce Styl vyber Nadpis 1. Pak klikni do druhého řádku a vyber Nadpis 2.'
    ],
    successExplanation: 'Nadpis má mít styl, ne jen velké tučné písmo. Ze stylů umí editor vytvořit obsah a čtečka pozná strukturu dokumentu.'
  },
  {
    id: 'dulezita-zprava', title: 'Důležitá zpráva', grade: 7, difficulty: 'zacatecnik',
    story: 'Oznámení o sběru papíru nikdo nečte pozorně. Redakce chce, aby datum a jedna prosba byly na první pohled vidět.',
    instructions: 'Tučně zvýrazni jen „ve čtvrtek 14. listopadu“. Kurzívou jen větu „Krabice prosím rozložte“. Nic jiného nezvýrazňuj.',
    initialDocument: [
      { id: 'h', type: 'heading1', text: 'Sběr papíru' },
      { id: 'p', text: 'Sběr papíru proběhne ve čtvrtek 14. listopadu od 7:30 do 8:00 před hlavním vchodem. Papír svažte provázkem. Krabice prosím rozložte, ušetříme tím místo v kontejneru.' },
      { id: 'p2', text: 'Třída, která přinese nejvíc papíru, vyhraje dort od školní jídelny.' }
    ],
    objectives: [
      { kind: 'mark', block: 'p', text: 've čtvrtek 14. listopadu', mark: 'b', exclusive: true, label: 'Datum „ve čtvrtek 14. listopadu“ je tučně (a nic jiného)' },
      { kind: 'mark', block: 'p', text: 'Krabice prosím rozložte', mark: 'i', exclusive: true, label: 'Prosba „Krabice prosím rozložte“ je kurzívou (a nic jiného)' },
      { kind: 'noMark', mark: 'u', label: 'Nic není podtržené' }
    ],
    hints: [
      'Zvýrazňuj jen to nejdůležitější. Když je tučně celý odstavec, nic nevynikne.',
      'Obě části jsou v prvním odstavci pod nadpisem.',
      'Myší označ slova „ve čtvrtek 14. listopadu“ a stiskni B (nebo Ctrl+B). Pak označ „Krabice prosím rozložte“ a stiskni I (Ctrl+I).'
    ],
    successExplanation: 'Zvýraznění funguje, jen když je ho málo. Tučné písmo pro to nejdůležitější, kurzíva pro jemnější důraz.'
  },
  {
    id: 'rozsypane-informace', title: 'Rozsypané informace', grade: 7, difficulty: 'zacatecnik',
    story: 'Seznam věcí na výlet se rozsypal do samostatných řádků. Rodiče si ho mají rychle přečíst a nic nezapomenout.',
    instructions: 'Čtyři řádky s věcmi na výlet převeď na odrážkový seznam a nech je v původním pořadí. Úvodní věta a poslední odstavec zůstanou odstavci.',
    initialDocument: [
      { id: 'h', type: 'heading1', text: 'Výlet do Moravského krasu' },
      { id: 'p', text: 'Sraz je v pondělí v 7:45 u školy. Na výlet si vezměte:' },
      { id: 'l1', text: 'pevnou obuv' },
      { id: 'l2', text: 'pláštěnku' },
      { id: 'l3', text: 'svačinu a pití' },
      { id: 'l4', text: 'kartičku pojišťovny' },
      { id: 'p2', text: 'Návrat plánujeme kolem 16. hodiny.' }
    ],
    objectives: [
      { kind: 'list', blocks: ['l1', 'l2', 'l3', 'l4'], list: 'bullet', ordered: true, label: 'Čtyři věci tvoří jeden odrážkový seznam' },
      { kind: 'type', block: 'p', type: 'paragraph', label: 'Úvodní věta zůstala odstavcem' },
      { kind: 'type', block: 'p2', type: 'paragraph', label: 'Poslední věta zůstala odstavcem' }
    ],
    hints: [
      'Výčet několika podobných věcí je přehlednější jako seznam s odrážkami.',
      'Jde o čtyři krátké řádky mezi „Na výlet si vezměte:“ a „Návrat plánujeme…“.',
      'Klikni do řádku „pevnou obuv“ a stiskni tlačítko Odrážky. Totéž udělej u dalších tří řádků.'
    ],
    successExplanation: 'Seznam s odrážkami se použije, když na pořadí nezáleží. Každá položka je krátká a začíná stejným způsobem.'
  },
  {
    id: 'pozvanka', title: 'Pozvánka', grade: 7, difficulty: 'zacatecnik',
    story: 'Pozvánka na vánoční jarmark je zarovnaná každý řádek jinak. Vypadá to, jako by ji psali tři lidé.',
    instructions: 'Hlavní nadpis zarovnej na střed. Všechen ostatní text zarovnej vlevo.',
    initialDocument: [
      { id: 'h', type: 'heading1', text: 'Pozvánka na vánoční jarmark', align: 'left' },
      { id: 'p1', text: 'Přijďte ve čtvrtek 18. prosince od 15:00 do školní jídelny.', align: 'center' },
      { id: 'p2', text: 'Koupit můžete výrobky žáků, cukroví a vánoční přání. Výtěžek poputuje do útulku pro opuštěná zvířata.', align: 'right' },
      { id: 'p3', text: 'Těšíme se na vás! Žákovský parlament', align: 'center' }
    ],
    objectives: [
      { kind: 'align', block: 'h', align: 'center', label: 'Hlavní nadpis je zarovnaný na střed' },
      { kind: 'alignOthers', except: ['h'], align: 'left', label: 'Ostatní text je zarovnaný vlevo' }
    ],
    hints: [
      'Jednotné zarovnání dělá dokument klidný a čitelný. Delší text se čte nejlépe zarovnaný vlevo.',
      'Zkontroluj nadpis a všechny tři odstavce pod ním.',
      'Klikni do nadpisu a stiskni „Na střed“. Pak klikni do každého odstavce a stiskni „Vlevo“.'
    ],
    successExplanation: 'Na střed se zarovnávají krátké nadpisy, delší text vlevo. Míchat zarovnání bez důvodu působí neuspořádaně.'
  },

  /* ===================== POKROČILÝ ===================== */
  {
    id: 'rozbita-reportaz', title: 'Rozbitá reportáž', grade: 7, difficulty: 'pokrocily',
    story: 'Při kopírování se reportáž ze Dne Země přeházela. Čtenář nepozná, co se dělo ráno a co odpoledne.',
    instructions: 'Seřaď pět odstavců tak, aby šly časově po sobě a text dával smysl. Nadpis zůstane nahoře.',
    initialDocument: [
      { id: 'h', type: 'heading1', text: 'Den Země na naší škole' },
      { id: 'c', text: 'Kolem poledne jsme se vrátili do školy na oběd. V jídelně čekala polévka z místní zeleniny a jablečný koláč.' },
      { id: 'a', text: 'Den Země jsme letos oslavili celodenní akcí. Ráno se všechny třídy sešly na školním hřišti, kde nás paní ředitelka seznámila s programem.' },
      { id: 'e', text: 'Na závěr jsme si slíbili, že stromky budeme celý rok zalévat. Za rok se podíváme, kolik jich vyrostlo.' },
      { id: 'b', text: 'Potom se třídy rozdělily na stanoviště. Šesťáci sázeli stromky za tělocvičnou, sedmáci čistili okolí potoka a osmáci stavěli budky pro ptáky.' },
      { id: 'd', text: 'Odpoledne jsme výsledky práce představili ostatním. Nejvíc potlesku sklidila třída 8.B za budku ve tvaru školy.' }
    ],
    objectives: [
      { kind: 'first', block: 'h', label: 'Nadpis je na začátku' },
      { kind: 'order', blocks: ['a', 'b', 'c'], label: 'Ráno → stanoviště → oběd' },
      { kind: 'order', blocks: ['c', 'd', 'e'], label: 'Oběd → odpoledne → závěr' },
      { kind: 'order', blocks: ['a', 'b', 'c', 'd', 'e'], adjacent: true, label: 'Všech pět odstavců jde po sobě' }
    ],
    hints: [
      'Reportáž vypráví události v čase. Hledej slova, která čas prozrazují.',
      'Všímej si začátků odstavců: Ráno, Potom, Kolem poledne, Odpoledne, Na závěr.',
      'Klikni do odstavce „Den Země jsme letos…“ a tlačítkem „Posunout nahoru“ ho dej hned pod nadpis. Pak pokračuj odstavcem „Potom…“.'
    ],
    successExplanation: 'Odstavce mají návaznost. Pořadí měníš přesunem celého odstavce, ne přepisováním textu.'
  },
  {
    id: 'skolni-pravidla', title: 'Školní pravidla', grade: 7, difficulty: 'pokrocily',
    story: 'Postup při požárním poplachu visí v každé třídě. Kroky jsou ale přeházené a nejsou očíslované.',
    instructions: 'Seřaď pět kroků do správného pořadí a převeď je na číslovaný seznam. Úvodní věta zůstane odstavcem.',
    initialDocument: [
      { id: 'h', type: 'heading1', text: 'Co dělat při požárním poplachu' },
      { id: 'p', text: 'Když zazní siréna, postupuj takto:' },
      { id: 's3', text: 'Seřaď se ve dvojicích u dveří třídy.' },
      { id: 's1', text: 'Přeruš práci a zachovej klid.' },
      { id: 's5', text: 'Na shromaždišti počkej, až tě vyučující spočítá.' },
      { id: 's2', text: 'Zavři okna, dveře nezamykej.' },
      { id: 's4', text: 'Za vyučujícím odejdi nejkratší cestou ven z budovy.' }
    ],
    objectives: [
      { kind: 'list', blocks: ['s1', 's2', 's3', 's4', 's5'], list: 'number', ordered: true, label: 'Kroky tvoří číslovaný seznam ve správném pořadí' },
      { kind: 'type', block: 'p', type: 'paragraph', label: 'Úvodní věta zůstala odstavcem' },
      { kind: 'first', block: 'h', label: 'Nadpis je na začátku' }
    ],
    hints: [
      'Když na pořadí záleží (postup, návod), použij číslovaný seznam.',
      'Logika: nejdřív přestat pracovat, pak zavřít okna, seřadit se, odejít a nakonec počkat na shromaždišti.',
      'Přesuň krok „Přeruš práci…“ hned pod úvodní větu (Posunout nahoru), pak seřaď ostatní. Nakonec do každého kroku klikni a stiskni Číslování.'
    ],
    successExplanation: 'Číslovaný seznam je pro postupy, kde záleží na pořadí. Odrážky jsou pro výčty, kde nezáleží.'
  },
  {
    id: 'obrazek-na-uteku', title: 'Obrázek na útěku', grade: 7, difficulty: 'pokrocily',
    story: 'Článku o školní zahradě utekl obrázek. Bez něj si čtenáři neumí představit, jak nové záhony vypadají.',
    instructions: 'Vlož ilustraci „Záhon se zeleninou“ hned za odstavec o záhonech, umísti ji na střed a napiš popisek (aspoň 3 slova), který říká, co je na obrázku.',
    initialDocument: [
      { id: 'h', type: 'heading1', text: 'Školní zahrada se probouzí' },
      { id: 'p1', text: 'Na jaře jsme ve školní zahradě odstranili staré listí a opravili plot.' },
      { id: 'p2', text: 'Největší radost máme z nových vyvýšených záhonů. Pěstujeme v nich ředkvičky, salát a bylinky na čaj.' },
      { id: 'p3', text: 'Zahrada je otevřená každé úterý odpoledne. Pomoct může kdokoli.' }
    ],
    objectives: [
      { kind: 'image', src: 'zahon', label: 'Je vložená ilustrace „Záhon se zeleninou“' },
      { kind: 'image', src: 'zahon', after: 'p2', label: 'Obrázek je hned za odstavcem o záhonech' },
      { kind: 'image', src: 'zahon', position: 'center', label: 'Obrázek je umístěný na střed' },
      { kind: 'caption', src: 'zahon', minWords: 3, mustInclude: ['záhon', 'zelenin', 'ředkv', 'salát', 'bylin', 'zahrad'], label: 'Popisek má aspoň 3 slova a říká, co je na obrázku' }
    ],
    hints: [
      'Obrázek patří k textu, o kterém mluví. Popisek čtenáři řekne, co na obrázku vidí.',
      'Obrázek patří za druhý odstavec („Největší radost máme…“).',
      'Klikni do odstavce „Největší radost…“, stiskni Vložit obrázek a vyber „Záhon se zeleninou“. Klikni do popisku pod obrázkem a napiš třeba „Nové záhony se zeleninou“.'
    ],
    successExplanation: 'Obrázek vkládej k místu, o kterém text mluví, a vždy mu dej popisek. Popisek pomáhá i lidem, kteří obrázek nevidí.'
  },
  {
    id: 'typograficky-audit', title: 'Typografický audit', grade: 7, difficulty: 'pokrocily',
    story: 'Plakát na turnaj ve florbale psal někdo ve spěchu. Mezery jsou všude jinde, než mají být.',
    instructions: 'Oprav mezery: před tečkou, čárkou a vykřičníkem mezera není, za nimi ano. Nikde nesmí být dvě mezery za sebou. Datum piš s mezerami (15. 10. 2026).',
    initialDocument: [
      { id: 'h', type: 'heading1', text: 'Turnaj ve florbale' },
      { id: 'p1', text: 'Ve středu  15.10.2026 se v tělocvičně koná turnaj ve florbale .' },
      { id: 'p2', text: 'Hrají se zápasy pětičlenných týmů,každý tým má aspoň jednu dívku .' },
      { id: 'p3', text: 'Přihlášky odevzdejte do pátku  10.10.2026 u třídní učitelky !' },
      { id: 'p4', text: 'Vstup pro diváky je zdarma.Přijďte fandit !' }
    ],
    objectives: [
      { kind: 'typo', rule: 'doubleSpace', label: 'Žádné dvě mezery za sebou' },
      { kind: 'typo', rule: 'spaceBeforePunct', label: 'Před . , ! není mezera' },
      { kind: 'typo', rule: 'spaceAfterPunct', label: 'Za čárkou a tečkou na konci věty je mezera' },
      { kind: 'typo', rule: 'date', label: 'Data jsou zapsaná s mezerami' },
      { kind: 'contains', block: 'p1', text: '15. 10. 2026', label: 'Datum turnaje: 15. 10. 2026' },
      { kind: 'contains', block: 'p3', text: '10. 10. 2026', label: 'Termín přihlášek: 10. 10. 2026' }
    ],
    hints: [
      'V češtině se interpunkce „lepí“ ke slovu před sebou a za ní následuje mezera. Datum má mezeru za každou tečkou.',
      'Chyby jsou ve všech čtyřech odstavcích pod nadpisem: dvojité mezery, mezera před tečkou/vykřičníkem, chybějící mezera za čárkou a tečkou, data.',
      'Klikni do textu a oprav ho klávesnicí: smaž mezeru před „.“ a „!“, přidej mezeru za „,“ v „týmů,každý“ a za „zdarma.“, z „15.10.2026“ udělej „15. 10. 2026“.'
    ],
    successExplanation: 'Typografie není drobnost: správné mezery dělají text čitelnější a profesionálnější. Datum se píše 15. 10. 2026.'
  },

  /* ===================== EXPERT ===================== */
  {
    id: 'clanek-do-casopisu', title: 'Článek do časopisu', grade: 7, difficulty: 'expert',
    story: 'Článek o úspěchu robotického kroužku dorazil jako jeden dlouhý neformátovaný text. Za hodinu se tiskne.',
    instructions: 'Uprav článek podle kontrolního seznamu: nadpisy, seznam, obrázek s popiskem, zvýraznění a zarovnání. Kontrola ti po každém kole ukáže, co ještě chybí.',
    initialDocument: [
      { id: 't', text: 'Šroubci vyhráli krajské kolo' },
      { id: 'sub', text: 'Robotický kroužek slaví první velký úspěch' },
      { id: 'p1', text: 'Tým Šroubci z kroužku robotiky zvítězil v krajském kole soutěže Robotiáda. Jejich robot zvládl dráhu nejrychleji ze všech dvanácti týmů.', align: 'justify' },
      { id: 's1', text: 'Jak se připravovali' },
      { id: 'p2', text: 'Členové týmu se scházeli dvakrát týdně. Robota postavili ze stavebnice a naprogramovali v blokovém jazyce.', align: 'center' },
      { id: 'p3', text: 'Co jejich robot umí:' },
      { id: 'l1', text: 'senzorem sleduje černou čáru' },
      { id: 'l2', text: 'motory řídí jednoduchý program' },
      { id: 'l3', text: 'baterie vydrží celý závod' },
      { id: 's2', text: 'Co je čeká dál' },
      { id: 'p4', text: 'V květnu pojedou Šroubci na celostátní finále. Držte jim palce!', align: 'right' }
    ],
    objectives: [
      { kind: 'type', block: 't', type: 'heading1', label: 'Titul má styl Nadpis 1' },
      { kind: 'align', block: 't', align: 'center', label: 'Titul je na střed' },
      { kind: 'type', block: 'sub', type: 'heading2', label: 'Podtitul má styl Nadpis 2' },
      { kind: 'align', block: 'sub', align: 'center', label: 'Podtitul je na střed' },
      { kind: 'type', block: 's1', type: 'heading2', label: '„Jak se připravovali“ je Nadpis 2' },
      { kind: 'type', block: 's2', type: 'heading2', label: '„Co je čeká dál“ je Nadpis 2' },
      { kind: 'list', blocks: ['l1', 'l2', 'l3'], list: 'bullet', ordered: true, label: 'Vlastnosti robota tvoří odrážkový seznam' },
      { kind: 'image', src: 'robot', after: 'p1', label: 'Ilustrace robota je hned za prvním odstavcem' },
      { kind: 'caption', src: 'robot', minWords: 3, mustInclude: ['robot'], label: 'Obrázek má popisek se slovem „robot“' },
      { kind: 'mark', block: 'p1', text: 'Šroubci', mark: 'b', label: 'Název týmu v prvním odstavci je tučně' },
      { kind: 'alignOthers', except: ['t', 'sub'], align: 'left', label: 'Ostatní text je zarovnaný vlevo' },
      { kind: 'countType', type: 'heading1', count: 1, label: 'V článku je jen jeden Nadpis 1' }
    ],
    hints: [
      'Článek má jasnou hierarchii: titul → podtitul → podnadpisy kapitol → text. Každá úroveň má svůj styl.',
      'Začni nadpisy (první dva řádky a dva krátké řádky uprostřed), pak seznam, obrázek a zarovnání.',
      'Styly: titul Nadpis 1, podtitul a oba podnadpisy Nadpis 2. Tři řádky pod „Co jejich robot umí:“ → Odrážky. Klikni do prvního odstavce → Vložit obrázek → Soutěžní robot → popisek. Označ „Šroubci“ v prvním odstavci → B. Zarovnání zkontroluj u každého bloku.'
    ],
    successExplanation: 'Dobře naformátovaný článek má hierarchii nadpisů, krátké seznamy, obrázek s popiskem a střídmé zvýraznění.'
  },
  {
    id: 'redaktor-pod-tlakem', title: 'Redaktor pod tlakem', grade: 7, difficulty: 'expert', noHints: true,
    story: 'Šéfredaktorka je nemocná a článek o knihovně musíš zkontrolovat sám. Najdi všechny chyby – kontrola ti řekne jen, kolik jich zbývá.',
    instructions: 'Oprav článek tak, aby byl čitelný a sémanticky správný: styly nadpisů, seznam, pořadí, typografie, zvýraznění a obrázek. Nápověda tu není.',
    initialDocument: [
      { id: 't', text: 'Knihovna má nové knihy', bold: ['Knihovna má nové knihy'] },
      { id: 'p1', text: 'Od pondělí  si můžete půjčit přes sto nových titulů . Knihy vybírali sami žáci v anketě.' },
      { id: 's1', text: 'Co je nového' },
      { id: 'p2', text: 'Nejvíc hlasů dostaly tyto žánry:' },
      { id: 'l1', text: 'komiksy' },
      { id: 'l2', text: 'detektivky' },
      { id: 'l3', text: 'knihy o přírodě' },
      { id: 'p3', text: 'Knihovna je otevřená v úterý a ve čtvrtek od 12:30 do 14:00. Výpůjčka trvá tři týdny,pak je potřeba knihu vrátit.' },
      { id: 's2', text: 'Kdy je otevřeno' },
      { id: 'p4', text: 'Slavnostní otevření nového oddělení proběhne 3.11.2026 ve velké přestávce.', bold: ['Slavnostní otevření nového oddělení proběhne 3.11.2026 ve velké přestávce.'] },
      { id: 'img', type: 'image', src: 'knihy', caption: '', position: 'right' }
    ],
    objectives: [
      { kind: 'type', block: 't', type: 'heading1', label: 'Titul je Nadpis 1' },
      { kind: 'type', block: 's1', type: 'heading2', label: '„Co je nového“ je Nadpis 2' },
      { kind: 'type', block: 's2', type: 'heading2', label: '„Kdy je otevřeno“ je Nadpis 2' },
      { kind: 'list', blocks: ['l1', 'l2', 'l3'], list: 'bullet', ordered: true, label: 'Žánry tvoří odrážkový seznam' },
      { kind: 'order', blocks: ['s2', 'p3'], adjacent: true, label: 'Otevírací doba je pod nadpisem „Kdy je otevřeno“' },
      { kind: 'typo', rule: 'doubleSpace', label: 'Žádné dvojité mezery' },
      { kind: 'typo', rule: 'spaceBeforePunct', label: 'Žádná mezera před tečkou' },
      { kind: 'typo', rule: 'spaceAfterPunct', label: 'Mezera za čárkou' },
      { kind: 'typo', rule: 'date', label: 'Datum s mezerami' },
      { kind: 'noMark', mark: 'b', blocks: ['p1', 'p2', 'p3', 'p4'], label: 'Běžný text není celý tučně' },
      { kind: 'caption', src: 'knihy', minWords: 3, mustInclude: ['knih', 'regál', 'polic', 'knihovn'], label: 'Obrázek má popisek' },
      { kind: 'image', src: 'knihy', position: 'center', label: 'Obrázek je na střed' }
    ],
    hints: [],
    successExplanation: 'Redaktor kontroluje strukturu (nadpisy, seznamy, pořadí), typografii i obrázky. Celý článek je opravený – to je práce profesionála.'
  }
];
