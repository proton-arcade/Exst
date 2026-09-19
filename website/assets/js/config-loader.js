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
 *
 * Editing safety net: because the catalog files are hand-edited, loading
 * them is *self-diagnosing*. A broken entry never fails silently:
 *
 *   - games.js that cannot run (missing file, syntax error, an entry pasted
 *     after the closing backtick) throws a described error, and every page
 *     shows it, instead of rendering an empty arcade.
 *   - recoverable mistakes (a block pasted without its [game] header, a
 *     duplicate id, an entry with no id, a folder pointing at an unknown
 *     id, a path that is not .html) are collected into `problems` and shown
 *     to the user by the page that renders the library.
 */
(function () {
  const LOADER_MARK = "assets/js/config-loader.js";

  /** Catalog files, as named in this file's own diagnostics. */
  const CATALOG_FILES = {
    games: "website/data/games.js",
    folders: "website/data/folders.js",
  };

  const LIST_KEYS = ["tags", "games", "aliases"];

  /** Problems listed in the on-page notice before it links to the console. */
  const NOTICE_LIMIT = 6;

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

  /* ---------------------------------------------------------------- reports */

  /**
   * One recoverable catalog mistake.
   * { file, line, message, hint }  — line is 0 when the whole file is at fault.
   */
  function problem(file, line, message, hint) {
    return { file, line: Number(line) || 0, message, hint: hint || "" };
  }

  /** Fatal catalog failure: the library cannot be shown at all. */
  function catalogError(file, message, hint) {
    const error = new Error(`${file} could not be read: ${message}`);
    error.name = "CatalogError";
    error.hint = hint || "";
    return error;
  }

  /** Console report so editors can see the same problems outside the page. */
  function report(problems) {
    try {
      if (typeof console === "undefined" || !console.warn) return;
      problems.forEach((item) =>
        console.warn(
          `[Exst Arcade] ${item.file}${item.line ? `:${item.line}` : ""} — ${item.message}${
            item.hint ? ` ${item.hint}` : ""
          }`,
        ),
      );
    } catch (_) {
      /* Console is optional. */
    }
  }

  /**
   * Ready-made markup for the "Catalog check" notice pages show after a bad
   * edit. Returns "" when there is nothing to report.
   */
  function catalogNoticeHtml(problems) {
    if (!problems || !problems.length) return "";
    const files = [...new Set(problems.map((item) => item.file))];
    // One bad edit can report many follow-on problems (a collection that
    // lists ids an unreadable file no longer defines), so keep the notice
    // scannable and leave the full list to the console.
    const shown = problems.slice(0, NOTICE_LIMIT);
    const hidden = problems.length - shown.length;
    const items =
      shown
        .map(
          (item) =>
            `<li>${
              item.line ? `<code>line ${item.line}</code> ` : ""
            }${escapeHtml(item.message)}${
              item.hint
                ? ` <span class="notice-hint">${escapeHtml(item.hint)}</span>`
                : ""
            }</li>`,
        )
        .join("") +
      (hidden
        ? `<li class="notice-more">…and ${hidden} more (the browser console lists every one).</li>`
        : "");
    return (
      `<section class="catalog-notice" role="status" aria-live="polite">` +
      `<div class="notice-head"><span class="notice-chip">CATALOG CHECK</span>` +
      `<button type="button" class="notice-close" data-dismiss-notice aria-label="Hide catalog check">×</button></div>` +
      `<p class="notice-lead">Your library loaded, but <strong>${problems.length} thing${
        problems.length === 1 ? "" : "s"
      }</strong> in <code>${escapeHtml(files.join(", "))}</code> need${
        problems.length === 1 ? "s" : ""
      } a look — a game you added may not be showing up because of ${
        problems.length === 1 ? "it" : "them"
      }.</p>` +
      `<ul>${items}</ul>` +
      `<p class="notice-hint">Every entry must sit <strong>inside</strong> the backtick-quoted text and start with its own <code>[game]</code> (or <code>[folder]</code>) line. Walkthrough: README → “Add a game”.</p>` +
      `</section>`
    );
  }

  /* ----------------------------------------------------------------- parser */

  /**
   * Parse `[type]` blocks of `key=value` lines.
   * Supports # comments, quoted values, booleans, and comma lists for
   * the tags / games / aliases keys.
   *
   * Each item carries the `line` it started on (1-based) so mistakes can be
   * reported with a location. A key that repeats inside one block means
   * another entry was pasted without its `[type]` header: start a new block
   * instead of quietly overwriting the previous entry.
   */
  function parseText(text, defaultType, file, problems) {
    const items = [];
    let current = null;
    String(text == null ? "" : text)
      .split(/\r?\n/)
      .forEach((raw, index) => {
        const lineNumber = index + 1;
        const line = stripComments(raw).trim();
        if (!line) return;
        const header = line.match(/^\[([a-z0-9_-]+)\]$/i);
        if (header) {
          if (current) items.push(current);
          current = { type: header[1].toLowerCase(), line: lineNumber };
          return;
        }
        const splitAt = line.indexOf("=");
        if (splitAt === -1) return;
        const key = line.slice(0, splitAt).trim();
        const value = cleanValue(line.slice(splitAt + 1));
        if (!current) current = { type: defaultType, line: lineNumber };
        if (Object.prototype.hasOwnProperty.call(current, key) && problems) {
          problems.push(
            problem(
              file,
              lineNumber,
              `“${key}=” appears again without a new [${defaultType}] line, so this was read as the start of another entry.`,
              `Put [${defaultType}] on its own line above it, so it is not merged into the entry before it.`,
            ),
          );
          items.push(current);
          current = { type: defaultType, line: lineNumber };
        }
        if (LIST_KEYS.includes(key)) {
          current[key] = String(value)
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        } else {
          if (key === "id") current.idLine = lineNumber;
          current[key] = value;
        }
      });
    if (current) items.push(current);
    return items;
  }

  /** Public single-file helper (no diagnostics): parse block text. */
  function parseBlockText(text, defaultType = "game") {
    return parseText(text, defaultType, "", null);
  }

  /** Warn about [type] blocks that this file does not read. */
  function checkBlockTypes(items, expectedType, file, problems) {
    items
      .filter((item) => item.type !== expectedType)
      .forEach((item) =>
        problems.push(
          problem(
            file,
            item.line,
            `A [${item.type}] block was skipped: this file only reads [${expectedType}] blocks.`,
            `Move it to ${
              item.type === "folder" ? CATALOG_FILES.folders : CATALOG_FILES.games
            } or rename the block to [${expectedType}].`,
          ),
        ),
      );
  }

  /* --------------------------------------------------------------- storage */

  /**
   * Saving can fail for reasons outside the site's control: private windows,
   * browsers that block storage on file:// pages, or a full quota. Every save
   * goes through here so the page can say so instead of quietly pretending
   * the data was kept.
   */
  let storageState = null; // null = not probed yet, otherwise true/false

  /** The browser's localStorage, or null when it cannot be reached at all. */
  function storageRef() {
    try {
      if (typeof window !== "undefined" && window.localStorage)
        return window.localStorage;
    } catch (_) {
      return null; // Reading the property can throw when storage is blocked.
    }
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  function probeStorage() {
    const store = storageRef();
    if (!store) return false;
    try {
      store.setItem("exst-storage-probe", "1");
      store.removeItem("exst-storage-probe");
      return true;
    } catch (_) {
      return false;
    }
  }

  function storageAvailable() {
    if (storageState === null) storageState = probeStorage();
    return storageState;
  }

  function storageGet(key, fallback) {
    const store = storageRef();
    if (!store) return fallback;
    try {
      const raw = store.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      try {
        const value = JSON.parse(raw);
        return value === null || value === undefined ? fallback : value;
      } catch (_) {
        // Plain, unquoted values (written before, or by hand) are used as-is,
        // so a change of encoding never orphans what is already saved.
        return raw;
      }
    } catch (_) {
      return fallback;
    }
  }

  /** Returns true when the value was really stored. */
  function storageSet(key, value) {
    const store = storageRef();
    if (!store) {
      storageState = false;
      return false;
    }
    try {
      // Strings stay unquoted in storage, exactly like this site always
      // wrote them; everything else is JSON.
      store.setItem(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
      storageState = true;
      return true;
    } catch (_) {
      storageState = false;
      return false;
    }
  }

  /** Plain-language explanation of blocked storage, or "" when it works. */
  function storageNoticeText() {
    if (storageAvailable()) return "";
    return (
      "This browser is not letting the page save data, so favorites, recents, play counts, " +
      "preferences, and high scores are not kept. A regular (non-private) window, or serving " +
      "the site over http(s), usually fixes it."
    );
  }

  /* ----------------------------------------------------------------- drafts */

  /**
   * Games added from inside the site (website/add.html) are kept in local
   * storage as their own `[game]` blocks — the exact text to paste into
   * website/data/games.js when the entry should outlive this browser. A
   * static site cannot write to its own files, so this is the honest
   * middle ground: immediately usable, clearly labelled, never silently
   * mistaken for a saved catalog edit.
   */
  const DRAFT_KEY = "exst-drafts";
  const DRAFT_FILE = "your saved drafts";

  /** Draft blocks saved on this device, oldest first. */
  function draftBlocks() {
    const value = storageGet(DRAFT_KEY, []);
    if (!Array.isArray(value)) return [];
    return value.filter((item) => typeof item === "string" && item.trim());
  }

  const BLOCK_FIELDS = [
    "title",
    "version",
    "icon",
    "path",
    "description",
    "tags",
    "featured",
    "badge",
    "available",
    "source",
  ];

  /** The `[game]` block for a set of fields, ready to paste or store. */
  function buildGameBlock(fields = {}) {
    const lines = ["[game]"];
    if (String(fields.id || "").trim()) lines.push(`id=${String(fields.id).trim()}`);
    BLOCK_FIELDS.forEach((key) => {
      let value = fields[key];
      if (value === undefined || value === null || value === "") return;
      if (value === false && key !== "available") return;
      if (Array.isArray(value)) {
        const list = value.map((item) => String(item).trim()).filter(Boolean);
        if (!list.length) return;
        value = list.join(", ");
      }
      if (key === "tags" && typeof value === "string") {
        const list = value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        if (!list.length) return;
        value = list.join(", ");
      }
      lines.push(`${key}=${value === true ? "true" : value}`);
    });
    return lines.join("\n") + "\n";
  }

  /**
   * Check builder input the same way the catalog is checked when it loads,
   * so a draft cannot be stored in a state the site would then refuse.
   * `takenIds` maps an id to where it already lives (for example
   * "in the catalog" or "in another draft").
   */
  function validateGameFields(fields = {}, options = {}) {
    const found = [];
    const add = (field, message) => found.push({ field, message });
    const takenIds = options.takenIds || new Map();

    const id = String(fields.id || "").trim();
    if (!id) {
      add("id", "Give the game an id: a short unique name used in links, like neon-pong.");
    } else {
      if (/\s/.test(id))
        add("id", "The id cannot contain spaces — use dashes instead (neon-pong).");
      if (/["'`#=,]/.test(id))
        add(
          "id",
          "The id cannot contain quotes, backticks, commas, hash or equals signs — the catalog file uses those.",
        );
      const taken = takenIds.get(id) || takenIds.get(id.toLowerCase());
      if (taken) add("id", `id=${id} is already used ${taken}.`);
    }

    if (!String(fields.title || "").trim())
      add("title", "Give the game a title — that is what players see.");

    const path = String(fields.path || "").trim();
    if (!path)
      add(
        "path",
        "Point path= at the game file, relative to the website/ folder (for example games/my-game.html).",
      );
    else if (/[\\"'`]/.test(path))
      add("path", "The path cannot contain quotes or backslashes.");
    else if (
      !/^https?:\/\//i.test(path) &&
      !/\.html?([?#].*)?$/i.test(path)
    )
      add("path", "The path must end in .html or .htm (or be a full https:// URL).");

    const icon = String(fields.icon || "").trim();
    if (icon && !/\.(png|jpe?g|webp|svg|gif|avif)([?#].*)?$/i.test(icon))
      add(
        "icon",
        "The artwork should be an image file (png, webp, jpg, svg) — leave it blank for the default icon.",
      );

    return found;
  }

  /** Add (or replace) a draft block. False when the browser will not store it. */
  function saveDraft(block) {
    const text = String(block || "").trim();
    if (!text) return false;
    const [parsed] = parseText(text, "game", DRAFT_FILE, null);
    const id = parsed ? String(parsed.id || "").trim() : "";
    const blocks = draftBlocks().filter((item) => {
      if (!id) return true;
      const [existing] = parseText(item, "game", DRAFT_FILE, null);
      return !existing || String(existing.id || "").trim() !== id;
    });
    return storageSet(DRAFT_KEY, [...blocks, text + "\n"]);
  }

  /** Remove the draft with this id. */
  function deleteDraft(id) {
    const wanted = String(id || "").trim();
    const kept = draftBlocks().filter((item) => {
      const [parsed] = parseText(item, "game", DRAFT_FILE, null);
      return !parsed || String(parsed.id || "").trim() !== wanted;
    });
    return storageSet(DRAFT_KEY, kept);
  }

  /** Drafts as playable entries, checked like everything else. */
  function loadDrafts(problems, byId) {
    const drafts = [];
    draftBlocks().forEach((text, index) => {
      const items = parseText(text, "game", DRAFT_FILE, null).filter(
        (item) => item.type === "game",
      );
      items.forEach((item) => {
        const game = normalizeGame(item);
        game.draft = true;
        if (!game.id) {
          problems.push(
            problem(
              DRAFT_FILE,
              0,
              `Draft ${index + 1} has no id= line, so it was skipped.`,
              "Open website/add.html to give it an id, or delete the draft.",
            ),
          );
          return;
        }
        if (byId.has(game.id)) {
          const existing = byId.get(game.id);
          problems.push(
            problem(
              DRAFT_FILE,
              0,
              `Draft “${game.title}” uses id=${game.id}, which the catalog already defines${
                existing.line ? ` on line ${existing.line}` : ""
              } — the catalog entry is used instead.`,
              "Give the draft a different id, or delete it.",
            ),
          );
          return;
        }
        if (!game.path || game.path === "#") {
          problems.push(
            problem(
              DRAFT_FILE,
              0,
              `Draft “${game.title}” has no path= line, so it cannot launch.`,
              "Open website/add.html and point it at the game file.",
            ),
          );
        }
        drafts.push(game);
      });
    });
    return drafts;
  }

  /* ------------------------------------------------------------- normalizers */

  function normalizeGame(game) {
    const { line, idLine, ...fields } = game;
    return {
      ...fields,
      id: String(fields.id || "").trim(),
      title: fields.title || fields.name || fields.id || "Untitled game",
      version: fields.version || "",
      icon: fields.icon || "assets/images/default-game.svg",
      path: fields.path || "#",
      description: fields.description || "",
      tags: Array.isArray(fields.tags) ? fields.tags : [],
      featured: fields.featured === true || fields.featured === "true",
      bundled: fields.bundled === true || fields.bundled === "true",
      wasm: fields.wasm === true || fields.wasm === "true",
      // Omitting the field means "ready to play".
      available:
        fields.available !== false && fields.available !== "false",
      line: Number(line) || 0,
      idLine: Number(idLine) || Number(line) || 0,
    };
  }

  function normalizeFolder(folder) {
    const { line, idLine, ...fields } = folder;
    return {
      ...fields,
      id: String(fields.id || fields.name || "").trim(),
      title: fields.title || fields.name || fields.id || "Folder",
      description: fields.description || "",
      icon: fields.icon || "assets/images/folder.svg",
      games: Array.isArray(fields.games) ? fields.games : [],
      line: Number(line) || 0,
    };
  }

  function loadGames(problems) {
    const file = CATALOG_FILES.games;
    const text = window.EXST_GAMES_TEXT;
    if (typeof text !== "string" || !text.trim()) {
      throw catalogError(
        file,
        "the file did not load, so there are no games to show",
        "That is almost always a JavaScript syntax error: an entry pasted after the closing backtick, a backtick inside a description, or the file being renamed/moved. Every entry must sit inside the backtick-quoted text and start with its own [game] line — see README → “Add a game”.",
      );
    }
    const items = parseText(text, "game", file, problems);
    checkBlockTypes(items, "game", file, problems);
    const games = [];
    const firstSeen = new Map(); // id -> line number
    items
      .filter((item) => item.type === "game")
      .forEach((item) => {
        const game = normalizeGame(item);
        if (!game.id) {
          problems.push(
            problem(
              file,
              game.line,
              `An entry (“${game.title}”) has no id= line, so it was skipped.`,
              "Every entry needs a unique id — that is how folders, links, and favorites find it.",
            ),
          );
          return;
        }
        if (firstSeen.has(game.id)) {
          problems.push(
            problem(
              file,
              game.idLine,
              `id=${game.id} is already used on line ${firstSeen.get(game.id)}, so this duplicate was skipped.`,
              "Two entries cannot share an id — give one of them a new id, or delete the copy.",
            ),
          );
          return;
        }
        firstSeen.set(game.id, game.idLine);
        if (!game.path || game.path === "#") {
          problems.push(
            problem(
              file,
              game.line,
              `“${game.title}” has no path= line, so it cannot launch.`,
              "Add path=games/your-game.html, relative to the website/ folder.",
            ),
          );
        } else if (
          !/^https?:\/\//i.test(game.path) &&
          !/\.html?([?#].*)?$/i.test(game.path)
        ) {
          problems.push(
            problem(
              file,
              game.line,
              `“${game.title}” points at ${game.path}, which is not an .html/.htm file.`,
              "Point path= straight at the game's .html file (or a full https:// URL).",
            ),
          );
        }
        games.push(game);
      });
    if (!games.length) {
      throw catalogError(
        file,
        "no [game] entries were found",
        "Each entry needs a [game] line followed by id=, title= and path= lines. See README → “Add a game”.",
      );
    }
    return games;
  }

  function loadFolders(problems, byId) {
    const file = CATALOG_FILES.folders;
    const text = window.EXST_FOLDERS_TEXT;
    if (typeof text !== "string" || !text.trim()) {
      problems.push(
        problem(
          file,
          0,
          "The file did not load, so collections are empty.",
          "It is either missing or has a JavaScript syntax error (often text pasted after the closing backtick). The game library still works without it.",
        ),
      );
      return [];
    }
    const items = parseText(text, "folder", file, problems);
    checkBlockTypes(items, "folder", file, problems);
    const folders = [];
    const firstSeen = new Map();
    items
      .filter((item) => item.type === "folder")
      .forEach((item) => {
        const folder = normalizeFolder(item);
        if (!folder.id) {
          problems.push(
            problem(
              file,
              folder.line,
              `A collection (“${folder.title}”) has no id= line, so it was skipped.`,
              "Give it an id so folder.html?id=… can find it.",
            ),
          );
          return;
        }
        if (firstSeen.has(folder.id)) {
          problems.push(
            problem(
              file,
              folder.line,
              `id=${folder.id} is already used on line ${firstSeen.get(folder.id)}, so this duplicate collection was skipped.`,
              "Two collections cannot share an id.",
            ),
          );
          return;
        }
        firstSeen.set(folder.id, folder.line);
        folder.games
          .filter((id) => !byId.has(id))
          .forEach((id) =>
            problems.push(
              problem(
                file,
                folder.line,
                `Collection “${folder.title}” lists id=${id}, which is not in ${CATALOG_FILES.games} — it was left out.`,
                "Check the id's spelling, or add that [game] entry.",
              ),
            ),
          );
        folders.push(folder);
      });
    return folders;
  }

  async function loadArcadeData() {
    const problems = [];
    const games = loadGames(problems);
    const byId = new Map(games.map((game) => [game.id, game]));
    // Games added from inside the site are part of the library too, so a
    // collection may list them and search finds them.
    loadDrafts(problems, byId).forEach((draft) => {
      games.push(draft);
      byId.set(draft.id, draft);
    });
    const folders = loadFolders(problems, byId);
    report(problems);
    // Also reachable as window.EXST_CATALOG_PROBLEMS for debugging.
    try {
      window.EXST_CATALOG_PROBLEMS = problems;
    } catch (_) {
      /* Ignore read-only windows. */
    }
    return { games, folders, byId, problems };
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
    const mode = storageGet("exst-open-mode", "page");
    return ["page", "same", "new"].includes(mode) ? mode : "page";
  }

  function bindOpenModeSelect() {
    const select = document.getElementById("openMode");
    if (!select) return;
    select.value = getOpenMode();
    select.addEventListener("change", () => {
      // The page shows a note when this returns false.
      storageSet("exst-open-mode", select.value);
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

  /**
   * Notice dismissal is delegated once, so any page can drop
   * catalogNoticeHtml() markup into the document and it just works.
   */
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-dismiss-notice]");
      if (close) close.closest(".catalog-notice")?.remove();
    });
  }

  window.ExstArcade = {
    loadArcadeData,
    parseBlockText,
    bindOpenModeSelect,
    createGameCard,
    catalogNoticeHtml,
    storageAvailable,
    storageGet,
    storageSet,
    storageNoticeText,
    draftBlocks,
    buildGameBlock,
    validateGameFields,
    saveDraft,
    deleteDraft,
    draftFile: DRAFT_FILE,
    gameUrl,
    homeUrl,
    getOpenMode,
    escapeHtml,
    assetUrl,
    catalogFiles: CATALOG_FILES,
    siteRoot: () => SITE_ROOT,
  };
})();
