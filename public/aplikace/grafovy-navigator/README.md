# Grafový navigátor: Síť základen

Výuková hra portálu Školeeq (modelování a grafy, 6. ročník). Statická, bez serveru a bez knihoven, bez `eval`.
Příběhem navazuje na Robotí dílnu a Šifrovací laboratoř: na planetě vzniká síť základen. Každá vyřešená úloha rozsvítí další základnu v síti.

- **URL:** `/aplikace/grafovy-navigator/`, parametry `?varianta=A|B|C` a `?rezim=rychly` (stejné zadání pro celou třídu)
- **localStorage:** `vyukovy-portal:grafovy-navigator:v1` (jen osobní rekord pro každý režim)
- **Ovládání:** myš, dotyk i klávesnice. Základny, kabely a stavy automatu jsou SVG tlačítka (Tab, Enter/mezerník) s popiskem pro čtečky; ke každé mapě je i textový seznam cest.

## Soubory

| Soubor | Obsah |
|---|---|
| `logic.js` | čistá logika bez DOM: rozvržení map, sousedé, Dijkstra (ohodnocená i „nejméně úseků“), dosažitelnost v orientovaném grafu, Kruskal (kostra) a rozbor sítě (okruh, odříznuté uzly), automat dveří, rozvrh dvou robotů (kontrola závislostí a souběhu, nejkratší doba hrubou silou); generátor úloh ze seedu, `check()` s vysvětlením, `solution()` |
| `app.js` | UI: průběh podle design systému; nástroje: výběr uzlů, stavba trasy (rover, krok zpět, energie), stavba kabelů, automat, plánovač s časovou osou |
| `style.css` | vzhled (tokeny `--ds-*`, motiv plánovacího centra) |

## Úrovně (celá mise 11 úloh, rychlá 5)

1. **Mapa jako graf:** sousedé základny · trasa s nejméně úseky.
2. **Nejkratší trasa:** nejlevnější trasa v ohodnoceném grafu · rover s energií přesně na nejkratší trasu.
3. **Síť kabelů:** nejlevnější propojení 6 a 7 základen (kostra grafu); hra hlídá okruhy a odříznuté základny.
4. **Šipky a automaty:** ze kterých základen se dá dojet do cíle · trasa po jednosměrkách · automat dveří (Zamčeno / Odemčeno / Otevřeno) podle posloupnosti vstupů.
5. **Souběžná práce:** výchozí plán (vše u robota A) je platný, ale pomalý; žák rozdělí práce mezi dva roboty se závislostmi a dosáhne nejkratší možné doby.

Přijímá se jakékoli optimální řešení (jiná trasa či kostra se stejnou cenou, jiný rozvrh se stejnou dobou).
