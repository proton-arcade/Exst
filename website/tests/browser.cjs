/* Run with npm start in another terminal, then npm run test:browser.
 *
 * The site ships with an empty library, so the suite drops a temporary demo
 * catalog into the page contexts it needs. The shipped empty state gets its
 * own checks at the end.
 */
const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", ".."); // repository root
const site = path.join(root, "website");
const demoFile = path.join(site, "games/test-demo.html");

const DEMO_CATALOG = `
# Three games plus one whose file is missing, for the player fallback.
[game]
id=demo-one
title=Demo One
path=games/test-demo.html
description=First demo game.
tags=Puzzle, Arcade
featured=true
hero=true

[game]
id=demo-two
title=Demo Two
path=games/test-demo.html
description=Second demo game.
tags=Action
hero=true

[game]
id=demo-three
title=Demo Three
path=games/test-demo.html
description=Third demo game.
tags=Racing

[game]
id=demo-missing
title=Demo Missing
path=games/does-not-exist.html
description=Points at a file that is not there.
`;

const DEMO_FOLDERS = `
[folder]
id=demo-shelf
title=Demo shelf
description=Two of the demo games.
icon=assets/images/folder.svg
games=demo-one, demo-two
`;

// The page's data/games.js assigns window.EXST_GAMES_TEXT. These pages keep a
// getter that ignores that assignment, so the demo catalog is what loads.
const INJECT = ([games, folders]) => {
  Object.defineProperty(window, "EXST_GAMES_TEXT", {
    configurable: true,
    get: () => games,
    set: () => {},
  });
  Object.defineProperty(window, "EXST_FOLDERS_TEXT", {
    configurable: true,
    get: () => folders,
    set: () => {},
  });
};

async function launch() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    // Portable fallback for restricted sandboxes with no system Chromium.
    const packed = require("@sparticuz/chromium").default;
    const dir = path.join(os.tmpdir(), "exst-browser-libs");
    fs.mkdirSync(dir, { recursive: true });
    const packageRoot = path.dirname(
      path.dirname(require.resolve("@sparticuz/chromium")),
    );
    const archive = require("node:zlib").brotliDecompressSync(
      fs.readFileSync(path.join(packageRoot, "bin/al2023.tar.br")),
    );
    execFileSync("tar", ["xf", "-", "-C", dir], { input: archive });
    return chromium.launch({
      headless: true,
      executablePath: await packed.executablePath(),
      args: packed.args,
      env: { ...process.env, LD_LIBRARY_PATH: path.join(dir, "lib") },
    });
  }
}

