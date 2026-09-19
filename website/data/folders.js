/*
 * Exst Arcade — collections ("folders").
 *
 * A folder is a hand-picked shelf of games that already exist in
 * website/data/games.js. It shows up as its own row on the home page, in
 * About → Collections, and at website/folder.html?id=its-id.
 *
 * ── ADD A COLLECTION (1 step) ────────────────────────────────────────────
 *   Copy the block below, remove the leading "#", and change the values.
 *   games = comma-separated game IDs copied from the id= lines in games.js.
 *
 *   Each block needs its own [folder] line and must sit before the closing
 *   backtick at the end of this file (text after that backtick is a
 *   JavaScript error). An ID that does not exist in games.js is left out and
 *   listed in the Catalog check notice on the home page.
 *
 * There are no collections yet: every folder needs games to hold, and the
 * library is still empty. Add a game first (see games.js), then paste a
 * folder block here.
 *
 * Lines starting with # are comments.
 */
window.EXST_FOLDERS_TEXT = `
# ── Example collection ───────────────────────────────────────────────────
# [folder]
# id=quick-play
# title=Quick rounds
# description=Games that make sense when you only have a few minutes.
# icon=assets/images/folder.svg
# games=retro-pong, your-next-game
`;
