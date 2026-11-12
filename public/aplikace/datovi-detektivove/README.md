# Datoví detektivové

Výuková hra portálu Školeeq pro 6. ročník (tabulky a grafy). Statická stránka, bez serveru a bez knihoven.

- **URL:** `/aplikace/datovi-detektivove/` (parametry: `?varianta=A|B|C|N&rezim=rychly|standard|dlouha`)
- **localStorage:** `vyukovy-portal:datovi-detektivove:v1` – osobní rekord pro každý režim, předvolby; bez jmen
- **Soubory:** `logic.js` (čistá logika, testovaná), `app.js` (UI), `style.css`, `nahled.svg`

## Obsah

| Úroveň | Úlohy | Typ interakce |
|---|---|---|
| Spis 1: Školní bufet | najdi buňku · adresa buňky (C4) · shoda maxim · nula je údaj · součet | klik do buňky, výběr více buněk, číslo, volba |
| Spis 2: Knihovna a sportovní den | řazení celých řádků (past „jen sloupec“) · filtr se 2 podmínkami (≥ vs >) · na pořadí nezáleží · doplnění podle pravidla · různé jednotky | nástroj Seřadit + Zpět/Ctrl+Z, nástroj Filtr, úprava buňky |
| Spis 3: Grafy školní redakce | vhodný graf ×2 · sloupec neodpovídá tabulce · oprav osu (od 0) · který graf klame a proč | volba s náhledy, klik na sloupec grafu, přepínání osy, porovnání dvou grafů |
| Velký případ (dlouhá mise) | propojení dvou tabulek · procenta > 100 % · chybějící údaj ≠ 0 | číslo, volba nad grafem |

Režimy: **rychlý** 6 úloh (~10 min), **celá mise** 15 úloh ve 3 úrovních (~20 min), **dlouhá** 18 úloh (~35 min).
Varianty A/B/C mají pevný seed (stejná úloha pro promítání), „Náhodná“ náhodný.

## Testy

- `tests/unit/datovi-detektivove.test.mjs` – řazení, filtrování, adresy, jednotky, zkreslení osy, generátor (63 seedů), vyhodnocení a typické chyby
- `tests/e2e/datovi-detektivove.spec.js` – odehrání rychlého režimu, chyba → oprava, klávesnice, 320 px, snížený pohyb, rekord a jeho smazání
