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
      "This collection was not found. Check its ID in data/folders/.",
    );
  document.title = `${folder.title} — Exst Arcade`;
  document.getElementById("folderTitle").textContent = folder.title;
  document.getElementById("folderDescription").textContent =
    folder.description || "A handpicked collection from your arcade.";
  const games = folder.games.map((id) => arcade.byId.get(id)).filter(Boolean);
  document.getElementById("folderCount").textContent = `${games.length} games`;
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
        '<p class="empty-note">This collection is waiting for its first game. Add game IDs in its text file.</p>';
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
    try {
      const id = card.dataset.gameId;
      const plays = JSON.parse(localStorage.getItem("exst-game-plays") || "{}");
      const recent = JSON.parse(localStorage.getItem("exst-recent") || "[]");
      plays[id] = (Number(plays[id]) || 0) + 1;
      localStorage.setItem("exst-game-plays", JSON.stringify(plays));
      localStorage.setItem(
        "exst-recent",
        JSON.stringify(
          [id, ...recent.filter((item) => item !== id)].slice(0, 30),
        ),
      );
    } catch {
      /* Launching should still work when storage is unavailable. */
    }
  });
}

bootFolder().catch((error) => {
  document.getElementById("folderTitle").textContent = "Collection unavailable";
  document.getElementById("folderDescription").textContent = error.message;
});
