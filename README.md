# Školeeq

**Školeeq** (škola + školení + kolega) je veřejný portál krátkých výukových her pro základní školy.
Statický web bez backendu a bez databáze, hostovaný na **Cloudflare Pages** přes **GitHub**.

- Katalog her se generuje z registru [`public/apps.json`](public/apps.json) – hledání (i bez diakritiky) a filtry podle ročníku, předmětu, tématu a obtížnosti.
- Každá hra je samostatná stránka ve složce `public/aplikace/<slug>/` – žádné iframy, žádné sdílené herní jádro.
- První hra: **Klávesová mise – Klik a školní výlet** (`/aplikace/klavesova-mise/`).
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
| `npm run test` | unit testy validátoru + Playwright smoke testy (katalog, mobil, Klávesová mise vč. `test.html`) |
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
  apps.json              registr her
  assets/                portal.css, portal.js, registry.js (sdílené schéma registru)
  aplikace/<slug>/       samostatné hry
  o-projektu/, 404.html, _headers, robots.txt, favicon.svg
scripts/                 serve, validate-apps, check-links, sync-site, new-app
templates/app/           šablona nové hry
tests/unit, tests/e2e    node:test a Playwright
docs/                    DEPLOYMENT, ADD_NEW_APP, ARCHITECTURE
site.config.json         název webu, doména (siteUrl), odkaz na repozitář – jediné místo
```

## Dokumentace

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) – GitHub → Cloudflare Pages → vlastní doména, rollback
- [docs/ADD_NEW_APP.md](docs/ADD_NEW_APP.md) – jak přidat hru za pár minut
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – rozhodnutí a jejich důvody
- [CLAUDE.md](CLAUDE.md) – trvalá pravidla pro generování dalších her

## Přejmenování webu / doména

Název a doména jsou v [`site.config.json`](site.config.json). Po změně spusť `npm run sync` a změny commitni.
Dokud není známá finální doména, nech `siteUrl` prázdné – `sitemap.xml` se nevygeneruje (nepoužíváme vymyšlené URL).
