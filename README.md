# Business Empire Companion

A web companion for the Android game **Business Empire: RichMan**. Look up perfect Clothing Brand collection launches, browse every collection’s attributes, and run the Investments trade helper (potential remaining + BUY / HOLD / SELL) from your multi-year stock & crypto range table.

**Theme:** Dark UI inspired by [ai.autonomo.codes](https://ai.autonomo.codes/) — background `#212a35`, green accents (`#81c784` / `#4CAF50`), orange CTAs (`#fc841f`).

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

`vite.config.ts` sets `base: '/business-empire/'`, and React Router uses that same base for client routes. After build, asset URLs look like `/business-empire/assets/…`.

**Deploy:** put the *contents* of `public/` on the server at the path that serves `/business-empire/` (not at the domain root).

**SPA fallback:** the server must serve `index.html` for client routes under that path, e.g. `/business-empire/investments` → the app’s `index.html`. Example Nginx:

```nginx
location /business-empire/ {
  alias /var/www/business-empire/;   # folder that contains index.html + assets/
  try_files $uri $uri/ /business-empire/index.html;
}
```

To host at the domain root instead, set `base: '/'` in `vite.config.ts` and rebuild.

---

## What’s in the app

| Area | Status | Description |
| --- | --- | --- |
| **Dashboard** | Live | Overview of businesses and quick links |
| **Clothing Brand → Overview** | Live | Launch rules, attributes, growth notes |
| **Clothing Brand → Launch Helper** | Live | Type a collection name; get Style, Quality, Price, Audience |
| **Clothing Brand → Collections** | Live | Full searchable/filterable collection database |
| **Investments** | Live | Stocks & crypto trade helper: current price + optional shares → potential remaining and BUY / HOLD / SELL |

Collection data lives in:

- `clothing_collections.json` (project root, source data)
- `src/data/clothing_collections.json` (used by the app)

Investment range data (your spreadsheet):

- `investments-stocks.md` / `src/data/investments-stocks.json`
- `investments-crypto.md` / `src/data/investments-crypto.json`

### Investments rules (from the spreadsheet)

- **Potential** = `(Max − Current Price) / Current Price`
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
│   │   ├── investments.ts         # Potential + BUY/HOLD/SELL logic
│   │   └── businesses.ts
│   └── pages/
│       ├── Dashboard.tsx
│       ├── ClothingOverview.tsx
│       ├── LaunchHelper.tsx
│       ├── Collections.tsx
│       └── Investments.tsx
├── investments-stocks.md          # Source stock ranges
├── investments-crypto.md          # Source crypto ranges
└── public/                        # Webroot — created by npm run build
```

---

## Tech stack

- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) 6
- [React Router](https://reactrouter.com/) 7

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

Private project for personal use with Business Empire: RichMan. Not affiliated with the game’s developers.
