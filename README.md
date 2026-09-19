# Exst Arcade

A responsive, static browser-game website built on the **Hybrid Bootstrap
Admin Template** by WebThemez, restyled as a Netflix-like portal: fixed
header, a spotlight carousel at the top, horizontal poster rows, a slide-in
details panel, and a bottom tab bar. No backend, no account, no build step,
and **no web server**: the whole site is static and runs straight from the
file system.

The library ships **empty on purpose**. Every game on the site is one you add
to a single text file, so there is nothing to delete before you start.

## Run it (no server needed)

Open **`index.html`** in any browser — double-click it, or drag it in. That's
it. The game list loads from plain `<script>` tags, so `file://` works exactly
like a hosted deployment.

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
    games.js        the game list      ← add games here (one block each)
    folders.js      the collections    ← add folders here (one block each)
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

1. **Put the game in `website/games/`** — a single file, or a folder whose
   main file is `index.html`:

   ```
   website/games/retro-pong.html
   website/games/retro-pong/index.html
   ```

2. **Paste one block into `website/data/games.js`** and change the values:

   ```txt
   [game]
   id=retro-pong
   title=Retro Pong
   path=games/retro-pong.html
   icon=assets/images/default-game.svg
   version=HTML build
   description=Two paddles, one ball, and a rivalry that never ends.
   tags=Arcade, Action
   ```

That's all. Refresh `index.html` and the game is in the grid, in the player
(`website/game.html?id=retro-pong`), in search, and in any collection that
lists it. No restart, no build.

**Remove a game** by deleting its `[game]` block (and the game file, if you
want). Nothing else refers to it.

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

Every game in the list is playable: there are no placeholder entries waiting
for a file, so a game either runs or it is not in the catalog.

Editing the catalog only ever changes what the site *shows*. Nothing you type
into the page is written back to disk: favorites, recents, play counts, and
high scores live in the browser's local storage, so they are per-browser (see
**Local data and privacy** below). To keep a game for good, put its block in
`website/data/games.js`.

To try a game without listing it, open
`website/game.html?path=games/your-game.html` — any game file can be played
directly.

### Fields

| Field         | What it does                                                     |
| ------------- | ---------------------------------------------------------------- |
| `id`          | Unique key, lowercase, used in links and My List — **required**   |
| `title`       | Name on the card — **required**                                   |
| `path`        | Game file relative to `website/` — **required**                   |
| `icon`        | Card artwork, relative to `website/` (webp/png/jpg/svg)           |
| `version`     | Small kicker line on the card, e.g. `HTML build`                  |
| `description` | One or two honest lines for the card and details panel            |
| `tags`        | Comma separated; `Action`, `Adventure`, `Racing`, `Puzzle`, `Arcade` plug into the search filters |
| `badge`       | Short label such as `NEW` or `HOT`                                |
| `featured`    | `true` = also eligible for the "Top rated" row                    |
| `hero`        | `true` = cycles in the spotlight carousel at the top of the page  |
| `heroart`     | Wide artwork for the carousel; blank falls back to `icon`         |

Lines starting with `#` are comments. Only add games you have the right to run
or share. Old fields from earlier versions (`original`, `available`,
`bundled`, `wasm`) are ignored, and the About page says so instead of failing
silently.

### The spotlight (the carousel at the top)

The big cover that cycles on the home page is driven by `hero=true`, in the
order the blocks appear in `games.js`:

```txt
[game]
id=retro-pong
...
hero=true
```

You can also edit it without touching the file: press **Edit spotlight** in
the hero on the home page, tick the games you want, and move them with ↑ ↓.
That choice is saved in the current browser, and the dialog's
**Copy for data/games.js** button hands you a ready-to-paste catalog with the
same order and `hero=true` already set — that is how you make it permanent for
everyone.

