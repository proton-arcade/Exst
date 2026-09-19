const params = new URLSearchParams(location.search);
const folderId = params.get('id');

async function bootFolder() {
  ExstArcade.bindOpenModeSelect();
  const arcade = await ExstArcade.loadArcadeData();
  const folder = arcade.folders.find((item) => item.id === folderId) || arcade.folders[0];
  if (!folder) throw new Error('No folders are configured.');
  document.title = `${folder.title} — Exst Arcade`;
  document.getElementById('folderTitle').textContent = folder.title;
  document.getElementById('folderDescription').textContent = folder.description || 'This folder is generated from a text file in data/folders/.';
  const games = folder.games.map((id) => arcade.byId.get(id)).filter(Boolean);
  document.getElementById('folderCount').textContent = `${games.length} games`;
  const grid = document.getElementById('folderGameGrid');
  grid.innerHTML = '';
  games.forEach((game) => grid.appendChild(ExstArcade.createGameCard(game, { from: `folder.html?id=${encodeURIComponent(folder.id)}` })));
  if (!games.length) grid.innerHTML = '<p class="empty-note">This folder has no matching game IDs yet. Edit its text file and add IDs from data/games.txt.</p>';
  document.getElementById('openMode')?.addEventListener('change', bootFolder);
}

bootFolder().catch((error) => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="config-error"><strong>Folder failed to load.</strong><br>${ExstArcade.escapeHtml(error.message)}</div>`);
});
