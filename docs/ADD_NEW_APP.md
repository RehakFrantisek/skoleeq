# Jak přidat novou hru

Cíl: nová hra se do portálu přidá **za pár minut** a nic dalšího v portálu se kvůli ní nemění.
Vzhled a herní průběh: [GAME_DESIGN_SYSTEM.md](GAME_DESIGN_SYSTEM.md). Šablona: [GAME_TEMPLATE.md](GAME_TEMPLATE.md).
Stačí nová složka a jeden záznam v `public/apps.json`. Katalog, filtry i smoke testy si hru najdou samy.

## Rychlá cesta (generátor)

```bash
npm run new-app -- binarni-vyzva "Binární výzva"
```

Vytvoří `public/aplikace/binarni-vyzva/` ze šablony `templates/app/` (funkční ukázkový kvíz) a přidá do registru záznam se stavem `draft`. Katalog ho zatím nezobrazí.

## Postup krok za krokem

1. **Složka a soubory:** `public/aplikace/<slug>/index.html` a k tomu vlastní `style.css`, `app.js`, obrázky, zvuky…
   - `slug` = malá písmena bez diakritiky, číslice a pomlčky (`binarni-vyzva`, `sifry-1`). Je zároveň `id` i část URL.
2. **Relativní cesty:** všechny lokální soubory hry odkazuj relativně (`style.css`, `img/robot.svg`), ne `/style.css`. Hra musí fungovat v podadresáři `/aplikace/<slug>/`.
   - Výjimky: odkaz zpět do katalogu `href="/"` a favicon portálu `/favicon.svg`.
3. **localStorage:** jen pod vlastním klíčem `vyukovy-portal:<slug>:v1`. Všechny hry běží na jedné doméně a sdílí jeden `localStorage`, takže kolize klíčů by si navzájem mazaly postup.
   - Klávesová mise si ponechává svůj původní klíč `klavesova-mise-v2` kvůli kompatibilitě s uloženým postupem.
   - Když změníš formát uložených dat, zvyš verzi (`:v2`), ať stará data nerozbijí hru.
4. **Záznam v `public/apps.json`:**

   ```json
   {
     "id": "binarni-vyzva",
     "title": "Binární výzva",
     "subtitle": "Nuly a jedničky",
     "description": "Převáděj čísla mezi desítkovou a dvojkovou soustavou a odemkni trezor.",
     "url": "/aplikace/binarni-vyzva/",
     "subject": "Informatika",
     "grades": [7, 8, 9],
     "topics": ["Číselné soustavy", "Kódování"],
     "difficulty": "stredni",
     "durationMinutes": 15,
     "icon": "binary",
     "color": "teal",
     "featured": false,
     "requiresKeyboard": false,
     "status": "published"
   }
   ```

   | Pole | Pravidla |
   |---|---|
   | `id` | slug, unikátní |
   | `url` | přesně `/aplikace/<id>/` |
   | `title` / `subtitle` / `description` | neprázdný text (max. 60 / 80 / 300 znaků), bez `<` `>` |
   | `subject` | text (např. `Informatika`, `Matematika`). Filtr předmětů se generuje z registru, nový předmět nic dalšího nevyžaduje |
   | `grades` | celá čísla 1–9 |
   | `topics` | 1–8 krátkých textů. Jednotné názvy témat napříč hrami = lepší filtr |
   | `difficulty` | `lehka` · `stredni` · `narocna` |
   | `durationMinutes` | kladné celé číslo (orientační, ověř při testování ve třídě) |
   | `icon` | `keyboard` `mouse` `binary` `code` `lock` `network` `globe` `puzzle` `book` `calculator` `chart` `robot` `slides` `document` |
   | `color` | `violet` `blue` `teal` `green` `orange` `red` `pink` `yellow` |
   | `featured` | volitelné; první `true` se ukáže v hero sekci jako „Doporučujeme“ |
   | `requiresKeyboard` | `true` = na kartě „Vyžaduje klávesnici“ a upozornění na dotykových zařízeních |
   | `thumbnail` | volitelné; název obrázku ve složce hry (`nahled.svg`, `nahled.webp`, poměr cca 16:7). Jinak se použije ikona |
   | `status` | `published` (v katalogu) · `planned` (karta „Připravujeme“ bez odkazu; složka hry zatím nemusí existovat) · `draft` / `hidden` (není v katalogu, URL ale funguje) |
   | `skills` | volitelné; 1–8 krátkých dovedností, které hra trénuje |
   | `teacher` | volitelné; karta na `/pro-ucitele/#<id>`: `goals[]`, `svp[]` (`{ "grade": 6, "text": "doslovná citace" }`), `lesson`, `prerequisites[]`, `reflection[]`, `differentiation`, `gradeNote`. Vzor: [GAME_TEMPLATE.md](GAME_TEMPLATE.md) |

   Pole a whitelisty jsou definované na jednom místě: [`public/assets/registry.js`](../public/assets/registry.js). Novou ikonu nebo barvu přidáš tam (a SVG ikony do `portal.js`, barvu do `portal.css`).
5. **Testy:** přímou URL každé publikované hry automaticky kontroluje `tests/e2e/catalog.spec.js` („každá publikovaná hra má funkční přímou URL bez chyb“): HTTP 200, žádné chyby v konzoli, žádné 404 assetů. Složitější hra si zaslouží vlastní `tests/e2e/<slug>.spec.js` (vzor: `klavesova-mise.spec.js`).
6. **Kontrola:**

   ```bash
   npm run check
   ```

   Pak `npm run dev` a vizuálně ověř hru na **320 px** (DevTools → responzivní režim) i na desktopu. Hlídej vodorovný scroll, čitelnost a ovladatelnost klávesnicí.
7. **Commit → PR → preview na Cloudflare Pages → merge.** Po merge do `main` je hra do minuty v produkci.
8. **Nezávislost:** hra nesmí importovat kód z jiné hry ani z `/assets/` portálu, nesmí spoléhat na centrální stav a nesmí přidávat externí CDN, analytiku ani trackery.

## Kontrolní seznam

- [ ] `public/aplikace/<slug>/index.html` existuje, `<html lang="cs">`, `<meta name="viewport">`, smysluplný `<title>`
- [ ] relativní cesty k vlastním souborům
- [ ] odkaz zpět do katalogu (`href="/"`), který nepřekrývá ovládání hry
- [ ] `localStorage` jen pod `vyukovy-portal:<slug>:v1`, zabalené v `try/catch`
- [ ] ovladatelné klávesnicí, viditelný focus, `prefers-reduced-motion`
- [ ] žádné chyby v konzoli, funguje na 320 px
- [ ] záznam v `apps.json`, `npm run check` je zelený
