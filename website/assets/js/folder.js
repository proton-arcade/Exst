const params = new URLSearchParams(location.search);
const folderId = params.get("id");

async function bootFolder() {
  ExstArcade.bindOpenModeSelect();
  const arcade = await ExstArcade.loadArcadeData();
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
    const link = event.target.closest("a");
    const card = link?.closest("[data-game-id]");
    if (!card || arcade.byId.get(card.dataset.gameId)?.available === false)
      return;
    // Launching always works; the counts are best-effort and the page says
    // so when the browser refuses to keep them.
    const id = card.dataset.gameId;
    const plays = ExstArcade.storageGet("exst-game-plays", {});
    const recent = ExstArcade.storageGet("exst-recent", []);
    plays[id] = (Number(plays[id]) || 0) + 1;
    ExstArcade.storageSet("exst-game-plays", plays);
    ExstArcade.storageSet(
      "exst-recent",
      [id, ...recent.filter((item) => item !== id)].slice(0, 30),
    );
  });

  const storageNote = document.getElementById("storageNote");
  if (storageNote) storageNote.textContent = ExstArcade.storageNoticeText();
}

bootFolder().catch((error) => {
  document.getElementById("folderTitle").textContent = "Collection unavailable";
  document.getElementById("folderDescription").textContent = error.hint
    ? `${error.message} ${error.hint}`
    : error.message;
});
