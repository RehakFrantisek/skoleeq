# Signál ze sondy

Výuková hra portálu Školeeq. Odpovídá tematickému plánu ICT školy pro 6. ročník (říjen, kódování a přenos dat): „Zakóduje v obrázku barvy více způsoby, zakóduje obrázek pomocí základních geometrických tvarů, zjednoduší zápis textu a obrázku, pomocí kontrolního součtu ověří úplnost zápisu“. Statická, bez serveru a bez knihoven, bez `eval`.

Sonda na cizí planetě (stejný příběh jako Robotí dílna a Šifrovací laboratoř) posílá snímky na Zemi. Každý bit stojí energii a okno spojení je krátké. Žák sestavuje zápis snímku, sleduje měřidlo „Přenos X z Y bitů“ a náhled toho, co na Zemi opravdu dorazí. Doručené snímky přibývají v albu.

- **URL:** `/aplikace/signal-ze-sondy/`, parametry `?varianta=A|B|C` a `?rezim=rychly` (stejné zadání pro celou třídu)
- **localStorage:** `vyukovy-portal:signal-ze-sondy:v1` (jen osobní rekord pro každý režim)
- **Ovládání:** myš, dotyk i klávesnice (výběry, přepínače, textová pole, tlačítka). V textových polích Enter = Odeslat a zkontrolovat.

## Soubory

| Soubor | Obsah |
|---|---|
| `logic.js` | čistá logika bez DOM: barvy kamery, snímky 8 × 8, terény a scény z tvarů, zápis „počet + znak“, ceník přenosu v bitech, generátor úloh ze seedu varianty, `check()` s konkrétním vysvětlením chyby, `solution()`, `isBetter()` |
| `app.js` | UI: titulní obrazovka → ukázka → 5 úrovní s úvodem → závěr; nástroj pro každý typ úlohy, měřidlo okna spojení, album |
| `style.css` | vzhled (tokeny `--ds-*` z design systému, motiv řídicího střediska) |

## Úrovně (celá mise 9 přenosů, rychlá 5)

1. **Barvy na cestu:** tabulka barev – podle polohy čísel v datech přiřaď ke každému číslu šestnáctkový kód a vyber nejmenší počet bitů na políčko, aby se přenos vešel (náhled na Zemi ukáže chybějící políčka) · spektrometr: převeď kód `#C04000` na RGB.
2. **Obrázek z tvarů:** doplň chybějící čísla v zápisu tvarů (po pixelech by se snímek nevešel) · seřaď přeházené pakety tvarů.
3. **Úseky:** zapiš dva řádky krajiny jako „počet + barva“ (háčky nejsou povinné, náhled se rozbaluje živě) · zkrať textové hlášení.
4. **Šum v kanálu:** spočítej kontrolní součet zprávy · najdi dva poškozené řádky podle součtu a vyžádej jen je (energie stačí přesně na dva).
5. **Velký přenos:** u tří snímků (z tvarů, terén, zrnitá fotka) vyber zápis; vejde se to jen s nejúspornější volbou u každého. Ceny se ukážou po odeslání.

Ceník (zjednodušený model): po pixelech = políčka × bity na barvu; úsek = 4 bity počet + bity na barvu; tvar = 2 bity druh + 4 bity za každé číslo + bity na barvu; barva v tabulce = 24 bitů; znak textu = 8 bitů.

Hodnocení: počet přenosů splněných napoprvé, pak méně nápověd, pak (jen se stopkami) čas. Nevyplněná odpověď se nepočítá jako pokus. Nápověda výsledek nesnižuje, po 2 pokusech jde zobrazit řešení.

## Úpravy obsahu

Snímky (`PICTURES`, řetězce číslic 0–6 o délce 8), terény (`TERRAINS`), scény z tvarů (`SCENES`) a texty jsou na začátku `logic.js`. Rozpočty se počítají automaticky: vejde se jen nejlevnější správný zápis. Po úpravě spusť `npm run test:unit` – test ověří, že každá úloha všech variant jde vyřešit, prázdná odpověď neprojde, tvary jsou u scén levnější než úseky, úseky u terénů levnější než pixely a v závěrečném přenosu se nevejde žádná horší volba.
