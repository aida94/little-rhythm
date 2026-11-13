# Little Rhythm

A web app to track sleep, meals and potty for your kids. Open it in Chrome, install it on your phone like an app, and use it offline. All data stays on the device.

## What it does

- **Today**: tap Sleep, Feed, Potty/Diaper or Note to log something. A live sleep timer runs until you tap Wake up.
- **Say it**: type or dictate a sentence such as "Mila slept 3 hours from 1.00", check the preview, and add it.
- **Food**: plan a weekly menu, and see which key nutrients were eaten this week.
- **Trends**: a 7-day chart of sleep, meals, poop and pee, plus averages.
- **Insights**: this week in numbers, plus AI insights and a question box (needs your own AI key).
- **First start**: add each child with name, gender and date of birth. Nothing is built in.
- **Settings** (the gear icon): edit, add or remove kids, backup and restore, sample data.

## Built with

| Part | Tool |
|---|---|
| Screens | [React 19](https://react.dev) with TypeScript |
| Build and dev server | [Vite 8](https://vite.dev) |
| Data storage | IndexedDB in the browser, through [Dexie](https://dexie.org) |
| Installable and offline | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (web app manifest and service worker) |
| Tests | [Vitest](https://vitest.dev) |
| Lint | [oxlint](https://oxc.rs) |
| Fonts | Inter and Bricolage Grotesque, bundled with the app (no Google request) |

Charts are plain SVG drawn by React. No chart library is used.

## AI assistant

The Insights tab can ask an AI for a weekly summary and answer questions about a child.

- It works with any **OpenAI-compatible** AI service. In **Settings → AI assistant**, add the service's **base URL**, your **API key** and the **model name**. The app checks the connection before saving.
  - Example: DeepSeek uses base URL `https://api.deepseek.com` and model `deepseek-flash`.
  - Example: OpenAI uses base URL `https://api.openai.com/v1`.
  - The service must allow calls straight from a browser (CORS). Some services do not.
- The settings are saved only in this browser (IndexedDB). They are not in the code and not in backups, so add them again on each device.
- When you use AI, the app sends a summary of the last 14 days of that child's logs to the AI service: times, foods, amounts, notes, age in months and gender. **Names are removed** first and replaced with "the child" or "a sibling".
- Nothing is sent until you tap **Create insights** or **Ask**.
- All AI calls are in `src/lib/ai.ts`. To move the key to a small server later, change that file.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in Chrome.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Run the tests once |
| `npm run lint` | Check the code for common mistakes |
| `npm run build` | Make the finished app in `dist/` |
| `npm run preview` | Serve the finished app at http://localhost:4173 |

## Where the data is

- Everything you log is saved in this browser on this device, in IndexedDB. Nothing is sent to a server.
- Each device has its own data. Your laptop and your phone do not share entries.
- To move data or keep a copy: **Settings → Download backup**, then **Restore backup** on the other device.
- If you clear the browser's site data or delete the installed app, the entries are deleted. Download a backup now and then.
- The dev server (port 5173) and the preview (port 4173) count as different sites, so each has its own data.

## Put it on your phone

A phone can only install the app from an **https** address, so the `dist/` folder must be hosted online. The hosted site holds only the app, never your data.

The app is published on GitHub Pages: **https://aida94.github.io/little-rhythm/**

1. To publish a new version, run `npm run deploy`. It builds the app and pushes it to the `gh-pages` branch.
2. Wait about a minute for GitHub to update the site.
3. On the phone, open the link:
   - **Android, Chrome**: ⋮ menu → **Install app**.
   - **iPhone, Safari or Chrome**: **Share** → **Add to Home Screen**.

On iPhone, the home-screen app has its own storage, separate from the browser tab. Install it first, then log only in the installed app.

When you upload a new version, the installed app updates itself the next time it opens online. Your data stays.

## Project layout

```
src/
  App.tsx            app state, tabs and which sheet is open
  main.tsx           start-up
  styles.css         all styles and colour tokens (light and dark)
  components/        header, tab bar, icons, charts, shared form parts
  views/             Today, Food, Trends, Insights screens
  sheets/            the pop-up forms (sleep, feed, potty, note, menu, Say it, settings)
  lib/               logic without any UI: data types, database, dates, food data,
                     the Say it parser, AI calls and the summary sent to the AI
                     (with tests), sample data, backup
public/              app icons
prototype/           the earlier single-file versions, kept for reference
```
