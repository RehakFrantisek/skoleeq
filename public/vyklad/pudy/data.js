// Obsah výkladu oddělený od kódu. Fakta pocházejí z podkladů uvedených v patičce.
// Barvy a krajina jsou ilustrační (zjednodušené pro ZŠ).
window.OBSAH = {
  horizons: [
    {
      id: 'povrch', name: 'Povrch', color: 'transparent', height: 0.5,
      text: 'Tady stojíme. Pod trávou a poli je tenký obal Země, kterému říkáme pedosféra neboli půdní obal. Posouvej dál a sestup do hloubky.',
      chips: ['pedosféra = půdní obal Země'],
    },
    {
      id: 'hrabanka', name: 'Hrabanka', color: '#6b4a26', height: 0.55,
      text: 'Nejsvrchnější vrstva: opadané listí, jehličí a zbytky rostlin. Tady začínají pracovat rozkladači.',
      chips: ['listí a zbytky rostlin', 'houby', 'brouci'],
      critters: ['🍂', '🍄', '🪲', '🍂', '🍁'],
    },
    {
      id: 'humus', name: 'Humus', color: '#2a1b12', height: 0.8,
      text: 'Tmavá vrstva plná živin. Humus vzniká z odumřelých organismů díky rozkladačům, třeba bakteriím a houbám. Je to nejúrodnější část půdy.',
      chips: ['nejúrodnější část', 'žížaly', 'rozkladači', 'kořeny'],
      critters: ['🪱', '🪱', '🐜', '🪱'],
    },
    {
      id: 'vrchni', name: 'Vrchní minerální půda', color: '#6f4f33', height: 0.8,
      text: 'Méně humusu, víc rozdrobených nerostů: zrnka písku a jílu a drobné kamínky. Sem ještě dosáhnou delší kořeny.',
      chips: ['zrnka písku a jílu', 'kamínky', 'kořeny'],
      critters: ['🐜'],
    },
    {
      id: 'spodni', name: 'Spodní minerální půda', color: '#9a7449', height: 0.8,
      text: 'Světlejší vrstva s větším množstvím kamenů. Života a humusu je tu už málo.',
      chips: ['víc kamenů', 'málo humusu'],
    },
    {
      id: 'hornina', name: 'Matečná hornina', color: '#85847f', height: 0.9,
      text: 'Nezvětralá hornina. Z ní půda kdysi vznikla a pomalu vzniká pořád: zvětráváním se rozpadá na menší a menší kousky.',
      chips: ['tady všechno začíná', 'zvětrávání'],
    },
  ],

  composition: [
    { id: 'nerosty', icon: '🪨', name: 'Pevné částice', text: 'Rozdrobené nerosty (minerály): zrnka písku, jílu a drobné kamínky. Uvidíš je i nahmatáš.' },
    { id: 'vzduch', icon: '💨', name: 'Půdní vzduch', text: 'Mezi zrnky jsou drobné póry se vzduchem. Dýchají ho kořeny i půdní živočichové.' },
    { id: 'voda', icon: '💧', name: 'Půdní voda', text: 'Voda s rozpuštěnými látkami, ze které rostliny berou živiny.' },
    { id: 'humus', icon: '🟫', name: 'Humus', text: 'Organická hmota z odumřelých organismů. Čím víc humusu, tím je půda úrodnější.' },
    { id: 'koreny', icon: '🌱', name: 'Kořeny', text: 'Kořeny drží půdu pohromadě a rozrušují horninu.' },
    { id: 'zivocichove', icon: '🪱', name: 'Živé organismy', text: 'Žížaly, brouci a další živočichové půdu provzdušňují a promíchávají.' },
    { id: 'rozkladaci', icon: '🦠', name: 'Mikroorganismy', text: 'Rozkladači (bakterie a houby) mění zbytky rostlin a živočichů na humus.' },
  ],

  textures: [
    {
      id: 'piscita', name: 'Písčitá', grain: 13, color: '#e0c48a', drain: 0.85, speed: 1.4,
      text: 'Velká zrnka, viditelná pouhým okem. Půda je lehká a sypká, špatně drží vodu i živiny. Zemědělci ji musí víc zalévat a hnojit.',
    },
    {
      id: 'hlinita', name: 'Hlinitá', grain: 7, color: '#a87a4c', drain: 0.45, speed: 3.2,
      text: 'Zrnka písku a jílu ve vyrovnaném poměru. Středně těžká půda, která udrží vodu i živiny. Zemědělci ji mají nejradši.',
    },
    {
      id: 'jilovita', name: 'Jílovitá', grain: 3, color: '#8a6a5a', drain: 0.12, speed: 6,
      text: 'Nejmenší zrnka, vidět jsou jen mikroskopem. Vodu nasaje a drží, je těžká a ulehlá. Zemědělci ji musí kypřit.',
    },
  ],

  // layers: [barva, tloušťka v %, popisek]
  types: [
    {
      id: 'cernozem', name: 'Černozem', top: '#4f7a2c', where: 'Hlavně v nížinách, na spraších.',
      layers: [['#1c140e', 48, 'tmavý humus'], ['#3a2a1d', 14, 'přechod'], ['#cdb27a', 38, 'spraš']],
      facts: ['Tmavá, bohatá na humus a živiny.', 'Nejúrodnější půda v Česku.'],
      grows: '🌾 pšenice · 🌽 kukuřice · cukrová řepa; v teplejších oblastech 🍇 vinná réva, 🍎 ovoce, zelenina, chmel',
      animals: '🐎 koně · 🐖 prasata · 🐓 drůbež',
    },
    {
      id: 'hnedozem', name: 'Hnědozem', top: '#6c8f36', where: 'V pahorkatinách, zhruba nad 200 m n. m.',
      layers: [['#4a3220', 22, 'humus'], ['#7d5634', 40, 'hnědá vrstva'], ['#b8936a', 38, 'podloží']],
      facts: ['Obsahuje méně humusu než černozem.', 'Je o něco méně úrodná, ale pořád dobrá pro zemědělství.'],
      grows: 'oves · len · řepka olejka · 🥔 brambory',
      animals: '🐄 krávy · 🐖 prasata · 🐟 ryby',
    },
    {
      id: 'kambizem', name: 'Kambizem', top: '#4d7d3a', where: 'Nejrozšířenější půda v Česku, hlavně na vrchovinách.',
      layers: [['#3d2b1c', 12, 'tenký humus'], ['#8a6236', 52, 'hnědá vrstva s kameny'], ['#86857f', 36, 'hornina']],
      facts: ['Dříve se jí říkalo hnědá půda.', 'Má málo humusu.'],
      stones: true,
    },
    {
      id: 'podzol', name: 'Podzol', top: '#3f6b3a', where: 'Častý na horách, pod jehličnatými lesy.',
      layers: [['#2a2018', 10, 'tenký humus'], ['#c9c3b6', 20, 'šedá vyluhovaná vrstva'], ['#9b5a2a', 30, 'rezavá vrstva'], ['#7d7c77', 40, 'hornina']],
      facts: ['Vyluhovaná, šedá půda s nízkým obsahem živin.', 'Neúrodná.'],
      grows: 'na horských loukách pastviny',
      animals: '🐑 ovce',
      stones: true,
    },
    {
      id: 'fluvizem', name: 'Fluvizem', top: '#5f9a46', where: 'V blízkosti velkých řek (nivní půda).',
      layers: [['#4a3a2a', 14, 'humus'], ['#8c7458', 12, 'naplavenina'], ['#b39a76', 10, 'písek'], ['#7a6650', 14, 'naplavenina'], ['#c2ab85', 12, 'písek'], ['#6e5c48', 38, 'náplavy']],
      facts: ['Nivní půda.', 'Vrstvy vznikají z usazenin, které řeka přinese při povodních.'],
    },
    {
      id: 'rendzina', name: 'Rendzina', top: '#5a8340', where: 'Na vápencovém nebo dolomitovém podkladu, v krasu.',
      layers: [['#2c2218', 22, 'tmavý humus s kamínky'], ['#e6e2d6', 78, 'vápenec']],
      facts: ['Vzniká na vápenci nebo dolomitu.', 'Najdeme ji v krasových oblastech.'],
      stones: true,
    },
  ],

  // Krajina zleva doprava: hory → řeka. Souřadnice ve viewBoxu 0..2400.
  zones: [
    { id: 'hory', name: 'Hory', from: 0, to: 560, soil: 'podzol', icons: ['🌲', '🐑', '🌲', '🐑'], note: 'Na horských loukách se pasou ovce.' },
    { id: 'vrchovina', name: 'Vrchovina', from: 560, to: 940, soil: 'kambizem', icons: ['🌲', '🌳', '🌲'], note: 'Kopce s lesy a loukami.' },
    { id: 'kras', name: 'Kras', from: 940, to: 1180, soil: 'rendzina', icons: ['🪨', '🌿'], note: 'Bílé vápencové skály, na nich tenká rendzina.' },
    { id: 'pahorkatina', name: 'Pahorkatina', from: 1180, to: 1650, soil: 'hnedozem', icons: ['🥔', '🐄', '🌼'], note: 'Brambory, oves, len, řepka olejka.' },
    { id: 'nizina', name: 'Nížina', from: 1650, to: 2180, soil: 'cernozem', icons: ['🌾', '🌽', '🍇', '🌾'], note: 'Pšenice, kukuřice, cukrová řepa i vinná réva.' },
    { id: 'niva', name: 'Niva řeky', from: 2180, to: 2400, soil: 'fluvizem', icons: ['🌳', '🦆'], note: 'Řeka při povodních ukládá nové vrstvy.' },
  ],

  quiz: [
    { q: 'Pedosféra je…', a: ['půdní obal Země', 'vzdušný obal Země'], ok: 0 },
    { q: 'Nejúrodnější část půdy je…', a: ['matečná hornina', 'humus'], ok: 1 },
    { q: 'Která půda má nejmenší zrnka?', a: ['jílovitá', 'písčitá'], ok: 0 },
    { q: 'Která půda špatně drží vodu, takže se musí zalévat?', a: ['jílovitá', 'písčitá'], ok: 1 },
    { q: 'Černozem najdeme hlavně…', a: ['v nížinách', 'na horách'], ok: 0 },
    { q: 'Podzol je…', a: ['nejúrodnější půda', 'vyluhovaná, málo úrodná půda'], ok: 1 },
    { q: 'Rendzina vzniká na…', a: ['vápenci nebo dolomitu', 'naplaveninách u řek'], ok: 0 },
    { q: '1 cm půdy vzniká v mírném pásu asi…', a: ['za 1–2 roky', 'za 100–150 let'], ok: 1 },
  ],
};
