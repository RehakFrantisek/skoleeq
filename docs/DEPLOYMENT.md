# Nasazení: GitHub → Cloudflare Pages

Portál je čistě statický. Cloudflare Pages jen vezme složku `public/` z repozitáře a rozešle ji po CDN s HTTPS. Žádný server, databáze ani API klíče. Free plán stačí.

> Ověřeno podle oficiální dokumentace Cloudflare k 2026-11-11. Rozhraní dashboardu se občas mění. Pokud se názvy tlačítek liší, řiď se odkazy na konci.

## 1. GitHub repozitář

1. Na <https://github.com/new> vytvoř repozitář (např. `skoleeq`). Může být veřejný i soukromý; Cloudflare umí obojí. **Nezaškrtávej** README ani .gitignore, ty už jsou v projektu.
2. V kořeni projektu:

   ```bash
   git remote add origin https://github.com/<uzivatel>/skoleeq.git
   ```

   ```bash
   git push -u origin main
   ```
3. Po prvním pushi se v záložce **Actions** spustí workflow **Kontrola** (`.github/workflows/check.yml`): validace registru, unit testy a Playwright smoke testy (Chromium, mobil, Firefox). Při chybné registraci hry selže.
4. *(Doporučeno, až bude na projektu víc lidí)* **Settings → Branches → Add branch ruleset** pro `main`: zakázat přímý push, vyžadovat pull request a úspěšný check **Kontrola**.

Pokud je repozitář veřejný, můžeš jeho adresu doplnit do `site.config.json` → `repoUrl` (zatím jen pro evidenci). Odkaz „GitHub“ do patičky přidej ručně, až repozitář opravdu existuje.

## 2. Cloudflare Pages projekt

1. Přihlas se na <https://dash.cloudflare.com> (účet je zdarma).
2. **Workers & Pages** → **Create application** → záložka **Pages** → **Connect to Git** (případně „Import an existing Git repository“).
3. Vyber **GitHub**, autorizuj Cloudflare (stačí přístup jen k tomuto repozitáři) a zvol repozitář `skoleeq` → **Begin setup**.
4. Nastavení buildu:

   | Pole | Hodnota |
   |---|---|
   | Project name | `skoleeq` (z něj vznikne `skoleeq.pages.dev`, pokud je volné) |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | *nech prázdné* (případně `exit 0`) |
   | Build output directory | `public` |
   | Root directory (advanced) | *nech prázdné* = kořen repozitáře |

   Nepovinné: v **Environment variables** přidej `SKIP_DEPENDENCY_INSTALL` = `1`. Cloudflare pak neinstaluje devDependencies (Playwright), které pro web nepotřebuje, a nasazení je rychlejší.
5. **Save and Deploy**. Za chvíli dostaneš adresu `https://<projekt>.pages.dev`.

Projekt nech napojený na Git, **nepřepínej na Direct Upload**. Git-integrovaný projekt už pak na Direct Upload přepnout nejde, a hlavně by se ztratily automatické náhledy pull requestů.

## 3. Ověření po nasazení

Otevři a zkontroluj:

- `https://<projekt>.pages.dev/`: katalog se načte a ukáže Klávesovou misi.
- `https://<projekt>.pages.dev/aplikace/klavesova-mise/`: hra běží, zkratky fungují, odkaz „← Všechny hry“ vede zpět.
- `https://<projekt>.pages.dev/neexistuje/`: stránka 404 portálu.
- `https://<projekt>.pages.dev/o-projektu/`
- Volitelně `…/aplikace/klavesova-mise/test.html` (v **anonymním okně**, test přepíše uložený postup) by po ~50 s měl ukázat `PASS`. Cloudflare může adresu zkrátit na `…/test` (pretty URLs), to je v pořádku.
- Hlavičky: v DevTools → Network → dokument by měl mít `x-content-type-options: nosniff` a `referrer-policy: strict-origin-when-cross-origin` (z `public/_headers`).

## 4. Jak probíhají změny

| Akce | Výsledek |
|---|---|
| push / merge do `main` | nové **produkční** nasazení (cca 1 min) |
| push do jiné větve nebo pull request | **preview** nasazení na vlastní adrese `https://<hash>.<projekt>.pages.dev` (a `https://<větev>.<projekt>.pages.dev`). Produkce se nemění. Odkaz se objeví u PR na GitHubu. |

Doporučený postup: větev → PR → zelená **Kontrola** + proklikání preview → merge.

### Větve (od 2026-11-27)

| Větev | K čemu |
|---|---|
| `main` | **jediná živá verze** – co je tady, to je na webu |
| `dev` | ladění a testování; sem se slučuje rozpracovaná práce, odtud se po `npm run check` a proklikání slučuje do `main` |
| `<téma>` (např. `vyklad-fotosynteza`) | jedna rozpracovaná hra nebo výklad; slučuje se do `dev` |

