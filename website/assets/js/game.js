/* Game player. Loads the catalog (no server needed) and embeds the game. */
const params = new URLSearchParams(location.search);
const gameId = params.get("id");
const directPath = params.get("path");

// Where the "back" button should return to. A folder link means we came from
// a collection page; anything else goes back to the home dashboard.
const requestedFrom = params.get("from") || "";
const from = /^folder\.html(\?[^#]*)?$/.test(requestedFrom)
  ? requestedFrom
  : ExstArcade.homeUrl();

/**
 * Direct launch (game.html?path=...) accepts only relative .html/.htm paths
 * inside the site: no schemes, no absolute paths, no parent-directory steps.
 */
function isSafeDirectPath(value) {
  if (!value) return false;
  if (/[\\]/.test(value)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  if (value.startsWith("/") || value.startsWith("//")) return false;
  if (value.split("/").some((part) => part === "..")) return false;
  return /\.(html?)([?#][^\s]*)?$/i.test(value);
}

/**
 * Best-effort check that the game file exists. Over file:// the browser will
 * not let us probe the filesystem, so we trust the catalog's available flag
 * there; over http(s) we can confirm with a HEAD request.
 */
async function pathLooksAvailable(path) {
  if (!path || path === "#") return false;
  if (location.protocol === "file:") return true;
  try {
    const response = await fetch(path, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch (_) {
    return true;
  }
}

async function resolveGame() {
  if (!directPath && !gameId)
    throw new Error(
      "No game selected. Open this page as game.html?id=<game-id> (from website/data/games.js) or game.html?path=games/<file>.html.",
    );
  if (directPath) {
    if (!isSafeDirectPath(directPath))
      throw new Error(
        "The path parameter must be a relative .html file inside the site.",
      );
    const slug = directPath
      .split("/")
      .pop()
      .split("?")[0]
      .replace(/\.html?$/i, "")
      .replace(/[-_]+/g, " ");
    return {
      id: slug,
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
      version: "Direct launch",
      description: "",
      tags: [],
      path: directPath,
      available: true,
    };
  }
  const arcade = await ExstArcade.loadArcadeData();
  const game = arcade.byId.get(gameId);
  if (!game)
    throw new Error(
      `No game with ID "${gameId}" exists in website/data/games.js.`,
    );
  return game;
}

async function bootGame() {
  const game = await resolveGame();

  const target = ExstArcade.assetUrl(game.path);
  document.title = `${game.title} — Exst Arcade`;
  document.getElementById("gameTitle").textContent = game.title;
  document.getElementById("gameMeta").textContent = [game.version, game.id]
    .filter(Boolean)
    .join(" · ");
  document.getElementById("backLink").href = from;
  document.getElementById("openDirect").href = target;
  document.getElementById("reloadGame").addEventListener("click", () => {
    document.getElementById("gameFrame").src = target;
  });

  const frame = document.getElementById("gameFrame");
  const fallback = document.getElementById("gameFallback");
  document
    .getElementById("fullscreenGame")
    ?.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await frame.requestFullscreen();
      } catch {
        document.getElementById("fullscreenGame").textContent = "Use new tab";
      }
    });
  const available =
    game.available !== false && (await pathLooksAvailable(target));
  if (available) {
    frame.src = target;
    fallback.hidden = true;
    frame.hidden = false;
  } else {
    frame.hidden = true;
    fallback.hidden = false;
    document.querySelector(".player-actions").hidden = true;
    document.getElementById("missingPath").textContent = ExstArcade.assetUrl(
      game.path,
    );
  }
}

bootGame().catch((error) => {
  document.querySelector(".game-shell").innerHTML =
    `<section class="frame-fallback"><h1>Game could not load</h1><p>${ExstArcade.escapeHtml(error.message)}</p><a class="play-link" href="${ExstArcade.escapeHtml(ExstArcade.homeUrl())}">Back to arcade</a></section>`;
});
