# Znakožrout

Výuková hra portálu Školeeq pro 7. ročník (textový editor: „dodržuje základní typografická pravidla“, „pohyb v dokumentu pomocí klávesnice i myši“; internet a komunikace: „chápe pojmy e-mail…“). Statická, bez serveru a bez knihoven, bez `eval`.

Znakožrout snědl ze školních textů speciální znaky. Žák je hledá na klávesnici (tři vrstvy: klávesa sama / Shift / pravý Alt = AltGr), vrací je do zpráv, píše adresy podle pravidla, otevírá trezor silným heslem a opravuje typografii. Snědené znaky se postupně vracejí ze „žaludku“ v postranním panelu.

- **URL:** `/aplikace/znakozrout/`, parametry `?varianta=A|B|C` a `?rezim=rychly`
- **localStorage:** `vyukovy-portal:znakozrout:v1` (jen osobní rekord pro každý režim). **Hesla z úlohy Trezor se neukládají.**
- **Ovládání:** fyzická klávesnice (doporučeno). Pod úlohou je klávesnice na obrazovce: zvýrazní stisknutou klávesu a vrstvu, na dotyku vkládá znaky (tlačítka Shift a AltGr fungují jednorázově). V polích Enter = Zkontrolovat.
- **Rozložení:** česká klávesnice QWERTZ ve Windows (`KEYBOARD` v `logic.js`). Mrtvé klávesy s diakritikou na AltGr v číselné řadě hra neuvádí. Vyhodnocuje se jen napsaný text, takže jiné rozložení (Mac) nevadí, jen se nemusí shodovat nápověda „kde znak bydlí“.

## Soubory

| Soubor | Obsah |
|---|---|
| `logic.js` | čistá logika bez DOM: rozložení klávesnice a mapa „znak → klávesa + vrstva“, texty úloh, generátor ze seedu varianty, `check()` s konkrétním vysvětlením, `solution()`, `passwordChecks()`, `isBetter()` |
| `app.js` | UI: titulní obrazovka → ukázka → 5 úrovní s úvodem → závěr; klávesnice se třemi vrstvami, nástroj pro každý typ úlohy, žaludek |
| `style.css` | vzhled (tokeny `--ds-*`, motiv fialového Znakožrouta, barvy vrstev: modrá = Shift, tmavá = sama, purpurová = AltGr) |

## Úrovně (celá hra 11 úloh, rychlá 6)

1. **Kde znak bydlí** (2 / 1): u tří znaků vyber na obrazovce klávesu (jsou na ní jen hlavní znaky – zbytek žák hledá na skutečné klávesnici) a vrstvu.
2. **Vyplivnuté znaky** (3 / 1): zpráva s mezerami a hromádka snědených znaků (! : ? :-) ( ) ; ° % @ # × ÷ < > \ _ / -); znaky se píšou do mezer.
3. **Adresy a názvy** (2 / 1): podle pravidla a příkladu napiš e-mail kroužku, adresu stránky třídy nebo název souboru (bez mezer, bez diakritiky, s `@ _ - / : .`). Domény jsou rezervované `*.example`.
4. **Trezor** (1 / 1): heslo s živě odškrtávanými pravidly (délka podle varianty, velké a malé písmeno, číslice, 2 různé znaky z vrstvy AltGr, zakázaná slova, žádný znak 3× za sebou).
5. **Typografická poradna** (3 / 2): oprav text: `-3 °C`, `40 %`, `120 Kč`, `(do Brna)`, `pátek, sraz`, `7:30!`, `3 × 4 = 12`, `12 : 4 = 3`.

Hodnocení: počet úloh splněných napoprvé, pak méně nápověd, pak (jen se stopkami) čas. Nevyplněná odpověď se nepočítá jako pokus. Druhá nápověda zvýrazní potřebné klávesy, po 2 pokusech jde zobrazit řešení. Minus lze psát spojovníkem `-` i znakem `−`, pevná mezera se bere jako mezera.

## Úpravy obsahu

Texty jsou na začátku `logic.js` (`WHERE_SETS`, `BLANK_TEXTS`, `RULE_TASKS`, `PASSWORD_RULES`, `FIX_TEXTS`). U `FIX_TEXTS` musí každá dvojice v `issues` obsahovat úsek, který je ve správném textu a ve špatném chybí. Po úpravě spusť `npm run test:unit` – test ověří, že každý znak úloh je na klávesnici, každá úloha všech variant jde vyřešit, prázdná odpověď neprojde a vzorová hesla splní pravidla.
