const params = new URLSearchParams(location.search);
const gameId = params.get('id');
const from = params.get('from') || 'index.html';

async function pathLooksAvailable(path) {
  if (!path || path === '#') return false;
  try {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch (_) {
    return true;
  }
}

async function bootGame() {
  const arcade = await ExstArcade.loadArcadeData();
  const game = arcade.byId.get(gameId);
  if (!game) throw new Error(`No game with ID "${gameId}" exists in data/games.txt.`);

  document.title = `${game.title} — Exst Arcade`;
  document.getElementById('gameTitle').textContent = game.title;
  document.getElementById('gameMeta').textContent = [game.version, game.id].filter(Boolean).join(' · ');
  document.getElementById('backLink').href = from;
  document.getElementById('openDirect').href = game.path;
  document.getElementById('reloadGame').addEventListener('click', () => {
    document.getElementById('gameFrame').src = game.path;
  });

  const frame = document.getElementById('gameFrame');
  const fallback = document.getElementById('gameFallback');
  const available = await pathLooksAvailable(game.path);
  if (available) {
    frame.src = game.path;
    fallback.hidden = true;
    frame.hidden = false;
  } else {
    frame.hidden = true;
    fallback.hidden = false;
    document.getElementById('missingPath').textContent = game.path;
  }
}

bootGame().catch((error) => {
  document.querySelector('.game-shell').innerHTML = `<section class="frame-fallback"><h1>Game could not load</h1><p>${ExstArcade.escapeHtml(error.message)}</p><a class="play-link" href="index.html">Back to arcade</a></section>`;
});