Preview adresy pro jiné větve než `main` vznikají jen tehdy, když jsou v Cloudflare zapnuté buildy i pro neprodukční větve (u projektu: **Settings → Builds → Branch control**). Bez toho se ostatní větve zkoušejí lokálně přes `npm run dev`.

## 5. Vlastní doména

Doménu můžeš připojit kdykoli později. Do té doby web normálně běží na `*.pages.dev`.

V Cloudflare: **Workers & Pages** → projekt → **Custom domains** → **Set up a domain** → zadej doménu → **Continue**.

### a) Subdoména (např. `hry.mojeskola.cz`)

- Doména **nemusí** být v Cloudflare.
- Nejdřív doménu přidej v Pages (krok výše), **pak** u svého DNS poskytovatele vytvoř záznam:

  | Typ | Název | Hodnota |
  |---|---|---|
  | CNAME | `hry` | `<projekt>.pages.dev` |

  (Pořadí je důležité: CNAME bez přidání domény v Pages končí chybou 522.)
- Pokud doména v Cloudflare je, Cloudflare záznam vytvoří sám.

### b) Kořenová doména / apex (např. `skoleeq.cz`)

- Doména **musí být zónou v Cloudflare** na stejném účtu: **Add a domain** v dashboardu, pak u registrátora domény změň **nameservery** na ty, které ti Cloudflare ukáže. Propagace trvá minuty až desítky hodin.
- Poté v Pages → Custom domains přidej `skoleeq.cz`. CNAME záznam se vytvoří automaticky.

### Ověření, HTTPS, www

- Stav domény v **Custom domains** přejde z *Verifying* na *Active*. Certifikát HTTPS vystaví Cloudflare automaticky (obvykle do několika minut).
- Pokud máš u domény **CAA záznamy**, musí povolovat certifikační autority, které Cloudflare používá (viz dokumentace Custom domains → Known issues).
- **www vs. bez www:** rozhodni se pro jednu variantu jako hlavní. Druhou přidej také jako custom domain a nastav přesměrování 301 přes **Bulk Redirects** (účet) nebo **Redirect Rules** (zóna), např. `www.skoleeq.cz/*` → `https://skoleeq.cz/${1}`.
- Pak doplň finální adresu do `site.config.json`:

  ```json
  "siteUrl": "https://skoleeq.cz"
  ```

  ```bash
  npm run sync
  ```

  Tím vznikne `public/sitemap.xml` a do `robots.txt` se doplní řádek `Sitemap:`. Commitni a pushni.
- *(Volitelně)* Přesměruj `<projekt>.pages.dev` na vlastní doménu přes Bulk Redirects, aby vyhledávače neindexovaly dvě adresy.

## 6. Rollback

Rychle (bez změny kódu):
**Workers & Pages** → projekt → **Deployments** → u posledního funkčního nasazení **⋯ → Rollback to this deployment**. Produkce se okamžitě přepne.

Trvale (v Gitu):

```bash
git revert <hash-chybneho-commitu>
```

```bash
git push
```

Nové nasazení pak odpovídá opravenému stavu. Po rollbacku v dashboardu vždy pushni i opravu do `main`, jinak ji další push přepíše.

## 7. Limity (Free plán)

Orientačně podle dokumentace k 2026-11-11: **500 buildů měsíčně**, **20 000 souborů** na projekt, **25 MiB** na jeden soubor. Pro tento portál je to s velkou rezervou. Pokud budou hry obsahovat velká videa či zvuky, hlídej limit 25 MiB. Aktuální čísla ověř na stránce Limits.

## Co musí vlastník udělat ručně

1. Vytvořit GitHub repozitář a pushnout `main`.
2. Na Cloudflare vytvořit Pages projekt a autorizovat GitHub (viz krok 2).
3. (Později) připojit doménu, nastavit DNS, doplnit `siteUrl` a spustit `npm run sync`.
4. (Volitelně) ochrana větve `main`.

## Oficiální zdroje

- Git integration: <https://developers.cloudflare.com/pages/get-started/git-integration/> a <https://developers.cloudflare.com/pages/configuration/git-integration/>
- Static HTML: <https://developers.cloudflare.com/pages/framework-guides/deploy-anything/>
- Build configuration: <https://developers.cloudflare.com/pages/configuration/build-configuration/>
- Custom domains: <https://developers.cloudflare.com/pages/configuration/custom-domains/>
- Headers: <https://developers.cloudflare.com/pages/configuration/headers/>
- Redirects: <https://developers.cloudflare.com/pages/configuration/redirects/>
- Rollbacks: <https://developers.cloudflare.com/pages/configuration/rollbacks/>
- Limits: <https://developers.cloudflare.com/pages/platform/limits/>
- GitHub: <https://docs.github.com/>
