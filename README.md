# Exst Arcade

A responsive, static browser-game website built on the **Hybrid Bootstrap
Admin Template** by WebThemez, with a custom dark/coral theme, locally hosted
fonts and artwork, and six playable original minigames. No backend, no
account, no build step, and **no web server**: the whole site is static and
runs straight from the file system.

## Run it (no server needed)

Open **`index.html`** in any browser — double-click it, or drag it in. That's
it. The game library loads from plain `<script>` tags, so `file://` works
exactly like a hosted deployment.

Optional HTTP mode (only needed if you want pretty URLs or are testing):

```sh
cd website
npm start          # http://localhost:3000 (serves the repo root)
```

`npm start` uses Python 3's static server bound to `0.0.0.0:3000`. For
deployment, copy the repository's files to any static host — keep
`node_modules`, `.test-artifacts`, and `website/mc/` out of the upload.

## Layout

```
index.html          dashboard (home) — lives at the repo root
README.md
website/
  assets/           css, fonts, images, js, vendor (Hybrid template)
  data/
    games.js        the game catalog  ← add games here (one block each)
    folders.js      the collections   ← add folders here (one block each)
  games/            game files: one .html per game, or a folder per game
  mc/               (your unzipped Minecraft client folders — git-ignored)
  game.html         the game player (game.html?id=<game-id>)
  folder.html       collection pages (folder.html?id=<folder-id>)
  add.html          add a game without a text editor (saves to this device)
  package.json      optional test/dev scripts
  tests/            catalog + Playwright browser suites
```

Everything the site needs lives in `website/`; `index.html` at the root links
into it with a `website/` prefix. The shared loader figures out that prefix
from its own script tag, so the same catalog works from both pages.

## Add a game (about one minute)

1. **Put the game in `website/games/`.**
   - Single file: `website/games/retro-pong.html`
   - Whole folder (e.g. an unzipped download): `website/games/retro-pong/index.html`
     — just unzip it straight into a new folder.
2. **Paste one block into `website/data/games.js`** and edit the values:

   ```txt
   [game]
   id=retro-pong
   title=Retro Pong
   path=games/retro-pong.html
   icon=assets/images/retro-pong.webp
   description=A short, honest description of the game.
   tags=Arcade, Action
   ```

   `id`, `title`, and `path` are required; `path` is relative to
   `website/`. Category tags `Action`, `Adventure`, `Racing`, `Puzzle`,
   `Arcade` plug into the sidebar filters. If the game isn't ready yet, add
   `available=false` — it shows as "Setup needed" until you remove the line.

That's all. Refresh `index.html` and the game is in the grid, in the player
(`website/game.html?id=retro-pong`), in search, and in any collection that
lists it. No restart, no build.

### If your edit doesn't show up

The catalog is read fresh every time the page loads, and **every edit is
checked** — a half-saved entry never disappears silently:

- **Nothing moved at all?** Refresh the page (the browser may still be
  showing the old copy), then check **About → Catalog** on the home page. It
  states exactly how many games and collections the page just read, so you
  can tell your edit was picked up.
- **"Catalog check" notice on Home** — the library loaded, but something in
  it needs attention. The notice names the file, the line, and what to do;
  the browser console lists the same problems. Usual causes: an entry pasted
  without its own `[game]` line, a reused `id`, or a collection that lists an
  id which isn't in `games.js`.
- **"The game library could not be read"** — `games.js` didn't load at all.
  Almost always a JavaScript error, and the message says which: an entry
  pasted **after** the closing backtick at the end of the file, a stray
  backtick inside a description, or the file being renamed/moved. Every entry
  must sit **inside** the backtick-quoted text and begin with its own
  `[game]` line.
- **A game shows "Setup needed"** — its entry still has `available=false`.
  Put the game file at the entry's `path` (or point `path` at the file you
  already have) and delete the `available=false` line.

Editing the catalog only ever changes what the site *shows*. Nothing you type
into the page is written back to disk: favorites, recents, play counts, and
high scores live in the browser's local storage, so they are per-browser (see
**Local data and privacy** below). To keep a game for good, put its block in
`website/data/games.js`.

To try a game without listing it, open
`website/game.html?path=games/your-game.html` — any game file can be played
directly.

### Starter entries and the Minecraft slots

The catalog ships with **unavailable** starter entries (FNAF, Backrooms,
Paper.io 2, and Minecraft release slots). They are honest placeholders —
wired into the launcher but marked *Setup needed* until real files exist.
Only enable them (`available=false` → remove the line) once you have placed
builds **you have the rights to run** at the configured paths:

- Minecraft slots expect unzipped clients under `website/mc/`
  (e.g. `website/mc/1.12.2/index.html`). Those folders are git-ignored;
  drop them in locally or on your host.

## Add a game without a text editor

Open **`website/add.html`** (linked from **About → Your games**). Fill in the
form and the game is added to the arcade immediately — no text editor, no
restart. The page checks the same rules the catalog loader does, so an id that
is taken, a path that is not a game file, or a missing title is explained
before anything is stored.

