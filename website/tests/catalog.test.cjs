const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..", ".."); // repository root
const site = path.join(root, "website");
const storage = new Map();

/**
 * Load the catalog files and the shared config-loader in a minimal browser
 * context. The loader detects the site prefix from window.EXST_SITE_ROOT,
 * which we set explicitly per scenario ("" = inside website/, "website/" =
 * from the root index.html).
 */
function loadArcade(siteRoot) {
  const context = vm.createContext({
    window: {
      location: { pathname: "/index.html" },
      EXST_SITE_ROOT: siteRoot,
    },
    document: { currentScript: null },
    URLSearchParams,
    localStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
    },
    fetch: () => {
      throw new Error("catalog must not be fetched over the network");
    },
  });
  context.window.window = context.window;
  vm.runInContext(
    fs.readFileSync(path.join(site, "data/games.js"), "utf8"),
    context,
  );
  vm.runInContext(
    fs.readFileSync(path.join(site, "data/folders.js"), "utf8"),
    context,
  );
  vm.runInContext(
    fs.readFileSync(path.join(site, "assets/js/config-loader.js"), "utf8"),
    context,
  );
  return { api: context.window.ExstArcade, context };
}

/**
 * Same, but with catalog text supplied by the test (undefined = file not
 * loaded, which is what a syntax error in the catalog file looks like).
 */
function loadArcadeWithText({ gamesText, foldersText, siteRoot = "" }) {
  const context = vm.createContext({
    window: {
      location: { pathname: "/index.html" },
      EXST_SITE_ROOT: siteRoot,
    },
    document: { currentScript: null },
    URLSearchParams,
    localStorage: { getItem: () => undefined, setItem: () => {} },
  });
  context.window.window = context.window;
  if (gamesText !== undefined)
    vm.runInContext(
      `window.EXST_GAMES_TEXT = ${JSON.stringify(gamesText)};`,
      context,
    );
  if (foldersText !== undefined)
    vm.runInContext(
      `window.EXST_FOLDERS_TEXT = ${JSON.stringify(foldersText)};`,
      context,
    );
  vm.runInContext(
    fs.readFileSync(path.join(site, "assets/js/config-loader.js"), "utf8"),
    context,
  );
  return { api: context.window.ExstArcade, context };
}

const GAME = (id, extra = "") =>
  `[game]\nid=${id}\ntitle=${id}\npath=games/${id}.html\n${extra}`;

test("text parser supports comments, quotes, booleans and tag arrays", () => {
  const { api } = loadArcade("");
  const [game] = api.parseBlockText(
    '[game]\nid=test # comment\ntitle="A # title"\nfeatured=true\ntags=Puzzle, Arcade',
  );
  assert.equal(game.id, "test");
  assert.equal(game.title, "A # title");
  assert.equal(game.featured, true);
  assert.deepEqual([...game.tags], ["Puzzle", "Arcade"]);
});

test("catalog loads without any fetch (file:// friendly)", async () => {
  const { api } = loadArcade("");
  const { games, folders, byId } = await api.loadArcadeData();
  assert.equal(games.length, 16);
  assert.equal(folders.length, 4);
  assert.ok(byId.get("neon-drift"));
  // Array.from: the catalog lives in a VM realm, so rebuild a host array.
  assert.deepEqual(
    Array.from(folders.map((f) => f.id)).sort(),
    ["arcade", "featured", "horror", "minecraft"],
  );
});

test("all catalog IDs are unique", async () => {
  const { api } = loadArcade("");
  const { games } = await api.loadArcadeData();
  assert.equal(new Set(games.map((g) => g.id)).size, games.length);
});

test("six originals have actual local game files and artwork", async () => {
  const { api } = loadArcade("");
  const { games } = await api.loadArcadeData();
  const originals = games.filter((g) => g.original);
  assert.equal(originals.length, 6);
  for (const game of originals) {
    assert.equal(game.available, true);
    assert.ok(
      fs.existsSync(path.join(site, game.path.split("?")[0])),
      `${game.id}: missing ${game.path}`,
    );
    assert.ok(
      fs.existsSync(path.join(site, game.icon)),
      `${game.id}: missing ${game.icon}`,
    );
  }
});

