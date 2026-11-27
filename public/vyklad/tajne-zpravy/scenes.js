// Scény výkladu „Jak se schovává zpráva“.
(function () {
  'use strict';
  const O = window.OBSAH;
  const V = window.Vyklad;
  const { el, svg, rng } = window.Kit;
  const { seg, clamp } = V;
  const $ = (id) => document.getElementById(id);
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const clean = (s) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shift = (s, k) => clean(s).replace(/[A-Z]/g, (c) => ABC[(ABC.indexOf(c) + k + 2600) % 26]);

  /* ---------- 0 · Úvod: obálka putuje po mapě ---------- */
  (function uvod() {
    const map = $('introMap');
    const defs = svg('defs');
    const g = svg('radialGradient', { id: 'parch', cx: '50%', cy: '45%', r: '75%' });
    g.append(svg('stop', { offset: 0, 'stop-color': '#fbf4e4' }), svg('stop', { offset: 1, 'stop-color': '#e6d3ad' }));
    defs.append(g);
    map.append(defs, svg('rect', { width: 1200, height: 700, fill: 'url(#parch)' }));
    const r = rng(5);
    for (let i = 0; i < 14; i++) {
      map.append(svg('path', { d: `M${r() * 1200} ${r() * 700} q ${40 + r() * 80} ${-20 - r() * 30} ${120 + r() * 120} 0`, stroke: '#cdb68a', 'stroke-width': 3, fill: 'none', opacity: 0.6 }));
    }
    const pts = [[170, 590], [540, 530], [830, 330], [1070, 170]];
    const d = 'M170 590 C 300 560, 420 530, 540 530 S 760 340, 830 330 S 1010 190, 1070 170';
    map.append(svg('path', { d, stroke: '#b89b6a', 'stroke-width': 6, fill: 'none', 'stroke-dasharray': '4 14', 'stroke-linecap': 'round' }));
    const trail = svg('path', { d, stroke: '#7a4b1c', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' });
    map.append(trail);
    const len = trail.getTotalLength();
    trail.setAttribute('stroke-dasharray', `${len} ${len}`);
    const icons = ['🏛️', '🏺', '📡', '💻'];
    const fracs = pts.map(([x, y]) => {
      let best = 0, bd = Infinity;
      for (let i = 0; i <= 300; i++) {
        const q = trail.getPointAtLength((i / 300) * len);
        const dd = (q.x - x) ** 2 + (q.y - y) ** 2;
        if (dd < bd) { bd = dd; best = i / 300; }
      }
      return best;
    });
    const stations = O.stations.map((s, i) => {
      const [x, y] = pts[i];
      const grp = svg('g', { class: 'station' });
      grp.append(svg('circle', { cx: x, cy: y, r: 34 }), svg('text', { x, y: y + 12, 'text-anchor': 'middle', 'font-size': 34 }, icons[i]),
        svg('text', { x, y: y + 66, 'text-anchor': 'middle', class: 'station__name' }, s.name));
      map.append(grp);
      return grp;
    });
    const env = svg('g', { class: 'envelope' });
    env.append(svg('rect', { x: -34, y: -22, width: 68, height: 44, rx: 6, fill: '#fffdf6', stroke: '#7a4b1c', 'stroke-width': 3 }),
      svg('path', { d: 'M-34 -22 L0 6 L34 -22', fill: 'none', stroke: '#7a4b1c', 'stroke-width': 3 }),
      svg('circle', { cx: 0, cy: 6, r: 8, fill: '#b3261e' }));
    map.append(env);
    const label = $('introStation');
    const text = document.querySelector('.intro__text');
    let lastI = -1;
    V.on('uvod', {
      stops: () => fracs,
      update(p) {
        const q = trail.getPointAtLength(p * len);
        env.setAttribute('transform', `translate(${q.x.toFixed(1)} ${(q.y - 46).toFixed(1)}) rotate(${(Math.sin(p * 20) * 6).toFixed(1)})`);
        trail.setAttribute('stroke-dashoffset', String(len * (1 - p)));
        let i = 0;
        fracs.forEach((f, j) => { if (p >= f - 0.02) i = j; });
        stations.forEach((s, j) => s.classList.toggle('is-on', j <= i));
        if (i !== lastI) {
          lastI = i;
          label.textContent = `${O.stations[i].name} · ${O.stations[i].note}`;
        }
        text.style.opacity = String(1 - seg(p, 0.75, 1) * 0.6);
      },
    });
  })();

  /* ---------- 1 · Kód, nebo šifra ---------- */
  window.Kit.sort($('sortBox'), {
    items: O.codeOrCipher,
    categories: [{ id: 'kod', label: '📖 Kód' }, { id: 'sifra', label: '🔑 Šifra' }],
    done: 'Rozdíl máš v malíčku.',
  });

  /* ---------- 2 · Skytala ---------- */
  (function skytala() {
    const { rows: k, text } = O.scytale;
    const c = text.length / k;
    // Páska nese písmena po sloupcích (po jedné otočce kolem hole)
    const order = [];
    for (let col = 0; col < c; col++) for (let r = 0; r < k; r++) order.push({ ch: text[r * c + col], row: r, col });
    const cipher = order.map((o) => o.ch).join('');
    const rod = $('scyRod');
    const view = document.querySelector('.scy__view');
    const stick = rod.querySelector('.scy__stick');
    for (let f = 0; f < k; f++) stick.append(el('div', { class: 'scy__face', style: `--f:${f}` }));
    const tiles = order.map((o) => {
      const t = el('span', { class: 'scy__tile' }, o.ch);
      rod.append(t);
      return { ...o, t };
    });
    const phase = $('scyPhase');
    const read = $('scyRead');
    let W = 48, H = 56, R = 28;
    function resize() {
      const vw = view.clientWidth;
      W = vw < 520 ? 34 : 48;
      H = vw < 520 ? 40 : 56;
      R = H / 2 / Math.tan(Math.PI / k);
      rod.style.setProperty('--w', `${W}px`);
      rod.style.setProperty('--h', `${H}px`);
      rod.style.setProperty('--r', `${R}px`);
      rod.style.setProperty('--len', `${c * W + 70}px`);
      const need = order.length * W * 0.95 + 20;
      view.style.setProperty('--fit', String(Math.min(1, vw / need)));
    }
    let lastMsg = '';
    function say(m) { if (m !== lastMsg) { lastMsg = m; phase.textContent = m; } }
    V.on('skytala', {
      resize,
      update(p) {
        const wrap = seg(p, 0.35, 0.62);
        const e = wrap * wrap * (3 - 2 * wrap);
        const turn = clamp((p - 0.66) / 0.113, 0, k - 1);
        const flat = Number(view.style.getPropertyValue('--fit')) || 1;
        const big = Math.min(2.2, (view.clientWidth * 0.55) / (c * W + 70));
        const fit = flat + (big - flat) * e;
        rod.style.transform = `scale(${fit.toFixed(3)}) rotateY(${(-22 * e).toFixed(1)}deg) rotateX(${(-90 * turn - 16 * e).toFixed(1)}deg)`;
        tiles.forEach((o, i) => {
          const fx = (i - (order.length - 1) / 2) * W * 0.95;
          const rx = (o.col - (c - 1) / 2) * W;
          const x = fx + (rx - fx) * e;
          const a = o.row * 90 * e;
          o.t.style.transform = `translateX(${x.toFixed(1)}px) rotateX(${a.toFixed(1)}deg) translateZ(${R.toFixed(1)}px)`;
          o.t.classList.toggle('is-front', p >= 0.64 && o.row === Math.round(turn));
        });
        stick.style.opacity = String(e);
        if (p < 0.33) {
          say('Posel nese pásek s písmeny. Kdo ho chytí, přečte jen změť.');
          read.textContent = cipher;
        } else if (p < 0.64) {
          say('Adresát má hůl přesně stejné tloušťky. Pásek na ni namotá…');
          read.textContent = '…';
        } else {
          const r = Math.round(turn);
          say(r < k - 1 ? '…a písmena se seřadí do řádků. Otáčej holí dál.' : 'Klíčem je tloušťka hole. Na tenčí nebo silnější holi by se písmena nesešla.');
          const rowsTxt = [];
          for (let j = 0; j <= r; j++) rowsTxt.push(text.slice(j * c, (j + 1) * c));
          read.textContent = r === k - 1 ? `${rowsTxt.join(' ')} → ${O.scytale.reading}` : rowsTxt.join(' ');
        }
      },
    });
  })();

  /* ---------- 3 · Caesarovo kolečko ---------- */
  (function caesar() {
    const w = $('wheel');
    const outer = svg('g', { class: 'wheel__outer' });
    const inner = svg('g', { class: 'wheel__inner' });
    w.append(svg('circle', { r: 155, class: 'wheel__bg-o' }), svg('circle', { r: 118, class: 'wheel__bg-i' }), outer, inner,
      svg('path', { d: 'M0 -158 L-12 -176 L12 -176 Z', class: 'wheel__mark' }));
    for (let i = 0; i < 26; i++) {
      const a = (i * 360) / 26;
      outer.append(svg('text', { transform: `rotate(${a}) translate(0 -132)`, class: 'wheel__l wheel__l--o', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, ABC[i]));
      inner.append(svg('text', { transform: `rotate(${a}) translate(0 -96)`, class: 'wheel__l wheel__l--i', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, ABC[i]));
    }
    w.append(svg('text', { class: 'wheel__hint', 'text-anchor': 'middle', y: -6 }, 'vnější: zpráva'), svg('text', { class: 'wheel__hint', 'text-anchor': 'middle', y: 14 }, 'vnitřní: šifra'));
    const range = $('keyRange');
    const out = $('keyOut');
    const plain = $('plainIn');
    const cOut = $('cipherOut');
    const ch = $('challenge');
    const chOut = $('challengeOut');
    const chFb = $('challengeFb');
    ch.textContent = O.caesar.challenge;
    function render() {
      const key = Number(range.value);
      out.textContent = String(key);
      inner.style.transform = `rotate(${(-key * 360) / 26}deg)`;
      w.setAttribute('aria-label', `Šifrovací kolečko s posunem ${key}: A se zašifruje jako ${ABC[key]}`);
      cOut.textContent = shift(plain.value, key) || '—';
      chOut.textContent = shift(O.caesar.challenge, -key);
      chFb.textContent = key === O.caesar.key ? `🎉 ${O.caesar.solved}` : '';
    }
    $('keyMinus').addEventListener('click', () => { range.value = String((Number(range.value) + 25) % 26); render(); });
    $('keyPlus').addEventListener('click', () => { range.value = String((Number(range.value) + 1) % 26); render(); });
    range.addEventListener('input', render);
    plain.addEventListener('input', render);
    render();
  })();

  /* ---------- 4 · Hrubá síla ---------- */
  (function brute() {
    const { plain, key } = O.brute;
    const cipher = shift(plain, key);
    const box = $('brute');
    const list = el('ol', { class: 'brute__list' });
    const rows = [];
    for (let k = 1; k <= 25; k++) {
      const li = el('li', { class: 'brute__row' }, el('span', { class: 'brute__k' }, `klíč ${k}`), el('span', { class: 'brute__t' }, shift(cipher, -k)));
      list.append(li);
      rows.push(li);
    }
    box.append(el('p', { class: 'brute__cipher' }, 'Zpráva: ', el('code', {}, cipher)), el('div', { class: 'brute__win' }, list));
    const keyEl = $('bruteKey');
    const fb = $('bruteFb');
    let last = -1;
    V.on('prolomeni', {
      stops: () => [0, (key - 1) / 24, 1],
      update(p) {
        const k = 1 + Math.round(p * 24);
        if (k === last) return;
        last = k;
        keyEl.textContent = String(k);
        rows.forEach((r, i) => {
          r.classList.toggle('is-current', i === k - 1);
          r.classList.toggle('is-tried', i < k - 1);
          r.classList.toggle('is-hit', i === key - 1 && k >= key);
        });
        const rowH = rows[0].offsetHeight || 34;
        list.style.transform = `translateY(${(-(k - 1) * rowH + rowH * 3).toFixed(0)}px)`;
        fb.textContent = k >= key ? `🔓 Klíč ${key}: „${plain}“` : '';
      },
    });
  })();

  /* ---------- 5 · Morseovka ---------- */
  (function morse() {
    const table = $('morseTable');
    const pretty = (s) => s.replace(/\./g, '·').replace(/-/g, '−');
    Object.entries(O.morse).forEach(([l, s]) => table.append(el('li', {}, el('b', {}, l), ' ', pretty(s))));
    const lamp = $('lamp');
    const now = $('morseNow');
    const fb = $('broadcastFb');
    const btn = $('broadcast');
    const reveal = $('reveal');
    let wi = 0, busy = false;
    const U = 200;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    btn.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      btn.disabled = true;
      reveal.hidden = true;
      fb.textContent = '';
      const word = O.morseBroadcasts[wi % O.morseBroadcasts.length];
      wi++;
      let shown = '';
      for (const letter of word) {
        for (const sym of O.morse[letter]) {
          shown += sym === '.' ? '·' : '−';
          now.textContent = shown;
          if (!V.reduceMotion()) {
            lamp.classList.add('is-on');
            await wait(sym === '.' ? U : U * 3);
            lamp.classList.remove('is-on');
            await wait(U);
          }
        }
        shown += '   ';
        now.textContent = shown;
        if (!V.reduceMotion()) await wait(U * 2);
      }
      fb.textContent = 'Co to bylo? Rozlušti to podle tabulky.';
      reveal.hidden = false;
      reveal.onclick = () => { fb.textContent = `Slovo: ${word}${word === 'SOS' ? ' (mezinárodní volání o pomoc)' : ''}`; };
      btn.disabled = false;
      busy = false;
    });

    // Telegrafní klíč
    const key = $('morseKey');
    const sig = $('tapSignal');
    const txt = $('tapText');
    const inv = Object.fromEntries(Object.entries(O.morse).map(([l, s]) => [s, l]));
    let start = 0, cur = '', text = '', timer;
    function down() {
      if (start) return;
      start = performance.now();
      clearTimeout(timer);
      key.classList.add('is-down');
      lamp.classList.add('is-on');
    }
    function up() {
      if (!start) return;
      const d = performance.now() - start;
      start = 0;
      key.classList.remove('is-down');
      lamp.classList.remove('is-on');
      cur += d < 250 ? '.' : '-';
      sig.textContent = pretty(cur);
      timer = setTimeout(() => {
        text += inv[cur] || '?';
        txt.textContent = text;
        cur = '';
        sig.textContent = '—';
      }, 800);
    }
    key.addEventListener('pointerdown', (e) => { e.preventDefault(); key.setPointerCapture(e.pointerId); down(); });
    key.addEventListener('pointerup', up);
    key.addEventListener('pointercancel', up);
    key.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); down(); } });
    key.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); up(); } });
    $('tapClear').addEventListener('click', () => { text = ''; cur = ''; txt.textContent = '—'; sig.textContent = '—'; });
  })();

  /* ---------- 6 · A → 65 → 01000001 ---------- */
  (function binar() {
    const bitsEl = $('binBits');
    const bits = (65).toString(2).padStart(8, '0').split('').map((b, i) => {
      const s = el('span', { class: 'bit' }, el('b', {}, b), el('small', {}, String(2 ** (7 - i))));
      bitsEl.append(s);
      return s;
    });
    const A = $('binA'), N = $('bin65'), cap = $('binCap');
    let lastCap = '';
    V.on('binar', {
      update(p) {
        const a = 1 - seg(p, 0.25, 0.35);
        const n = seg(p, 0.3, 0.4) * (1 - seg(p, 0.6, 0.7));
        const b = seg(p, 0.65, 0.75);
        A.style.opacity = String(a);
        A.style.transform = `scale(${(1 + (1 - a) * 0.4).toFixed(2)})`;
        N.style.opacity = String(n);
        N.style.transform = `scale(${(0.8 + n * 0.2).toFixed(2)})`;
        bitsEl.style.opacity = String(b);
        bits.forEach((s, i) => s.classList.toggle('is-on', p >= 0.68 + i * 0.03));
        const t = p < 0.33 ? 'Písmeno A…' : p < 0.66 ? '…má v tabulce ASCII číslo 65…' : '…a číslo 65 se zapíše osmi nulami a jedničkami: 64 + 1 = 65.';
        if (t !== lastCap) { lastCap = t; cap.textContent = t; }
      },
    });
  })();

  /* ---------- 7 · Vypínače ---------- */
  (function bity() {
    const box = $('bits');
    const sum = $('bitSum');
    const letter = $('bitLetter');
    const fb = $('bitFb');
    const state = [0, 0, 0, 0, 0, 0, 0, 0];
    const btns = state.map((_, i) => {
      const val = 2 ** (7 - i);
      const b = el('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': `Vypínač ${val}` },
        el('span', { class: 'switch__val' }, String(val)), el('span', { class: 'switch__bit' }, '0'));
      b.addEventListener('click', () => { state[i] ^= 1; render(); });
      box.append(b);
      return b;
    });
    function render() {
      let s = 0;
      btns.forEach((b, i) => {
        b.setAttribute('aria-checked', String(!!state[i]));
        b.querySelector('.switch__bit').textContent = String(state[i]);
        if (state[i]) s += 2 ** (7 - i);
      });
      sum.textContent = String(s);
      const ok = (s >= 65 && s <= 90) || (s >= 97 && s <= 122);
      letter.textContent = ok ? String.fromCharCode(s) : '—';
      fb.textContent = s === 75 ? ' 🎉 Hotovo: 64 + 8 + 2 + 1 = 75 = K' : '';
    }
    render();
  })();

  /* ---------- 8 · QR kód ---------- */
  (function qr() {
    const S = 25;
    const g = $('qrSvg');
    const kind = Array.from({ length: S }, () => Array(S).fill('data'));
    const dark = Array.from({ length: S }, () => Array(S).fill(false));
    function finder(x0, y0) {
      for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
        const X = x0 + x, Y = y0 + y;
        if (X < 0 || Y < 0 || X >= S || Y >= S) continue;
        kind[Y][X] = 'finder';
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        dark[Y][X] = x >= 0 && y >= 0 && x <= 6 && y <= 6 && ring !== 2;
      }
    }
    finder(0, 0); finder(S - 7, 0); finder(0, S - 7);
    for (let i = 8; i < S - 8; i++) {
      kind[6][i] = 'timing'; dark[6][i] = i % 2 === 0;
      kind[i][6] = 'timing'; dark[i][6] = i % 2 === 0;
    }
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      kind[18 + y][18 + x] = 'align';
      dark[18 + y][18 + x] = Math.max(Math.abs(x), Math.abs(y)) !== 1;
    }
    const r = rng(9);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (kind[y][x] === 'data') dark[y][x] = r() < 0.5;
    g.append(svg('rect', { x: -2, y: -2, width: S + 4, height: S + 4, fill: '#fff' }));
    g.setAttribute('viewBox', `-2 -2 ${S + 4} ${S + 4}`);
    const groups = {};
    ['data', 'finder', 'timing', 'align'].forEach((k) => { groups[k] = svg('g', { class: `qr__${k}` }); g.append(groups[k]); });
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (dark[y][x]) groups[kind[y][x]].append(svg('rect', { x, y, width: 1.02, height: 1.02 }));
    const sticker = svg('rect', { x: 10, y: 11, width: 6, height: 5, rx: 0.6, class: 'qr__sticker', opacity: 0 });
    g.append(sticker);
    const parts = [
      ['finder', 'Rohové čtverce', 'Podle tří velkých čtverců mobil pozná, kde kód je a jak je natočený. Proto jsou jen ve třech rozích.'],
      ['timing', 'Vodicí řady', 'Střídající se černé a bílé body pomáhají spočítat řádky a sloupce.'],
      ['align', 'Malý čtverec', 'Pomáhá přečíst kód, i když je vyfocený šikmo nebo trochu zkřivený.'],
      ['data', 'Data', 'Ostatní body nesou samotnou zprávu a k tomu kontrolní informace navíc, díky kterým jde opravit chyby.'],
    ];
    const box = $('qrParts');
    const info = $('qrInfo');
    parts.forEach(([k, label, text]) => {
      const b = el('button', { type: 'button', class: 'btn btn--sm', 'aria-pressed': 'false' }, label);
      b.addEventListener('click', () => {
        box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        g.dataset.hi = k;
        info.textContent = text;
      });
      box.append(b);
    });
    let on = false;
    $('qrSticker').addEventListener('click', (e) => {
      on = !on;
      sticker.setAttribute('opacity', on ? '1' : '0');
      e.currentTarget.textContent = on ? 'Sundat nálepku' : '🩹 Přelepit kus kódu';
      $('qrStickerInfo').textContent = on
        ? 'Díky opravným informacím jde QR kód přečíst, i když kus chybí. Podle zvolené úrovně opravy to může být zhruba 7 až 30 % kódu. Rohové čtverce ale zakrýt nesmíš.'
        : '';
    });
  })();

  /* ---------- 10 · Mise ---------- */
  (function mise() {
    const box = $('locks');
    const final = $('missionFinal');
    const opened = new Set();
    O.mission.forEach((m) => {
      const input = el('input', { type: 'text', id: `lock-${m.id}`, maxlength: 6, autocomplete: 'off', spellcheck: 'false' });
      const fb = el('p', { class: 'feedback', 'aria-live': 'polite' });
      const icon = el('span', { class: 'lock__icon', 'aria-hidden': 'true' }, '🔒');
      const open = el('button', { type: 'submit', class: 'btn btn--primary' }, 'Odemknout');
      const hint = el('button', { type: 'button', class: 'btn' }, 'Nápověda');
      const form = el('form', { class: 'card lock' },
        el('h3', {}, icon, ' ', m.title),
        el('p', { class: 'lock__clue' }, el('code', {}, m.clue)),
        el('label', { for: `lock-${m.id}` }, 'Odpověď'), input,
        el('div', { class: 'actions' }, open, hint), fb);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (opened.has(m.id)) return;
        if (clean(input.value).replace(/\s/g, '') === m.answer) {
          opened.add(m.id);
          icon.textContent = '🔓';
          form.classList.add('is-open');
          input.disabled = true;
          open.disabled = true;
          fb.textContent = `Odemčeno: ${m.answer}`;
          if (opened.size === O.mission.length) final.textContent = `🎉 Heslo zní ${O.missionWord}! Tam jsme dnes začali: u spartské skytaly.`;
        } else {
          fb.textContent = 'Ještě ne. Zkus to znovu, nebo si vezmi nápovědu.';
        }
      });
      hint.addEventListener('click', () => { fb.textContent = m.hint; });
      box.append(form);
    });
  })();

  /* ---------- 11 · Kvíz ---------- */
  window.Kit.quiz($('quiz'), O.quiz);

  V.start();
})();
