# Školeeq

**Školeeq** (škola + školení + kolega) je veřejný portál krátkých výukových her pro základní školy.
Statický web bez backendu a bez databáze, hostovaný na **Cloudflare Pages** přes **GitHub**.

- Katalog her se generuje z registru [`public/apps.json`](public/apps.json) – hledání (i bez diakritiky) a filtry podle ročníku, předmětu, tématu a obtížnosti.
- Každá hra je samostatná stránka ve složce `public/aplikace/<slug>/` – žádné iframy, žádné sdílené herní jádro.
- Hratelné hry:
  - **Klávesová mise – Kurzík a školní výlet** – 12 zkratek a pohyb v textu bez myši, 6 kapitol + trénink (`/aplikace/klavesova-mise/`)
  - **Datoví detektivové – tabulky a grafy** (`/aplikace/datovi-detektivove/`)
  - **Dokumentová záchranka** – formátování dokumentu ve skutečném mini-editoru, 10 misí (`/aplikace/dokumentova-zachranka/`)
  - **Robotí dílna: Záchrana sondy** – programování z bloků, interpret s krokováním, 12 misí (`/aplikace/roboti-dilna/`)
  - **Šifrovací laboratoř: Signál ze sondy** – bity, znaková sada, Caesar, Morseovka, kódování obrázků a barev, kontrolní součty; 17 úloh v 5 úrovních (`/aplikace/sifrovaci-laborator/`)
  - **Grafový navigátor: Síť základen** – grafy, nejkratší cesta, kostra grafu, orientované grafy, automat, souběžná práce dvou robotů; 11 úloh v 5 úrovních (`/aplikace/grafovy-navigator/`)
  - **Phishingová hlídka** – phishing, hesla a bezpečné sdílení (`/aplikace/phishingova-hlidka/`)
  - **Signál ze sondy** – barvy více způsoby, obrázek z tvarů, zápis úseků, kontrolní součet (`/aplikace/signal-ze-sondy/`)
  - **Znakožrout** – speciální znaky, Shift a AltGr, e-mail a adresy, silné heslo, typografie; klávesnice se třemi vrstvami, 11 úloh v 5 úrovních (`/aplikace/znakozrout/`)
- Připravované hry (karta „Připravujeme“): zatím žádné; návrh Prezentačního studia je v soukromém repozitáři skoleeq-lab (`pripravujeme/`).
- Stránka **Pro učitele** (`/pro-ucitele/`, přímé odkazy `/pro-ucitele/#<id>`): cíle, doslovné citace ŠVP, tipy do 45min hodiny, otázky k reflexi.
- Bez přihlašování, bez analytiky a cookies. Postup her jen v `localStorage` prohlížeče.

## Rychlý start

Potřebuješ jen **Node.js 20+** (pro vývojový server a testy; web sám Node nepotřebuje).

```bash
npm install
```

```bash
npm run dev
```

Otevři <http://localhost:8080/>. Server je bez závislostí (`scripts/serve.mjs`), napodobuje Cloudflare Pages: složky s `index.html`, skutečnou 404 a hlavičky z `public/_headers`. Jiný port: `npm run dev -- --port 3000`.

## Příkazy

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | statický HTTP server nad `public/` |
| `npm run validate` | validace `apps.json` (schéma, unikátní id, existence `index.html`), kontrola interních odkazů, synchronizace se `site.config.json` |
| `npm run test` | unit testy (validátor, logika všech nových her) + Playwright (katalog, Pro učitele, mobil, Klávesová mise vč. `test.html`, Datoví detektivové, Dokumentová záchranka, Robotí dílna, Šifrovací laboratoř, Grafový navigátor) |
| `npm run check` | `validate` + `test` – spusť před každým commitem |
| `npm run new-app -- <slug> "Název"` | založí novou hru ze šablony a přidá ji do registru jako `draft` |
| `npm run sync` | po změně `site.config.json` přepíše název webu, `robots.txt` a `sitemap.xml` |

### Prohlížeče pro testy (jednorázově)

```bash
npx playwright install chromium firefox
```

Místo staženého Chromia lze použít systémový prohlížeč: `PW_CHANNEL=msedge npm run test:e2e` nebo `PW_CHANNEL=chrome npm run test:e2e`.
Firefox (jen smoke testy `@smoke`) běží vždy v CI. Lokálně ho zapneš proměnnou `PW_FIREFOX=1 npm run test:e2e`. Na Windows ho může zablokovat Smart App Control / Defender (chyba `spawn UNKNOWN`). Pak ho nech na CI.

### Test Klávesové mise

Původní prohlížečový test hry je na <http://localhost:8080/aplikace/klavesova-mise/test.html> (po ~50 s vypíše `PASS`). Automaticky ho spouští i `npm run test`.
⚠️ `test.html` při běhu **přepíše uložený postup hry** v tomto prohlížeči (klíč `klavesova-mise-v2`) – na produkci ho otevírej v anonymním okně.

## Struktura

