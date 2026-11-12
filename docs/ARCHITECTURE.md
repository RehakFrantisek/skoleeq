# Architektura

```
GitHub (1 repozitář)
        │ push do main / pull request
        ▼
Cloudflare Pages (1 projekt, CDN + HTTPS), nasazuje se jen public/
        ├── /                            katalog (index.html + assets/portal.js načte /apps.json)
        ├── /aplikace/klavesova-mise/   samostatná hra
        ├── /aplikace/datovi-detektivove/ samostatná hra (ES moduly: logic.js + app.js)
        ├── /aplikace/<další-hra>/      samostatná hra
        ├── /pro-ucitele/               karty pro učitele (assets/teachers.js čte /apps.json)
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

## Připravované hry a karty Pro učitele

- Stav `planned` v registru: katalog je vykreslí v sekci **Připravujeme** jako `.plan-card` bez odkazu na hru (počty „her v katalogu“ počítají jen `published`). Na stejné filtry reagují i připravované karty.
- Volitelné pole `teacher` → stránka `/pro-ucitele/` (`assets/teachers.js`) vykreslí kartu s kotvou `#<id>`; přímý odkaz zaostří nadpis karty. Citace ŠVP jsou data v `apps.json`, ne HTML.
- Volitelné `skills` – krátký seznam dovedností (zatím jen data, katalog je nezobrazuje).

## Datoví detektivové

- `logic.js`: čistý ES modul bez DOM – seedovaný generátor (`mulberry32`), datové operace (řazení celých řádků vs. jen sloupce, filtr se dvěma podmínkami, adresy buněk, jednotky, zkreslení osy), 18 úloh ve 4 úrovních, `checkAnswer()` s konkrétní zpětnou vazbou. Importují ho unit i E2E testy.
- `app.js`: UI – stylizovaný tabulkový editor (`<table>` s tlačítky v buňkách, roving tabindex, šipky, řádek vzorců), nástroje Seřadit („Rozšířit výběr / Jen sloupec“, Zpět) a Filtr, SVG grafy bez knihoven (sloupcový, čárový, kruhový se vzory), klikací sloupce s `role="button"`.
- Zachytává jen `Ctrl/⌘+Z`, a to jen v úloze s řazením mimo textová pole.

## Dokumentová záchranka

- `missions.js` (obsah) · `model.js` (dokument jako pole bloků, značky tučně/kurzíva/podtržení po znacích, čisté operace, historie Zpět/Znovu se slučováním psaní) · `checks.js` (vyhodnocení stavu dokumentu) · `app.js` (UI).
- Editor: každý textový blok je samostatný `contenteditable`; po každé změně se DOM vykreslí znovu z modelu a obnoví se kurzor podle pozic znaků. `beforeinput` zachytí Enter, formátovací příkazy, Zpět/Znovu a vkládání (jen `text/plain`). Psaní se do modelu promítá rozdílem (LCS), takže značky zůstanou u svých znaků i po opravě mezer.
- Kontroly hodnotí stav: sémantické bloky (`heading1`, `heading2`, `paragraph`, seskupené `bulletedList`/`numberedList`, `image`), přesný úsek se značkou, pořadí, obrázek a popisek, typografická pravidla. Automaticky se přidává kontrola zachování textu (podpis bez mezer).

## Robotí dílna

- `missions.js` (obsah, mapy v ASCII, reference) · `engine.js` (simulátor, interpret jako generátor, cíle, vyhodnocení na všech mapách) · `app.js` (UI).
- Program je strom uzlů; interpret vrací událost po každém příkazu a vyhodnocení podmínky, UI ji jen vykreslí (krokování, pozastavení, zvýraznění bloku). Limit 400 instrukcí, max. 3 úrovně vnoření, max. 20 opakování – nekonečný běh nevznikne.
- Editor: bloky se přetahují přes Pointer Events (myš, pero, dotyk za úchyt ⠿) na libovolné místo – mezi bloky i do cyklu/větve; cíl se počítá z pozice ukazatele, neplatné cíle (blok do sebe sama, vnoření > 3, > 40 bloků) se odmítnou s vysvětlením. Klávesnice: výběr bloku, Alt+↑/↓, Delete, tlačítka ↑ ↓ ✕. Robot je trvalý prvek SVG, pohyb a otočení animuje CSS (délka podle rychlosti).
- Testy pro každou misi: dosažitelnost všech políček (BFS), referenční řešení projde na všech mapách, prázdný a výchozí program neprojde, alternativní řešení projdou.

## Šifrovací laboratoř

- `logic.js` (kódování, šifry, obrázky, parita, generátor úloh ze seedu varianty A/B/C, vyhodnocení s vysvětlením, `solution()`) · `app.js` (průběh podle design systému a nástroj pro každý typ úlohy).
- Odpověď má pro každý typ úlohy pevný tvar; stejný tvar posílá UI, `solution()` i testy. Unit test ověří všechny úlohy všech variant (řešení projde, prázdná odpověď ne), E2E test dohraje celou misi přes skutečné ovládací prvky.
- Fotka ze sondy je inline SVG zakryté mřížkou dílků; každá kopie má vlastní id přechodů (skrytá kopie v `display: none` by je jinak vypnula).

## Grafový navigátor

- `logic.js` (grafové algoritmy: Dijkstra, dosažitelnost, Kruskal, automat, rozvrh dvou robotů hrubou silou přes pořadí a přiřazení; generátor úloh ze seedu varianty) · `app.js` (průběh podle design systému, SVG nástroje).
- Hodnotí se optimalita, ne konkrétní řešení: trasa/kostra se stejnou cenou nebo rozvrh se stejnou dobou projdou.
- Hrany v SVG mají klikací plochu jako obdélník kolem úsečky (vodorovná či svislá čára má jinak nulový rozměr a nejde na ni kliknout ani v testech).

## Audit před vlnou 1 (2026-11-11)

- Repozitář: statický portál, registr `apps.json` + schéma `registry.js` sdílené katalogem i CI, generátor `new-app`, testy `node:test` + Playwright, Cloudflare Pages bez buildu. Zadání šlo splnit bez změny architektury.
- Klávesová mise zůstala beze změny (`app.js`, klíč `klavesova-mise-v2`, `test.html` PASS v testech). V registru jí přibyla jen karta `teacher`.
- Rozdíly zadání vs. pravidla repozitáře a zvolené řešení: tabulka v [README](../README.md#rozhodnutí-a-výchozí-hodnoty-vlna-1-2026-11).
- Druhá iterace (Dokumentová záchranka, Robotí dílna): hry už byly v registru jako `planned`, takže se jen přepnuly na `published` – žádná duplicitní karta. Zadání chtělo klíče `edu.doc-rescue.v1` a `edu.robot-workshop.v1`; ponechán formát repozitáře `vyukovy-portal:<slug>:v1`.
- Test `expectNoHorizontalScroll` nově hlídá i šířku layout viewportu – na mobilní emulaci se při přetečení rozšíří i `innerWidth`, takže původní kontrola přetečení nepoznala.

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
