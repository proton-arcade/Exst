const params = new URLSearchParams(location.search);
const folderId = params.get("id");

const $ = (id) => document.getElementById(id);
const escape = ExstArcade.escapeHtml;
const asset = ExstArcade.assetUrl;

// Saving goes through the shared helpers, which report when the browser
// blocks storage instead of dropping the write without a word.
const read = ExstArcade.storageGet;
const save = ExstArcade.storageSet;

let favorites = read("exst-favorites", []);
let recent = read("exst-recent", []);
let plays = read("exst-game-plays", {});
if (!Array.isArray(favorites)) favorites = [];
if (!Array.isArray(recent)) recent = [];
if (!plays || typeof plays !== "object") plays = {};

let arcade = null;
let detailsId = null;
let toastTimer;

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2500);
}

function heroArt(game) {
  return ExstArcade.spotlightArt(game);
}

function ratingFor(game) {
  let hash = 0;
  for (const ch of game.id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return (7.5 + (hash % 24) / 10).toFixed(1);
}

function play(id, event) {
  const game = arcade.byId.get(id);
  if (!game) return;
  plays[id] = (Number(plays[id]) || 0) + 1;
  save("exst-game-plays", plays);
  recent = [id, ...recent.filter((x) => x !== id)].slice(0, 30);
  save("exst-recent", recent);
  const mode = ExstArcade.getOpenMode();
  const url = ExstArcade.gameUrl(game, mode, folderId ? `folder.html?id=${encodeURIComponent(folderId)}` : "");
  if (mode === "new" || event?.ctrlKey || event?.metaKey)
    window.open(url, "_blank", "noopener");
  else location.href = url;
}

function toggleFavorite(id) {
  const game = arcade.byId.get(id);
  if (!game) return;
  const exists = favorites.includes(id);
  favorites = exists ? favorites.filter((x) => x !== id) : [...favorites, id];
  const stored = save("exst-favorites", favorites);
  toast(
    !stored
      ? `${game.title} is on My List for this visit only — this browser is not saving changes.`
      : exists
        ? `${game.title} removed from My List`
        : `${game.title} added to My List`,
  );
  if (detailsId) syncDetailsFavorite();
}

function openDetails(id) {
  const game = arcade.byId.get(id);
  if (!game) return;
  detailsId = id;
  $("detailsCover").style.backgroundImage = `url('${heroArt(game)}')`;
  $("detailsTitle").textContent = game.title;
  $("detailsHeadTitle").textContent = game.title;
  $("detailsOverview").textContent =
    game.description || "Ready to launch from your editable arcade list.";
  $("detailsVote").textContent = ratingFor(game);
  $("detailsMeta").textContent = [game.version, game.id]
    .filter(Boolean)
    .join("  •  ");
  $("detailsTags").innerHTML = [...(game.tags || [])]
    .slice(0, 4)
    .map((t) => `<span>${escape(t)}</span>`)
    .join("");
  $("detailsPlay").dataset.play = game.id;
  $("detailsDirect").href = asset(game.path);
  const panel = $("detailsPage");
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add("open"));
  document.body.classList.add("noscroll");
  $("detailsPage").querySelector("main").scrollTop = 0;
  syncDetailsFavorite();
}

function syncDetailsFavorite() {
  const game = arcade.byId.get(detailsId);
  if (!game) return;
  const saved = favorites.includes(game.id);
  for (const btn of document.querySelectorAll(
    '#detailsPage [data-favorite], #detailsFooterFav',
  )) {
    btn.dataset.favorite = game.id;
    btn.classList.toggle("saved", saved);
    btn.setAttribute("aria-pressed", String(saved));
    const label = btn.querySelector("span");
    if (label) label.textContent = saved ? "Listed" : "My List";
  }
}

function closeDetails() {
  detailsId = null;
  const panel = $("detailsPage");
  panel.classList.remove("open");
  document.body.classList.remove("noscroll");
  setTimeout(() => {
    if (!detailsId) panel.hidden = true;
  }, 220);
}

