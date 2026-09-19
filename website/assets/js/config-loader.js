/*
 * Shared catalog loader for Exst Arcade.
 *
 * The catalog is embedded as plain text in data/games.js and data/folders.js
 * (loaded with ordinary <script> tags), so the whole site works from
 * file:// with no web server, and over http(s) when deployed.
 *
 * Paths inside the catalog are relative to the site folder (the directory
 * that contains assets/). This file figures out that folder from its own
 * <script src> attribute, so the same catalog works no matter which page
 * is being rendered. Set window.EXST_SITE_ROOT = "" or "some/prefix/"
 * before this script loads to override the detection.
 */
(function () {
  const LOADER_MARK = "assets/js/config-loader.js";

  function detectSiteRoot() {
    if (typeof window.EXST_SITE_ROOT === "string") {
      const value = window.EXST_SITE_ROOT.trim();
      return value ? value.replace(/\/+$/, "") + "/" : "";
    }
    if (typeof document !== "undefined" && document.currentScript) {
      const src = document.currentScript.getAttribute("src") || "";
      const index = src.lastIndexOf(LOADER_MARK);
      if (index !== -1) {
        const prefix = src.slice(0, index).replace(/\/+$/, "");
        return prefix ? prefix + "/" : "";
      }
    }
    // Fallback: assume this page sits in the site folder.
    if (typeof window !== "undefined" && window.location) {
      return window.location.pathname.replace(/[^/]*$/, "");
    }
    return "";
  }

  const SITE_ROOT = detectSiteRoot();

  /** Resolve a catalog-relative path (e.g. "games/x.html") from the page. */
  function assetUrl(path) {
    if (!path || path === "#") return path || "#";
    if (/^(https?:)?\/\//i.test(path) || path.startsWith("#")) return path;
    return SITE_ROOT + path;
  }

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

  /**
   * Parse `[type]` blocks of `key=value` lines.
   * Supports # comments, quoted values, booleans, and comma lists for
   * the tags / games / aliases keys.
   */
  function parseBlockText(text, defaultType = "game") {
    const items = [];
    let current = null;
    String(text == null ? "" : text)
      .split(/\r?\n/)
      .forEach((raw) => {
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

  function normalizeGame(game) {
    return {
      ...game,
      id: String(game.id || "").trim(),
      title: game.title || game.name || game.id || "Untitled game",
      version: game.version || "",
      icon: game.icon || "assets/images/default-game.svg",
      path: game.path || "#",
      description: game.description || "",
      tags: Array.isArray(game.tags) ? game.tags : [],
      featured: game.featured === true || game.featured === "true",
      bundled: game.bundled === true || game.bundled === "true",
      wasm: game.wasm === true || game.wasm === "true",
      // Omitting the field means "ready to play".
      available:
        game.available !== false && game.available !== "false",
    };
  }

  function normalizeFolder(folder) {
    return {
      ...folder,
      id: String(folder.id || folder.name || "").trim(),
      title: folder.title || folder.name || folder.id || "Folder",
      description: folder.description || "",
      icon: folder.icon || "assets/images/folder.svg",
      games: Array.isArray(folder.games) ? folder.games : [],
    };
  }

  function loadGames() {
    return parseBlockText(window.EXST_GAMES_TEXT, "game")
      .filter((item) => item.type === "game")
      .map(normalizeGame)
      .filter((game) => game.id);
  }

  function loadFolders() {
    return parseBlockText(window.EXST_FOLDERS_TEXT, "folder")
      .filter((item) => item.type === "folder")
      .map(normalizeFolder)
      .filter((folder) => folder.id);
  }

  async function loadArcadeData() {
    const games = loadGames();
    const folders = loadFolders();
    const byId = new Map(games.map((game) => [game.id, game]));
    return { games, folders, byId };
  }

  function gameUrl(game, mode = "page", from = "") {
    if (!game) return "#";
    if (mode === "same" || mode === "new") return assetUrl(game.path);
    const params = new URLSearchParams({ id: game.id });
    if (from) params.set("from", from);
    return `${SITE_ROOT}game.html?${params.toString()}`;
  }

  /**
   * The home page (index.html) lives one directory above the site folder
   * (the folder that holds assets/). From the site folder itself that is
   * "../index.html"; from the root index.html it is just "index.html".
   */
  function homeUrl() {
    const segments = SITE_ROOT
      ? SITE_ROOT.replace(/\/+$/, "").split("/").filter(Boolean)
      : [];
    const prefix =
      segments.length === 0
        ? "../"
        : segments.length === 1
          ? ""
          : segments.slice(0, -1).join("/") + "/";
    return prefix + "index.html";
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
        <img src="${escapeHtml(assetUrl(game.icon))}" alt="${escapeHtml(game.title)} icon" loading="lazy" decoding="async" />
      </a>
      <div class="game-card-body">
        <div class="game-kicker">${escapeHtml(game.version || game.id)}</div>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.description || "Ready to launch from your editable arcade list.")}</p>
        <div class="tag-row">${tags}</div>
        <div class="card-actions">
          <a class="play-link" href="${escapeHtml(href)}"${target}>${available ? "Play" : "Setup needed"}</a>
          ${available ? `<a class="small-link" href="${escapeHtml(assetUrl(game.path))}" target="_blank" rel="noopener">direct</a>` : ""}
        </div>
      </div>`;
    // Swap in the default icon if the thumbnail is missing (no inline handlers).
    const thumb = article.querySelector("img");
    thumb.addEventListener(
      "error",
      () => {
        thumb.src = assetUrl("assets/images/default-game.svg");
      },
      { once: true },
    );
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
    homeUrl,
    getOpenMode,
    escapeHtml,
    assetUrl,
    siteRoot: () => SITE_ROOT,
  };
})();
