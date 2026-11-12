# Design systém her Školeeq

Jednotný vzhled a herní průběh pro všechny výukové hry. **Hry nesdílí kód ani CSS** (každá je samostatná složka, viz [CLAUDE.md](../CLAUDE.md)). Design systém je proto dohoda: tokeny a komponenty si hra **zkopíruje** ze šablony [`templates/app/`](../templates/app/) a rozšíří o vlastní motiv. Vzorová plná implementace: [`public/aplikace/datovi-detektivove/`](../public/aplikace/datovi-detektivove/).

Proč kopírovat a ne sdílet: změna sdíleného CSS by mohla potichu rozbít starší hry. Kopie je pár kB a každá hra zůstane funkční i za rok.

## 1. Principy

- **Profesionálně hravé, ne infantilní.** Světlé plochy, čistá typografie, ilustrace z CSS/SVG.
- **Nácvik dovednosti před kvízem.** Žák pracuje s „nástrojem“ (tabulka, editor, graf), ne jen kliká na a/b/c.
- **Hrají všichni.** Žádné životy, žádné odečítání bodů, žádný časový limit jako jediný režim. Stopky jsou volitelné a ve výchozím stavu vypnuté.
- **Chyba je stopa.** Každá chybná odpověď dostane věcné „proč“ a žák opravuje dál, aniž by ztratil rozpracovaný stav.
- **Nápověda není neúspěch.** Počítá se zvlášť a výsledek úlohy nesnižuje.
- **Žádné veřejné srovnávání.** Jen osobní rekord v `localStorage` daného prohlížeče, s tlačítkem pro smazání.

## 2. Tokeny (CSS proměnné)

| Token | Hodnota | Použití |
|---|---|---|
| `--ds-bg` | `#f4f6f2` | pozadí stránky |
| `--ds-surface` / `--ds-surface-2` | `#fff` / `#f8faf8` | karty / vnořené plochy |
| `--ds-ink` / `--ds-ink-2` / `--ds-muted` | `#132a32` / `#34505b` / `#52656d` | text (všechny ≥ 4,5 : 1 na bílé) |
| `--ds-line` | `#d9e0dc` | okraje |
| `--ds-success` (+ `-ink`, `-soft`) | `#0f766e` | **úspěch**, postup, správná odpověď (tmavě zelená/tyrkysová) |
| `--ds-action` (+ `-ink`, `-soft`) | `#1d5fd6` | **interakce**: tlačítka, výběr, odkazy |
| `--ds-warn` (+ `-ink`, `-soft`) | `#b8480f` | **upozornění**, „ještě ne“ (oranžová, ne červená) |
| `--ds-focus` | `#1d4ed8` | obrys `:focus-visible` (3 px) |
| `--ds-radius` / `--ds-radius-sm` | `16px` / `10px` | zaoblení |
| `--ds-tap` | `44px` | minimální dotykový cíl |
| `--ds-font`, `--ds-font-display`, `--ds-mono` | systémová písma | žádné webfonty (rychlost, soukromí) |

Motiv konkrétní hry přidávej jako `--game-*` (např. Datoví detektivové: `--game-folder` – barva složky se spisem). Text na motivových barvách musí mít kontrast ≥ 4,5 : 1.

**Ne jen barva:** každý stav má i tvar nebo text – ikona ✓ / ! / i ve zpětné vazbě, „● “ a silný obrys u vybrané buňky, „Připravujeme“ jako text, vzory (tečky, šrafy) ve výsečích grafu.

## 3. Komponenty

| Komponenta | Třídy (šablona) | Pravidla |
|---|---|---|
| Horní lišta | `.bar`, `.back`, `.hud` | vždy odkaz „← Všechny hry“ (`href="/"`); HUD jen během hry |
| Progress bar | `<progress>` + text „Úloha 3 z 15“ | skutečný `<progress>` s `<label>` |
| Inventář nápověd | `.chip` s 🔍 a počtem | počet použitých nápověd, nic se neodečítá |
| Karta úlohy | `.case` / `.screen` | typ úrovně, číslo úlohy, nadpis (`tabindex="-1"`, dostane focus), zadání |
| Volby | `fieldset.choices > label.choice > input[type=radio]` | skutečné radio, celé políčko klikací, min. 44 px |
| Velká tlačítka | `.btn`, `--primary`, `--success`, `--ghost`, `--warn` | min. výška 48 px; `--ghost` pro vedlejší akce |
| Nápověda | `.hint` | postupně od obecné po konkrétní, aspoň 2 kroky |
| Zpětná vazba | `.feedback.is-good / .is-bad / .is-solution` | `role="status"`, ikona + tučný začátek („Správně.“ / „Ještě ne.“ / „Řešení:“) + vysvětlení |
| Úvod úrovně | `.folder` (DD) | název úrovně, na co se zaměřuje, počet úloh |
| Rekapitulace | `.stats`, `.skills` | přesnost (napoprvé), vyřešeno, nápovědy, volitelně čas; seznam konkrétních dovedností ✓ / ↻ |

