# CLAUDE.md – pravidla projektu Školeeq

Školeeq je **statický** portál výukových miniaplikací pro ZŠ (Cloudflare Pages, GitHub): hry v `public/aplikace/`, interaktivní výklady a nástroje v `public/vyklad/` (v `apps.json` s polem `"kind": "vyklad"` nebo `"nastroj"`). Tato pravidla platí pro každou změnu a hlavně pro **generování nových her**.

## Nepřekročitelná pravidla

1. **Žádný backend.** Žádné SSR, databáze, API, Workers, přihlašování, analytika, cookies, trackery ani externí CDN. Vše je statické v `public/`.
2. **Žádný framework ani bundler.** HTML5 + CSS3 + vanilla JS. Node.js jen pro `scripts/` a testy (devDependencies).
3. **Každá hra je nezávislá:** `public/aplikace/<slug>/index.html` + vlastní CSS/JS/assets. Nesmí importovat kód jiné hry ani `public/assets/` portálu. Žádné sdílené herní jádro, žádný centrální stav.
4. **Registr je jediný zdroj katalogu:** novou hru přidáš záznamem v `public/apps.json`. HTML katalogu se kvůli hře **nikdy needituje**. Schéma a whitelisty: `public/assets/registry.js`.
5. **localStorage:** jen klíč `vyukovy-portal:<slug>:v1`, vždy v `try/catch`. Klávesová mise má výjimku: **`klavesova-mise-v2` neměnit.**
6. **Klávesová mise jen opatrně** (`public/aplikace/klavesova-mise/`): opravy a rozšíření ano (od 2026-11-17 má 6. kapitolu Bez myši), ale uložený postup žáků musí dál fungovat (klíč `klavesova-mise-v2`, pole `stars` se jen doplňuje), jen fyzická klávesnice (žádná klávesnice na obrazovce) a `test.html` musí dál hlásit PASS.
7. **Čeština** ve všem veřejném textu, se správnou diakritikou, srozumitelně pro žáky 2. stupně i učitele. Nevymýšlej osobní údaje, e-maily, domény ani ověřená didaktická fakta (ročníky a délky jsou orientační).
8. **Přístupnost a výkon:** sémantické HTML (`main`, `nav`, skutečná `button`/`a`, `label`), ovládání klávesnicí, viditelný `:focus-visible`, kontrast AA, `prefers-reduced-motion`, funguje od 320 px bez vodorovného scrollu, dotykové cíle ≥ 44 px.
9. **Bezpečnost:** text z dat vkládej přes `textContent`, ne `innerHTML`. Žádné `eval`, žádné vkládání cizích skriptů.
10. **Testy před hotovo:** `npm run check` musí projít. Netvrď, že něco prošlo, pokud jsi to nespustil.

## Nová hra – postup

```bash
npm run new-app -- <slug> "Název hry"
```

Pak podle [docs/ADD_NEW_APP.md](docs/ADD_NEW_APP.md); vzhled a průběh podle [docs/GAME_DESIGN_SYSTEM.md](docs/GAME_DESIGN_SYSTEM.md) (titulní obrazovka → ukázka → úrovně → závěr, nápověda bez trestu, oprava chyb, stopky volitelné). Vzor složitější hry: `public/aplikace/datovi-detektivove/` (logika v `logic.js` bez DOM, testovaná v `tests/unit/`).

1. Naprogramuj hru v `public/aplikace/<slug>/`. Šablona už obsahuje odkaz „← Všechny hry“, `lang="cs"`, viewport a správný localStorage klíč.
2. Lokální soubory odkazuj **relativně** (`style.css`, ne `/style.css`).
3. Doplň metadata v `apps.json` (popis, předmět, ročníky, témata, obtížnost, délka, ikona, barva, `requiresKeyboard`, ideálně `skills` a `teacher` s doslovnými citacemi ŠVP) a nastav `"status": "published"`. Rozpracovaná hra může mít `"status": "planned"` (karta „Připravujeme“).
4. U složitější hry přidej `tests/e2e/<slug>.spec.js`. Přímou URL testuje automaticky `catalog.spec.js`.
5. `npm run check`, pak `npm run dev` a ověř 320 px i desktop, klávesnici a konzoli bez chyb.

### Hra s klávesovými zkratkami

- Zachytávej `keydown` jen když je hra aktivní, `preventDefault()` jen pro zkratky, které hra opravdu používá.
- Rozhoduj podle `event.key` (české QWERTZ), `event.code` jen jako záloha. Podporuj `ctrlKey || metaKey` (Mac ⌘).
- Neslibuj zkratky vyhrazené prohlížečem/OS (`Ctrl+N/T/W`, `⌘+Q/W`).

## Větve

`main` = živý web (každý push se nasadí). Ladí se ve větvi `dev` nebo v tématické větvi, do `main` jen po `npm run check`. Rozpracované návrhy, které nemají být ani v `dev`, patří do soukromého repozitáře `skoleeq-lab`.

## Příkazy

| | |
|---|---|
| `npm run dev` | lokální server http://localhost:8080 |
| `npm run validate` | registr + odkazy + synchronizace `site.config.json` |
| `npm run test` | unit + Playwright (Chromium, mobil; Firefox smoke) |
| `npm run check` | validate + test |
| `npm run sync` | po změně názvu/domény v `site.config.json` |

Prohlížeče pro testy: `npx playwright install chromium firefox`. Systémový Edge/Chrome: `PW_CHANNEL=msedge|chrome`.

## Kde co je

- Úvod `public/index.html`, katalogy `public/hriste/` a `public/vyklad/index.html`, `public/assets/portal.{js,css}`, schéma `public/assets/registry.js`
- Název webu / doména: `site.config.json` (pak `npm run sync`)
- Hlavičky: `public/_headers` (lokálně je čte `scripts/serve.mjs`)
- Dokumentace: `docs/DEPLOYMENT.md`, `docs/ADD_NEW_APP.md`, `docs/ARCHITECTURE.md`

## Nedělat

Žádné iframy v katalogu, SPA catch-all routing, CSP bez otestování všech her, `X-Frame-Options: DENY` (rozbije `test.html`), změnu klíče `klavesova-mise-v2`, vymyšlené URL v sitemap, ruční editaci karet v `index.html`.
