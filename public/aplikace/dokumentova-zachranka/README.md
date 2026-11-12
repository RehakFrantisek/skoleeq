# Dokumentová záchranka

Výuková hra portálu Školeeq (formátování dokumentu, hlavně 7. ročník). Statická, bez serveru a bez knihoven.

- **URL:** `/aplikace/dokumentova-zachranka/`, přímo na misi `#<id-mise>` (např. `#pozvanka`), `?vse=1` odemkne všechny mise
- **localStorage:** `vyukovy-portal:dokumentova-zachranka:v1` (stav misí: hotovo, hvězdy, body; přepínač „odemknout vše“)

## Soubory

| Soubor | Obsah |
|---|---|
| `missions.js` | **obsah 10 misí** – texty, výchozí dokument, cíle, nápovědy, ilustrace. Učitel může upravit bez zásahu do logiky |
| `model.js` | datový model dokumentu (bloky, značky po znacích), operace, historie Zpět/Znovu |
| `checks.js` | deterministické vyhodnocení stavu dokumentu, typografická pravidla, hvězdy a body |
| `app.js` | UI: přehled misí, editor, panel nástrojů, kontrola, dialogy, tisk a export HTML |
| `img/*.svg` | vlastní ilustrace (bez cizích licencí) |

## Editor – podporovaný rozsah

- Pravda je v modelu (`model.js`), DOM editoru se po každé změně vykreslí znovu. Každý blok je samostatný `contenteditable` – výběr nikdy nepřesáhne jeden blok.
- **Funguje:** psaní a mazání v bloku, výběr myší i Shift+šipkami, tučně/kurzíva/podtržení (tlačítka i Ctrl+B/I/U), styly Nadpis 1/Nadpis 2/Odstavec, zarovnání vlevo/na střed/vpravo/do bloku, odrážkový a číslovaný seznam, přesun bloku (tlačítka i Alt+Shift+↑/↓), vložení ilustrace ze sady, popisek a umístění obrázku, Zpět/Znovu (tlačítka, Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z), Nový pokus (jde vrátit), tisk / PDF, stažení HTML.
- **Záměrně ne:** Enter nevytváří nový odstavec (mise opravují existující bloky), vkládání ze schránky bere jen čistý text (cizí HTML se zahodí), přetahování textu myší je vypnuté.
- Psaní ve stejném bloku se pro Zpět slučuje do jednoho kroku.

## Kontrola

Hodnotí se **stav dokumentu**, ne posloupnost kliknutí: typ bloku, zarovnání, značka na přesném úseku textu (a nikde jinde), seznam (typ, pořadí, souvislost), pořadí odstavců, obrázek (ilustrace, místo, umístění, popisek), typografie (mezery, datum). Ke každé misi se přidává kontrola, že text zůstal zachovaný (mění se jen mezery) – smazáním textu se mise splnit nedá.

## Testy

`tests/unit/dokumentova-zachranka.test.mjs` (model, Zpět/Znovu, cíle, řešitelnost všech 10 misí) a `tests/e2e/dokumentova-zachranka.spec.js` (dohrání všech 10 misí přes editor, psaní, zkratky, schránka, reset, postup).
