(function () {
  const ROOT = window.location.pathname.replace(/[^/]*$/, "");

  function stripComments(line) {
    let quote = null;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const prev = line[i - 1];
      if ((char === '"' || char === "'") && prev !== "\\")
        quote = quote === char ? null : quote || char;
      if (!quote && char === "#") return line.slice(0, i);
    }
    return line;
  }

  function cleanValue(value) {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return trimmed;
  }

  function parseBlockText(text, defaultType = "game") {
    const items = [];
    let current = null;
    text.split(/\r?\n/).forEach((raw) => {
      const line = stripComments(raw).trim();
      if (!line) return;
      const header = line.match(/^\[([a-z0-9_-]+)\]$/i);
      if (header) {
        if (current) items.push(current);
        current = { type: header[1].toLowerCase() };
        return;
      }
      if (!current) current = { type: defaultType };
      const splitAt = line.indexOf("=");
      if (splitAt === -1) return;
      const key = line.slice(0, splitAt).trim();
      const value = cleanValue(line.slice(splitAt + 1));
      if (["tags", "games", "aliases"].includes(key)) {
        current[key] = String(value)
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      } else {
        current[key] = value;
      }
    });
    if (current) items.push(current);
    return items;
  }

  async function fetchText(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.text();
  }

  function normalizeGame(game) {
    return {
      ...game,
      id: String(game.id || "").trim(),
      title: game.title || game.name || game.id || "Untitled game",
      version: game.version || "",
      icon: game.icon || "assets/images/default-game.svg",
      path: game.path || "#",
      tags: Array.isArray(game.tags) ? game.tags : [],
      featured: game.featured === true || game.featured === "true",
      bundled: game.bundled === true || game.bundled === "true",
      wasm: game.wasm === true || game.wasm === "true",
    };
  }

  function normalizeFolder(folder, fileName) {
    const fallbackId = (fileName || "").replace(/\.txt$/i, "");
    return {
      ...folder,
      id: String(folder.id || fallbackId).trim(),
      title: folder.title || folder.name || fallbackId || "Folder",
      description: folder.description || "",
      icon: folder.icon || "assets/images/folder.svg",
      games: Array.isArray(folder.games) ? folder.games : [],
    };
  }

  async function loadGames() {
    const textGames = parseBlockText(
      await fetchText("data/games.txt"),
      "game",
    ).filter((item) => item.type === "game");
    return textGames.map(normalizeGame).filter((game) => game.id);
  }

  async function loadFolders() {
    const indexText = await fetchText("data/folders/index.txt");
    const files = indexText
      .split(/\r?\n/)
      .map((line) => stripComments(line).trim())
      .filter(Boolean);
    const folders = await Promise.all(
      files.map(async (file) => {
        const text = await fetchText(`data/folders/${file}`);
        const block =
          parseBlockText(text, "folder").find(
            (item) => item.type === "folder",
          ) || {};
        return normalizeFolder(block, file);
      }),
    );
    return folders.filter((folder) => folder.id);
  }

  async function loadArcadeData() {
    const [games, folders] = await Promise.all([loadGames(), loadFolders()]);
    const byId = new Map(games.map((game) => [game.id, game]));
    return { games, folders, byId };
  }

  function gameUrl(game, mode = "page", from = "") {
    if (!game) return "#";
    if (mode === "same" || mode === "new") return game.path;
    const params = new URLSearchParams({ id: game.id });
    if (from) params.set("from", from);
    return `game.html?${params.toString()}`;
  }

  function getOpenMode() {
    try {
      const mode = localStorage.getItem("exst-open-mode");
      return ["page", "same", "new"].includes(mode) ? mode : "page";
    } catch {
      return "page";
    }
  }

  function bindOpenModeSelect() {
    const select = document.getElementById("openMode");
    if (!select) return;
    select.value = getOpenMode();
    select.addEventListener("change", () => {
      try {
        localStorage.setItem("exst-open-mode", select.value);
      } catch {
        /* Storage can be disabled by the browser. */
      }
    });
  }

  function tagList(game) {
    const tags = [...(game.tags || [])];
    if (game.wasm) tags.push("WASM");
    if (game.bundled) tags.push("bundled");
    return tags.slice(0, 4);
  }

  function createGameCard(game, options = {}) {
    const article = document.createElement("article");
    article.className = `game-card ${game.featured ? "is-featured" : ""}`;
    const mode = getOpenMode();
    const available = game.available !== false;
    const href = gameUrl(game, available ? mode : "page", options.from || "");
    const target = mode === "new" ? ' target="_blank" rel="noopener"' : "";
    const tags = tagList(game)
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");
    article.innerHTML = `
      <a class="game-thumb" href="${escapeHtml(href)}"${target} aria-label="Play ${escapeHtml(game.title)}">
        <img src="${escapeHtml(game.icon)}" alt="${escapeHtml(game.title)} icon" loading="lazy" onerror="this.src='assets/images/default-game.svg'" />
      </a>
      <div class="game-card-body">
        <div class="game-kicker">${escapeHtml(game.version || game.id)}</div>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.description || "Ready to launch from your editable arcade list.")}</p>
        <div class="tag-row">${tags}</div>
        <div class="card-actions">
          <a class="play-link" href="${escapeHtml(href)}"${target}>${available ? "Play" : "Setup needed"}</a>
          ${available ? `<a class="small-link" href="${escapeHtml(game.path)}" target="_blank" rel="noopener">direct</a>` : ""}
        </div>
      </div>`;
    return article;
  }

  function escapeHtml(value) {
    return String(value).replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );
  }

  window.ExstArcade = {
    loadArcadeData,
    parseBlockText,
    bindOpenModeSelect,
    createGameCard,
    gameUrl,
    getOpenMode,
    escapeHtml,
  };
})();