```
public/                  ← jediná složka, která se nasazuje (Cloudflare Pages: output directory)
  index.html             katalog
  apps.json              registr her (published / planned / draft / hidden)
  assets/                portal.css, portal.js, teachers.js, registry.js (sdílené schéma registru)
  aplikace/<slug>/       samostatné hry
  vyklad/<slug>/         interaktivní výklady a nástroje (apps.json: "kind": "vyklad" | "nastroj")
  pro-ucitele/           karty pro učitele (generované z apps.json)
  o-projektu/, 404.html, _headers, robots.txt, favicon.svg
scripts/                 serve, validate-apps, check-links, sync-site, new-app
templates/app/           šablona nové hry (podle design systému)
tests/unit, tests/e2e    node:test a Playwright
docs/                    DEPLOYMENT, ADD_NEW_APP, ARCHITECTURE
site.config.json         název webu, doména (siteUrl), odkaz na repozitář – jediné místo
```

## Dokumentace

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) – GitHub → Cloudflare Pages → vlastní doména, rollback
- [docs/ADD_NEW_APP.md](docs/ADD_NEW_APP.md) – jak přidat hru za pár minut
- [docs/GAME_TEMPLATE.md](docs/GAME_TEMPLATE.md) – šablona nové hry a záznam v katalogu
- [docs/GAME_DESIGN_SYSTEM.md](docs/GAME_DESIGN_SYSTEM.md) – tokeny, komponenty, herní průběh, přístupnost
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – rozhodnutí a jejich důvody
- [CLAUDE.md](CLAUDE.md) – trvalá pravidla pro generování dalších her

## Přejmenování webu / doména

Název a doména jsou v [`site.config.json`](site.config.json). Po změně spusť `npm run sync` a změny commitni.
Dokud není známá finální doména, nech `siteUrl` prázdné – `sitemap.xml` se nevygeneruje (nepoužíváme vymyšlené URL).

## Nasazení (GitHub → Cloudflare Pages), doména, rollback – stručně

Podrobný postup je v [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Shrnutí:

1. Repozitář na GitHubu, `git push` do `main`. GitHub Actions spustí workflow **Kontrola** (`npm run validate` + testy).
2. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, vybrat repozitář. Framework preset **None**, build command prázdný, **output directory `public`**, produkční větev `main`.
3. Každý push do `main` = nové produkční nasazení. Pull request = náhledová URL.
4. Vlastní doména: v projektu Pages → **Custom domains** → přidat doménu a nastavit DNS podle průvodce. Pak doplnit `siteUrl` do `site.config.json` a spustit `npm run sync`.
5. Rollback: v projektu Pages → **Deployments** → u starší verze **Rollback to this deployment**. Případně `git revert` a push.

Žádná hesla, tokeny ani API klíče se do repozitáře nevkládají – nejsou potřeba (statický web, propojení přes GitHub aplikaci Cloudflare).

## Rozhodnutí a výchozí hodnoty (vlna 1, 2026-11)

Zadání vlny her se v několika bodech lišilo od pravidel repozitáře. Platí pravidla repozitáře ([CLAUDE.md](CLAUDE.md)), rozdíly:

| Zadání | Zvoleno | Proč |
|---|---|---|
| klíč `edu:<game-id>:v1`, `edu.doc-rescue.v1`, `edu.robot-workshop.v1` | `vyukovy-portal:<slug>:v1` | pravidlo repozitáře (jeden formát pro všechny hry); Klávesová mise dál `klavesova-mise-v2` |
| pole `summary`, `estimatedMinutes` | stávající `description`, `durationMinutes` | beze změny schématu a starých záznamů |
| `skills`, karta Pro učitele | nová volitelná pole `skills`, `teacher` | validována v `registry.js` |
| stav „Připravujeme“ | nový stav `planned` | karta bez odkazu, složka hry nemusí existovat |
| složka `_template` | `templates/app/` | mimo `public/` (nenasadí se), používá ji `npm run new-app` |
| Vite | ne | hra je vanilla ES modul; bundler by nic nepřinesl |
| ročníky | DD 6. (aktuální výuka), ostatní podle ŠVP | v `apps.json` jdou změnit; v `teacher.gradeNote` označeno jako pracovní návrh |
| hodnocení | napoprvé → nápovědy → (volitelně) čas | nápověda nesnižuje „vyřešeno“; stopky ve výchozím stavu vypnuté |
| varianty | A/B/C (pevný seed) + náhodná | sousedé mají jiná čísla, učitel může promítat stejnou variantu |

## Další kroky

1. **Ověřit ve třídě** všechny tři nové hry (délky misí, srozumitelnost zadání a nápověd) a s učitelem potvrdit ročníky v `apps.json`.
2. **Prezentační studio – další hra na řadě** (záznam odložen do skoleeq-lab, `pripravujeme/prezentacni-studio.json`): plátno 16:9 s miniaturami snímků, panel oprav. Mise: označ 3 chyby na snímku, zkrať přetížený text na klíčové body, oprav velikost písma a kontrast, vyber vhodný graf/obrázek, seřaď snímky do příběhu. Hodnotit konkrétní principy (počet slov, kontrastní poměr, pořadí), ne vkus. Výstup: náhled před/po. Lze převzít model bloků a historii z Dokumentové záchranky.
3. Dokumentová záchranka: volitelně export `.docx` (zatím jen tisk/PDF a HTML, které Word umí otevřít), mise na záhlaví/zápatí.
4. Robotí dílna: proměnné a cyklus „opakuj, dokud“ pro 9. ročník. (Přetahování bloků myší i dotykem je hotové – 2026-11-12.)
5. Vlna 2 (zatím ne v katalogu): Souborový detektiv, Internetový ověřovatel, Excelová výzva.
6. Změřit Lighthouse na produkční URL (zatím neměřeno).
