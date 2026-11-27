// Obsah výkladu „Jak se schovává zpráva“. Texty a úlohy jsou oddělené od kódu scén.
window.OBSAH = {
  stations: [
    { id: 'sparta', name: 'Sparta', note: 'skytala' },
    { id: 'rim', name: 'Řím', note: 'Caesarova šifra' },
    { id: 'telegraf', name: 'Telegraf', note: 'Morseova abeceda' },
    { id: 'pocitac', name: 'Počítač', note: 'nuly a jedničky' },
  ],

  codeOrCipher: [
    { text: 'Morseova abeceda', answer: 'kod', why: 'Tečky a čárky zná každý, kdo má tabulku. Nic netají, jen převádí.' },
    { text: 'Caesarova šifra', answer: 'sifra', why: 'Bez znalosti posunu (klíče) zprávu nepřečteš.' },
    { text: 'QR kód', answer: 'kod', why: 'Přečte ho každý mobil. Je to jen jiný zápis.' },
    { text: 'Skytala', answer: 'sifra', why: 'Klíčem je hůl správné tloušťky.' },
    { text: 'Braillovo písmo', answer: 'kod', why: 'Písmo pro nevidomé: veřejně známý zápis bodů.' },
    { text: 'Písmena jako nuly a jedničky', answer: 'kod', why: 'Tabulku zná každý počítač, nic se tím netají.' },
  ],

  // Skytala: zpráva se píše po řádcích podél hole, páska se čte po otočkách
  scytale: { rows: 4, text: 'ZITRAVSEDMUMOSTU', reading: 'ZÍTRA V SEDM U MOSTU' },

  caesar: {
    challenge: 'YHQL YLGL YLFL',
    key: 3,
    solved: 'VENI VIDI VICI – přišel jsem, viděl jsem, zvítězil jsem. Tak prý Caesar oznámil své vítězství.',
  },

  // Šifrovaný text se spočítá ve scéně z otevřeného textu a klíče
  brute: { plain: 'TAHLE SIFRA NEMA SANCI', key: 12 },

  morse: {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
    K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  },
  morseBroadcasts: ['SOS', 'AHOJ'],

  mission: [
    { id: 'caesar', title: 'Zámek 1 · Caesar (posun 3)', clue: 'VSD', answer: 'SPA', hint: 'Každé písmeno posuň o 3 zpátky: V → S.' },
    { id: 'morse', title: 'Zámek 2 · Morseovka', clue: '.-.   -', answer: 'RT', hint: 'Krátká, dlouhá, krátká je R. Jedna čárka je T.' },
    { id: 'binary', title: 'Zámek 3 · Nuly a jedničky', clue: '01000001', answer: 'A', hint: '01000001 je 65, a 65 je velké písmeno A.' },
  ],
  missionWord: 'SPARTA',

  quiz: [
    { q: 'Morseova abeceda je…', a: ['kód', 'šifra'], ok: 0 },
    { q: 'U skytaly je klíčem…', a: ['barva pásku', 'tloušťka hole'], ok: 1 },
    { q: 'Caesar posune písmena o 3. Slovo VENI se zašifruje jako…', a: ['YHQL', 'SBKF'], ok: 0 },
    { q: 'Kolik posunů musíš vyzkoušet, abys Caesarovu šifru (26 písmen) určitě prolomil?', a: ['asi tisíc', '25'], ok: 1 },
    { q: 'Velké písmeno A je v počítači (v tabulce ASCII) číslo…', a: ['65', '1'], ok: 0 },
    { q: 'Zámek u adresy webu znamená, že…', a: ['web je určitě poctivý', 'spojení s webem je šifrované'], ok: 1 },
  ],
};
