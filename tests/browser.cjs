/* Run with npm start in another terminal, then npm run test:browser. */
const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
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
    await goto("/");
    await expect(page.locator(".arcade-game-card")).toHaveCount(6);
    await expect(page.locator("#sidebar")).toHaveCSS(
      "background-color",
      "rgb(23, 24, 29)",
    );
    await page.locator('.favorite-button[data-favorite="neon-snake"]').click();
    await expect(page.locator("#favoriteCount")).toHaveText("1");
    await page.locator('[data-view="favorites"]').first().click();
    await expect(page.locator(".arcade-game-card")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".arcade-game-card h3")).toHaveText("Neon Snake");
    await page.locator(".favorite-button").click();
    await expect(page.locator(".empty-state")).toBeVisible();
    await page.locator('#mainNav [data-view="discover"]').click();
    await page.locator("#searchInput").fill("snake");
    await expect(page.locator(".arcade-game-card")).toHaveCount(1);
    await page.locator("#searchInput").fill("no-such-game");
    await expect(page.locator(".empty-state")).toBeVisible();
    await page.locator("#searchInput").fill("");
    await page.locator('[data-filter="Puzzle"]').click();
    await expect(page.locator(".arcade-game-card")).toHaveCount(2);
    await page.locator('[data-filter="All"]').click();
    await page.locator("#sortSelect").selectOption("az");
    await expect(page.locator(".arcade-game-card h3").first()).toHaveText(
      "2048",
    );
    await page.locator('[data-slide="1"]').click();
    await expect(page.locator(".hero-copy h2")).toHaveText("Cosmic Escape");
    await page.locator("#settingsButton").click();
    await page.locator("#openMode").selectOption("new");
    await page.locator("#savePreferences").click();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("exst-open-mode")),
      "new",
    );
    await page.locator("#settingsButton").click();
    await page.locator("#openMode").selectOption("page");
    await page.locator("#savePreferences").click();
    await page.locator('#mainNav [data-view="all"]').click();
    await expect(page.locator(".arcade-game-card")).toHaveCount(16);
    await page.locator('.card-play[data-play="fnaf"]').click();
    await expect(page.locator("#dialogTitle")).toHaveText(
      "This game needs its files",
    );
    await page.locator("#closeDialog").click();
    console.log(
      "✓ Search, categories, sorting, favorites, carousel, preferences and setup states",
    );
    await page.locator('.card-play[data-play="2048"]').click();
    await page.waitForURL("**/game.html?id=2048");
    const frame = page.frameLocator("#gameFrame");
    await frame.locator("#startButton").click();
    await expect(frame.locator(".tile")).toHaveCount(16);
    for (let i = 0; i < 6; i++)
      for (const key of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"])
        await page.keyboard.press(key);
    assert.ok(Number(await frame.locator("#score").textContent()) > 0);
    await page.locator("#backLink").click();
    await page.locator('#mainNav [data-view="recent"]').click();
    await expect(page.locator(".arcade-game-card h3")).toHaveText("2048");
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
      await goto("/games/arcade.html?game=" + id);
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
    await goto("/games/arcade.html?game=memory-match");
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
      if (await page.locator(`[data-card="${pair[0]}"]`).isDisabled()) continue;
      for (const i of pair) await page.locator(`[data-card="${i}"]`).click();
    }
    await expect(page.locator("#overlayTitle")).toHaveText("Nicely played.");
    assert.ok(Number(await page.locator("#score").textContent()) >= 800);
    console.log("✓ Memory Match complete win and high score");
    await goto("/");
    await expect(page.locator(".arcade-game-card")).toHaveCount(6);
    fs.mkdirSync(".test-artifacts", { recursive: true });
    await page.screenshot({
      path: ".test-artifacts/desktop.png",
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
          path: ".test-artifacts/mobile.png",
          fullPage: true,
        });
        await page.locator("#menuToggle").click();
        await expect(page.locator("#sidebar")).toHaveClass(/open/);
        await page.locator('#mainNav [data-view="favorites"]').click();
        await expect(page.locator("#sidebar")).not.toHaveClass(/open/);
        await page.locator("#menuToggle").click();
        await page.locator('#mainNav [data-view="discover"]').click();
      }
    }
    await page.locator("#foldersButton").click();
    await expect(page.locator(".folder-links>a")).toHaveCount(4);
    await page.locator('.folder-links>a[href="folder.html?id=arcade"]').click();
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
    await goto("/game.html?id=fnaf");
    await expect(page.locator("#gameFallback")).toBeVisible();
    await expect(page.locator(".player-actions")).toBeHidden();
    await goto("/game.html?id=not-found");
    await expect(page.locator(".frame-fallback h1")).toHaveText(
      "Game could not load",
    );
    console.log(
      "✓ Configured collections, folder launch modes, missing-game fallbacks",
    );
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