If no game has `hero=true`, the carousel falls back to `featured=true` games,
then to the first six games in the file.

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
id=quick-play
title=Quick rounds
description=Games that make sense when you only have a few minutes.
icon=assets/images/folder.svg
games=retro-pong, your-next-game
```

`games` is a comma-separated list of game `id`s. The collection shows up as its
own poster row on the home page, under **About → Collections**, and at
`website/folder.html?id=quick-play`. IDs that don't exist are reported on the
About page.

## Included features

- Netflix-style home screen: fixed header, 90vh hero cover with Play / My
  List / Details, horizontal poster galleries, and a bottom tab bar
  (Home, Search, New, About).
- Spotlight carousel with dots, auto-rotation, and the in-page editor
  described above.
- Category chips, live search, sorting, and curated collections.
- My List favorites, recent plays, play counts, launch preferences, and high
  scores saved in the current browser's local storage.
- A game player with reload, fullscreen, and direct/new-tab launch options.
- Accessible labels, keyboard focus styles, skip navigation, reduced-motion
  support, and native dialogs.
- Editable-by-hand catalog files that report anything they had to ignore.
- Self-checking catalog: every load reports what it read (About → Catalog),
  and a bad edit — an entry pasted outside the backticks, a block missing its
  `[game]` line, a duplicate id, a collection pointing at an unknown id — is
  described on screen with file and line instead of silently vanishing.
- An empty library is a valid state, not an error: the home page explains how
  to add the first game instead of showing an empty grid.

## Local data and privacy

There is no authentication, analytics, tracking, cloud sync, or remote
leaderboard. Favorites, recents, preferences, the spotlight order, and high
scores are stored only in the current browser's local storage on your device;
clearing browser data resets them. All content is local to the repository — no
third-party scripts are loaded at runtime. Because the player embeds game files
in an iframe, only add games you trust.

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
npm test                        # catalog + structure: parsing, IDs, files,
                                # references, URL rules, script order, orphans,
                                # spotlight ordering and removals
npm start                       # in a second terminal, for the browser suite
npm run test:browser            # Playwright: dashboard, spotlight editor,
                                # player, collections, mobile widths, file://
```

The Node tests run in two files. **`catalog.test.cjs`** validates catalog
parsing, unique IDs, folder references, URL building, escaping, spotlight
ordering and fallbacks, retired-field reporting, the catalog safety net (a
block pasted without its `[game]` header, duplicate ids, unknown folder
references, an unreadable `games.js` throwing an explained error), the
empty-library state, and that nothing that shipped still references the
removed games. **`structure.test.cjs`** guards the things a build step would
normally catch: every local file a page references exists, each page loads its
scripts in a working order (catalog, then loader, then page code), page scripts
only look for elements that are really on that page, no script or stylesheet is
left unreferenced, the loader still exports the API the pages use, and the game
artwork always has a default layer behind it so a wrong icon path shows the
default art instead of an empty tile.

The browser suite covers search, categories, sorting, persistent favorites,
launch preferences, the spotlight editor (tick, reorder, save, persist across
reload, copy-out), the on-screen Catalog check notice (and its dismiss button),
the "game library could not be read" panel, an end-to-end catalog edit, adding a
game from inside the site (validated, saved, playable, badged, removable), a
browser that blocks local storage (everything still loads, plays, and says
plainly that nothing is being kept), the empty-library states, favorites, the
player, mobile navigation, horizontal overflow at four widths, and opening the
whole site over `file://` with no server. Screenshots are written to the
ignored `.test-artifacts/` directory.

## Attribution

Adapted from [Hybrid Bootstrap Admin Template](https://github.com/learning-zone/website-templates/tree/master/hybrid-bootstrap-admin-template) by [WebThemez](https://webthemez.com/), licensed under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by-3.0/). Original template attribution is preserved in the source and the site's footer. See `website/assets/vendor/hybrid/ATTRIBUTION.md`.

Look inspired by [JuegoAmigo.github.io](https://github.com/JuegoAmigo/juegoamigo.github.io)
and the zuix-web-flix template.

Bootstrap is MIT licensed. DM Sans and Space Grotesk are locally hosted under
the SIL Open Font License; license files are in `website/assets/fonts/`.
