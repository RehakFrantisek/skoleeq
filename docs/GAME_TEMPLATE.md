# Šablona nové hry

Zkopírovatelná šablona je ve složce **[`templates/app/`](../templates/app/)** (`index.html`, `style.css`, `app.js`, `README.md`). Je to funkční mini-hra podle [design systému](GAME_DESIGN_SYSTEM.md): titulní obrazovka → ukázka → úrovně → závěr, s nápovědou, opravou chyb, volitelnými stopkami a lokálním rekordem. Komentáře v souborech vysvětlují, co nahradit.

> Zadání počítalo se složkou `_template`. Šablona je místo toho v `templates/app/` mimo `public/`: nenasadí se jako veřejná stránka a používá ji generátor `npm run new-app`.

## 1. Založení hry

```bash
npm run new-app -- sifrovaci-laborator "Šifrovací laboratoř"
```

Vytvoří `public/aplikace/sifrovaci-laborator/` (placeholdery `{{ID}}` a `{{TITLE}}` jsou nahrazené) a přidá do [`public/apps.json`](../public/apps.json) záznam se stavem `draft` – katalog ho zatím neukáže, přímá URL ale funguje.

Ručně: zkopíruj obsah `templates/app/` do `public/aplikace/<slug>/` a nahraď `{{ID}}` slugem a `{{TITLE}}` názvem.

## 2. Programování

1. V `app.js` nahraď `TUTORIAL`, `LEVELS` a `SKILLS` vlastními úlohami. Každá úloha má mít `why` ke každé možnosti (vysvětlení „proč“) a aspoň 2 nápovědy.
2. Složitější hra: přesuň čistou logiku (generování úloh ze seedu, vyhodnocení) do `logic.js` jako ES modul bez DOM a v `index.html` načti `app.js` jako `type="module"`. Vzor: `public/aplikace/datovi-detektivove/`.
3. Motiv hry: přidej `--game-*` proměnné a SVG ilustrace přímo do složky hry. Žádné cizí obrázky s nejasnou licencí.
4. `localStorage` jen pod `vyukovy-portal:<slug>:v1`, vždy v `try/catch`, s tlačítkem „Smazat moje výsledky“.

## 3. Přidání do katalogu

V `public/apps.json` doplň záznam (schéma a whitelisty: [`public/assets/registry.js`](../public/assets/registry.js), tabulka polí: [ADD_NEW_APP.md](ADD_NEW_APP.md)):

```json
{
  "id": "sifrovaci-laborator",
  "title": "Šifrovací laboratoř",
  "subtitle": "Caesar, znakové sady a kontrolní součet",
  "description": "Zakóduj a rozšifruj zprávy a zjisti, proč didaktická šifra není skutečná ochrana.",
  "url": "/aplikace/sifrovaci-laborator/",
  "subject": "Informatika",
  "grades": [6],
  "topics": ["Kódování a šifry"],
  "difficulty": "stredni",
  "durationMinutes": 15,
  "icon": "lock",
  "color": "violet",
  "requiresKeyboard": false,
  "status": "published",
  "skills": ["Caesarova šifra", "Znaková sada"],
  "teacher": {
    "goals": ["…"],
    "svp": [{ "grade": 6, "text": "zašifruje a dešifruje text pomocí několika šifer" }],
    "lesson": "…",
    "prerequisites": ["…"],
    "reflection": ["…", "…", "…"],
    "differentiation": "…",
    "gradeNote": "Pracovní návrh – ročník lze upravit."
  }
}
```

- `status`: `planned` = karta „Připravujeme“ (neklikatelná, složka hry ještě nemusí existovat), `published` = hratelná, `draft`/`hidden` = mimo katalog.
- `teacher.svp` cituj **doslova** z přepisu ŠVP. Rozvržení do ročníků označ v `gradeNote` jako pracovní návrh, dokud ho škola nepotvrdí.
- Karta „Pro učitele“ se vygeneruje automaticky na `/pro-ucitele/#<id>`; HTML katalogu ani stránky pro učitele se neupravuje.

## 4. Testy a kontrola

1. Přímou URL každé publikované hry testuje automaticky `tests/e2e/catalog.spec.js`.
2. Logika v `logic.js` → unit testy `tests/unit/<slug>.test.mjs` (vzor: `datovi-detektivove.test.mjs` – pro desítky seedů ověř, že úlohy mají jednoznačnou odpověď a správná odpověď projde).
3. E2E `tests/e2e/<slug>.spec.js`: odehrání od začátku do konce, chyba → vysvětlení → oprava, ovládání klávesnicí, 320 px (`@mobile`).
4. `npm run check` musí být zelený. Pak `npm run dev` a ruční kontrola na 320 px, desktopu a jen klávesnicí.
