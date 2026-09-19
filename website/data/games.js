/*
 * Exst Arcade — the game list. Everything on the site is built from this file.
 * It is plain text in `backticks` so the site works from file:// with no
 * server, no build step and no restart: edit, save, refresh the page.
 *
 * ── ADD A GAME (2 steps, about a minute) ─────────────────────────────────
 *   1. Put the game in website/games/
 *        single file :  website/games/retro-pong.html
 *        whole folder:  website/games/retro-pong/index.html
 *                       (unzip the game straight into a new folder)
 *   2. Paste a [game] block BELOW THIS COMMENT, INSIDE the backtick-quoted
 *      text (remove the leading "#" from a copy of the example further
 *      down), change the values, save, and refresh.
 *
 *      !! Every block must start with its own [game] line and sit before the
 *      !! closing backtick at the end of this file. Text pasted after that
 *      !! backtick, or a stray backtick inside a description, is a JavaScript
 *      !! error: the whole library disappears from the site. Every page then
 *      !! shows a "Catalog check" notice pointing back here, so nothing fails
 *      !! silently. The Add a game page (website/add.html) builds the block
 *      !! for you if you would rather not type it.
 *
 * ── THE SPOTLIGHT (the carousel at the top of the home page) ─────────────
 *   hero=true      put this game in the top carousel that cycles on the
 *                  home page. Order in this file = order in the carousel.
 *   heroart=...    optional wide artwork for the carousel. Blank uses icon.
 *
 *   You can also change the carousel without editing this file: press
 *   "Edit spotlight" on the home page, tick the games you want and set the
 *   order. That choice is remembered in this browser; the button also
 *   copies a ready-to-paste version of this file so you can make it
 *   permanent for everyone.
 *
 * ── FIELD NOTES ──────────────────────────────────────────────────────────
 *   id          unique key, lowercase, used in links and My List   REQUIRED
 *   title       name on the card                                   REQUIRED
 *   path        game file relative to the website/ folder          REQUIRED
 *   icon        card artwork relative to website/ (webp/png/jpg/svg)
 *   version     small kicker line on the card (e.g. "HTML build")
 *   description one or two honest lines for the card and details page
 *   tags        comma separated; "Action, Adventure, Racing, Puzzle,
 *               Arcade" plug into the search filters
 *   badge       short label such as NEW or HOT
 *   featured    true = also eligible for the "Top rated" row
 *   hero        true = also cycles in the spotlight carousel at the top
 *   heroart     wide artwork for the spotlight (optional)
 *
 * Lines starting with # are comments. Only add games you have the right to
 * run or share.
 */
window.EXST_GAMES_TEXT = `
# ── Your library starts here ─────────────────────────────────────────────
# Nothing is listed yet, so the arcade is empty on purpose. Copy the block
# below, remove every # at the start of its lines, and change the values.
#
# [game]
# id=retro-pong
# title=Retro Pong
# path=games/retro-pong.html
# icon=assets/images/default-game.svg
# version=HTML build
# description=Two paddles, one ball, and a rivalry that never ends.
# tags=Arcade, Action
# badge=NEW
# featured=true
# hero=true
#
# ── Second game: same thing again ────────────────────────────────────────
# [game]
# id=your-next-game
# title=Your next game
# path=games/your-next-game.html
# description=What is it? One line is plenty.
# tags=Puzzle
`;
