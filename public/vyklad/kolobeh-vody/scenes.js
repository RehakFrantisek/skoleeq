// Scény výkladu „Kde byla tahle kapka včera?“ (koloběh vody).
(function () {
  'use strict';
  const O = window.OBSAH;
  const V = window.Vyklad;
  const { el, svg, rng } = window.Kit;
  const { seg, clamp } = V;
  const $ = (id) => document.getElementById(id);
  const drop = (x, y, s, fill) => svg('path', { d: `M${x} ${y - 14 * s} C${x + 9 * s} ${y - 2 * s} ${x + 9 * s} ${y + 8 * s} ${x} ${y + 8 * s} C${x - 9 * s} ${y + 8 * s} ${x - 9 * s} ${y - 2 * s} ${x} ${y - 14 * s}Z`, fill });

  /* ---------- 0 · Úvod: kapka obejde krajinu ---------- */
  (function uvod() {
    const m = $('introMap');
    const defs = svg('defs');
    const g = svg('linearGradient', { id: 'introSky', x1: 0, y1: 0, x2: 0, y2: 1 });
    g.append(svg('stop', { offset: 0, 'stop-color': '#8fd0f5' }), svg('stop', { offset: 1, 'stop-color': '#e9f6fb' }));
    defs.append(g);
    m.append(defs, svg('rect', { width: 1200, height: 700, fill: 'url(#introSky)' }));
    m.append(svg('circle', { cx: 1080, cy: 110, r: 55, fill: '#ffd66b' }));
    // pevnina s horami
    m.append(svg('path', { d: 'M380 600 C 520 560, 600 470, 700 400 L 800 260 L 860 300 L 930 190 L 1010 290 L 1080 230 L 1200 330 L 1200 700 L 380 700 Z', fill: '#6f9a52' }));
    m.append(svg('path', { d: 'M930 190 L 958 228 L 940 222 L 925 240 L 908 222 Z M800 260 L 822 288 L 798 282 L 786 292 Z', fill: '#fff' }));
    // řeka z hor do moře
    m.append(svg('path', { d: 'M960 300 C 900 380, 860 420, 760 470 S 560 560, 430 610', stroke: '#4aa3df', 'stroke-width': 14, fill: 'none', 'stroke-linecap': 'round' }));
    // moře
    m.append(svg('path', { d: 'M0 560 Q 100 545 200 560 T 400 560 L 460 620 L 460 700 L 0 700 Z', fill: '#2f7fc1' }));
    const cloud = svg('g', { class: 'intro__cloud' });
    [[420, 190, 46], [470, 170, 56], [530, 190, 44], [475, 205, 50]].forEach(([cx, cy, r]) => cloud.append(svg('circle', { cx, cy, r, fill: '#fff' })));
    m.append(cloud);
    const pts = [[210, 575], [470, 150], [930, 250], [700, 500]];
    const d = 'M210 575 C 190 420, 300 200, 470 150 S 860 120, 930 250 S 840 420, 700 500 S 380 640, 230 585';
    m.append(svg('path', { d, stroke: '#ffffff', 'stroke-width': 6, fill: 'none', 'stroke-dasharray': '4 14', 'stroke-linecap': 'round', opacity: 0.9 }));
    const trail = svg('path', { d, stroke: '#1b5f96', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' });
    m.append(trail);
    const len = trail.getTotalLength();
    trail.setAttribute('stroke-dasharray', `${len} ${len}`);
    const fracs = pts.map(([x, y]) => {
      let best = 0, bd = Infinity;
      for (let i = 0; i <= 300; i++) {
        const q = trail.getPointAtLength((i / 300) * len);
        const dd = (q.x - x) ** 2 + (q.y - y) ** 2;
        if (dd < bd) { bd = dd; best = i / 300; }
      }
      return best;
    });
    const stations = O.route.map((s, i) => {
      const [x, y] = pts[i];
      const grp = svg('g', { class: 'station' });
      grp.append(svg('circle', { cx: x, cy: y, r: 14 }), svg('text', { x, y: y + 44, 'text-anchor': 'middle', class: 'station__name' }, s.name));
      m.append(grp);
      return grp;
    });
    const kapka = svg('g', { class: 'kapka' });
    kapka.append(drop(0, 0, 2.2, '#3b9be0'), svg('circle', { cx: -6, cy: -4, r: 4, fill: '#fff', opacity: 0.8 }),
      svg('circle', { cx: -5, cy: 4, r: 2.4, fill: '#123' }), svg('circle', { cx: 6, cy: 4, r: 2.4, fill: '#123' }));
    m.append(kapka);
    const label = $('introStation');
    const text = document.querySelector('.intro__text');
    let last = '';
    // Na úzkém displeji se mapa posouvá za kapkou, aby neutekla z obrazovky
    let visW = 1200;
    function resize() {
      const box = m.getBoundingClientRect();
      visW = Math.min(1200, (700 * box.width) / Math.max(1, box.height));
    }
    V.on('uvod', {
      resize,
      stops: () => [0, ...fracs.slice(1), 1],
      update(p) {
        const q = trail.getPointAtLength(p * len);
        const vx = clamp(q.x - visW / 2, 0, 1200 - visW);
        m.setAttribute('viewBox', `${vx.toFixed(1)} 0 ${visW.toFixed(1)} 700`);
        kapka.setAttribute('transform', `translate(${q.x.toFixed(1)} ${(q.y - 30).toFixed(1)})`);
        trail.setAttribute('stroke-dashoffset', String(len * (1 - p)));
        let i = 0;
        fracs.forEach((f, j) => { if (p >= f - 0.02) i = j; });
        stations.forEach((s, j) => s.classList.toggle('is-on', j <= i));
        const t = p > 0.97 ? 'Zpátky v moři · a znovu dokola' : `${O.route[i].name} · ${O.route[i].note}`;
        if (t !== last) { last = t; label.textContent = t; }
        text.style.opacity = String(1 - seg(p, 0.03, 0.14));
        text.style.visibility = p > 0.15 ? 'hidden' : 'visible';
      },
    });
  })();

  /* ---------- 1 · 100 kapek ---------- */
  (function kapky() {
    const box = $('drops');
    const drops = Array.from({ length: 100 }, (_, i) => {
      const s = el('span', { class: 'drop' });
      s.style.setProperty('--i', i);
      box.append(s);
      return s;
    });
    // 3 sladké kapky jsou poslední tři
    const cap = $('dropsCap');
    let lastCap = '';
    V.on('kapky', {
      update(p) {
        const show = seg(p, 0, 0.3);
        const salt = Math.round(seg(p, 0.35, 0.7) * O.salty);
        drops.forEach((d, i) => {
          d.classList.toggle('is-in', i / 100 < show + 0.01);
          d.classList.toggle('is-salty', i < salt);
          d.classList.toggle('is-fresh', i >= O.salty && p > 0.75);
        });
        const t = p < 0.33 ? 'Představ si všechnu vodu na Zemi jako 100 kapek…'
          : p < 0.72 ? `…asi ${O.salty} z nich je slaných: voda v mořích a oceánech.`
          : `Sladká voda v řekách, jezerech, ledovcích a pod zemí jsou jen zbylé asi ${100 - O.salty} kapky.`;
        if (t !== lastCap) { lastCap = t; cap.textContent = t; }
      },
    });
  })();

  /* ---------- 2 · Skupenství ---------- */
  (function skupenstvi() {
    const range = $('temp');
    const out = $('tempOut');
    const view = $('stateView');
    const name = $('stateName');
    const text = $('stateText');
    const water = $('glassWater');
    const bubbles = $('bubbles');
    const steam = $('steam');
    const r = rng(4);
    for (let i = 0; i < 14; i++) bubbles.append(svg('circle', { cx: 60 + r() * 80, cy: 110 + r() * 90, r: 2 + r() * 4, style: `animation-delay:${(-r() * 1.2).toFixed(2)}s` }));
    [70, 100, 130].forEach((x, i) => steam.append(svg('path', { d: `M${x} 70 q -14 -18 0 -34 q 14 -16 0 -32`, style: `animation-delay:${i * 0.4}s` })));
    let lastId = '';
    function render() {
      const t = Number(range.value);
      out.textContent = `${t} °C`;
      const st = O.states.find((s) => t < s.max) || O.states[O.states.length - 1];
      const id = t < 0 ? 'led' : t < 100 ? 'voda' : 'para';
      view.dataset.state = id;
      const level = id === 'para' ? 110 : 90;
      water.setAttribute('d', `M${39 + (level - 90) * 0.06} ${level} L45 200 Q46 210 56 210 L144 210 Q154 210 155 200 L${161 - (level - 90) * 0.06} ${level} Z`);
      range.style.setProperty('--pct', `${((t + 20) / 140) * 100}%`);
      if (id !== lastId) {
        lastId = id;
        const s = O.states.find((x) => x.id === id);
        name.textContent = s.name;
        text.textContent = s.text;
      }
    }
    range.addEventListener('input', render);
    render();
  })();

  /* ---------- 3 · Výpar ---------- */
  (function vypar() {
    const a = $('vyparArt');
    const stepsEl = $('vyparSteps');
    const steps = O.evaporation.map((t) => { const li = el('li', {}, t); stepsEl.append(li); return li; });
    a.append(svg('rect', { width: 400, height: 420, rx: 18, fill: '#cfeaf8' }));
    const sun = svg('circle', { cx: 330, cy: 320, r: 34, fill: '#ffd23f' });
    a.append(sun);
    const cloud = svg('g', { opacity: 0 });
    [[140, 70, 30], [175, 58, 36], [210, 72, 28], [178, 82, 30]].forEach(([cx, cy, rr]) => cloud.append(svg('circle', { cx, cy, r: rr, fill: '#fff' })));
    a.append(cloud);
    a.append(svg('path', { d: 'M0 300 Q 60 292 120 300 T 240 300 L 250 420 L 0 420 Z', fill: '#2f7fc1' }));
    a.append(svg('path', { d: 'M240 300 Q 300 290 400 300 L 400 420 L 250 420 Z', fill: '#e2c88f' }));
    // strom
    a.append(svg('rect', { x: 322, y: 230, width: 12, height: 72, fill: '#7a4f2a' }));
    [[328, 215, 34], [305, 235, 24], [352, 235, 24]].forEach(([cx, cy, rr]) => a.append(svg('circle', { cx, cy, r: rr, fill: '#4f8f34' })));
    const rnd = rng(8);
    const vapour = [];
    for (let i = 0; i < 22; i++) {
      const c = svg('circle', { r: 3 + rnd() * 3, fill: '#ffffff', opacity: 0 });
      c.dataset.x = String(10 + rnd() * 220); c.dataset.o = String(rnd());
      a.append(c); vapour.push(c);
    }
    const leaves = [];
    for (let i = 0; i < 9; i++) {
      const c = svg('circle', { r: 2.5 + rnd() * 2, fill: '#ffffff', opacity: 0 });
      c.dataset.x = String(300 + rnd() * 60); c.dataset.o = String(rnd());
      a.append(c); leaves.push(c);
    }
    const salt = svg('g', { opacity: 0 });
    for (let i = 0; i < 16; i++) salt.append(svg('rect', { x: 20 + rnd() * 200, y: 306 + rnd() * 30, width: 5, height: 5, fill: '#f4f4f4', transform: `rotate(${rnd() * 45})` }));
    salt.append(svg('text', { x: 120, y: 380, 'text-anchor': 'middle', class: 'svg-label svg-label--light' }, 'sůl zůstává v moři'));
    a.append(salt);
    V.on('vypar', {
      update(p) {
        sun.setAttribute('cy', String(320 - seg(p, 0, 0.3) * 230));
        const rise = seg(p, 0.15, 1);
        vapour.forEach((c) => {
          const t = (rise * 2.2 + Number(c.dataset.o)) % 1;
          c.setAttribute('cx', c.dataset.x);
          c.setAttribute('cy', String(295 - t * 210));
          c.setAttribute('opacity', String(seg(p, 0.2, 0.35) * (1 - t) * 0.9));
        });
        leaves.forEach((c) => {
          const t = (rise * 2 + Number(c.dataset.o)) % 1;
          c.setAttribute('cx', c.dataset.x);
          c.setAttribute('cy', String(200 - t * 130));
          c.setAttribute('opacity', String(seg(p, 0.78, 0.9) * (1 - t)));
        });
        salt.setAttribute('opacity', String(seg(p, 0.5, 0.6)));
        cloud.setAttribute('opacity', String(seg(p, 0.55, 0.95)));
        const idx = p < 0.28 ? 0 : p < 0.5 ? 1 : p < 0.76 ? 2 : 3;
        steps.forEach((li, i) => li.classList.toggle('is-active', i === idx));
      },
    });
  })();

  /* ---------- 4 · Pokus: oblak ve sklenici ---------- */
  (function oblak() {
    const g = $('coldGlass');
    g.append(svg('path', { d: 'M40 30 L56 215 Q57 225 67 225 L153 225 Q163 225 164 215 L180 30', fill: 'rgba(255,255,255,.6)', stroke: '#5b7f99', 'stroke-width': 5 }));
    g.append(svg('path', { d: 'M47 80 L56 215 Q57 225 67 225 L153 225 Q163 225 164 215 L173 80 Z', fill: '#9fd3f5' }));
    const ice = svg('g', { opacity: 0 });
    [[80, 84], [120, 92], [100, 120]].forEach(([x, y]) => ice.append(svg('rect', { x, y, width: 30, height: 28, rx: 5, fill: '#eaf7ff', stroke: '#9cc9e6', 'stroke-width': 2 })));
    g.append(ice);
    const r = rng(12);
    const droplets = [];
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1;
      const y = 60 + r() * 150;
      const x = side > 0 ? 176 - (y - 30) * 0.085 + r() * 6 : 44 + (y - 30) * 0.085 - r() * 6;
      const c = svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (1.6 + r() * 2.4).toFixed(1), fill: '#e3f3ff', stroke: '#5b9cc9', 'stroke-width': 1, opacity: 0, class: 'dew' });
      c.style.transitionDelay = `${(0.3 + r() * 2.5).toFixed(2)}s`;
      g.append(c);
      droplets.push(c);
    }
    const btn = $('coolBtn');
    const reset = $('coolReset');
    const txt = $('coolText');
    const q = $('coolQ');
    const note = $('skyNote');
    let tmr;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      ice.setAttribute('opacity', '1');
      g.classList.add('is-cold');
      droplets.forEach((c) => c.setAttribute('opacity', '1'));
      txt.textContent = 'Led sklenici ochlazuje… Sleduj vnější stranu skla.';
      tmr = setTimeout(() => {
        txt.textContent = 'Na skle se objevily kapky, i když sklenice nikde neteče!';
        q.hidden = false;
        window.Kit.choice(q, {
          question: 'Odkud se kapky na skle vzaly?',
          options: ['Ze vzduchu: pára se o studené sklo ochladila a zkapalněla.', 'Voda prosákla sklem ven.'],
          correct: 0,
          explain: ['Tomu se říká kondenzace (kapalnění).', 'Sklem voda neprojde. Kapky přišly z druhé strany, ze vzduchu.'],
        });
        note.hidden = false;
        reset.hidden = false;
      }, V.reduceMotion() ? 0 : 3200);
    });
    reset.addEventListener('click', () => {
      clearTimeout(tmr);
      ice.setAttribute('opacity', '0');
      g.classList.remove('is-cold');
      droplets.forEach((c) => c.setAttribute('opacity', '0'));
      txt.textContent = 'Sklenice má teplotu pokoje. Na skle nic není.';
      q.hidden = true; note.hidden = true; reset.hidden = true;
      btn.disabled = false;
      btn.focus();
    });
  })();

  /* ---------- 5 · Srážky ---------- */
  window.Kit.sort($('sortBox'), {
    items: O.precipitation,
    categories: [{ id: 'pevne', label: '🧊 Pevné' }, { id: 'kapalne', label: '💧 Kapalné' }, { id: 'plynne', label: '💨 Plynné' }],
    done: 'Skupenství máš v malíčku.',
  });

  /* ---------- 6 · Krajina s oblakem ---------- */
  (function krajina() {
    const W = 2400, CROP_Y = 40, CROP_H = 620;
    const pts = [[0, 520], [380, 520], [430, 505], [600, 440], [820, 330], [900, 200], [980, 300], [1060, 160], [1150, 270], [1280, 360],
      [1450, 410], [1720, 450], [1900, 470], [2160, 500], [2200, 520], [2400, 520]];
    function surf(x) {
      for (let i = 1; i < pts.length; i++) {
        if (x <= pts[i][0]) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          const t = (x - x0) / (x1 - x0);
          return y0 + (y1 - y0) * (t * t * (3 - 2 * t));
        }
      }
      return 520;
    }
    const root = $('landSvg');
    root.setAttribute('viewBox', `0 ${CROP_Y} ${W} ${CROP_H}`);
    root.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    const defs = svg('defs');
    const g = svg('linearGradient', { id: 'landSky', x1: 0, y1: 0, x2: 0, y2: 1 });
    g.append(svg('stop', { offset: 0, 'stop-color': '#8fd0f5' }), svg('stop', { offset: 1, 'stop-color': '#eaf6fb' }));
    defs.append(g);
    root.append(defs, svg('rect', { y: CROP_Y, width: W, height: CROP_H, fill: 'url(#landSky)' }));
    const line = (a, b, dy = 0) => { const s = []; for (let x = a; x <= b; x += 10) s.push(`${x} ${(surf(x) + dy).toFixed(1)}`); return s; };
    root.append(svg('path', { d: `M${line(0, W).join(' L')} L${W} 700 L0 700Z`, fill: '#6f9a52' }));
    root.append(svg('path', { d: `M${line(0, W, 40).join(' L')} L${W} 700 L0 700Z`, fill: '#5d8745' }));
    // moře na začátku a na konci
    root.append(svg('path', { d: 'M0 515 Q 100 505 200 515 T 400 515 L 440 560 L 440 700 L 0 700Z', fill: '#2f7fc1' }));
    root.append(svg('path', { d: 'M2170 515 Q 2270 505 2400 515 L 2400 700 L 2150 700Z', fill: '#2f7fc1' }));
    // sníh na vrcholcích
    root.append(svg('path', { d: 'M1060 160 L1100 205 L1075 200 L1058 214 L1040 198 L1022 205Z M900 200 L930 238 L905 232 L885 240 L875 228Z', fill: '#fff' }));
    // potok z hor a řeka
    root.append(svg('path', { d: `M1100 230 C 1180 330, 1300 390, 1450 ${surf(1450) - 2} S 1800 ${surf(1800) - 4}, 2000 ${surf(2000) - 4} S 2140 ${surf(2140)}, 2190 515`, stroke: '#4aa3df', 'stroke-width': 16, fill: 'none', 'stroke-linecap': 'round' }));
    // vsakování v lese: šipky do země
    const seep = svg('g', { stroke: '#2f7fc1', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', class: 'seep' });
    [1380, 1480, 1580].forEach((x) => seep.append(svg('path', { d: `M${x} ${surf(x) + 10} l0 50 m-8 -10 l8 10 l8 -10` })));
    root.append(seep);
    // výpar nad mořem
    const vap = svg('g', { stroke: '#ffffff', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.9 });
    [80, 200, 320, 2260, 2350].forEach((x) => vap.append(svg('path', { d: `M${x} 495 q -10 -20 0 -40 q 10 -20 0 -40` })));
    root.append(vap);
    const icons = { pobrezi: ['🌾'], hory: ['🌲', '🌲'], les: ['🌳', '🌳', '🌲'], reka: ['🏡', '🌾'], navrat: ['⛵'] };
    const zones = O.zones.map((z) => {
      const grp = svg('g', { class: 'zone' });
      const mid = (z.from + z.to) / 2;
      grp.append(svg('text', { x: mid, y: Math.max(CROP_Y + 60, Math.min(surf(z.from), surf(mid), surf(z.to)) - 120), 'text-anchor': 'middle', class: 'zone__name' }, z.name));
      (icons[z.id] || []).forEach((ic, i, arr) => {
        const x = z.from + ((i + 0.7) / (arr.length + 0.4)) * (z.to - z.from);
        grp.append(svg('text', { x, y: z.id === 'navrat' ? 500 : surf(x) - 4, 'text-anchor': 'middle', class: 'zone__icon' }, ic));
      });
      root.append(grp);
      return { z, grp };
    });
    const vp = document.querySelector('.land__viewport');
    const card = $('landCard');
    const rain = $('landRain');
    const cloud = $('landCloud');
    let svgW = 0, vpW = 0, cur = null;
    function resize() {
      const h = vp.clientHeight;
      vpW = vp.clientWidth;
      svgW = (h * W) / CROP_H;
      root.style.width = `${svgW}px`;
      root.style.height = `${h}px`;
    }
    V.on('krajina', {
      resize,
      // Kamera sleduje oblak: p = poloha oblaku v krajině (0..1), zastávka uprostřed každé zóny
      stops: () => O.zones.map((z) => (z.from + z.to) / 2 / W),
      update(p) {
        if (!svgW) resize();
        const cx = Math.min(W - 1, p * W);
        const x = clamp((cx / W) * svgW - vpW / 2, 0, Math.max(0, svgW - vpW));
        root.style.transform = `translate3d(${(-x).toFixed(1)}px,0,0)`;
        cloud.style.left = `${(((cx / W) * svgW - x) / vpW * 100).toFixed(2)}%`;
        const e = zones.find(({ z }) => cx >= z.from && cx < z.to) || zones[zones.length - 1];
        const raining = e.z.id === 'hory' || e.z.id === 'les';
        rain.classList.toggle('is-on', raining);
        cloud.classList.toggle('is-small', e.z.id === 'more' || e.z.id === 'navrat');
        if (e !== cur) {
          cur = e;
          zones.forEach((zz) => zz.grp.classList.toggle('is-active', zz === e));
          card.replaceChildren(el('h3', {}, e.z.name), el('p', {}, e.z.text));
        }
      },
    });
  })();

  /* ---------- 7 · Pod zemí ---------- */
  (function podzemi() {
    const shaft = $('shaft');
    const track = el('div', { class: 'shaft__track' });
    shaft.append(track);
    const r = rng(21);
    const parts = O.underground.map((h) => {
      const part = el('div', { class: `layer layer--${h.id}` });
      if (h.id === 'povrch') {
        part.append(el('div', { class: 'layer__grass' }));
        for (let i = 0; i < 26; i++) {
          const d = el('span', { class: 'raindrop' });
          d.style.cssText = `left:${(r() * 100).toFixed(1)}%;animation-delay:${(-r() * 1).toFixed(2)}s`;
          part.append(d);
        }
      } else {
        part.style.background = h.color;
        if (h.id === 'hornina') {
          // Pukliny a dutiny v hornině vyplněné podzemní vodou
          const c = svg('svg', { class: 'cracks', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
          for (let i = 0; i < 9; i++) {
            let x = r() * 100, y = 0;
            let d = `M${x.toFixed(1)} ${y}`;
            while (y < 100) { x += (r() - 0.5) * 14; y += 8 + r() * 10; d += ` L${x.toFixed(1)} ${Math.min(100, y).toFixed(1)}`; }
            c.append(svg('path', { d, 'vector-effect': 'non-scaling-stroke' }));
          }
          for (let i = 0; i < 6; i++) c.append(svg('ellipse', { cx: (r() * 100).toFixed(1), cy: (10 + r() * 80).toFixed(1), rx: (3 + r() * 5).toFixed(1), ry: (2 + r() * 3).toFixed(1) }));
          part.append(c);
        }
        const n = h.id === 'strk' ? 40 : h.id === 'hornina' ? 0 : 12;
        for (let i = 0; i < n; i++) {
          const s = h.id === 'hornina' ? 90 + r() * 140 : h.id === 'strk' ? 10 + r() * 26 : 6 + r() * 14;
          const b = el('span', { class: h.id === 'hornina' ? 'rock' : 'pebble' });
          b.style.cssText = `left:${(r() * 96).toFixed(1)}%;top:${(r() * 88).toFixed(1)}%;width:${s.toFixed(0)}px;height:${(s * (0.55 + r() * 0.4)).toFixed(0)}px`;
          part.append(b);
        }
        const k = h.id === 'puda' ? 6 : h.id === 'strk' ? 9 : h.id === 'hornina' ? 7 : 10;
        for (let i = 0; i < k; i++) {
          const d = el('span', { class: h.id === 'mineralka' ? 'bubble' : 'seepdrop' });
          d.style.cssText = `left:${(5 + r() * 88).toFixed(1)}%;top:${(r() * 80).toFixed(1)}%;animation-delay:${(-r() * 3).toFixed(2)}s`;
          part.append(d);
        }
        part.append(el('span', { class: 'layer__tag' }, h.name));
      }
      track.append(part);
      return { h, part };
    });
    const nameEl = $('layerName');
    const textEl = $('layerText');
    const depth = $('depthLabel');
    let stageH = 0, total = 0, offsets = [], current = -1;
    function resize() {
      stageH = shaft.clientHeight;
      parts.forEach(({ part, h }) => { part.style.height = `${h.height * stageH}px`; });
      offsets = parts.map(({ part }) => part.offsetTop);
      total = track.scrollHeight;
    }
    V.on('podzemi', {
      resize,
      stops() {
        if (!stageH) resize();
        const run = Math.max(1, total - stageH);
        return offsets.map((o, i) => (i === 0 ? 0 : i === offsets.length - 1 ? 1 : clamp((o - stageH * 0.15) / run)));
      },
      update(p) {
        if (!stageH) resize();
        const y = p * Math.max(0, total - stageH);
        track.style.transform = `translate3d(0, ${(-y).toFixed(1)}px, 0)`;
        const mid = y + stageH * 0.35;
        let i = 0;
        offsets.forEach((o, j) => { if (mid >= o) i = j; });
        if (i !== current) {
          current = i;
          nameEl.textContent = parts[i].h.name;
          textEl.textContent = parts[i].h.text;
          depth.textContent = `· ${i + 1}/${parts.length}`;
        }
      },
    });
  })();

  /* ---------- 8 · Rybník v zimě ---------- */
  (function rybnik() {
    const a = $('pondArt');
    a.append(svg('rect', { width: 400, height: 420, rx: 18, fill: '#dfe9f0' }));
    const snow = svg('g', { fill: '#fff', opacity: 0 });
    const r = rng(30);
    for (let i = 0; i < 30; i++) snow.append(svg('circle', { cx: r() * 400, cy: 20 + r() * 90, r: 2 + r() * 2.5 }));
    a.append(snow);
    a.append(svg('path', { d: 'M0 120 L40 120 Q 80 380 200 390 Q 320 380 360 120 L400 120 L400 420 L0 420Z', fill: '#7a6a55' }));
    const waterTop = svg('path', { d: 'M40 120 Q 80 380 200 390 Q 320 380 360 120 Z', fill: '#4aa3df' });
    a.append(waterTop);
    const deep = svg('path', { d: 'M88 300 Q 120 380 200 388 Q 280 380 312 300 Z', fill: '#1f5f99', opacity: 0 });
    a.append(deep);
    const ice = svg('rect', { x: 40, y: 120, width: 320, height: 0, fill: '#eaf7ff', stroke: '#b5d9ef', 'stroke-width': 2 });
    a.append(ice);
    const fish = svg('g', { class: 'fish' });
    fish.append(svg('text', { x: 170, y: 290, 'font-size': 34, 'text-anchor': 'middle' }, '🐟'), svg('text', { x: 235, y: 245, 'font-size': 28, 'text-anchor': 'middle' }, '🐟'));
    a.append(fish);
    const lblIce = svg('text', { x: 200, y: 112, 'text-anchor': 'middle', class: 'svg-label', opacity: 0 }, 'led plave');
    const lblDeep = svg('text', { x: 300, y: 330, 'text-anchor': 'middle', class: 'svg-label svg-label--light', opacity: 0 }, 'asi 4 °C');
    a.append(lblIce, lblDeep);
    const txt = $('pondText');
    let last = '';
    V.on('rybnik', {
      update(p) {
        snow.setAttribute('opacity', String(seg(p, 0.05, 0.3)));
        ice.setAttribute('height', (seg(p, 0.15, 0.55) * 26).toFixed(1));
        lblIce.setAttribute('opacity', String(seg(p, 0.4, 0.5)));
        waterTop.setAttribute('fill', p > 0.2 ? '#6fb7e6' : '#4aa3df');
        deep.setAttribute('opacity', String(seg(p, 0.65, 0.85)));
        lblDeep.setAttribute('opacity', String(seg(p, 0.75, 0.9)));
        const sink = seg(p, 0.65, 0.9);
        fish.setAttribute('transform', `translate(0 ${(sink * 70).toFixed(1)})`);
        const t = p < 0.33 ? 'Přichází zima a voda v rybníce chladne.'
          : p < 0.66 ? 'Led má menší hustotu než kapalná voda, proto vzniká nahoře a plave. Rybník přikryje jako poklice.'
          : 'Kapalná voda má největší hustotu asi při 4 °C (přesněji 3,95 °C). Taková voda klesne ke dnu a právě tam ryby přečkají zimu.';
        if (t !== last) { last = t; txt.textContent = t; }
      },
    });
  })();

  /* ---------- 9 · Kohoutek a filtr ---------- */
  (function kohoutek() {
    const list = $('pipeline');
    const info = $('pipeInfo');
    O.tapSteps.forEach((s) => {
      const b = el('button', { type: 'button', class: 'pipe', 'aria-pressed': 'false' }, el('span', { class: 'pipe__icon', 'aria-hidden': 'true' }, s.icon), el('span', {}, s.name));
      b.addEventListener('click', () => {
        list.querySelectorAll('.pipe').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        b.classList.add('is-seen');
        info.replaceChildren(el('h3', {}, `${s.icon} ${s.name}`), el('p', {}, s.text));
      });
      list.append(el('li', {}, b));
    });
    const btn = $('filterBtn');
    const txt = $('filterText');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      document.querySelector('.filter-exp__view').classList.add('is-run');
      setTimeout(() => {
        txt.textContent = 'Voda je mnohem čistší: písek a štěrk zachytily hlínu. Pitná ale není! Mikroorganismy filtrem projdou, proto úpravna vodu ještě dezinfikuje.';
        btn.textContent = 'Hotovo';
      }, V.reduceMotion() ? 0 : 2600);
    });
  })();

  /* ---------- 10 · Mise: seřaď koloběh ---------- */
  (function mise() {
    const pool = $('orderPool');
    const list = $('orderList');
    const fb = $('orderFb');
    const order = [3, 0, 5, 2, 4, 1];
    let next = 0;
    const btns = order.map((i) => {
      const b = el('button', { type: 'button', class: 'btn order__chip' }, O.mission[i]);
      b.addEventListener('click', () => {
        if (i === next) {
          b.hidden = true;
          list.append(el('li', { class: 'order__item' }, O.mission[i]));
          next++;
          fb.textContent = next === O.mission.length ? '🎉 Kapka obešla celý koloběh a je zpátky v moři. A může vyrazit znovu!' : '✔ Správně, pokračuj.';
          pool.querySelectorAll('.is-hint').forEach((x) => x.classList.remove('is-hint'));
        } else {
          b.classList.remove('is-shake');
          void b.offsetWidth;
          b.classList.add('is-shake');
          fb.textContent = 'Tenhle krok ještě nepřijde na řadu. Zkus jiný.';
        }
      });
      pool.append(b);
      return { i, b };
    });
    $('orderUndo').addEventListener('click', () => {
      if (!next) return;
      next--;
      list.lastElementChild.remove();
      btns.find((x) => x.i === next).b.hidden = false;
      fb.textContent = '';
    });
    $('orderHint').addEventListener('click', () => {
      const t = btns.find((x) => x.i === next);
      if (!t) return;
      t.b.classList.add('is-hint');
      fb.textContent = 'Nápověda: zvýraznil jsem další krok.';
    });
  })();

  /* ---------- 11 · Kvíz ---------- */
  window.Kit.quiz($('quiz'), O.quiz);

  V.start();
})();