(async () => {
  const browser = await launch();
  const errors = [];
  const broken = [];
  const watch = (page) => {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      // One demo entry deliberately points at a missing file.
      if (r.status() >= 400 && !r.url().includes("games/does-not-exist.html"))
        broken.push(`${r.status()} ${r.url()}`);
    });
    return page;
  };
  fs.writeFileSync(
    demoFile,
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Demo game</title></head>' +
      '<body><h1 id="demo">Demo game running</h1></body></html>\n',
  );

  try {
    const base = process.env.TEST_URL || "http://127.0.0.1:3000";
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await context.addInitScript(INJECT, [DEMO_CATALOG, DEMO_FOLDERS]);
    const page = watch(await context.newPage());
    const goto = async (route) => {
      await page.goto(base + route);
    };
    const goTab = async (ref) => {
      await page.locator(`#footerBar [ref="${ref}"]`).click();
    };

    // Home: hero carousel from hero=true, poster rows, red logo.
    await goto("/");
    await expect(page.locator(".hero-title")).toHaveText("Demo One");
    await expect(page.locator("#heroDots [data-slide]")).toHaveCount(2);
    await expect(page.locator("#row-top .movie")).toHaveCount(1);
    await expect(page.locator("#row-all .movie")).toHaveCount(4);
    await expect(page.locator("#row-folder-demo-shelf .movie")).toHaveCount(2);
    await expect(page.locator(".logo")).toHaveCSS("color", "rgb(221, 53, 50)");
    await expect(page.locator("#heroEdit")).toBeVisible();

    // The carousel cycles through the games marked hero=true.
    await page.locator('#heroDots [data-slide="1"]').click();
    await expect(page.locator(".hero-title")).toHaveText("Demo Two");

    // Spotlight editor: tick a game, reorder it, save, and keep it on reload.
    await page.locator("#heroEdit").click();
    await expect(page.locator("#spotlightDialog")).toBeVisible();
    await expect(page.locator(".spot-row")).toHaveCount(4);
    await page.locator("[data-spot-toggle='2']").check();
    await page.locator("[data-spot-up='2']").click();
    await page.locator("[data-spot-up='1']").click();
    await expect(
      page.locator(".spot-row").first().locator(".spot-title"),
    ).toHaveText("Demo Three");
    await page.locator("[data-spot-save]").click();
    await expect(page.locator("#spotlightDialog")).toBeHidden();
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("exst-hero-ids"))),
      ["demo-three", "demo-one", "demo-two"],
    );
    await expect(page.locator(".hero-title")).toHaveText("Demo Three");
    await expect(page.locator("#heroDots [data-slide]")).toHaveCount(3);
    await page.reload();
    await expect(page.locator(".hero-title")).toHaveText("Demo Three");
    await expect(page.locator("#heroDots [data-slide]")).toHaveCount(3);

    // Copy out: a ready-to-paste catalog in the chosen order.
    await page.locator("#heroEdit").click();
    await page.locator("[data-spot-copy]").click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(copied.includes("window.EXST_GAMES_TEXT"));
    assert.ok(copied.includes("hero=true"));
    assert.ok(
      copied.indexOf("id=demo-three") < copied.indexOf("id=demo-one"),
      "copied catalog should keep the spotlight order",
    );

    // Reset drops the local choice and returns to the catalog order.
    await page.locator("[data-spot-reset]").click();
    await expect(page.locator(".hero-title")).toHaveText("Demo One");
    await expect(page.locator("#heroDots [data-slide]")).toHaveCount(2);
    await page.locator("#closeSpotlight").click();

    // Search tab: live results, empty state, categories, sorting.
    await goTab("search");
    await page.locator("#searchInput").fill("demo two");
    await expect(page.locator("#searchGrid .movie")).toHaveCount(1);
    await page.locator("#searchInput").fill("no-such-game");
    await expect(page.locator("#searchEmpty")).toBeVisible();
    await page.locator("#searchInput").fill("");
    await page.locator('[data-filter="Racing"]').click();
    await expect(page.locator("#searchGrid .movie")).toHaveCount(1);
    await page.locator('[data-filter="All"]').click();
    await page.locator("#sortSelect").selectOption("az");
    await expect(
      page.locator("#searchGrid .movie .item-label").first(),
    ).toHaveText("Demo Missing");

    // Details slide-in plus My List, remembered after a reload.
    await page.locator('#searchGrid [data-details="demo-one"]').click();
    await expect(page.locator("#detailsPage")).toBeVisible();
    await expect(page.locator("#detailsTitle")).toHaveText("Demo One");
    await page.locator("#detailsFooterFav").click();
    await page.locator("#detailsClose").click();
    await page.reload();
    await goTab("home");
    await expect(page.locator("#row-mylist .movie")).toHaveCount(1);
    await page.locator('#row-mylist [data-details="demo-one"]').click();
    await page.locator("#detailsFooterFav").click();
    await page.locator("#detailsClose").click();
    await expect(page.locator("#row-mylist")).toBeHidden();

    // The player embeds the game file.
    await goto("/website/game.html?id=demo-one");
    await expect(page.locator("#gameTitle")).toHaveText("Demo One");
    await expect(page.locator("#gameFrame")).toBeVisible();
    await expect(
      page.frameLocator("#gameFrame").locator("#demo"),
    ).toHaveText("Demo game running");

    // A catalog entry whose file is missing explains itself.
    await goto("/website/game.html?id=demo-missing");
    await expect(page.locator("#gameFallback")).toBeVisible();
    await expect(page.locator("#gameFallback h1")).toHaveText(
      "That game file is missing",
    );
    await expect(page.locator("#missingPath")).toHaveText(
      "games/does-not-exist.html",
    );
    await goto("/website/game.html?id=not-found");
    await expect(page.locator(".frame-fallback h1")).toHaveText(
      "Game could not load",
    );

    // Direct launch by path works, path traversal does not.
    await goto("/website/game.html?path=games/test-demo.html");
    await expect(page.locator("#gameTitle")).toHaveText("Test demo");
    await expect(page.locator("#gameFrame")).toBeVisible();
    await goto("/website/game.html?path=../../index.html");
    await expect(page.locator(".frame-fallback h1")).toHaveText(
      "Game could not load",
    );

    // Folder page: cards, launch mode, and the details panel from a poster.
    await goto("/website/folder.html?id=demo-shelf");
    await expect(page.locator("#folderTitle")).toHaveText("Demo shelf");
    await expect(page.locator(".game-card")).toHaveCount(2);
    await page.locator("#openMode").selectOption("new");
    await expect(page.locator(".play-link").first()).toHaveAttribute(
      "target",
      "_blank",
    );
    await page.locator("#openMode").selectOption("page");
    await page.locator(".game-thumb").first().click();
    await expect(page.locator("#detailsPage")).toBeVisible();

    // About: the spotlight shortcut and no catalog notes for a clean file.
    await goto("/");
    await goTab("about");
    await expect(page.locator("#aboutFolders > a")).toHaveCount(1);
    await expect(page.locator("#catalogNotes")).toBeHidden();

    // Responsive: no horizontal overflow at phone, tablet and desktop widths.
    fs.mkdirSync(path.join(root, ".test-artifacts"), { recursive: true });
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(260);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `Overflow at ${width}px`,
      );
      if (width === 390) {
        await page.screenshot({
          path: path.join(root, ".test-artifacts/mobile.png"),
          fullPage: true,
        });
        await goTab("search");
        await expect(page.locator("#page-search")).toBeVisible();
        await goTab("home");
        await page.locator("#heroEdit").click();
        await expect(page.locator("#spotlightDialog")).toBeVisible();
        await page.screenshot({
          path: path.join(root, ".test-artifacts/spotlight-editor.png"),
        });
        await page.locator("#closeSpotlight").click();
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await goto("/");
    await page.screenshot({
      path: path.join(root, ".test-artifacts/desktop.png"),
      fullPage: true,
    });
    console.log(
      "✓ Carousel, spotlight editor, search, My List, player and collections",
    );

    // The shipped state: an empty library that explains how to add a game.
    const empty = watch(
      await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    );
    await empty.goto(base + "/");
    await expect(empty.locator(".hero-title")).toHaveText("Add your first game");
    await expect(empty.locator("#heroHowTo")).toBeVisible();
    await expect(empty.locator("#heroEdit")).toBeHidden();
    await expect(empty.locator("#row-empty")).toBeVisible();
    await empty.locator("[data-starter]").click();
    await expect(empty.locator("#dialogTitle")).toHaveText("Add a game");
    await expect(empty.locator(".starter-block")).toContainText("hero=true");
    await empty.locator("#closeDialog").click();
    await empty.locator('#footerBar [ref="search"]').click();
    await expect(empty.locator("#searchCount")).toHaveText(
      "0 games in the library",
    );
    await expect(empty.locator("#searchEmpty")).toBeVisible();
    await empty.locator('#footerBar [ref="about"]').click();
    await expect(empty.locator("#aboutFolders")).toContainText(
      "No collections yet",
    );
    // The About shortcut opens the same editor, which explains the empty file.
    await empty.locator("#aboutSpotlight").click();
    await expect(empty.locator("#spotlightContent")).toContainText(
      "There are no games",
    );
    await empty.locator("#spotlightContent [data-starter]").click();
    await expect(empty.locator("#dialogTitle")).toHaveText("Add a game");
    await expect(empty.locator(".starter-block")).toContainText("[game]");
    await empty.locator("#closeDialog").click();
    await empty.locator("[data-spot-close]").click();
    await expect(empty.locator("#page-about")).toBeVisible();
    await empty.locator('#footerBar [ref="home"]').click();
    await expect(empty.locator("#page-home")).toBeVisible();
    await expect(empty.locator("#heroHowTo")).toBeVisible();
    console.log("✓ Empty library: hero, rows, search and About all guide the way");

    // No-server proof: the same page, opened straight from the filesystem.
    // (Closing extra pages kills the fallback Chromium used in sandboxes, so
    // the file:// checks reuse this one.)
    const fileErrors = [];
    empty.on("pageerror", (e) => fileErrors.push(e.message));
    await empty.goto("file://" + path.join(root, "index.html"));
    await expect(empty.locator(".hero-title")).toHaveText("Add your first game");
    await expect(empty.locator("#row-empty")).toBeVisible();
    await expect(empty.locator(".logo")).toBeVisible();
    await empty.locator("#heroHowTo").click();
    await expect(empty.locator("#dialogTitle")).toHaveText("Add a game");
    await empty.locator("#closeDialog").click();
    await empty.locator('#footerBar [ref="about"]').click();
    await empty.locator("#aboutSpotlight").click();
    await expect(empty.locator("#spotlightContent")).toContainText(
      "There are no games",
    );
    await empty.locator("[data-spot-close]").click();
    await empty.goto("file://" + path.join(root, "website/folder.html"));
    await expect(empty.locator("#folderTitle")).toHaveText(
      "Collection unavailable",
    );
    assert.deepEqual(fileErrors, [], "file:// JavaScript errors");
    console.log("✓ No-server file:// run: home, spotlight dialog and folder");

    assert.deepEqual(errors, [], "Browser JavaScript errors");
    assert.deepEqual(broken, [], "Broken local resources");
    console.log(
      "✓ Mobile navigation, responsive widths, no broken assets or JavaScript errors",
    );
    console.log("All browser tests passed.");
  } finally {
    fs.rmSync(demoFile, { force: true });
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
