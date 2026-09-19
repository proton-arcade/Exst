const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", ".."); // repository root
const site = path.join(root, "website");

/**
 * Structural guarantees for a site that has no build step. These catch the
 * mistakes that otherwise show up as a blank page or a feature that quietly
 * does nothing: a renamed file still referenced by a page, a script looking
 * for an element that no longer exists, scripts loaded in the wrong order.
 */

/** Pages, with the scripts they load, in load order (literal src values). */
const PAGES = [
  {
    file: "index.html",
    scripts: [
      "website/data/games.js",
      "website/data/folders.js",
      "website/assets/js/icons.js",
      "website/assets/js/config-loader.js",
      "website/assets/js/flix.js",
    ],
  },
  {
    file: "website/add.html",
    scripts: [
      "data/games.js",
      "data/folders.js",
      "assets/js/icons.js",
      "assets/js/config-loader.js",
      "assets/js/add.js",
    ],
  },
  {
    file: "website/folder.html",
    scripts: [
      "data/games.js",
      "data/folders.js",
      "assets/js/config-loader.js",
      "assets/js/folder.js",
    ],
  },
  {
    file: "website/game.html",
    scripts: [
      "data/games.js",
      "data/folders.js",
      "assets/js/config-loader.js",
      "assets/js/game.js",
    ],
  },
  {
    file: "website/games/arcade.html",
    scripts: ["../assets/js/minigames.js"],
  },
];

/**
 * Element ids a script looks for that are deliberately not in that page's
 * HTML: either built at runtime or optional by design. Keep this list short
 * and specific — it is an exception list, not a dumping ground.
 */
const RUNTIME_IDS = new Map([
  ["website/assets/js/flix.js", new Set(["tryOriginal", "retryLoad"])],
  [
    "website/assets/js/config-loader.js",
    new Set(["openMode"]), // optional control: `if (!select) return`
  ],
  ["website/assets/js/game.js", new Set(["tryOriginal"])],
]);

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

/** Resolve a page's literal script src to a repo-relative path. */
function scriptFile(pageFile, script) {
  return path
    .relative(root, path.resolve(path.dirname(path.join(root, pageFile)), script))
    .split(path.sep)
    .join("/");
}

function localReferences(html) {
  const refs = [];
  const patterns = [
    /\bsrc="([^"]+)"/g,
    /\bhref="([^"]+)"/g,
    /background-image:\s*url\(([^)]+)\)/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of html.matchAll(pattern)) {
      const value = match[1].replace(/^['"]|['"]$/g, "").trim();
      if (!value) continue;
      if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(value)) continue;
      if (value.startsWith("${")) continue; // template placeholder
      refs.push(value.split(/[?#]/)[0]);
    }
  });
  return refs;
}

test("every local file a page references exists", () => {
  const missing = [];
  PAGES.forEach(({ file }) => {
    const dir = path.dirname(path.join(root, file));
    localReferences(read(file)).forEach((ref) => {
      if (!ref || ref.endsWith("/")) return;
      const target = path.resolve(dir, ref);
      if (!fs.existsSync(target)) missing.push(`${file} → ${ref}`);
    });
  });
  assert.deepEqual(missing, [], "pages reference files that do not exist");
});

test("scripts load in the order the pages require", () => {
  PAGES.forEach(({ file, scripts }) => {
    const html = read(file);
    const positions = scripts.map((script) => {
      const index = html.indexOf(script);
      assert.notEqual(index, -1, `${file} does not load ${script}`);
      return { script, index };
    });
    for (let i = 1; i < positions.length; i += 1) {
      assert.ok(
        positions[i].index > positions[i - 1].index,
        `${file}: ${positions[i - 1].script} must load before ${positions[i].script}`,
      );
    }
  });
});

test("the catalog loads before the loader, which loads before page scripts", () => {
  PAGES.forEach(({ file, scripts }) => {
    const html = read(file);
    const at = (script) => html.indexOf(script);
    const loaderIndex = scripts.findIndex((script) =>
      script.includes("config-loader.js"),
    );
    if (loaderIndex === -1) return; // arcade.html is self-contained
    const loaderAt = at(scripts[loaderIndex]);
    // The catalog text must be defined before the loader reads it...
    ["data/games.js", "data/folders.js"].forEach((catalog) => {
      const script = scripts.find((item) => item.endsWith(catalog));
      if (!script) return;
      assert.ok(
        at(script) < loaderAt,
        `${file}: ${script} must load before the loader`,
      );
    });
    // ...and every script after the loader is the page's own code.
    scripts.slice(loaderIndex + 1).forEach((script) => {
      assert.ok(
        at(script) > loaderAt,
        `${file}: ${script} must load after the loader`,
      );
    });
  });
});

test("page scripts only look for elements that exist on that page", () => {
  const problems = [];
  PAGES.forEach(({ file, scripts }) => {
    const html = read(file);
    const ids = new Set(
      [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
    );
    scripts.forEach((scriptSrc) => {
      const script = scriptFile(file, scriptSrc);
      const allowed = RUNTIME_IDS.get(script) || new Set();
      const used = new Set();
      const source = read(script);
      for (const match of source.matchAll(
        /getElementById\(\s*"([^"]+)"\s*\)/g,
      ))
        used.add(match[1]);
      // The `$("id")` shorthand used by the page scripts.
      for (const match of source.matchAll(/(?<![\w.$])\$\(\s*"([^"]+)"\s*\)/g))
        used.add(match[1]);
      [...used]
        .filter((id) => !ids.has(id) && !allowed.has(id))
        .forEach((id) => problems.push(`${file} ← ${script}: #${id}`));
    });
  });
  assert.deepEqual(
    problems,
    [],
    "scripts look for elements that are not on their page",
  );
});

test("no stylesheet is left behind", () => {
  const pages = fs
    .readdirSync(root)
    .filter((name) => name.endsWith(".html"))
    .concat(
      fs
        .readdirSync(site)
        .filter((name) => name.endsWith(".html"))
        .map((name) => `website/${name}`),
      fs
        .readdirSync(path.join(site, "games"))
        .filter((name) => /\.html?$/.test(name))
        .map((name) => `website/games/${name}`),
    );
  const referenced = new Set();
  pages.forEach((page) => {
    for (const match of read(page).matchAll(
      /href="([^"]*\.css)"/g,
    ))
      referenced.add(path.basename(match[1]));
  });
  const orphans = fs
    .readdirSync(path.join(site, "assets/css"))
    .filter((name) => name.endsWith(".css"))
    .filter((name) => !referenced.has(name));
  assert.deepEqual(orphans, [], "unreferenced stylesheets in assets/css");
});

