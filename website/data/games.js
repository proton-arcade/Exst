/*
 * Exst Arcade — game catalog (works with or without a web server).
 *
 * ADD A GAME (2 steps, ~1 minute):
 *   1. Put your game in website/games/
 *        - single file :  website/games/retro-pong.html
 *        - whole folder:  website/games/retro-pong/index.html
 *          (just unzip the game straight into a new folder inside games/)
 *   2. Paste a [game] block below and change the values.
 *
 * The game appears in the dashboard, the player, and any folder that lists it.
 * No restart, no server, no build step — just refresh the page.
 *
 * Field notes:
 *   id          unique key, lowercase (used in URLs)              REQUIRED
 *   title       name shown on the card                            REQUIRED
 *   path        game file, relative to website/ (index.html or a
 *               plain .html file)                                 REQUIRED
 *   icon        thumbnail, relative to website/ (png/webp/jpg/svg)
 *   version     small kicker text on the card
 *   description one or two lines of honest copy for the card
 *   tags        comma separated. Use Action / Adventure / Racing /
 *               Puzzle / Arcade so category filters can find it
 *   featured    true = also considered for the spotlight shelf
 *   badge       short label such as NEW or HOT (optional)
 *   available   set available=false while files are still missing.
 *               Omit it once the game file exists (defaults to true).
 *   source      where the files came from (optional note)
 *
 * Only add games you have the right to run or distribute.
 * Lines starting with # are comments.
 */
window.EXST_GAMES_TEXT = `
# Playable Exst originals (built in, always ready).

[game]
id=neon-drift
title=Neon Drift
version=Arcade original
icon=assets/images/neon-drift.webp
path=games/arcade.html?game=neon-drift
description=Own the night. Chase the rush.
tags=Racing, Arcade
featured=true
original=true
badge=HOT

[game]
id=neon-snake
title=Neon Snake
version=Arcade original
icon=assets/images/neon-snake.webp
path=games/arcade.html?game=neon-snake
description=A fresh glow on an all-time classic.
tags=Arcade, Action
featured=true
original=true
badge=POPULAR

[game]
id=2048
title=2048
version=Arcade original
icon=assets/images/2048.webp
path=games/arcade.html?game=2048
description=Easy to learn. Impossible to put down.
tags=Puzzle, Arcade
featured=true
original=true

[game]
id=cosmic-escape
title=Cosmic Escape
version=Arcade original
icon=assets/images/cosmic-escape.webp
path=games/arcade.html?game=cosmic-escape
description=Small ship. One very big universe.
tags=Action, Adventure
featured=true
original=true
badge=NEW

[game]
id=memory-match
title=Memory Match
version=Arcade original
icon=assets/images/memory-match.webp
path=games/arcade.html?game=memory-match
description=Find your match. Train your brain.
tags=Puzzle, Arcade
featured=true
original=true

[game]
id=brick-breaker
title=Brick Breaker
version=Arcade original
icon=assets/images/brick-breaker.webp
path=games/arcade.html?game=brick-breaker
description=Break the bricks. Beat your best.
tags=Arcade, Action
featured=true
original=true
badge=NEW

# Your own games go here. Copy a block, edit it, done.
# Keep available=false on a starter entry until the real files are in place.

[game]
available=false
id=fnaf
title=Five Nights at Freddy's
version=HTML build
icon=assets/images/fnaf.svg
path=games/fnaf.html
description=Keep your cool on the night shift. Watch the doors, save power, and do not blink at the wrong time.
tags=horror, survival, featured
featured=true
source=fnaf.html

[game]
available=false
id=backrooms
title=Backrooms
version=HTML build
icon=assets/images/backrooms.svg
path=games/backrooms.html
description=Yellow walls, buzzing lights, and a maze that keeps changing when you are not looking.
tags=horror, maze, exploration
featured=true
source=backrooms.html

[game]
available=false
id=paper-io-2
title=Paper.io 2
version=HTML build
icon=assets/images/paper-io-2.svg
path=games/paper-io-2.htm
description=Claim territory, cut careful lines, and keep your paper trail from getting sliced.
tags=arcade, territory, quick play
featured=true
source=paper-io-2.htm

# Minecraft client slots. Unzip each client into the matching folder under
# website/mc/ (for example website/mc/1.12.2/index.html), then remove the
# available=false line from that entry.
[game]
available=false
id=1.12.2
title=Latest release
version=1.12.2-u3
icon=assets/images/m-logo1.svg
path=mc/1.12.2/index.html
description=A configured launcher entry for your 1.12.2 browser client. Drop the files into the matching path to make it playable.
tags=minecraft, release, java
featured=true
bundled=true
source=Eaglercraft_1.12.2_u3_Offline.zip

[game]
available=false
id=1.12.2-wasm
title=Latest release WASM
version=1.12.2-u3-wasm
icon=assets/images/m-logo1.svg
path=mc/1.12.2-wasm/index.html
description=The WASM variant of the latest configured client.
tags=minecraft, wasm, release
featured=true
bundled=true
wasm=true
source=Eaglercraft_1.12.2_u3_WASM_Offline.zip

[game]
available=false
id=1.8.8
title=Previous release
version=1.8.8-u53
icon=assets/images/m-logo2.svg
path=mc/1.8.8/index.html
description=A previous release entry wired into the same arcade launcher.
tags=minecraft, release, classic
featured=false
bundled=true
source=EaglercraftX_1.8_u53_Offline_Signed.zip

[game]
available=false
id=1.8.8-wasm
title=Previous release WASM
version=1.8.8-u53-wasm
icon=assets/images/m-logo2.svg
path=mc/1.8.8-wasm/index.html
description=The WASM-GC build for the 1.8.8 line.
tags=minecraft, wasm, classic
featured=false
bundled=true
wasm=true
source=EaglercraftX_1.8_u53_WASM-GC_Offline.zip

[game]
available=false
id=1.5.2
title=Older release
version=1.5.2-sp2.01
icon=assets/images/m-logo11.svg
path=mc/1.5.2/index.html
description=Older release entry for the archive shelf.
tags=minecraft, archive, older
featured=false
bundled=true
source=Eaglercraft_1.5.2-sp2.01_Offline.zip

[game]
available=false
id=1.2.6
title=Older release
version=1.2.6-Alpha
icon=assets/images/m-logo11.svg
path=mc/1.2.6-Alpha/index.html
description=Alpha-era archive entry.
tags=minecraft, alpha, archive
featured=false
bundled=true
source=Eaglercraft_1.2.6-Alpha_Offline.zip

[game]
available=false
id=Unknown-Alpha
title=Older release
version=Unknown-Alpha
icon=assets/images/m-logo11.svg
path=mc/Unknown-Alpha/indev.html
description=Unknown alpha archive entry.
tags=minecraft, alpha, archive
featured=false
bundled=true
source=Eaglercraft_Unknown-Alpha_Offline.zip
`;
