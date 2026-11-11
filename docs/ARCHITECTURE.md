# Architektura

```
GitHub (1 repozitář)
        │ push do main / pull request
        ▼
Cloudflare Pages (1 projekt, CDN + HTTPS), nasazuje se jen public/
        ├── /                            katalog (index.html + assets/portal.js načte /apps.json)
        ├── /aplikace/klavesova-mise/   samostatná hra
        ├── /aplikace/<další-hra>/      samostatná hra
        ├── /o-projektu/                informace o portálu
        └── 404.html                    skutečná 404 (žádný SPA fallback)
```

## Klíčová rozhodnutí

| Rozhodnutí | Proč |
|---|---|
| **Statický web, žádný backend/SSR/DB** | nulové provozní náklady, rychlost z CDN, nic k údržbě ani k napadení |
| **Vanilla HTML/CSS/JS (ES moduly), bez frameworku a bundleru** | katalog má ~15 kB JS. Framework by přidal build, závislosti i váhu bez přínosu. Node slouží jen pro dev server, validaci a testy |
| **Každá hra = vlastní složka a URL, žádné iframy** | hry s globálními `keydown` handlery (Ctrl+…) nekolidují s katalogem. Hra se stahuje až při otevření |
| **Registr `apps.json` + sdílené schéma `registry.js`** | stejný validátor běží v prohlížeči (katalog ignoruje vadné záznamy) i v CI (build selže). Nová hra = složka + záznam, beze změny kódu katalogu |
| **Vykreslování přes `textContent`/atributy** | ochrana proti XSS i v případě chybného záznamu. `innerHTML` jen pro konstantní SVG ikony z whitelistu |
| **Filtry v URL (`?q=&rocnik=&predmet=&tema=&obtiznost=`)** | odkaz na filtrovaný katalog lze poslat žákům. `history.replaceState`, takže nezahlcuje historii |
| **Název webu a doména v `site.config.json`** | `npm run sync` přepíše název ve stránkách a vygeneruje `robots.txt`/`sitemap.xml`. `npm run validate` hlídá, že je vše synchronizované |
| **Vlastní mini server `scripts/serve.mjs`** | žádná závislost. Chová se jako Pages (index.html ve složkách, 404, `_headers`), takže lokální testy odpovídají produkci |

## Katalog

- `public/index.html`: statická kostra (hero, formulář filtrů, prázdný stav, chybový stav, skeletony).
- `public/assets/portal.js`: `fetch('/apps.json', { cache: 'no-cache' })` → `validateRegistry` → jen `status: "published"` → možnosti filtrů z dat → karty.
  - Hledání: bez ohledu na diakritiku a velikost písmen (`normalize('NFD')`). Všechna slova dotazu musí být v názvu, podtitulu, popisu, předmětu nebo tématech.
  - Ročníky 1.–9. jsou ve filtru vždy. Předměty, témata a obtížnosti jen ty, které v registru opravdu jsou.
  - Malý katalog (1–2 hry bez filtru) doplní dlaždice „Další hry se připravují“, ať nepůsobí rozbitě.
  - Dotykové zařízení bez jemného ukazatele + hra s `requiresKeyboard` → nenásilné upozornění. Hra zůstává v katalogu.
- `public/assets/registry.js`: schéma, whitelisty (`difficulty`, `status`, `color`, `icon`), pravidla URL (`/aplikace/<id>/`, bez `..`).

## Integrace Klávesové mise

Zdroj: `index.zip` (z `shortcut-game/index.zip`, 5 souborů) rozbalený beze změny do `public/aplikace/klavesova-mise/`. Před úpravami prošel původní `test.html` (baseline: PASS v Edge i Chrome).

**Jediné změny oproti originálu** (logika `app.js` je beze změny):

1. `index.html`: v hlavičce odkaz **„← Všechny hry“** (`href="/"`) vedle tlačítka zvuku (obalené do `div.top-actions`), v patičce odkaz „další hry na Školeeq“.
2. `style.css`: na konec přidaný, jasně označený blok stylů pro tento odkaz. Na šířce ≤ 480 px dostane odkaz vlastní řádek nad hlavičkou, aby se původní hlavička vešla i na 320 px (bez toho by tlačítko zvuku přetékalo).

