const ui = {
  search: document.getElementById('searchInput'),
  stats: document.getElementById('stats'),
  folderGrid: document.getElementById('folderGrid'),
  featuredRail: document.getElementById('featuredRail'),
  gameGrid: document.getElementById('gameGrid')
};

let arcade = { games: [], folders: [], byId: new Map() };

function renderFolders() {
  ui.folderGrid.innerHTML = '';
  arcade.folders.forEach((folder, index) => {
    const foundGames = folder.games.map((id) => arcade.byId.get(id)).filter(Boolean);
    const card = document.createElement('a');
    card.className = `folder-card folder-tone-${index % 4}`;
    card.href = `folder.html?id=${encodeURIComponent(folder.id)}`;
    card.innerHTML = `
      <img src="${folder.icon}" alt="" loading="lazy" onerror="this.src='assets/images/folder.svg'" />
      <span class="folder-label">${ExstArcade.escapeHtml(folder.title)}</span>
      <strong>${foundGames.length} games</strong>
      <p>${ExstArcade.escapeHtml(folder.description)}</p>`;
    ui.folderGrid.appendChild(card);
  });
}

function renderGames(list) {
  ui.gameGrid.innerHTML = '';
  list.forEach((game) => ui.gameGrid.appendChild(ExstArcade.createGameCard(game, { from: 'index.html' })));
  if (!list.length) ui.gameGrid.innerHTML = '<p class="empty-note">No games match that search. Try a tag, version, or title.</p>';
}

function renderFeatured() {
  const featured = arcade.games.filter((game) => game.featured).slice(0, 12);
  ui.featuredRail.innerHTML = '';
  featured.forEach((game) => ui.featuredRail.appendChild(ExstArcade.createGameCard(game, { from: 'index.html' })));
}

function renderStats() {
  const tags = new Set(arcade.games.flatMap((game) => game.tags || []));
  ui.stats.innerHTML = `<span>${arcade.games.length} games</span><span>${arcade.folders.length} folders</span><span>${tags.size} tags</span>`;
}

function applySearch() {
  const query = ui.search.value.trim().toLowerCase();
  if (!query) return renderGames(arcade.games);
  const filtered = arcade.games.filter((game) => [game.id, game.title, game.version, game.description, ...(game.tags || [])]
    .join(' ')
    .toLowerCase()
    .includes(query));
  renderGames(filtered);
}

async function boot() {
  ExstArcade.bindOpenModeSelect();
  arcade = await ExstArcade.loadArcadeData();
  renderStats();
  renderFolders();
  renderFeatured();
  renderGames(arcade.games);
  ui.search.addEventListener('input', applySearch);
  document.getElementById('openMode')?.addEventListener('change', () => {
    renderFeatured();
    applySearch();
  });
}

boot().catch((error) => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="config-error"><strong>Could not load arcade data.</strong><br>${ExstArcade.escapeHtml(error.message)}</div>`);
});
