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
 *
 * Pass a gamesText / foldersText override to exercise a catalog without
 * touching the files on disk.
 */
function loadArcade(siteRoot, overrides = {}) {
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
  if (overrides.gamesText !== undefined)
    context.window.EXST_GAMES_TEXT = overrides.gamesText;
  if (overrides.foldersText !== undefined)
    context.window.EXST_FOLDERS_TEXT = overrides.foldersText;
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

test("the shipped catalog is empty, and loads without any fetch", async () => {
  const { api } = loadArcade("");
  const { games, folders, byId, notes } = await api.loadArcadeData();
  assert.equal(games.length, 0);
  assert.equal(folders.length, 0);
  assert.equal(byId.size, 0);
  assert.deepEqual(Array.from(notes), []);
});

test("every removed feature file is gone, and no page mentions them", () => {
  const gone = [
    "website/games/arcade.html",
    "website/games/fnaf.html",
    "website/games/backrooms.html",
    "website/games/paper-io-2.htm",
    "website/assets/js/minigames.js",
    "website/assets/js/app.js",
    "website/assets/css/minigames.css",
    "website/assets/images/2048.webp",
    "website/assets/images/neon-drift.webp",
    "website/assets/images/neon-drift-hero.webp",
    "website/assets/images/neon-snake.webp",
    "website/assets/images/cosmic-escape.webp",
    "website/assets/images/memory-match.webp",
    "website/assets/images/brick-breaker.webp",
    "website/assets/images/fnaf.svg",
    "website/assets/images/backrooms.svg",
    "website/assets/images/paper-io-2.svg",
    "website/assets/images/m-logo1.svg",
    "website/assets/images/m-logo2.svg",
    "website/assets/images/m-logo11.svg",
  ];
  for (const file of gone)
    assert.equal(fs.existsSync(path.join(root, file)), false, file);

  // Nothing that ships may still reference the removed games, the old
  // original-game engine, or the placeholder launcher slots.
  const forbidden = [
    /arcade original/i,
    /minigames\.(js|css)/i,
    /games\/arcade\.html/i,
    /arcade\.html\?game=/i,
    /neon[-\s]?(drift|snake)/i,
    /cosmic[-\s]escape/i,
    /brick[-\s]breaker/i,
    /memory[-\s]match/i,
    /paper[-\s]io/i,
    /\bfnaf\b/i,
    /backrooms/i,
    /m-logo/i,
  ];
  const extensions = [".html", ".js", ".css", ".cjs", ".json", ".md", ".txt"];
  const skip = new Set([
    ".git",
    "node_modules",
    ".test-artifacts",
    path.basename(__filename),
  ]);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.includes(path.extname(entry.name))) {
        const source = fs.readFileSync(full, "utf8");
        for (const pattern of forbidden)
          assert.equal(
            pattern.test(source),
            false,
            `${path.relative(root, full)} still matches ${pattern}`,
          );
      }
    }
  };
  walk(root);
});

test("the games folder is kept with instructions for dropping games in", () => {
  const readme = path.join(site, "games/README.md");
  assert.ok(fs.existsSync(readme));
  assert.match(fs.readFileSync(readme, "utf8"), /data\/games\.js/);
});

test("a hero=true game is what the spotlight carousel cycles", async () => {
  const gamesText = `
[game]
id=first
title=First
path=games/first.html
featured=true

[game]
id=second
title=Second
path=games/second.html
hero=true

[game]
id=third
title=Third
path=games/third.html
hero=true
heroart=assets/images/third-hero.webp
`;
  const { api } = loadArcade("", { gamesText });
  const { games, byId } = await api.loadArcadeData();
  assert.equal(games.length, 3);
  assert.equal(byId.get("second").hero, true);
  assert.equal(byId.get("first").hero, false);
  assert.equal(byId.get("third").heroart, "assets/images/third-hero.webp");

  // hero=true games win, in catalog order.
  assert.deepEqual(
    Array.from(api.spotlightGames(games, null).map((g) => g.id)),
    ["second", "third"],
  );
  // A saved order from the home page takes precedence, order and all.
  assert.deepEqual(
    Array.from(api.spotlightGames(games, ["third", "first"]).map((g) => g.id)),
    ["third", "first"],
  );
  // Stale saved ids are dropped instead of breaking the carousel.
  assert.deepEqual(
    Array.from(api.spotlightGames(games, ["gone", "first"]).map((g) => g.id)),
    ["first"],
  );
});

test("without hero games the carousel falls back to featured, then to six", async () => {
  const { api } = loadArcade("", {
    gamesText: `
[game]
id=a
title=A
path=games/a.html
featured=true

[game]
id=b
title=B
path=games/b.html
`,
  });
  const { games } = await api.loadArcadeData();
  assert.deepEqual(
    Array.from(api.spotlightGames(games, []).map((g) => g.id)),
    ["a"],
  );

  const many = Array.from({ length: 9 }, (_, i) => ({
    id: `g${i}`,
    title: `G${i}`,
  }));
  assert.equal(api.spotlightGames(many, []).length, 6);
});

test("the spotlight art falls back from heroart to the card icon", async () => {
  const { api } = loadArcade("");
  assert.equal(
    api.spotlightArt({ id: "x", icon: "assets/images/x.webp" }),
    "assets/images/x.webp",
  );
  assert.equal(
    api.spotlightArt({
      id: "x",
      icon: "assets/images/x.webp",
      heroart: "assets/images/x-wide.webp",
    }),
    "assets/images/x-wide.webp",
  );
});

test("retired fields and dangling folder ids are reported, not swallowed", async () => {
  const { api } = loadArcade("", {
    gamesText: `
[game]
id=old
title=Old
path=games/old.html
original=true
available=false
`,
    foldersText: `
[folder]
id=mixed
title=Mixed
games=old, ghost
`,
  });
  const { notes } = await api.loadArcadeData();
  const report = Array.from(notes).join(" ");
  assert.match(report, /original/);
  assert.match(report, /available/);
  assert.match(report, /ghost/);
});

test("a folder block that points at real games is accepted", async () => {
  const { api } = loadArcade("", {
    gamesText: `
[game]
id=one
title=One
path=games/one.html
`,
    foldersText: `
[folder]
id=shelf
title=Shelf
description=One game on a shelf.
games=one
`,
  });
  const { folders, byId, notes } = await api.loadArcadeData();
  assert.equal(folders.length, 1);
  assert.deepEqual(Array.from(folders[0].games), ["one"]);
  assert.ok(byId.has("one"));
  assert.deepEqual(Array.from(notes), []);
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
  assert.equal(rootPage.api.assetUrl("games/a.html"), "website/games/a.html");
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

test("no page fetches the catalog at runtime", () => {
  for (const file of [
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

test("the home page ships the spotlight editor wiring", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const hook of [
    'id="heroEdit"',
    'id="heroHowTo"',
    'id="spotlightDialog"',
    'id="spotlightContent"',
    'id="closeSpotlight"',
    'id="catalogNotes"',
  ])
    assert.ok(html.includes(hook), hook);

  const flix = fs.readFileSync(path.join(site, "assets/js/flix.js"), "utf8");
  for (const hook of [
    "buildSpotlightDraft",
    "saveSpotlight",
    "ExstArcade.spotlightGames",
    "ExstArcade.spotlightArt",
  ])
    assert.ok(flix.includes(hook), hook);

  // Edits must survive a reload, so the choice is written to local storage.
  assert.match(flix, /localStorage\.setItem\(SPOTLIGHT_KEY/);
});
