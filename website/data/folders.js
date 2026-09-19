/*
 * Exst Arcade — collections ("folders"). Works with or without a web server.
 *
 * ADD A FOLDER (1 step):
 *   Paste a [folder] block below. games = comma-separated game IDs copied
 *   from the id= lines in data/games.js. That's all — the folder appears
 *   in the sidebar's Collections dialog and at folder.html?id=its-id.
 *
 * Lines starting with # are comments.
 */
window.EXST_FOLDERS_TEXT = `
[folder]
id=arcade
title=Fast arcade rounds
description=Quick games that make sense when someone just wants to jump in for a few minutes.
icon=assets/images/paper-io-2.svg
games=neon-drift, neon-snake, 2048, cosmic-escape, memory-match, brick-breaker, paper-io-2

[folder]
id=featured
title=Featured games
description=The first shelf people see: a mix of ready-to-play HTML games and configured launcher entries.
icon=assets/images/folder-star.svg
games=neon-drift, neon-snake, 2048, cosmic-escape, memory-match, brick-breaker, fnaf, backrooms, paper-io-2, 1.12.2, 1.12.2-wasm

[folder]
id=horror
title=Night shift & maze scares
description=Games with tension, dark corners, and that one hallway you probably should not walk down.
icon=assets/images/folder.svg
games=fnaf, backrooms

[folder]
id=minecraft
title=Minecraft clients
description=All Minecraft-style launch entries, selected by ID from data/games.js.
icon=assets/images/m-logo1.svg
games=1.12.2, 1.12.2-wasm, 1.8.8, 1.8.8-wasm, 1.5.2, 1.2.6, Unknown-Alpha
`;
