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
  lastProblems = arcade.problems || [];
  const game = arcade.byId.get(gameId);
  if (!game) {
    // Say *why* the entry is missing when the catalog reported problems,
    // otherwise "my game doesn't show up" is a dead end.
    const problems = arcade.problems || [];
    const detail = problems.length
      ? ` ${ExstArcade.catalogFiles.games} reported ${
          problems.length
        } problem${problems.length === 1 ? "" : "s"}: ${problems
          .slice(0, 3)
          .map((item) => `${item.line ? `line ${item.line}: ` : ""}${item.message}`)
          .join(" ")}`
      : "";
    throw new Error(
      `No game with ID "${gameId}" exists in ${ExstArcade.catalogFiles.games}.${detail}`,
    );
  }
  return game;
}

/** Problems from the last catalog read, for the error panel below. */
let lastProblems = [];

/**
 * Only the problems that concern the game being opened are shown in the
 * player, so an unrelated broken entry does not interrupt play.
 */
function problemsForGame(game, problems) {
  if (!game || !problems || !problems.length) return [];
  return problems.filter(
    (item) =>
      item.line === game.line ||
      item.line === game.idLine ||
      item.message.includes(game.id) ||
      item.message.includes(game.path),
  );
}

function showCatalogNotice(game, problems) {
  const mine = problemsForGame(game, problems);
  const host = document.getElementById("gameNotice");
  if (host && mine.length)
    host.innerHTML = ExstArcade.catalogNoticeHtml(mine);
}

async function bootGame() {
  const game = await resolveGame();
  showCatalogNotice(game, lastProblems);

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
    // When the catalog itself flagged this entry (no path=, wrong extension),
    // say so here instead of only offering the generic "needs its files" copy.
    const mine = problemsForGame(game, lastProblems);
    if (mine.length)
      fallback.insertAdjacentHTML(
        "beforeend",
        `<p class="fallback-problem">${mine
          .map(
            (item) =>
              `${item.line ? `Line ${item.line} of ${ExstArcade.escapeHtml(
                item.file,
              )}: ` : ""}${ExstArcade.escapeHtml(item.message)}${
                item.hint ? ` ${ExstArcade.escapeHtml(item.hint)}` : ""
              }`,
          )
          .join(" ")}</p>`,
      );
  }
}

bootGame().catch((error) => {
  document.querySelector(".game-shell").innerHTML =
    `<section class="frame-fallback"><h1>${
      error.name === "CatalogError"
        ? "The game library could not be read"
        : "Game could not load"
    }</h1><p>${ExstArcade.escapeHtml(error.message)}</p>${
      error.hint ? `<p>${ExstArcade.escapeHtml(error.hint)}</p>` : ""
    }<a class="play-link" href="${ExstArcade.escapeHtml(ExstArcade.homeUrl())}">Back to arcade</a></section>`;
});