Games added this way are saved **on this device only** (browser local storage)
and are badged **DRAFT** so they are never mistaken for catalog entries. They
appear in the grid, search, the player, and collections that list their id.
The page also prints the exact `[game]` block to paste into
`website/data/games.js` — pasting it there is what makes a game permanent and
visible to everyone who opens the site.

```
Add a game (website/add.html)
  ↓ save
this device's browser storage   →  playable right away, DRAFT badge
  ↓ copy the block, paste it into website/data/games.js
the catalog                     →  part of the site itself
```

## Add a collection (folder)

Paste one block into `website/data/folders.js`:

```txt
[folder]
id=my-folder
title=My collection
description=Games for a rainy afternoon.
icon=assets/images/folder.svg
games=neon-snake, 2048, retro-pong
```

`games` is a comma-separated list of game `id`s. The folder shows up as its
own poster row on the home page, under **About → Collections**, and at
`website/folder.html?id=my-folder`.

## Included features

- Netflix-style home screen: fixed header, 90vh hero cover with Play / My
  List / Details, horizontal poster galleries, and a bottom tab bar
  (Home, Search, New, About).
- Featured-game hero rotation, category chips, live search, sorting, and
  curated collections.
- My List favorites, recent plays, play counts, launch preferences, and high
  scores saved in the current browser's local storage.
- A game player with reload, fullscreen, and direct/new-tab launch options.
- Keyboard controls, on-screen direction buttons, and touch controls in the
  original games.
- Accessible labels, keyboard focus styles, skip navigation, reduced-motion
  support, and native dialogs.
- Clear "setup needed" states for placeholder game entries.
- Self-checking catalog: every load reports what it read (About → Catalog),
  and a bad edit — an entry pasted outside the backticks, a block missing its
  `[game]` line, a duplicate id, a collection pointing at an unknown id — is
  described on screen with file and line instead of silently vanishing.

## Six playable originals

| Game          | How to play                                                               |
| ------------- | ------------------------------------------------------------------------- |
| Neon Drift    | Left/right or A/D to change lanes and avoid traffic.                      |
| Neon Snake    | Arrow keys or WASD to collect food without hitting the walls or yourself. |
| 2048          | Arrow keys, WASD, or swipe to merge equal tiles and reach 2048.           |
| Cosmic Escape | Arrow keys, WASD, or drag to dodge asteroids and collect stars.           |
| Memory Match  | Click/tap cards to find all eight matching pairs in fewer moves.          |
| Brick Breaker | Mouse, touch, or left/right to move the paddle and clear the bricks.      |

Use the on-screen buttons on touch devices. Pause/resume and restart are
available in every original game. Press Space to start or pause canvas games,
or Escape to pause. The game artwork is AI-generated promotional art; the
games themselves are lightweight canvas/DOM minigames.

## Local data and privacy

There is no authentication, analytics, tracking, cloud sync, or remote
leaderboard. Favorites, recents, preferences, and high scores are stored only
in the current browser's local storage on your device; clearing browser data
resets them. All content is local to the repository — no third-party scripts
are loaded at runtime. Because the player embeds game files in an iframe,
only add games you trust.

**When saving is switched off:** some browsers block local storage, especially
for pages opened straight from the filesystem (`file://`) and in private
windows. The site detects it and says so — About and collection pages carry a
plain line explaining that nothing is being kept, favoriting reports
"on My List for this visit only", the game itself stops promising a saved best
score, and the launch preference stops claiming to be remembered. The library
still loads and every game still plays; a regular window, or serving the site
over http(s), makes saving work again.

## Tests

```sh
cd website
npm install
npm test                        # catalog parsing, IDs, files, references, URL rules
npm start                       # in a second terminal, for the browser suite
npm run test:browser            # Playwright: dashboard, player, all six games,
                                # collections, mobile widths, plus a no-server
                                # file:// smoke test
```

The Node tests validate catalog parsing, unique IDs, file existence, folder
references, URL building, escaping, and the catalog safety net: a block
pasted without its `[game]` header becomes its own entry, duplicate ids and
unknown folder references are reported with file and line, and an unreadable
`games.js` throws an explained error instead of rendering an empty arcade.
The browser suite covers search, categories, sorting, persistent favorites,
launch preferences, setup dialogs, 2048 scoring, every original game's
start/pause/restart, a complete Memory Match win, the on-screen Catalog check
notice (and its dismiss button), the "game library could not be read" panel,
an end-to-end catalog edit, adding a game from inside the site (validated,
saved, playable, badged, removable), a browser that blocks local storage
(everything still loads, plays, and says plainly that nothing is being
kept), mobile
navigation, horizontal overflow at four widths, and opening the whole site
over `file://` with no server. Screenshots are written to the ignored
`.test-artifacts/` directory.

## Attribution

Adapted from [Hybrid Bootstrap Admin Template](https://github.com/learning-zone/website-templates/tree/master/hybrid-bootstrap-admin-template) by [WebThemez](https://webthemez.com/), licensed under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by-3.0/). Original template attribution is preserved in the source and the site's footer. See `website/assets/vendor/hybrid/ATTRIBUTION.md`.

Bootstrap is MIT licensed. DM Sans and Space Grotesk are locally hosted under
the SIL Open Font License; license files are in `website/assets/fonts/`.
