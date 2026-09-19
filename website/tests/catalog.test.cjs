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
function loadArcade(siteRoot, options = {}) {
  // `null` means "blocked storage", so it must not fall back to the default.
  const backing = "storage" in options ? options.storage : storage;
  const context = vm.createContext({
    window: null, // filled in below, once the storage shim exists
    document: { currentScript: null },
    URLSearchParams,
    console: { warn: () => {} },
    localStorage: backing
      ? {
          getItem: (k) => backing.get(k),
          setItem: (k, v) => backing.set(k, v),
          removeItem: (k) => backing.delete(k),
        }
      : {
          getItem() {
            throw new Error("storage blocked");
          },
          setItem() {
            throw new Error("storage blocked");
          },
          removeItem() {
            throw new Error("storage blocked");
          },
        },
    fetch: () => {
      throw new Error("catalog must not be fetched over the network");
    },
  });
  context.window = {
    location: { pathname: "/index.html" },
    EXST_SITE_ROOT: siteRoot,
    // Reachable both as window.localStorage and as the global.
    localStorage: context.localStorage,
  };
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
function loadArcadeWithText({
  gamesText,
  foldersText,
  siteRoot = "",
  storage: shim,
}) {
  const backing = shim || new Map();
  const context = vm.createContext({
    window: null, // filled in below, once the storage shim exists
    document: { currentScript: null },
    URLSearchParams,
    console: { warn: () => {} },
    localStorage: {
      getItem: (k) => (backing.has(k) ? backing.get(k) : null),
      setItem: (k, v) => backing.set(k, String(v)),
      removeItem: (k) => backing.delete(k),
    },
  });
  context.window = {
    location: { pathname: "/index.html" },
    EXST_SITE_ROOT: siteRoot,
    localStorage: context.localStorage,
  };
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

test("the shipped catalog is empty, and loads without any fetch", async () => {
  const { api } = loadArcade("");
  const { games, folders, byId, problems } = await api.loadArcadeData();
  assert.equal(games.length, 0);
  assert.equal(folders.length, 0);
  assert.equal(byId.size, 0);
  assert.deepEqual(Array.from(problems), []);
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
  const { api } = loadArcadeWithText({ gamesText });
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
  const { api } = loadArcadeWithText({ gamesText: `
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
  const { api } = loadArcadeWithText({ gamesText: `
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
  const { problems } = await api.loadArcadeData();
  const report = Array.from(problems, (p) => p.message).join(" ");
  assert.match(report, /original/);
  assert.match(report, /available/);
  assert.match(report, /ghost/);
});

test("a folder block that points at real games is accepted", async () => {
  const { api } = loadArcadeWithText({ gamesText: `
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
  const { folders, byId, problems } = await api.loadArcadeData();
  assert.equal(folders.length, 1);
  assert.deepEqual(Array.from(folders[0].games), ["one"]);
  assert.ok(byId.has("one"));
  assert.deepEqual(Array.from(problems), []);
});

test("all catalog IDs are unique", async () => {
  const { api } = loadArcade("");
  const { games } = await api.loadArcadeData();
  assert.equal(new Set(games.map((g) => g.id)).size, games.length);
});

test("all configured folder references resolve", async () => {
  const { api } = loadArcade("");
  const { games, folders, byId } = await api.loadArcadeData();
  assert.equal(games.length, 0);
  assert.equal(folders.length, 0);
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

/* ---------- Saving is reported, never silently dropped ---------- */

test("storage helpers report availability and never throw", () => {
  const working = loadArcade("").api;
  assert.equal(working.storageAvailable(), true);
  assert.equal(working.storageSet("exst-favorites", ["a"]), true);
  assert.deepEqual(Array.from(working.storageGet("exst-favorites", [])), ["a"]);
  assert.equal(working.storageNoticeText(), "");

  const blocked = loadArcade("", { storage: null }).api;
  assert.equal(blocked.storageAvailable(), false);
  assert.equal(blocked.storageSet("exst-favorites", ["a"]), false);
  assert.deepEqual(Array.from(blocked.storageGet("exst-favorites", ["fallback"])), [
    "fallback",
  ]);
  assert.match(blocked.storageNoticeText(), /not letting the page save data/);
});

test("a blocked storage does not break catalog loading or the open mode", async () => {
  const { api } = loadArcade("", { storage: null });
  const { games, folders } = await api.loadArcadeData();
  assert.equal(games.length, 0);
  assert.equal(folders.length, 0);
  assert.equal(api.getOpenMode(), "page");
});

test("preferences written before (and by hand) are still read", () => {
  const store = new Map([["exst-open-mode", "new"], ["exst-favorites", "[]"]]);
  const { api } = loadArcade("", { storage: store });
  assert.equal(api.getOpenMode(), "new");
  assert.deepEqual(Array.from(api.storageGet("exst-favorites", ["x"])), []);

  // ...and writing keeps strings plain, exactly as before.
  assert.equal(api.storageSet("exst-open-mode", "same"), true);
  assert.equal(store.get("exst-open-mode"), "same");
  assert.equal(api.storageSet("exst-favorites", ["a", "b"]), true);
  assert.equal(store.get("exst-favorites"), '["a","b"]');
  assert.equal(api.getOpenMode(), "same");
});
