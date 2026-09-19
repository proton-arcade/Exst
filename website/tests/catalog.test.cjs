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
