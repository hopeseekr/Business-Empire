# Business Empire Companion

A web companion for the Android game **Business Empire: RichMan**. Look up perfect Clothing Brand collection launches, browse every collection’s attributes, and run the Investments trade helper (potential remaining + BUY / HOLD / SELL) from your multi-year stock & crypto range table.

**Live Utility:** https://ai.autonomo.codes/business-empire/

> **98% coded by [Grok](https://grok.com) AI via [Grok Build](https://x.ai/cli)**

---

## Requirements

- **Node.js** 18 or newer (20+ recommended)
- **npm** 9 or newer (ships with Node)

Check your versions:

```bash
node -v
npm -v
```

---

## Getting started

### 1. Clone or open the project

```bash
cd BusinessEmpire
```

### 2. Install dependencies

```bash
npm install
```

This installs React, React Router, Vite, TypeScript, and related packages listed in `package.json`.

### 3. Start the development server

```bash
npm run dev
```

Vite will print a local URL, typically:

```text
http://localhost:5173/
```

Open that URL in your browser. Edits under `src/` hot-reload automatically.

To listen on all interfaces (useful on LAN or remote machines):

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm install` | Install project dependencies |
| `npm run dev` | Start the Vite dev server (hot reload) |
| `npm run build` | Typecheck with TypeScript, then build production assets into `public/` |
| `npm run preview` | Serve the production build locally (run `build` first) |

### Production build

```bash
npm run build
```

Output is written to **`public/`** (the webroot). Preview it:

```bash
npm run preview
```

Point your web server document root at `public/` — same convention as your other sites. That folder contains minified HTML, JS, and CSS ready to publish.

### Subdirectory hosting (`/business-empire/`)

The app is configured for:

```text
https://ai.autonomo.codes/business-empire/
```

`vite.config.ts` sets `base: '/business-empire/'` so asset URLs look like `/business-empire/assets/…` after build.

**Routing:** the app uses **hash routing** (`HashRouter`). Live URLs look like:

```text
https://ai.autonomo.codes/business-empire/#/
https://ai.autonomo.codes/business-empire/#/investments
https://ai.autonomo.codes/business-empire/#/clothing/launch
```

The part after `#` never reaches the server, so a hard refresh only requests `/business-empire/` (or `index.html`). No SPA `try_files` / fallback rewrite is required on the host.

**Deploy:** put the *contents* of `public/` on the server at the path that serves `/business-empire/` (not at the domain root).

To host at the domain root instead, set `base: '/'` in `vite.config.ts` and rebuild.

---

## What’s in the app

| Area | Status | Description |
| --- | --- | --- |
| **Dashboard** | Live | Overview of businesses and quick links |
| **Clothing Brand → Overview** | Live | Launch rules, attributes, growth notes |
| **Clothing Brand → Launch Helper** | Live | Type a collection name; get Style, Quality, Price, Audience |
| **Clothing Brand → Collections** | Live | Full searchable/filterable collection database |
| **Investments → Trade Helper** | Live | Stocks, crypto & bullion trade helper: current price + optional units → potential remaining and BUY / HOLD / SELL |
| **Investments → Bulk Screening** | Live | Type every ticker’s price in one keyboard pass (ENTER / TAB to advance) → % vs average, % to max and BUY / HOLD / SELL per row |

Collection data lives in:

- `clothing_collections.json` (project root, source data)
- `src/data/clothing_collections.json` (used by the app)

Investment range data (your spreadsheet):

- `investments-stocks.md` / `src/data/investments-stocks.json`
- `investments-crypto.md` / `src/data/investments-crypto.json`
- `investments-bullion.md` / `src/data/investments-bullion.json`

### Investments rules (from the spreadsheet)

- **Potential** (Bulk Screening: *To Max*) = `(Max − Current Price) / Current Price`
- **vs Avg** (Bulk Screening) = `(Current Price − Average) / Average` — negative means trading at a discount
- **BUY** when price is below the historical average
- **SELL** when price is at/above average **and** you entered shares (you hold a position)
- **HOLD** when price is at/above average **and** you entered no shares (wait for a better entry)

---

## Project structure

```text
BusinessEmpire/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── clothing_collections.json      # Source collection data
├── clothing_collections.md        # Human-readable table
├── static/                        # Static source assets (copied into public on build)
│   └── favicon.svg
├── src/
│   ├── main.tsx                   # App entry
│   ├── App.tsx                    # Routes
│   ├── index.css                  # Theme & layout
│   ├── types.ts
│   ├── components/
│   │   └── Layout.tsx             # Shell, sidebar, nav
│   ├── data/
│   │   ├── clothing_collections.json
│   │   ├── collections.ts         # Search/filter helpers
│   │   ├── investments-stocks.json
│   │   ├── investments-crypto.json
│   │   ├── investments-bullion.json
│   │   ├── investments.ts         # Potential + BUY/HOLD/SELL logic
│   │   └── businesses.ts
│   └── pages/
│       ├── Dashboard.tsx
│       ├── ClothingOverview.tsx
│       ├── LaunchHelper.tsx
│       ├── Collections.tsx
│       ├── Investments.tsx         # Trade helper
│       └── BulkScreening.tsx       # Rapid whole-market price entry
├── investments-stocks.md          # Source stock ranges
├── investments-crypto.md          # Source crypto ranges
├── investments-bullion.md         # Source bullion ranges (Gold / Silver / Diamonds)
└── public/                        # Webroot — created by npm run build
```

---

## Tech stack

- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) 6
- [React Router](https://reactrouter.com/) 7

### Built with Grok

**98% coded by [Grok](https://grok.com) AI via [Grok Build](https://x.ai/cli).**

This companion app was largely written end-to-end with [Grok](https://grok.com), SpaceXAI’s frontier model, driven from the terminal by [Grok Build](https://x.ai/cli) — SpaceXAI’s coding agent.

---

## Troubleshooting

**Port 5173 already in use**

```bash
npm run dev -- --port 5174
```

**`npm install` fails**

- Confirm Node 18+ with `node -v`
- Delete `node_modules` and the lockfile, then reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

**Blank page after deploy**

- Ensure the host serves `public/index.html` for client-side routes (SPA fallback), or deploy under the root path Vite expects.
- Confirm the server document root is `public/`, not the project root.

**Typecheck / build errors**

```bash
npx tsc --noEmit
npm run build
```

---

## License

This project is licensed under [Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)](https://creativecommons.org/licenses/by-nd/4.0/). See [LICENSE.md](LICENSE.md) for details.

Not affiliated with the developers of Business Empire: RichMan.