## 4. Herní průběh (povinný pro každou hru)

1. **Titulní obrazovka:** co se naučíš (konkrétní dovednosti), čas, ovládání, volba délky (rychlý režim ~10 min), přepínač stopek (výchozí vypnuto), osobní rekord + smazání, odkaz „Pro učitele“ (`/pro-ucitele/#<id>`).
2. **Mini-tutoriál:** 1 ukázková úloha s vysvětlením rozhraní. Jde přeskočit.
3. **3–5 úrovní**, postupně těžších. Před úrovní krátký úvod.
4. **Úloha:** zadání → práce → *Zkontrolovat* → věcná zpětná vazba.
   - Správně: vysvětlení + „Další úkol →“ (dostane focus).
   - Špatně: vysvětlení „proč“, stav zůstává, žák opravuje. Po 2 pokusech se nabídne „Ukázat řešení“.
5. **Závěr:** konkrétní osvojené dovednosti, statistiky, „Hrát jinou variantu“, „Další hry“. Upozornění, že výsledek je jen v tomto prohlížeči.

**Hodnocení:** přesnost (vyřešeno napoprvé) → méně nápověd → (volitelně) rychlost. Funkce `isBetter()` v `datovi-detektivove/logic.js`.

## 5. Determinismus a data

- Úlohy generuj **lokálně** z pravidel a seedu (`mulberry32`). Žádné síťové API ani generativní AI ve hře.
- Varianty **A/B/C** = pevné seedy, aby sousedé neměli stejná čísla a učitel mohl promítat stejnou variantu. Parametry URL `?varianta=B&rezim=rychly`.
- Logiku (generování, vyhodnocení) drž v **čistém ES modulu bez DOM** (`logic.js`), ať jde testovat v `node --test` a používat v E2E testech.
- Všechny datasety jsou smyšlené. Žádná jména žáků – jen družstva, třídy („6.B“), dny, vymyšlené tituly.

## 6. Přístupnost (kontrolní seznam)

- [ ] sémantika: `main`, `header`, skutečné `button`/`a`/`label`, `fieldset` + `legend` u skupin voleb, `table` s `caption` a `th scope`
- [ ] vše ovladatelné klávesnicí; ve velké mřížce *roving tabindex* + šipky (jen jedna buňka v pořadí Tab)
- [ ] po přechodu na novou úlohu focus na nadpis úlohy; po vyřešení focus na „Další úkol“
- [ ] SVG grafy: `role="img"` + `aria-label` se shrnutím hodnot; klikací sloupce `role="button"`, `tabindex="0"`, Enter/mezerník
- [ ] `prefers-reduced-motion: reduce` vypne přechody a animace
- [ ] 320 px bez vodorovného scrollu stránky (široké tabulky scrollují uvnitř `.sheet__scroll`); pozor na grid položky – `min-width: 0`
- [ ] dotykové cíle ≥ 44 px, kontrast AA, `:focus-visible`
- [ ] klávesové zkratky jen když je hra aktivní a jen ty, které hra opravdu používá (DD: Ctrl/⌘+Z = Zpět při řazení)

## 7. Co je v šabloně a co ne

Šablona `templates/app/` obsahuje tokeny, lištu s HUD, titulní obrazovku, ukázku, úrovně s volbami, nápovědu, opravu chyb, „Ukázat řešení“, závěr s dovednostmi, volitelné stopky a lokální rekord. Pro složitější interakce (tabulka, grafy, řazení, filtry) se inspiruj v `datovi-detektivove/app.js` – zkopíruj potřebnou funkci, neimportuj ji.
