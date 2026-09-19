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

## Local data and privacy

There is no authentication, analytics, tracking, cloud sync, or remote
leaderboard. Favorites, recents, preferences, the spotlight order, and high
scores are stored only in the current browser's local storage on your device;
clearing browser data resets them. All content is local to the repository — no
third-party scripts are loaded at runtime. Because the player embeds game files
in an iframe, only add games you trust.

## Tests

```sh
cd website
npm install
npm test                        # catalog parsing, spotlight ordering, removals
npm start                       # in a second terminal, for the browser suite
npm run test:browser            # Playwright: dashboard, spotlight editor,
                                # player, collections, mobile widths, file://
```

The Node tests validate catalog parsing, spotlight ordering and fallbacks,
retired-field and dangling-folder reporting, URL building, escaping, and that
nothing that shipped still references the removed games. The browser suite
covers the empty-library states, the spotlight editor (tick, reorder, save,
persist across reload, copy-out), search, favorites, the player, mobile
navigation, horizontal overflow at four widths, and opening the whole site
over `file://` with no server. Screenshots are written to the ignored
`.test-artifacts/` directory.

## Attribution

Adapted from [Hybrid Bootstrap Admin Template](https://github.com/learning-zone/website-templates/tree/master/hybrid-bootstrap-admin-template) by [WebThemez](https://webthemez.com/), licensed under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by-3.0/). Original template attribution is preserved in the source and the site's footer. See `website/assets/vendor/hybrid/ATTRIBUTION.md`.

Look inspired by [JuegoAmigo.github.io](https://github.com/JuegoAmigo/juegoamigo.github.io)
and the zuix-web-flix template.

Bootstrap is MIT licensed. DM Sans and Space Grotesk are locally hosted under
the SIL Open Font License; license files are in `website/assets/fonts/`.
