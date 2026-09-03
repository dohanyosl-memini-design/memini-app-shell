# connectors.hu – külső szolgáltatás-szinkron (pl. Billingo)

Ez a leírás arra válaszol: **mi az a connectors.hu, hogyan telepítem a CLI-t,
és hol él a token.**

## Mi ez, és mi nem

A [connectors.hu](https://connectors.hu) egy külső szolgáltatás, amelyhez egy
`connectors` nevű parancssori eszköz (CLI) tartozik. A CLI magyar üzleti
rendszerekkel (pl. **Billingo** számlázás) szinkronizál egy API-tokenen
keresztül.

- **Nem** része a Memini alkalmazás kódjának, és nem fut a Vercelen.
- Egy különálló bináris, amit a fejlesztő/üzemeltető gépére telepítesz.
- A repó csak **kényelmi bekötést** ad hozzá: a token neve dokumentálva van
  (`.env.example`), és van egy átlátható telepítő szkript.

> A Memini saját MCP-integrációja ettől független — az a `.mcp.json`-ban a
> `memini-crm` szerver, ami a saját Vercel appot hívja. A connectors.hu egy
> harmadik fél eszköze.

## Telepítés

Két egyenértékű mód. **Mindkettő ugyanazt a bináris CLI-t** tölti le a hivatalos
GitHub release-ből (`Szotasz/connectors-cli`) a `~/.local/bin` mappába.

### 1) Repóban követett szkript (ajánlott)

Ez olvasható a forráskódban, így látod, mit futtatsz:

```bash
npm run connectors:setup
# vagy közvetlenül:
bash scripts/connectors-setup.sh
```

### 2) Hivatalos egysoros telepítő

```bash
curl -fsSL https://connectors.hu/install.sh | sh
```

> Óvatosság: a `curl … | sh` egy távoli szkriptet futtat közvetlenül a
> shellben. Ezért adunk a repóban egy átlátható változatot (1. mód) — érdemes
> azt használni, vagy a szkriptet előbb letölteni és elolvasni.

Ha a `~/.local/bin` nincs a `PATH`-on, a telepítő kiírja, mit tegyél hozzá a
`~/.zshrc` / `~/.bashrc` fájlhoz:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Token

A CLI a `CONNECTORS_HU_TOKEN` környezeti változóval hitelesít. A tokent a
connectors.hu vezérlőpultján generálod:
**https://connectors.hu/dashboard/api-keys** — formátuma `cnk_...`.

```bash
export CONNECTORS_HU_TOKEN=cnk_...
```

**A token titok.** Soha ne kerüljön a repóba, a `.env.example`-be vagy a
Vercelre. A `.env.example` csak a változó **nevét** dokumentálja üres értékkel.
A tokent a saját környezetedben (shell, `.env` – ami git-ignore-olt, vagy a
futtató szerver env-je) add meg.

## Használat

```bash
connectors sync                                  # szinkron indítása
connectors billingo list-documents --top 5       # pl. Billingo számlák listája
```

## Fájlok a repóban

| Fájl | Szerep |
|------|--------|
| `scripts/connectors-setup.sh` | Átlátható telepítő (a hivatalos install.sh megfelelője) |
| `.env.example` → `CONNECTORS_HU_TOKEN` | A token nevének dokumentálása (üres értékkel) |
| `package.json` → `connectors:setup` | `npm run connectors:setup` kényelmi parancs |