test("starter game entries are explicitly marked unavailable", async () => {
  const { api } = loadArcade("");
  const { games } = await api.loadArcadeData();
  const starters = games.filter((g) => !g.original);
  assert.ok(starters.length >= 10);
  starters.forEach((g) => assert.equal(g.available, false, g.id));
});

test("all configured folder references resolve", async () => {
  const { api } = loadArcade("");
  const { folders, byId } = await api.loadArcadeData();
  for (const folder of folders)
    for (const id of folder.games)
      assert.ok(byId.has(id), `${folder.id}: ${id}`);
});

test("game URLs preserve launch modes and encode IDs", () => {
  const { api } = loadArcade("");
  const game = { id: "test & game", path: "games/example.html" };
  assert.equal(api.gameUrl(game), "game.html?id=test+%26+game");
  assert.equal(api.gameUrl(game, "new"), game.path);
  assert.equal(api.gameUrl(game, "same"), game.path);
});

test("site prefix resolves paths and the home link per page location", () => {
  // Root index.html: catalog paths gain the website/ prefix.
  const rootPage = loadArcade("website/");
  assert.equal(
    rootPage.api.assetUrl("games/a.html"),
    "website/games/a.html",
  );
  assert.equal(
    rootPage.api.gameUrl({ id: "x", path: "games/a.html" }),
    "website/game.html?id=x",
  );
  assert.equal(rootPage.api.homeUrl(), "index.html");

  // Pages inside website/: no prefix, home is one level up.
  const sitePage = loadArcade("");
  assert.equal(sitePage.api.assetUrl("games/a.html"), "games/a.html");
  assert.equal(sitePage.api.homeUrl(), "../index.html");
});

test("absolute and hash paths pass through untouched", () => {
  const { api } = loadArcade("website/");
  assert.equal(
    api.assetUrl("https://example.com/x.html"),
    "https://example.com/x.html",
  );
  assert.equal(api.assetUrl("#"), "#");
});

test("HTML escaping covers attributes and markup", () => {
  const { api } = loadArcade("");
  assert.equal(
    api.escapeHtml('<a title="x">\'&'),
    "&lt;a title=&quot;x&quot;&gt;&#39;&amp;",
  );
});

test("all original game IDs have a playable engine", async () => {
  const engine = fs.readFileSync(
    path.join(site, "assets/js/minigames.js"),
    "utf8",
  );
  const { api } = loadArcade("");
  const { games } = await api.loadArcadeData();
  for (const game of games.filter((g) => g.original))
    assert.ok(
      engine.includes(`"${game.id}":`) || engine.includes(`    ${game.id}:`),
      game.id,
    );
});

test("no page fetches the catalog at runtime", () => {
  for (const file of [
    "assets/js/app.js",
    "assets/js/flix.js",
    "assets/js/game.js",
    "assets/js/folder.js",
  ]) {
    const source = fs.readFileSync(path.join(site, file), "utf8");
    assert.ok(
      !/fetch\s*\(\s*["'`][^"'`]*games\.txt/.test(source),
      `${file} still fetches the old catalog`,
    );
  }
});

/* ---------- Catalog edit safety net ----------
 * A hand-edited catalog must never fail silently: either the entry loads, or
 * the page is told exactly what went wrong and where.
 */

test("a clean catalog reports no problems", async () => {
  const { api } = loadArcade("");
  const { problems } = await api.loadArcadeData();
  assert.equal(problems.length, 0);
});

test("a block pasted without its [game] header becomes its own entry", async () => {
  const { api } = loadArcadeWithText({
    gamesText:
      "[game]\nid=first\ntitle=First\npath=games/first.html\n\n" +
      "id=second\ntitle=Second\npath=games/second.html\n",
    foldersText: "[folder]\nid=col\ntitle=Col\ngames=first, second\n",
  });
  const { games, problems } = await api.loadArcadeData();
  assert.deepEqual(
    Array.from(games.map((g) => g.id)),
    ["first", "second"],
  );
  assert.equal(games[0].title, "First");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].line, 6);
  assert.match(problems[0].message, /without a new \[game\] line/);
});