test("no page loads a script that nothing references", () => {
  const loaded = new Set(
    PAGES.flatMap(({ file, scripts }) =>
      scripts.map((s) => path.basename(scriptFile(file, s))),
    ),
  );
  const candidates = fs
    .readdirSync(path.join(site, "assets/js"))
    .filter((name) => name.endsWith(".js"));
  const orphans = candidates.filter((name) => !loaded.has(name));
  assert.deepEqual(orphans, [], "unreferenced scripts in assets/js");
});

test("the loader's public API is present and callable", () => {
  const source = read("website/assets/js/config-loader.js");
  const api = [
    "loadArcadeData",
    "parseBlockText",
    "bindOpenModeSelect",
    "createGameCard",
    "catalogNoticeHtml",
    "storageAvailable",
    "storageGet",
    "storageSet",
    "storageNoticeText",
    "draftBlocks",
    "buildGameBlock",
    "validateGameFields",
    "saveDraft",
    "deleteDraft",
    "gameUrl",
    "homeUrl",
    "getOpenMode",
    "escapeHtml",
    "assetUrl",
  ];
  api.forEach((name) =>
    assert.match(
      source,
      new RegExp(`(^|\\s)${name},`, "m"),
      `ExstArcade.${name} is not exported`,
    ),
  );
});

test("every page that shows the arcade has the shared UI hooks", () => {
  // These are what the loader and diagnostics attach to.
  assert.match(read("index.html"), /id="catalogNotice"/);
  assert.match(read("website/folder.html"), /id="folderNotice"/);
  assert.match(read("website/game.html"), /id="gameNotice"/);
  const css = read("website/assets/css/flix.css");
  assert.match(css, /\.catalog-notice\b/, "notice styles are missing");
  assert.match(css, /\.storage-note\b/, "storage note styles are missing");
  assert.match(css, /\.item-badge\.draft\b/, "draft badge styles are missing");
});

test("the site's own pages never promise what they cannot keep", () => {
  // Copy that the blocked-storage work made conditional must not come back
  // as an unconditional claim in the markup.
  const arcade = read("website/games/arcade.html");
  assert.match(
    arcade,
    /id="gameNote"/,
    "the best-score note needs an id so it can be corrected",
  );
  const index = read("index.html");
  assert.match(index, /id="catalogStatus"/);
  assert.match(index, /id="openMode"/);
});

test("artwork always has a default-art layer behind it", () => {
  const source = read("website/assets/js/flix.js");
  assert.match(source, /const DEFAULT_ART = asset\("assets\/images\/default-game\.svg"\)/);
  assert.match(source, /function artLayers/, "artLayers helper is missing");
  // Poster, hero cover, and details cover all use it.
  const uses = [...source.matchAll(/artLayers\(/g)].length;
  assert.ok(uses >= 4, `artLayers is used ${uses} times, expected 4+`);
  assert.ok(
    fs.existsSync(path.join(site, "assets/images/default-game.svg")),
    "the fallback artwork itself is missing",
  );
  // Both layers need to be sized, or the fallback shows unstyled.
  const css = read("website/assets/css/flix.css");
  assert.match(css, /background-size: cover, cover/);
});