async function bootFolder() {
  ExstArcade.bindOpenModeSelect();
  arcade = await ExstArcade.loadArcadeData();
  const folder = folderId
    ? arcade.folders.find((item) => item.id === folderId)
    : arcade.folders[0];
  if (!folder)
    throw new Error(
      "This collection was not found. Check its ID in website/data/folders.js.",
    );
  document.title = `${folder.title} — Exst Arcade`;
  document.getElementById("folderTitle").textContent = folder.title;
  document.getElementById("folderDescription").textContent =
    folder.description || "A handpicked collection from your arcade.";
  const games = folder.games.map((id) => arcade.byId.get(id)).filter(Boolean);
  document.getElementById("folderCount").textContent = `${games.length} games`;
  // Collections are built from the game catalog, so a catalog problem can
  // explain why a game is missing from this page.
  const notice = document.getElementById("folderNotice");
  if (notice)
    notice.innerHTML = ExstArcade.catalogNoticeHtml(arcade.problems);
  const grid = document.getElementById("folderGameGrid");
  function renderFolderGames() {
    grid.innerHTML = "";
    games.forEach((game) => {
      const card = ExstArcade.createGameCard(game, {
        from: `folder.html?id=${encodeURIComponent(folder.id)}`,
      });
      card.dataset.gameId = game.id;
      grid.appendChild(card);
    });
    if (!games.length)
      grid.innerHTML =
        '<p class="empty-note">This collection is waiting for its first game. Add its game IDs in website/data/folders.js.</p>';
  }
  renderFolderGames();
  document
    .getElementById("openMode")
    ?.addEventListener("change", renderFolderGames);

  grid.addEventListener("click", (event) => {
    const playBtn = event.target.closest(".play-link, .small-link");
    if (playBtn) return; // Allow direct play / direct links to trigger normally
    const link = event.target.closest("a");
    const card = link?.closest("[data-game-id]");
    if (!card) return;
    const gameId = card.dataset.gameId;
    // Launching always works; the counts are best-effort and the page says
    // so when the browser refuses to keep them.
    const plays = ExstArcade.storageGet("exst-game-plays", {});
    const recent = ExstArcade.storageGet("exst-recent", []);
    plays[gameId] = (Number(plays[gameId]) || 0) + 1;
    ExstArcade.storageSet("exst-game-plays", plays);
    ExstArcade.storageSet(
      "exst-recent",
      [gameId, ...recent.filter((item) => item !== gameId)].slice(0, 30),
    );
    if (link.classList.contains("game-thumb") || link.closest(".game-thumb")) {
      event.preventDefault();
      openDetails(gameId);
      return;
    }
  });

  document.addEventListener("click", (e) => {
    const fav = e.target.closest("[data-favorite]");
    if (fav) {
      e.preventDefault();
      toggleFavorite(fav.dataset.favorite);
      return;
    }
    const launch = e.target.closest("[data-play]");
    if (launch) {
      e.preventDefault();
      play(launch.dataset.play, e);
      return;
    }
    const details = e.target.closest("[data-details]");
    if (details) {
      e.preventDefault();
      openDetails(details.dataset.details);
      return;
    }
  });

  $("detailsClose").addEventListener("click", closeDetails);
  $("detailsShare").addEventListener("click", async () => {
    const game = arcade.byId.get(detailsId);
    if (!game) return;
    const url = ExstArcade.gameUrl(game, "page");
    try {
      await navigator.clipboard.writeText(new URL(url, location.href).href);
      toast("Link to " + game.title + " copied.");
    } catch {
      toast("Copy this link: " + url);
    }
  });

  $("closeDialog").addEventListener("click", () => $("infoDialog").close());
  $("infoDialog").addEventListener("click", (e) => {
    if (e.target === $("infoDialog")) {
      const r = e.target.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        e.target.close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && detailsId) closeDetails();
  });

  $("detailsPage").querySelector("main").addEventListener("scroll", (e) => {
    const top = e.target.scrollTop;
    $("detailsHeader").style.backgroundColor =
      top > 40 ? "rgba(16,16,16,1)" : "rgba(16,16,16,0)";
  });

  const storageNote = document.getElementById("storageNote");
  if (storageNote) storageNote.textContent = ExstArcade.storageNoticeText();

  if (window.renderIcons) window.renderIcons(document);
}

bootFolder().catch((error) => {
  document.getElementById("folderTitle").textContent = "Collection unavailable";
  document.getElementById("folderDescription").textContent = error.hint
    ? `${error.message} ${error.hint}`
    : error.message;
});
