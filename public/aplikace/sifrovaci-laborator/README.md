# Šifrovací laboratoř: Signál ze sondy

Výuková hra portálu Školeeq (kódování a přenos dat, 6. ročník). Statická, bez serveru a bez knihoven, bez `eval`.
Příběhem navazuje na Robotí dílnu: zachráněná sonda posílá zprávy a žák je rozluští. Za každou zprávu se odkryje dílek fotky ze sondy.

- **URL:** `/aplikace/sifrovaci-laborator/`, parametry `?varianta=A|B|C` a `?rezim=rychly` (stejné zadání pro celou třídu)
- **localStorage:** `vyukovy-portal:sifrovaci-laborator:v1` (jen osobní rekord pro každý režim)
- **Ovládání:** myš, dotyk i klávesnice. Mřížky (pixely, parita) mají roving tabindex: Tab vstoupí jednou, šipky se pohybují, Enter/mezerník přepne políčko. V textových polích Enter = Zkontrolovat.

## Soubory

| Soubor | Obsah |
|---|---|
| `logic.js` | čistá logika bez DOM: kódování (bity, znaková sada, Morseovka), Caesarova šifra, kódování řádků obrázku, barvy RGB, parita, kontrolní číslice; generátor úloh ze seedu varianty, `check()` s konkrétním vysvětlením chyby, `solution()`, `isBetter()` |
| `app.js` | UI: titulní obrazovka → ukázka → 5 úrovní s úvodem → závěr; „nástroj“ pro každý typ úlohy (lampy, šifrovací kolo, mřížka, míchání barev, vektorová kresba, paritní mřížka) |
| `style.css` | vzhled (tokeny `--ds-*` z design systému, motiv noční laboratoře) |

## Úrovně a úlohy (celá mise 17 úloh, rychlá 6)

1. **Binární vysílačka:** rozsviť číslo lampami 16-8-4-2-1 · přečti číslo ze světel · slovo z pětic bitů (A = 1).
2. **Znaková sada:** dekóduj zprávu z kódů (výřez ASCII, mezera 32) · zakóduj odpověď · bity a bajty.
3. **Šifrovací kolo:** Caesar se známým klíčem · prolomení bez klíče zkoušením posunů · Morseovka · proč je Caesar slabý.
4. **Pixelová pohlednice:** nakresli obrázek podle čísel řádků · zakóduj dva řádky · namíchej barvu R/G/B (0/128/255, i šestnáctkově) · nastav kruh a obdélník souřadnicemi.
5. **Rušení signálu:** najdi převrácený bit podle parity · doplň kontrolní bity · najdi zprávu se špatnou kontrolní číslicí.

Hodnocení: počet úloh vyřešených napoprvé, pak méně nápověd, pak (jen se stopkami) čas. Nápověda výsledek nesnižuje, po 2 pokusech jde zobrazit řešení. Všechny zprávy a obrázky jsou vymyšlené.

## Úpravy obsahu

Slova, zprávy, obrázky 8 × 8 a barvy jsou v polích na začátku sekce „Obsah úloh“ v `logic.js` (písmena A–Z bez diakritiky, obrázky jako řetězce `#`/`.` o délce 8). Po úpravě spusť `npm run test:unit` – test ověří, že každá úloha všech variant jde vyřešit a prázdná odpověď neprojde.
