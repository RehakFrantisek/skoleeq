# Robotí dílna: Záchrana sondy

Výuková hra portálu Školeeq (algoritmizace a programování; podle tematického plánu ICT školy 6. a 9. ročník, obtížnost misí je odstupňovaná). Statická, bez serveru, bez Scratche a bez `eval`.

- **URL:** `/aplikace/roboti-dilna/`, přímo na misi `#<id-mise>` (např. `#dve-cesty`), `?vse=1` odemkne všechny mise
- **localStorage:** `vyukovy-portal:roboti-dilna:v1`

## Soubory

| Soubor | Obsah |
|---|---|
| `missions.js` | **obsah 12 misí** – příběh, zadání, mapy (ASCII), cíle, odemčené bloky, požadavky, nápovědy, referenční řešení |
| `engine.js` | simulátor mřížky a interpret stromu příkazů (generátor), limity, cíle, vyhodnocení misí, hvězdy |
| `app.js` | UI: přehled, editor bloků, mapa (SVG), běh / krokování / pozastavení / reset, záznam, nápověda |

## Editor programu

- **Přetahování** (myš, pero, dotyk): blok z nabídky se dá pustit kamkoli do programu – mezi dva bloky, na začátek, do cyklu nebo větve. Bloky v programu se přesouvají tažením za lištu (myš) nebo za úchyt ⠿ (dotyk). Fialová čára ukazuje, kam blok dopadne; neplatné místo (blok do sebe sama, vnoření > 3) je oranžové a nic se nezmění. Esc přetahování zruší, okraje okna a programu se při tažení samy posouvají.
- **Kliknutí**: blok z nabídky se vloží na označené místo („sem se vloží další blok“). Místo se nastaví kliknutím na blok (vkládá se za něj), do mezery mezi bloky (objeví se ＋) nebo na „＋ vkládat sem“.
- **Klávesnice**: Tab na blok, Enter ho vybere; Alt+↑/↓ ho posune, Delete smaže; tlačítka ↑ ↓ ✕ fungují dál.

## Model simulace

- Mřížka max. 10 × 10, robot má (x, y) a směr N/E/S/W. Každý příkaz je jeden diskrétní krok.
- Zeď, kámen, anténa i okraj mapy blokují pohyb – robot se zastaví a hra napíše důvod („Robot narazil do zdi na políčku [5, 3].“). Souřadnice pro žáky jsou [sloupec, řádek] od 1.
- Příkazy: Jdi vpřed, Otoč vlevo/vpravo, Vezmi, Polož; bloky Opakuj N× (1–10) a Když (před tebou je překážka / stojíš na baterii) s větví jinak.
- Podmínky se vyhodnocují **za běhu**. Limit 400 vykonaných instrukcí a max. 3 úrovně vnoření – běh vždy bezpečně skončí s vysvětlením.
- Animace jen zobrazuje události interpretu; výsledek na rychlosti ani na `prefers-reduced-motion` nezávisí.

## Vyhodnocení

Program se spustí na **všech mapách mise** (mise 9, 10 a 12 mají dvě mapy). Primárně se hodnotí cílový stav (poloha, natočení, posbírané předměty, kontrolní body, doručené baterie), sekundárně počet bloků, vykonaných kroků a resetů. Přijímá se jakékoli správné řešení; povinný cyklus, podmínka nebo limit bloků jsou vždy výslovně napsané v zadání mise.

## Úpravy map

Legenda: `#` zeď, `o` kámen, `.` volno, `S` start, `G` cíl, `A` anténa, `B` baterie, `V` vzorek, `K` kontrolní bod, `D` dok sondy. Po úpravě spusť `npm run test:unit` – test ověří dosažitelnost políček a že referenční řešení projde na všech mapách.
