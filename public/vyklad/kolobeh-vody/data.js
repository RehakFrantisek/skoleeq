// Obsah výkladu „Kde byla tahle kapka včera?“ (koloběh vody, 6. ročník).
// Zdroje: Umíme fakta – Voda: základy a koloběh; Umíme fakta – Využívání vody;
// ZŠ Kunratice – Zeměpis 6, 7. týden „Kbelík vody“; Naučme – Mezipředmětový projekt Voda;
// Učíme o klimatu – Voda kolem nás. Výpar z listů rostlin je obecné školní učivo.
window.OBSAH = {
  route: [
    { name: 'Moře', note: 'odtud kapka vyrazí' },
    { name: 'Oblak', note: 'pára zkapalní' },
    { name: 'Hory', note: 'srážky' },
    { name: 'Řeka', note: 'cesta zpátky do moře' },
  ],

  // Umíme fakta: „asi 97 % vody na Zemi je slaná“
  salty: 97,

  states: [
    { max: 0, id: 'led', name: 'Led (pevné skupenství)', text: 'Pod 0 °C voda zamrzne. Led je lehčí než kapalná voda (má menší hustotu), proto plave na hladině.' },
    { max: 100, id: 'voda', name: 'Voda (kapalné skupenství)', text: 'Mezi 0 °C a 100 °C je voda kapalná. Vypařuje se z hladiny i bez varu, třeba z louže nebo z prádla na šňůře.' },
    { max: 999, id: 'para', name: 'Vodní pára (plynné skupenství)', text: 'Při 100 °C voda vře: vypařuje se v celém objemu. Pára sama o sobě je neviditelná.' },
  ],

  evaporation: [
    '☀️ Slunce ohřívá hladinu moří, jezer i řek.',
    '💨 Voda se vypařuje i bez varu a jako neviditelná pára stoupá vzhůru.',
    '🧂 Sůl se nevypaří, zůstane v moři. Proto jsou oblaka ze sladké vody.',
    '🌳 Pára stoupá i z listů rostlin.',
  ],

  precipitation: [
    { text: '🌧️ Déšť', answer: 'kapalne', why: 'Kapky vody padající z oblaku.' },
    { text: '🌫️ Mlha', answer: 'kapalne', why: 'Drobounké kapičky vody vznášející se u země.' },
    { text: '❄️ Sníh', answer: 'pevne', why: 'Ledové krystalky, které padají z oblaku.' },
    { text: '⚪ Krupky', answer: 'pevne', why: 'Malé ledové kuličky.' },
    { text: '🧊 Led na rybníce', answer: 'pevne', why: 'Zamrzlá voda, plave na hladině.' },
    { text: '💨 Vodní pára ve vzduchu', answer: 'plynne', why: 'Neviditelný plyn. Když se ochladí, zkapalní.' },
  ],

  // Krajina zleva doprava. Souřadnice ve viewBoxu 0..2400.
  zones: [
    { id: 'more', name: 'Moře', from: 0, to: 420, text: 'Nad mořem se voda vypařuje a pára stoupá vzhůru.' },
    { id: 'pobrezi', name: 'Nad pevninou', from: 420, to: 820, text: 'Vítr žene oblak nad pevninu. Pára se ve výšce ochlazuje a kapalní.' },
    { id: 'hory', name: 'Hory', from: 820, to: 1280, text: 'Z oblaku padají srážky: v létě déšť, v zimě sníh.' },
    { id: 'les', name: 'Les a louka', from: 1280, to: 1720, text: 'Voda, která dopadne na zem, se buď znovu vypaří, nebo prosákne do země, nebo steče do potoka.' },
    { id: 'reka', name: 'Řeka', from: 1720, to: 2160, text: 'Potoky se spojují v řeky a ty vedou vodu zpátky do moří a oceánů.' },
    { id: 'navrat', name: 'Zpátky v moři', from: 2160, to: 2400, text: 'Kapka je zase v moři. Koloběh může začít znovu.' },
  ],

  underground: [
    { id: 'povrch', name: 'Povrch', color: 'transparent', height: 0.5, text: 'Prší. Část vody steče po povrchu, část se vsákne. Posouvej a jdi s kapkou do hloubky.' },
    { id: 'puda', name: 'Půda', color: '#4a3322', height: 0.8, text: 'Voda prosakuje půdou mezi zrnky, kolem kořenů a chodbiček žížal. Kořeny si z ní berou vodu.' },
    { id: 'strk', name: 'Písek a štěrk', color: '#b99c6b', height: 0.8, text: 'Mezi zrnky písku a štěrku je hodně místa, voda jimi prosakuje snadno. Zároveň se cestou čistí, podobně jako ve filtru.' },
    { id: 'hornina', name: 'Hornina s puklinami', color: '#7d7c77', height: 0.9, text: 'Podzemní voda vyplňuje dutiny a pukliny v horninách. Rozpouští z nich minerální látky.' },
    { id: 'mineralka', name: 'Minerální voda', color: '#5d6f7a', height: 0.8, text: 'Podzemní voda stálého složení se nazývá minerální. Kvůli těsnému kontaktu s horninou v ní bývá víc rozpuštěných látek, někdy i oxid uhličitý.' },
  ],

  tapSteps: [
    { id: 'zdroj', icon: '⛰️', name: 'Zdroj', text: 'Pitná voda se získává z podzemních i povrchových vod. Podzemní voda má stálejší složení, povrchovou je obvykle nutné vyčistit.' },
    { id: 'upravna', icon: '🏭', name: 'Úpravna', text: 'Usazování odstraní hrubé nečistoty (kal), filtrace přes písek zachytí drobné částice, dezinfekce (chlorem, ozonem nebo UV zářením) zničí mikroorganismy.' },
    { id: 'kohoutek', icon: '🚰', name: 'Kohoutek', text: 'Vodovodem se v Česku rozvádí pitná voda. Je zdravotně nezávadná, proto má smysl pít vodu z kohoutku místo balené.' },
    { id: 'odpad', icon: '🚽', name: 'Odpadní voda', text: 'Použitím a znečištěním pitné nebo užitkové vody vzniká odpadní voda.' },
    { id: 'cov', icon: '🦠', name: 'Čistírna (ČOV)', text: 'Mechanické čištění odstraní písek a nečistoty přes česle a síta. Pak bakterie rozloží organické látky. Ze zbylého kalu může vzniknout bioplyn nebo hnojivo.' },
    { id: 'zpet', icon: '🏞️', name: 'Řeka', text: 'Vyčištěná voda se vrací do řeky a pokračuje v koloběhu.' },
  ],

  mission: [
    'Slunce ohřeje moře a voda se vypaří.',
    'Pára stoupá a ve výšce se ochlazuje.',
    'Pára zkapalní a vznikne oblak.',
    'Z oblaku padají srážky.',
    'Voda steče do řeky nebo prosákne do země.',
    'Řeka donese vodu zpátky do moře.',
  ],

  quiz: [
    { q: 'Hydrosféra je…', a: ['vodní obal Země', 'vzdušný obal Země'], ok: 0 },
    { q: 'Kolik vody na Zemi je slané?', a: ['asi polovina', 'asi 97 %'], ok: 1 },
    { q: 'Proč led plave na hladině?', a: ['má menší hustotu než voda', 'je těžší než voda'], ok: 0 },
    { q: 'Když se vypařuje mořská voda, sůl…', a: ['odletí do oblaku', 'zůstane v moři'], ok: 1 },
    { q: 'Kapalnění vodní páry se jinak řekne…', a: ['kondenzace', 'sublimace'], ok: 0 },
    { q: 'Sníh a krupky jsou voda ve skupenství…', a: ['plynném', 'pevném'], ok: 1 },
    { q: 'Podzemní voda vyplňuje…', a: ['dutiny a pukliny v horninách', 'jen jeskyně'], ok: 0 },
    { q: 'Odpadní vodu z obcí čistí…', a: ['úpravna pitné vody', 'čistírna odpadních vod (ČOV)'], ok: 1 },
  ],
};