Zachováno: 5 kapitol / 37 kroků, trénink 12 zkratek, zvuky, hvězdy, rekord, kopírování výsledku, `test.html`, klíč `localStorage` **`klavesova-mise-v2`**.

### Zkratky a omezení prohlížečů

- Hra zachytává `keydown` ve fázi capture na `document` a pro Ctrl/⌘ + písmeno volá `preventDefault()`, ale **jen během příběhu a tréninku** (na úvodní obrazovce hry zkratky prohlížeče fungují normálně). Test ověřuje, že `Ctrl + A/C/X/V/S/P/F/Z/Y/B/I/U` mají `defaultPrevented`, takže se v aktivní hře neotevře tisk (Ctrl+P), hledání (Ctrl+F) ani ukládání (Ctrl+S).
- **Co stránka zachytit nemůže:** zkratky vyhrazené prohlížečem nebo OS, např. `Ctrl+N`, `Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`, a na Macu `⌘+Q`, `⌘+W`, `⌘+H`, `⌘+M`. Hra je naštěstí nepoužívá. Rozšíření prohlížeče nebo nástroje OS (např. Windows schránka `Win+V`) mohou zkratku zachytit dřív než stránka. Stoprocentní podporu proto neslibujeme.
- **České QWERTZ:** hra rozhoduje podle `event.key` (znak), ne podle fyzické klávesy. Ctrl+Z/Ctrl+Y tedy fungují podle popisků na české klávesnici. Pokud prohlížeč znak nevrátí, použije se záloha `event.code`.
- **macOS:** místo Ctrl funguje ⌘ (`metaKey`), ověřeno testem.
- **Clipboard API:** `navigator.clipboard.writeText` funguje jen v zabezpečeném kontextu (HTTPS na Cloudflare Pages, `localhost` při vývoji) a se svolením prohlížeče. Při zamítnutí hra text výsledku označí a vyzve ke zkopírování přes Ctrl+C (ověřeno testem). Na `file://` nebo HTTP bez TLS se vždy použije tato záloha.
- `test.html` při běhu maže a přepisuje `klavesova-mise-v2` v daném prohlížeči. Není odkazovaný z katalogu, `X-Robots-Tag: noindex` a `robots.txt` ho vyřazují z vyhledávačů.

## Hlavičky a bezpečnost (`public/_headers`)

- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (kamera, mikrofon, poloha… vypnuto).
- `X-Frame-Options: SAMEORIGIN`: cizí weby portál nevloží do iframu, `test.html` (iframe na stejném originu) funguje.
- **CSP zatím záměrně není.** Klávesová mise používá inline `data:` SVG favicon a inline `style` atributy. Další hry mohou potřebovat audio/canvas. Restriktivní CSP je vhodné zavést až s testy všech her (např. nejdřív `Content-Security-Policy-Report-Only`).
- Žádné cookies, analytika ani externí zdroje. Vše se servíruje z vlastní domény.

## Výkon

- Homepage celkem ~41 kB nekomprimovaně (HTML 6,5 kB, CSS 17 kB, JS 17 kB včetně `registry.js`, `apps.json` < 1 kB). Žádné webfonty (systémové písmo), žádné obrázky kromě SVG loga. Hry se stahují až po kliknutí.
- `apps.json` má `Cache-Control: max-age=0, must-revalidate` (nové hry hned viditelné), `/assets/*` hodinu.
- Kontrast: všechny dvojice textu a pozadí v portálu (včetně 8 barev her) mají ≥ 4,5 : 1 (WCAG AA). Ověřeno výpočtem.
- **Lighthouse zatím nebyl změřen** (v prostředí, kde portál vznikl, nebylo možné nástroj stáhnout). Cíl ≥ 90 ve všech kategoriích. Po nasazení změř v Chrome DevTools → Lighthouse na produkční URL (mobil i desktop).

## Co v MVP záměrně není

Backend, přihlašování, databáze (Supabase/Firebase/D1), Workers API, žebříčky, profily, administrace, analytika, sdílené herní jádro, SPA routing. Nic z toho nepotřebuje ani nová hra. Pokud by později bylo potřeba (např. učitelské třídy), přidává se jako samostatná vrstva, katalog a hry zůstávají statické.
