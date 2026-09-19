# Exst Arcade

A static game website that updates itself from editable text files. It is designed so you can copy a block, paste it, change the values, and refresh the page.

## Main files

- `index.html` — homepage with search, folders, featured games, and all games.
- `folder.html?id=folder-id` — generated folder pages.
- `game.html?id=game-id` — generated game player page with a top-left back arrow and a large iframe.
- `data/games.txt` — every game lives here.
- `data/folders/index.txt` — list of folder text files to load.
- `data/folders/*.txt` — each folder chooses games by ID.
- `assets/images/` — icons/thumbnails.
- `games/` — put standalone HTML games here.

## Add a game

Open `data/games.txt`, copy this block, paste it at the bottom, then change the values:

```txt
[game]
id=my-game
title=My Game
version=HTML build
icon=assets/images/my-game.svg
path=games/my-game.html
description=A short real description for the game card.
tags=arcade, quick play
featured=false
source=my-game.html
```

Then put the real game file at the path you wrote, for example:

```txt
games/my-game.html
```

Important: `id` must be unique. Folder files use this ID.

## Add a folder

1. Create a new file in `data/folders/`, for example `data/folders/racing.txt`.
2. Add this:

```txt
[folder]
id=racing
title=Racing games
description=Fast driving games and time trials.
icon=assets/images/folder.svg
games=my-game, paper-io-2
```

3. Open `data/folders/index.txt` and add the file name:

```txt
racing.txt
```

The folder page will appear automatically on refresh.

## Opening games

The top-right selector lets visitors choose:

- `game page` — opens `game.html?id=...` with a back arrow.
- `replace tab` — opens the raw game path in the same tab.
- `new tab` — opens the raw game path in a new tab.

If a game refuses to run inside the iframe, choose `replace tab` or `new tab`.

## Included starter entries

The config includes entries for:

- `fnaf`
- `backrooms`
- `paper-io-2`
- `1.12.2`
- `1.12.2-wasm`
- `1.8.8`
- `1.8.8-wasm`
- `1.5.2`
- `1.2.6`
- `Unknown-Alpha`

The three files in `games/` are safe slot pages. Replace them with your real uploaded game HTML files when ready.
