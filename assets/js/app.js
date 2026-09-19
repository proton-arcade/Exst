const ui = {
  search: document.getElementById('searchInput'),
  stats: document.getElementById('stats'),
  folderGrid: document.getElementById('folderGrid'),
  gameGrid: document.getElementById('gameGrid')
};

const TOP_COUNT = 10;
const GAME_PLAYS_KEY = 'exst-game-plays';
const FOLDER_PLAYS_KEY = 'exst-folder-plays';

let arcade = { games: [], folders: [], byId: new Map() };

function readCounts(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch (_) {
    return {};
  }
}

function bumpCount(key, id) {
  if (!id) return;
  const counts = readCounts(key);
  counts[id] = (counts[id] || 0) + 1;
  localStorage.setItem(key, JSON.stringify(counts));
}

function topPlayed(items, key) {
  const plays = readCounts(key);
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) =>
      (plays[b.item.id] || 0) - (plays[a.item.id] || 0) ||
      Number(Boolean(b.item.featured)) - Number(Boolean(a.item.featured)) ||
      a.index - b.index)
    .slice(0, TOP_COUNT)
    .map((entry) => entry.item);
}

function renderGames(list) {
  ui.gameGrid.innerHTML = '';
  list.forEach((game) => {
    const card = ExstArcade.createGameCard(game, { from: 'index.html' });
    card.dataset.gameId = game.id;
    ui.gameGrid.appendChild(card);
  });
  if (!list.length) ui.gameGrid.innerHTML = '<p class="empty-note">No games match that search. Try a tag, version, or title.</p>';
}

function renderFolders(list) {
  ui.folderGrid.innerHTML = '';
  list.forEach((folder, index) => {
    const foundGames = folder.games.map((id) => arcade.byId.get(id)).filter(Boolean);
    const card = document.createElement('a');
    card.className = `folder-card folder-tone-${index % 4}`;
    card.href = `folder.html?id=${encodeURIComponent(folder.id)}`;
    card.dataset.folderId = folder.id;
    card.innerHTML = `
      <img src="${folder.icon}" alt="" loading="lazy" onerror="this.src='assets/images/folder.svg'" />
      <span class="folder-label">${ExstArcade.escapeHtml(folder.title)}</span>
      <strong>${foundGames.length} games</strong>
      <p>${ExstArcade.escapeHtml(folder.description)}</p>`;
    ui.folderGrid.appendChild(card);
  });
  if (!list.length) ui.folderGrid.innerHTML = '<p class="empty-note">No folders match that search.</p>';
}

function renderStats() {
  const tags = new Set(arcade.games.flatMap((game) => game.tags || []));
  ui.stats.innerHTML = `<span>${arcade.games.length} games</span><span>${arcade.folders.length} folders</span><span>${tags.size} tags</span>`;
}

function applySearch() {
  const query = ui.search.value.trim().toLowerCase();
  if (!query) {
    renderGames(topPlayed(arcade.games, GAME_PLAYS_KEY));
    renderFolders(topPlayed(arcade.folders, FOLDER_PLAYS_KEY));
    return;
  }
  const matchedGames = arcade.games.filter((game) => [game.id, game.title, game.version, game.description, ...(game.tags || [])]
    .join(' ')
    .toLowerCase()
    .includes(query));
  const matchedFolders = arcade.folders.filter((folder) => [folder.id, folder.title, folder.description]
    .join(' ')
    .toLowerCase()
    .includes(query));
  renderGames(matchedGames);
  renderFolders(matchedFolders);
}

function bindPlayTracking() {
  ui.gameGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.game-card');
    if (card && event.target.closest('a')) bumpCount(GAME_PLAYS_KEY, card.dataset.gameId);
  });
  ui.folderGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.folder-card');
    if (card) bumpCount(FOLDER_PLAYS_KEY, card.dataset.folderId);
  });
}

async function boot() {
  ExstArcade.bindOpenModeSelect();
  arcade = await ExstArcade.loadArcadeData();
  renderStats();
  applySearch();
  bindPlayTracking();
  ui.search.addEventListener('input', applySearch);
  document.getElementById('openMode')?.addEventListener('change', applySearch);
}

boot().catch((error) => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="config-error"><strong>Could not load arcade data.</strong><br>${ExstArcade.escapeHtml(error.message)}</div>`);
});
