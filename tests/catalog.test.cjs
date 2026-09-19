const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const storage = new Map();
const context = vm.createContext({
  window: { location: { pathname: "/index.html" } },
  URLSearchParams,
  localStorage: {
    getItem: (k) => storage.get(k),
    setItem: (k, v) => storage.set(k, v),
  },
  fetch: async (file) => ({
    ok: true,
    text: async () => fs.readFileSync(path.join(root, file), "utf8"),
  }),
});
vm.runInContext(
  fs.readFileSync(path.join(root, "assets/js/config-loader.js"), "utf8"),
  context,
);
const api = context.window.ExstArcade;
test("text parser supports comments, quotes, booleans and tag arrays", () => {
  const [game] = api.parseBlockText(
    '[game]\nid=test # comment\ntitle="A # title"\nfeatured=true\ntags=Puzzle, Arcade',
  );
  assert.equal(game.id, "test");
  assert.equal(game.title, "A # title");
  assert.equal(game.featured, true);
  assert.deepEqual([...game.tags], ["Puzzle", "Arcade"]);
});
test("all catalog IDs are unique", async () => {
  const { games } = await api.loadArcadeData();
  assert.equal(new Set(games.map((g) => g.id)).size, games.length);
  assert.equal(games.length, 16);
});
test("six originals have actual local game files and artwork", async () => {
  const { games } = await api.loadArcadeData();
  const originals = games.filter((g) => g.original);
  assert.equal(originals.length, 6);
  for (const game of originals) {
    assert.equal(game.available, true);
    assert.ok(fs.existsSync(path.join(root, game.path.split("?")[0])));
    assert.ok(fs.existsSync(path.join(root, game.icon)));
  }
});
test("starter game entries are explicitly marked unavailable", async () => {
  const { games } = await api.loadArcadeData();
  games
    .filter((g) => !g.original)
    .forEach((g) => assert.equal(g.available, false));
});
test("all configured folder references resolve", async () => {
  const { folders, byId } = await api.loadArcadeData();
  for (const folder of folders)
    for (const id of folder.games)
      assert.ok(byId.has(id), `${folder.id}: ${id}`);
});
test("game URLs preserve launch modes and encode IDs", () => {
  const game = { id: "test & game", path: "games/example.html" };
  assert.equal(api.gameUrl(game), "game.html?id=test+%26+game");
  assert.equal(api.gameUrl(game, "new"), game.path);
  assert.equal(api.gameUrl(game, "same"), game.path);
});
test("HTML escaping covers attributes and markup", () => {
  assert.equal(
    api.escapeHtml('<a title="x">\'&'),
    "&lt;a title=&quot;x&quot;&gt;&#39;&amp;",
  );
});
test("all original game IDs have a playable engine", async () => {
  const engine = fs.readFileSync(
    path.join(root, "assets/js/minigames.js"),
    "utf8",
  );
  const { games } = await api.loadArcadeData();
  for (const game of games.filter((g) => g.original))
    assert.ok(engine.includes(`"${game.id}":`) || engine.includes(`    ${game.id}:`));
});
