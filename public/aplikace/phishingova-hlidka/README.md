# Phishingová hlídka

Výuková hra portálu Školeeq (bezpečnost na internetu; podle tematického plánu ICT školy 7. ročník, opakování v 9.). Statická, bez serveru a bez knihoven, bez `eval`.
Žák je členem bezpečnostního týmu fiktivní ZŠ Lipová: v e-mailech, SMS, chatech a konceptech příspěvků označuje podezřelé části 🚩 a vynáší verdikt.

- **URL:** `/aplikace/phishingova-hlidka/`, parametry `?varianta=A|B|C` a `?rezim=rychly` (stejné zadání pro celou třídu)
- **localStorage:** `vyukovy-portal:phishingova-hlidka:v1` (jen osobní rekord pro každý režim). Heslo z úlohy se nikam neukládá.
- **Ovládání:** myš, dotyk i klávesnice. Části zprávy jsou `role="button"` s `aria-pressed`: Tab na ně přejde, Enter/mezerník je označí. Fokus nebo najetí na odkaz ukáže ve stavovém řádku, kam odkaz opravdu vede. V poli pro heslo Enter = Zkontrolovat.

## Soubory

| Soubor | Obsah |
|---|---|
| `logic.js` | čistá logika bez DOM: obsah všech úloh, verdikty, generátor mise ze seedu varianty, `check()` s konkrétním vysvětlením, `solution()`, odhad síly hesla `passwordReport()`, `isBetter()` |
| `app.js` | UI: titulní obrazovka → ukázka → 4 úrovně s úvodem → závěr; nástroje „zpráva se stopami“ (e-mail, SMS, chat, příspěvek), „výběr“ a „stavba hesla“ s živým měřákem |
| `style.css` | vzhled (tokeny `--ds-*` z design systému, motiv bezpečnostního centra) |

## Úrovně (celá služba 12 úloh, rychlá 6)

1. **Podezřelé e-maily** (3 z 5): plná schránka, výhra ve hře, zásilka s `.pdf.exe`, změna čísla účtu (ověřit), bezpečný e-mail od třídní.
2. **SMS a chaty** (3 z 5): doplatek za balík, „ahoj, tady máma“, falešná podpora hry, telefon za 1 Kč, bezpečná zpráva od spolužáka.
3. **Hesla a přihlášení** (3, vždy včetně stavby hesla): stavba hesla bez údajů z profilu, nejsilnější heslo, jedno heslo všude, nečekaný kód z SMS, kam heslo uložit.
4. **Co o sobě sdílím** (3 z 4): dovolená a prázdný byt, doučování s adresou a telefonem, selfie s cedulí ulice a polohou, bezpečný příspěvek z turnaje.

U podvodné zprávy je třeba najít aspoň `need` stop (ne všechny) a zvolit správný verdikt. Označení nevinné části se vysvětlí („Tohle je v pořádku…“). Úroveň vždy začíná jasným podvodem a obsahuje i klidnější případ (bezpečné / ověřit).

**Síla hesla:** entropie = délka × log2(velikost abecedy), snížená za běžná hesla, řady (123, qwertz), opakování a údaje z profilu (i se záměnami 0→o, @→a). „Silné“ = aspoň 60 bitů. Doba prolomení předpokládá 10 miliard pokusů za sekundu – je orientační.

## Pravidla obsahu

- Všechny adresy, firmy, hry a sítě jsou vymyšlené; **domény končí na `.test`** (rezervovaná doména). Unit test to hlídá.
- Žádná skutečná jména, čísla ani značky. Telefonní číslo je jen maska `6XX XXX XXX`.
- Po úpravě obsahu spusť `npm run test:unit` – test ověří, že každá úloha jde vyřešit, prázdná odpověď neprojde a každá část zprávy má vysvětlení.
