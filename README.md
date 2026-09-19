# Exst Arcade

A responsive, static browser-game website built from the **Hybrid Bootstrap Admin Template** by WebThemez. The dashboard has a custom dark/coral theme, locally hosted fonts and artwork, and six playable original minigames. No backend, account, or production build is required.

## Run locally

```sh
npm start
# http://localhost:3000
```

`npm start` uses Python 3's static HTTP server, bound to `0.0.0.0:3000`. Alternatively, serve this folder with any static web server. Opening `index.html` directly with `file://` will not work because the catalog is fetched from text files.

Deploy the repository's static files to any static hosting service. No runtime npm dependencies or build step are needed. Keep `node_modules`, tests, and `.test-artifacts` out of the deployment.

## Included features

- Hybrid's sidebar/topbar dashboard structure and original Bootstrap CSS, with a responsive custom theme.
- Featured-game carousel, category filters, live search, sorting, and curated collections.
- Favorites, recent plays, play counts, launch preferences, and high scores saved in the current browser's local storage.
- A game player with reload, fullscreen, and direct/new-tab launch options.
- Keyboard controls, on-screen direction buttons, and touch controls in the original games.
- Accessible labels, keyboard focus styles, skip navigation, reduced-motion support, and dialogs.
- Clear “setup needed” states for the original repository's placeholder game entries.

## Six playable originals

| Game          | How to play                                                               |
| ------------- | ------------------------------------------------------------------------- |
| Neon Drift    | Left/right or A/D to change lanes and avoid traffic.                      |
| Neon Snake    | Arrow keys or WASD to collect food without hitting the walls or yourself. |
| 2048          | Arrow keys, WASD, or swipe to merge equal tiles and reach 2048.           |
| Cosmic Escape | Arrow keys, WASD, or drag to dodge asteroids and collect stars.           |
| Memory Match  | Click/tap cards to find all eight matching pairs in fewer moves.          |
| Brick Breaker | Mouse, touch, or left/right to move the paddle and clear the bricks.      |

Use the on-screen buttons on touch devices. Pause/resume and restart are available in every original game. Press Space to start or pause canvas games, or Escape to pause. The game artwork is AI-generated promotional art; the games themselves are lightweight canvas/DOM minigames.

## Main files

- `index.html` — discovery dashboard and game library.
- `game.html?id=game-id` — embedded player.
- `folder.html?id=folder-id` — custom text-configured folder pages.
- `data/games.txt` — editable game catalog.
- `data/folders/index.txt` and `data/folders/*.txt` — editable custom folders.
- `games/arcade.html` and `assets/js/minigames.js` — six built-in games.
- `assets/js/app.js` — dashboard interaction and local persistence.
- `assets/js/config-loader.js` — shared text parser and catalog loader.
- `assets/css/arcade.css` — custom dashboard/player theme.
- `assets/vendor/hybrid/` — original template CSS and attribution.

## Add a game

Add a block to `data/games.txt`:

```txt
[game]
id=my-game
title=My Game
version=HTML build
icon=assets/images/my-game.webp
path=games/my-game.html
description=A short description for the game card.
tags=Arcade, Puzzle
featured=true
available=true
badge=NEW
```

`id` must be unique. Add the actual game and thumbnail files at the configured paths. Use category tags `Action`, `Adventure`, `Racing`, `Puzzle`, or `Arcade` for the category filters. Set `available=false` while a game still needs its files. Unavailable entries appear in **All games** but cannot be launched from the dashboard.

The inherited FNAF, Backrooms, Paper.io, and Minecraft entries are preserved as **unavailable starter entries**, not playable licensed copies. Replace their placeholder/missing files with builds you have permission to use before changing `available` to `true`.

## Add a folder

1. Create `data/folders/my-folder.txt`:

```txt
[folder]
id=my-folder
title=My collection
description=Games for a rainy afternoon.
icon=assets/images/folder.svg
games=neon-snake, 2048, my-game
```

2. Add `my-folder.txt` to `data/folders/index.txt`.
3. Open `folder.html?id=my-folder`.

The three homepage mood collections use built-in category filters. Custom text-configured folders have their own URLs.

## Launch preferences and privacy

Open **Preferences** in the sidebar to select the arcade player, same-tab launch, or a new tab. Local data is stored only on the current browser/device; there is no authentication, analytics, cloud sync, or remote leaderboard. Clearing browser storage clears saved progress.

## Tests

```sh
npm install
npm test
# With npm start running in another terminal:
npm run test:browser
```

The Node tests validate catalog parsing, IDs, files, folder references, and launch URLs. Playwright checks search, categories, sorting, persistent favorites, launch preferences, setup dialogs, the player, 2048 scoring, every original game's start/pause/restart, a complete Memory Match win, mobile navigation, and horizontal overflow at four screen widths.

The browser suite uses an installed Playwright Chromium when available, with a portable `@sparticuz/chromium` fallback for restricted Linux environments. Screenshots are written to the ignored `.test-artifacts/` directory.

## Attribution

Adapted from [Hybrid Bootstrap Admin Template](https://github.com/learning-zone/website-templates/tree/master/hybrid-bootstrap-admin-template) by [WebThemez](https://webthemez.com/), licensed under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/). Original template attribution is preserved in the source and the site's footer. See `assets/vendor/hybrid/ATTRIBUTION.md`.

Bootstrap is MIT licensed. DM Sans and Space Grotesk are locally hosted under the SIL Open Font License; license files are in `assets/fonts/`.