test("a duplicate id keeps the first entry and reports the copy", async () => {
  const { api } = loadArcadeWithText({
    gamesText:
      "[game]\nid=dup\ntitle=One\npath=games/one.html\n\n" +
      "[game]\nid=dup\ntitle=Two\npath=games/two.html\n",
    foldersText: "[folder]\nid=col\ntitle=Col\ngames=dup\n",
  });
  const { games, problems } = await api.loadArcadeData();
  assert.equal(games.length, 1);
  assert.equal(games[0].title, "One");
  assert.equal(problems.length, 1);
  // Points at the duplicate's own id= line, and names the original's.
  assert.equal(problems[0].line, 7);
  assert.match(problems[0].message, /already used on line 2/);
});

test("entries with no id or no usable path are reported", async () => {
  const { api } = loadArcadeWithText({
    gamesText:
      "[game]\ntitle=Missing id\npath=games/x.html\n\n" +
      "[game]\nid=no-path\ntitle=No path\n\n" +
      "[game]\nid=wrong-ext\npath=games/wrong.txt\n",
    foldersText:
      "[folder]\nid=col\ntitle=Col\ngames=no-path, wrong-ext\n",
  });
  const { games, problems } = await api.loadArcadeData();
  assert.deepEqual(
    Array.from(games.map((g) => g.id)),
    ["no-path", "wrong-ext"],
  );
  assert.equal(problems.length, 3);
  assert.match(problems[0].message, /no id= line/);
  assert.match(problems[1].message, /no path= line/);
  assert.match(problems[2].message, /not an \.html\/\.htm file/);
});

test("a folder that lists an unknown game id explains which id is missing", async () => {
  const { api } = loadArcadeWithText({
    gamesText: GAME("kept"),
    foldersText: "[folder]\nid=col\ntitle=Col\ngames=kept, ghost\n",
  });
  const { folders, problems } = await api.loadArcadeData();
  assert.equal(folders.length, 1);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].file, "website/data/folders.js");
  assert.match(problems[0].message, /id=ghost/);
});

test("a catalog file that cannot run throws an explained error", async () => {
  const { api } = loadArcadeWithText({ gamesText: undefined, foldersText: "" });
  await assert.rejects(
    () => api.loadArcadeData(),
    (error) => {
      assert.equal(error.name, "CatalogError");
      assert.match(error.message, /website\/data\/games\.js could not be read/);
      assert.match(error.hint, /closing backtick/);
      return true;
    },
  );
});

test("a catalog with no [game] entries throws instead of showing an empty arcade", async () => {
  const { api } = loadArcadeWithText({ gamesText: "# nothing here yet\n" });
  await assert.rejects(
    () => api.loadArcadeData(),
    /no \[game\] entries were found/,
  );
});

test("a missing folders file is a problem, not a fatal error", async () => {
  const { api } = loadArcadeWithText({
    gamesText: GAME("solo"),
    foldersText: undefined,
  });
  const { games, folders, problems } = await api.loadArcadeData();
  assert.equal(games.length, 1);
  assert.equal(folders.length, 0);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /collections are empty/);
});

test("[folder] blocks in games.js and [game] blocks in folders.js are reported", async () => {
  const { api } = loadArcadeWithText({
    gamesText: GAME("kept") + "\n[folder]\nid=oops\n",
    foldersText: "[game]\nid=stray\n",
  });
  const { problems } = await api.loadArcadeData();
  const messages = problems.map((p) => p.message).join(" | ");
  assert.match(messages, /\[folder\] block was skipped/);
  assert.match(messages, /\[game\] block was skipped/);
});

test("the catalog notice renders problems with their file and line", async () => {
  const { api } = loadArcadeWithText({
    gamesText: GAME("dup") + "\n" + GAME("dup"),
  });
  const { problems } = await api.loadArcadeData();
  assert.equal(api.catalogNoticeHtml([]), "");
  const html = api.catalogNoticeHtml(problems);
  assert.match(html, /CATALOG CHECK/);
  assert.match(html, /website\/data\/games\.js/);
  assert.match(html, /line 7/);
  assert.match(html, /data-dismiss-notice/);
  assert.ok(/&lt;/.test(api.catalogNoticeHtml([
    { file: "f.js", line: 1, message: "<script>", hint: "" },
  ])));
});
