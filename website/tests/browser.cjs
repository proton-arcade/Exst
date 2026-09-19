/* Run with npm start in another terminal, then npm run test:browser. */
const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", ".."); // repository root

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
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [],
      broken = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`);
    });
    const base = process.env.TEST_URL || "http://127.0.0.1:3000";
    const goto = async (route) => {
      await page.goto(base + route);
    };
    const goTabOn = async (target, ref) => {
      await target.locator(`#footerBar [ref="${ref}"]`).click();
    };
    const goTab = async (ref) => goTabOn(page, ref);

    // Netflix-style home: hero cover + originals row + red logo.
    await goto("/");
    await expect(page.locator("#row-originals .movie")).toHaveCount(6);
    await expect(page.locator(".logo")).toHaveCSS(
      "color",
      "rgb(221, 53, 50)",
    );
    await expect(page.locator(".hero-title")).not.toBeEmpty();
    await expect(page.locator("#page-home")).toBeVisible();

    // Details slide-in + My List favorites with reload persistence.
    await page.locator('#row-originals [data-details="neon-snake"]').click();
    await expect(page.locator("#detailsPage")).toBeVisible();
    await expect(page.locator("#detailsTitle")).toHaveText("Neon Snake");
    await page.locator("#detailsFooterFav").click();
    await page.locator("#detailsClose").click();
    await expect(page.locator("#row-mylist .movie")).toHaveCount(1);
    await goTab("about");
    await expect(page.locator("#favoriteCount")).toHaveText("1");
    await goTab("home");
    await page.reload();
    await expect(page.locator("#row-mylist .movie .item-label")).toHaveText(
      "Neon Snake",
    );
    await page.locator('#row-mylist [data-details="neon-snake"]').click();
    await page.locator("#detailsFooterFav").click();
    await page.locator("#detailsClose").click();
    await expect(page.locator("#row-mylist")).toBeHidden();

    // Search tab: live results, empty states, categories, sorting.
    await goTab("search");
    await page.locator("#searchInput").fill("snake");
    await expect(page.locator("#searchGrid .movie")).toHaveCount(1);
    await page.locator("#searchInput").fill("no-such-game");
    await expect(page.locator("#searchEmpty")).toBeVisible();
    await page.locator("#searchInput").fill("");
    await page.locator('[data-filter="Puzzle"]').click();
    await expect(page.locator("#searchGrid .movie")).toHaveCount(2);
    await page.locator('[data-filter="All"]').click();
    await page.locator("#sortSelect").selectOption("az");
    await expect(
      page.locator("#searchGrid .movie .item-label").first(),
    ).toHaveText("2048");
    await page.locator("#sortSelect").selectOption("popular");

    // Hero carousel rotates the featured spotlight.
    await goTab("home");
    await page.locator('[data-slide="1"]').click();
    await expect(page.locator(".hero-title")).toHaveText("Neon Snake");

    // Preferences persist the launch mode.
    await goTab("about");
    await page.locator("#openMode").selectOption("new");
    assert.equal(
      await page.evaluate(() => localStorage.getItem("exst-open-mode")),
      "new",
    );
    await page.locator("#openMode").selectOption("page");

    // Full library + setup-needed starter entries.
    await goTab("search");
    await expect(page.locator("#searchGrid .movie")).toHaveCount(16);
    await page.locator('#searchGrid [data-details="fnaf"]').click();
    await expect(page.locator("#dialogTitle")).toHaveText(
      "This game needs its files",
    );
    await page.locator("#closeDialog").click();
    console.log(
      "✓ Search, categories, sorting, My List, carousel, preferences and setup states",
    );

    // Details Play launches the player; 2048 merges and scores.
    await page.locator('#searchGrid [data-details="2048"]').click();
    await page.locator("#detailsPlay").click();
    await page.waitForURL("**/website/game.html?id=2048");
    const frame = page.frameLocator("#gameFrame");
    await frame.locator("#startButton").click();
    await expect(frame.locator(".tile")).toHaveCount(16);
    for (let i = 0; i < 6; i++)
      for (const key of [
        "ArrowLeft",
        "ArrowDown",
        "ArrowRight",
        "ArrowUp",
      ])
        await page.keyboard.press(key);
    assert.ok(Number(await frame.locator("#score").textContent()) > 0);
    await page.locator("#backLink").click();
    await goTab("notifications");
    await expect(
      page.locator("#recentRow .movie .item-label").first(),
    ).toHaveText("2048");
    console.log(
      "✓ Game player, 2048 merge scoring, persistence and recently played",
    );
    for (const id of [
      "neon-drift",
      "neon-snake",
      "cosmic-escape",
      "memory-match",
      "brick-breaker",
    ]) {
      await goto("/website/games/arcade.html?game=" + id);
      await page.locator("#startButton").click();
      await expect(page.locator("#overlay")).toBeHidden();
      await page.locator("#pauseButton").click();
      await expect(page.locator("#overlayTitle")).toHaveText(
        "Take a breather.",
      );
      await page.locator("#startButton").click();
      await expect(page.locator("#overlay")).toBeHidden();
      if (id === "memory-match") {
        await expect(page.locator(".memory-card")).toHaveCount(16);
        await page.locator('[data-card="0"]').click();
        await page.locator('[data-card="1"]').click();
        await expect(page.locator("#controlHint")).toContainText("1 moves");
      } else {
        await page.keyboard.press("ArrowLeft");
      }
      await page.locator("#restartButton").click();
      await expect(page.locator("#score")).toHaveText("0");
      await page.locator("#pauseButton").click();
      console.log("✓ " + id + " start, controls, pause, resume, restart");
    }
    // Solve Memory Match using only visible card information; verify a real win.
    await goto("/website/games/arcade.html?game=memory-match");
    await page.locator("#startButton").click();
    const symbols = {};
    for (let i = 0; i < 16; i += 2) {
      for (const n of [i, i + 1]) {
        await page.locator(`[data-card="${n}"]`).click();
        symbols[n] = await page.locator(`[data-card="${n}"]`).textContent();
      }
      await page.waitForTimeout(900);
    }
    const groups = {};
    for (const [i, symbol] of Object.entries(symbols))
      (groups[symbol] ??= []).push(i);
    for (const pair of Object.values(groups)) {
      if (await page.locator(`[data-card="${pair[0]}"]`).isDisabled())
        continue;
      for (const i of pair) await page.locator(`[data-card="${i}"]`).click();
    }
    await expect(page.locator("#overlayTitle")).toHaveText("Nicely played.");
    assert.ok(Number(await page.locator("#score").textContent()) >= 800);
    console.log("✓ Memory Match complete win and high score");
    await goto("/");
    await expect(page.locator("#row-originals .movie")).toHaveCount(6);
    fs.mkdirSync(path.join(root, ".test-artifacts"), { recursive: true });
    await page.screenshot({
      path: path.join(root, ".test-artifacts/desktop.png"),
      fullPage: true,
    });
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
        await expect(page.locator("#page-home")).toBeHidden();
        await goTab("home");
        await expect(page.locator("#page-home")).toBeVisible();
      }
    }
    await goTab("about");
    // #aboutFolders holds the collections; "Add a game" is a separate link
    // that happens to share the same styling class.
    await expect(page.locator("#aboutFolders>a")).toHaveCount(4);
    await page
      .locator('.folder-links>a[href="website/folder.html?id=arcade"]')
      .click();
    await expect(page.locator("#folderTitle")).toHaveText("Fast arcade rounds");
    await expect(page.locator(".game-card")).toHaveCount(7);
    await page.locator("#openMode").selectOption("new");
    await expect(page.locator(".play-link").first()).toHaveAttribute(
      "target",
      "_blank",
    );
    await page.locator("#openMode").selectOption("page");
    await page.locator(".play-link").first().click();
    await expect(page.locator("#backLink")).toHaveAttribute(
      "href",
      "folder.html?id=arcade",
    );
    await goto("/website/game.html?id=fnaf");
    await expect(page.locator("#gameFallback")).toBeVisible();
    await expect(page.locator(".player-actions")).toBeHidden();
    await goto("/website/game.html?id=not-found");
    await expect(page.locator(".frame-fallback h1")).toHaveText(
      "Game could not load",
    );
    await goto("/website/game.html?path=games/fnaf.html");
    await expect(page.locator("#gameTitle")).toHaveText("Fnaf");
    await expect(page.locator("#gameFrame")).toBeVisible();
    await goto("/website/game.html?path=../../index.html");
    await expect(page.locator(".frame-fallback h1")).toHaveText(
      "Game could not load",
    );
    console.log(
      "✓ Configured collections, folder launch modes, missing-game fallbacks",
    );

    // A catalog edit is never silent: a clean library shows no notice...
    await goto("/");
    await expect(page.locator(".catalog-notice")).toHaveCount(0);

    // ...a recoverable mistake is listed with file + line and can be closed...
    await page.route("**/website/data/games.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body:
          "window.EXST_GAMES_TEXT = `\n[game]\nid=alpha\ntitle=Alpha\npath=games/arcade.html?game=neon-snake\n\n[game]\nid=alpha\ntitle=Alpha copy\npath=games/arcade.html?game=2048\n`;",
      }),
    );
    await page.route("**/website/data/folders.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body:
          "window.EXST_FOLDERS_TEXT = `\n[folder]\nid=one\ntitle=One\ngames=alpha\n`;",
      }),
    );
    await goto("/");
    await expect(page.locator(".catalog-notice")).toBeVisible();
    await expect(page.locator(".catalog-notice")).toContainText("CATALOG CHECK");
    await expect(page.locator(".catalog-notice")).toContainText(
      "id=alpha is already used on line 3",
    );
    await expect(page.locator(".catalog-notice li").first()).toContainText(
      "line 8",
    );
    await page.locator("[data-dismiss-notice]").click();
    await expect(page.locator(".catalog-notice")).toHaveCount(0);
    await page.unroute("**/website/data/games.js");
    await page.unroute("**/website/data/folders.js");

    // ...and an unreadable catalog file is explained instead of leaving the
    // page stuck on "Loading…" with an empty arcade.
    const errorsBeforeBrokenCatalog = errors.length;
    await page.route("**/website/data/games.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body:
          // The classic mis-paste: a block after the closing backtick, which
          // makes the whole catalog file a syntax error.
          "window.EXST_GAMES_TEXT = `\n[game]\nid=only-game\n`;\n\n[game]\nid=oops\ntitle=My Game\n",
      }),
    );
    await goto("/");
    await expect(page.locator("#heroTitle")).toHaveText(
      "The game library could not be read",
    );
    await expect(page.locator(".hero-notice")).toContainText("closing backtick");
    await expect(page.locator(".hero-notice")).toContainText(
      "website/data/games.js could not be read",
    );
    // The Play button cannot launch anything, so it is not offered.
    await expect(page.locator(".hero-content .options")).toBeHidden();
    await page.unroute("**/website/data/games.js");
    await goto("/");
    await expect(page.locator("#row-originals .movie")).toHaveCount(6);
    errors.length = errorsBeforeBrokenCatalog; // the broken file is the point of the test
    console.log(
      "\u2713 Catalog edits: broken files and duplicate ids are explained on screen",
    );

    // Add a game from inside the site: it must be validated, saved, playable
    // immediately, clearly marked as device-local, and removable.
    await goto("/website/add.html");
    await expect(page.locator("#blockPreview")).toContainText("[game]");
    // The form refuses an id with a space, and says why.
    await page.locator("#fieldId").fill("neon pong");
    await page.locator("#fieldTitle").fill("Neon Pong");
    await page.locator("#fieldPath").fill("games/neon-pong.html");
    await expect(page.locator("#saveDraft")).toBeDisabled();
    await expect(page.locator("#addNotice")).toContainText(
      "cannot contain spaces",
    );
    // A usable id saves, and the page says exactly what happened.
    await page.locator("#fieldId").fill("neon-pong");
    await expect(page.locator("#fieldId")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.locator("#addNotice")).not.toContainText("cannot contain");
    await page.locator("#fieldIcon").fill("assets/images/default-game.svg");
    await page.locator("#fieldTags").fill("Arcade, Action");
    await page.locator("#fieldDescription").fill("Added from inside the site.");
    await expect(page.locator("#saveDraft")).toBeEnabled();
    await page.locator("#saveDraft").click();
    await expect(page.locator("#saveStatus")).toContainText(
      "Saved Neon Pong on this device",
    );
    await expect(page.locator("#draftList")).toContainText("Neon Pong");
    await expect(page.locator("#draftCount")).toHaveText("1");
    // The block it offers is the exact catalog text.
    await expect(page.locator("#blockPreview")).toContainText("id=neon-pong");
    await expect(page.locator("#blockPreview")).toContainText("tags=Arcade, Action");

    // Home: the new game is in the library, badged as added on this device.
    await goto("/");
    await expect(page.locator("#row-all .movie")).toHaveCount(17);
    await expect(
      page.locator('#row-all [data-details="neon-pong"] .item-badge'),
    ).toHaveText("DRAFT");
    await expect(page.locator("#row-all")).toContainText("Neon Pong");
    await page.locator('#row-all [data-details="neon-pong"]').click();
    await expect(page.locator("#detailsDraftNote")).toBeVisible();
    await expect(page.locator("#detailsDraftNote")).toContainText(
      "Added on this device",
    );
    await page.locator("#detailsClose").click();
    await goTab("search");
    await page.locator("#searchInput").fill("neon-pong");
    await expect(page.locator("#searchGrid .movie")).toHaveCount(1);
    await page.locator("#searchInput").fill("");
    await goTab("about");
    await expect(page.locator("#draftCount")).toContainText(
      "1 added on this device",
    );
    await expect(
      page.locator('.folder-links a[href="website/add.html"]'),
    ).toBeVisible();

    // Removing it takes it back out of the library.
    await goto("/website/add.html");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("[data-remove]").click();
    await expect(page.locator("#draftCount")).toHaveText("0");
    await expect(page.locator("#draftList")).toContainText("Nothing added here yet");
    await goto("/");
    await expect(page.locator("#row-all .movie")).toHaveCount(16);
    console.log(
      "\u2713 Adding a game inside the site: validated, saved, playable, badged and removable",
    );
    // No-server proof: open the site straight from the filesystem.
    const filePage = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const fileErrors = [];
    filePage.on("pageerror", (e) => fileErrors.push(e.message));
    await filePage.goto("file://" + path.join(root, "index.html"));
    await expect(filePage.locator("#row-originals .movie")).toHaveCount(6);
    await filePage
      .locator('#row-originals [data-details="neon-drift"]')
      .click();
    await filePage.locator("#detailsPlay").click();
    await filePage.waitForURL(/game\.html\?id=neon-drift/);
    await filePage
      .frameLocator("#gameFrame")
      .locator("#startButton")
      .click();
    await expect(filePage.frameLocator("#gameFrame").locator("#overlay")).toBeHidden();
    await filePage.locator("#backLink").click();
    await filePage.waitForURL(/index\.html/);
    await expect(filePage.locator("#row-originals .movie")).toHaveCount(6);
    await filePage.locator('#footerBar [ref="about"]').click();
    await expect(filePage.locator("#catalogStatus")).toContainText(
      "16 games and 4 collections read from website/data/games.js",
    );
    await filePage
      .locator('.folder-links>a[href="website/folder.html?id=arcade"]')
      .click();
    await expect(filePage.locator("#folderTitle")).toHaveText(
      "Fast arcade rounds",
    );
    await filePage.close();
    assert.deepEqual(fileErrors, [], "file:// JavaScript errors");
    console.log(
      "✓ No-server file:// run: dashboard, player and folder all work",
    );

    // The claim this whole suite exists to protect: edit the catalog on disk,
    // reload, and the new game is there — even over file:// with no server.
    const editDir = fs.mkdtempSync(path.join(os.tmpdir(), "exst-catalg-edit-"));
    try {
      const skipDirs = new Set(["node_modules", ".git", ".test-artifacts"]);
      fs.cpSync(root, editDir, {
        recursive: true,
        filter: (src) =>
          !path.relative(root, src).split(path.sep).some((p) => skipDirs.has(p)),
      });
      const gamesFile = path.join(editDir, "website/data/games.js");
      fs.writeFileSync(
        gamesFile,
        fs
          .readFileSync(gamesFile, "utf8")
          .replace(
            /(\n`;)\s*$/,
            "\n[game]\nid=my-test-game\ntitle=My Test Game\nversion=Just added\nicon=assets/images/default-game.svg\npath=games/my-test-game.html\ndescription=Added during the catalog-edit test.\ntags=Arcade\n$1",
          ),
      );
      // Its own browser: this check opens and closes a page after the main
      // page has been through the whole suite.
      const editBrowser = await launch();
      const editPage = await editBrowser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      await editPage.goto("file://" + path.join(editDir, "index.html"));
      await expect(editPage.locator("#row-all .movie")).toHaveCount(17);
      await expect(
        editPage.locator("#row-all .item-label", { hasText: "My Test Game" }),
      ).toHaveCount(1);
      await expect(editPage.locator(".catalog-notice")).toHaveCount(0);
      await editPage.locator('#footerBar [ref="about"]').click();
      await expect(editPage.locator("#catalogStatus")).toContainText(
        "17 games and 4 collections read from website/data/games.js",
      );
      await expect(
        editPage.locator('.folder-links > a[href*="folder.html?id=arcade"]'),
      ).toContainText("7 games");
      await editPage.close();
      await editBrowser.close();
      console.log(
        "\u2713 Catalog edits: a new [game] block appears after a reload, over file://",
      );
    } finally {
      fs.rmSync(editDir, { recursive: true, force: true });
    }

    // A browser that blocks storage must be told, not silently ignored —
    // "it doesn't save" is never left unexplained.
    const blockedBrowser = await launch();
    try {
      const blockedPage = await blockedBrowser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      await blockedPage.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          get() {
            throw new DOMException("The operation is insecure.", "SecurityError");
          },
        });
      });
      const blockedErrors = [];
      blockedPage.on("pageerror", (e) => blockedErrors.push(e.message));

      // The library still loads and plays.
      await blockedPage.goto(base + "/");
      await expect(blockedPage.locator("#row-originals .movie")).toHaveCount(6);
      // ...and About/passwords say plainly that nothing can be saved.
      await goTabOn(blockedPage, "about");
      await expect(blockedPage.locator("#catalogStatus")).toContainText(
        "not letting the page save data",
      );
      await expect(blockedPage.locator(".pref-block .hint")).toContainText(
        "not letting the page save data",
      );
      // Favoriting still works for the session and reports the failure.
      await goTabOn(blockedPage, "home");
      await blockedPage
        .locator('#row-originals [data-details="neon-snake"]')
        .click();
      await blockedPage.locator("#detailsFooterFav").click();
      await expect(blockedPage.locator("#toast")).toContainText(
        "this browser is not saving changes",
      );
      await blockedPage.locator("#detailsClose").click();

      // Collection pages say it too.
      await blockedPage.goto(base + "/website/folder.html?id=arcade");
      await expect(blockedPage.locator("#storageNote")).toContainText(
        "not letting the page save data",
      );

      // And the game itself stops promising a saved best score.
      await blockedPage.goto(base + "/website/game.html?id=neon-snake");
      const blockedFrame = blockedPage.frameLocator("#gameFrame");
      await expect(blockedFrame.locator("#gameNote")).toContainText(
        "not letting the page save data",
      );

      assert.deepEqual(blockedErrors, [], "blocked-storage JavaScript errors");
      console.log(
        "\u2713 Blocked storage: library still plays, and saving is explained instead of silently dropped",
      );
      await blockedPage.close();
    } finally {
      await blockedBrowser.close();
    }

    assert.deepEqual(errors, [], "Browser JavaScript errors");
    assert.deepEqual(broken, [], "Broken local resources");
    console.log(
      "✓ Mobile navigation, responsive widths, no broken assets or JavaScript errors",
    );
    console.log("All browser tests passed.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
