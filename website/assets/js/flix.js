/* Exst Arcade — Netflix-style home screen.
 * Same catalog (website/data/games.js + folders.js), same localStorage keys,
 * same file://-friendly loader — presented like JuegoAmigo.github.io:
 * hero cover, poster rows, slide-in details, bottom icon bar.
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const escape = ExstArcade.escapeHtml;
  const asset = ExstArcade.assetUrl;

  // Where the "Edit spotlight" dialog remembers this device's carousel order.
  const SPOTLIGHT_KEY = "exst-hero-ids";

  // Saving goes through the shared helpers, which report when the browser
  // blocks storage instead of dropping the write without a word. The single
  // message the user sees is written where the action happens, so a failure
  // is never overwritten by a success message.
  const read = ExstArcade.storageGet;
  const save = ExstArcade.storageSet;

  let favorites = read("exst-favorites", []);
  let recent = read("exst-recent", []);
  let plays = read("exst-game-plays", {});
  if (!Array.isArray(favorites)) favorites = [];
  if (!Array.isArray(recent)) recent = [];
  if (!plays || typeof plays !== "object") plays = {};

  let data = null;
  let heroSlides = [];
  let heroIndex = 0;
  let heroTimer = null;
  let query = "";
  let category = "All";
  let sort = "popular";
  let currentPage = 0; // 0 home, 1 search, 2 notifications, 3 about
  let detailsId = null;
  let toastTimer;

  const PAGES = ["home", "search", "notifications", "about"];

  function toast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2500);
  }

  function heroArt(game) {
    return ExstArcade.spotlightArt(game);
  }

  /** Artwork that is used when a game's own image cannot be loaded. */
  const DEFAULT_ART = asset("assets/images/default-game.svg");

  /**
   * Two stacked background layers: the game's artwork, then the default
   * artwork underneath. A typo in an icon path shows the default art instead
   * of an empty poster, so it never just silently disappears.
   */
  function artLayers(...paths) {
    return [...paths, DEFAULT_ART]
      .map((item) => `url('${escape(String(item))}')`)
      .join(",");
  }

  /** Deterministic 7.5–9.8 rating so the details page has a "Vote" line. */
  function ratingFor(game) {
    let hash = 0;
    for (const ch of game.id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
    return (7.5 + (hash % 24) / 10).toFixed(1);
  }

  function showInfo(title, content) {
    $("dialogTitle").textContent = title;
    $("dialogContent").innerHTML = content;
    if (window.renderIcons) window.renderIcons($("infoDialog"));
    $("infoDialog").showModal();
  }

  function play(id, event) {
    const game = data.byId.get(id);
    if (!game) return;
    plays[id] = (Number(plays[id]) || 0) + 1;
    save("exst-game-plays", plays);
    recent = [id, ...recent.filter((x) => x !== id)].slice(0, 30);
    save("exst-recent", recent);
    const mode = ExstArcade.getOpenMode();
    const url = ExstArcade.gameUrl(game, mode);
    if (mode === "new" || event?.ctrlKey || event?.metaKey)
      window.open(url, "_blank", "noopener");
    else location.href = url;
  }

  function toggleFavorite(id) {
    const game = data.byId.get(id);
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
    renderAll();
    if (detailsId) syncDetailsFavorite();
  }

  /* ---------- Posters ---------- */

  function poster(game) {
    const badge = game.badge;
    return (
      `<div class="movie">` +
      `<button class="item" data-details="${escape(game.id)}" ` +
      `style="background-image:${artLayers(asset(game.icon))}" ` +
      `aria-label="View ${escape(game.title)}" title="${escape(game.title)}">` +
      (badge ? `<span class="item-badge">${escape(badge)}</span>` : "") +
      `<span class="item-label">${escape(game.title)}</span>` +
      `</button></div>`
    );
  }

  function row(id, title, games) {
    if (!games.length) return "";
    return (
      `<section class="flix-row" id="${id}" aria-label="${escape(title)}">` +
      `<h1>${escape(title)}<span class="row-count">${games.length} title${games.length === 1 ? "" : "s"}</span></h1>` +
      `<div class="gallery">${games.map(poster).join("")}</div></section>`
    );
  }

  /* ---------- Hero ---------- */

  function renderHero() {
    const dots = $("heroDots");
    dots.innerHTML = heroSlides
      .map(
        (game, i) =>
          `<button data-slide="${i}" class="${i === heroIndex ? "selected" : ""}" aria-label="Show ${escape(game.title)}" aria-pressed="${i === heroIndex}"></button>`,
      )
      .join("");
    syncHero();
  }

  /**
   * The carousel has nothing to show (no games yet, or nothing ticked in the
   * spotlight editor): the hero explains how to add the first game instead of
   * leaving dead buttons behind.
   */
  function syncEmptyHero() {
    $("heroCover").style.backgroundImage = artLayers(
      asset("assets/images/default-game.svg"),
    );
    $("heroKicker").textContent = "READY WHEN YOU ARE";
    $("heroTitle").textContent = "Add your first game";
    $("heroMeta").innerHTML = "";
    $("heroOverview").textContent =
      "Drop a game file into website/games/, paste one [game] block into website/data/games.js, and it shows up right here.";
    $("heroCategories").textContent =
      "website/games/   •   website/data/games.js";
    for (const id of ["heroPlay", "heroDetails", "heroFavorite"]) {
      const button = $(id);
      button.disabled = true;
      delete button.dataset.play;
      delete button.dataset.details;
      delete button.dataset.favorite;
    }
    $("heroHowTo").hidden = false;
    $("heroEdit").hidden = true;
  }

  function syncHero() {
    const game = heroSlides[heroIndex];
    if (!game) {
      syncEmptyHero();
      return;
    }
    $("heroHowTo").hidden = true;
    $("heroEdit").hidden = false;
    for (const id of ["heroPlay", "heroDetails", "heroFavorite"])
      $(id).disabled = false;
    $("heroCover").style.backgroundImage = artLayers(heroArt(game));
    $("heroKicker").textContent = game.version
      ? `${game.version.toUpperCase()} • IN THE SPOTLIGHT`
      : "IN THE SPOTLIGHT";
    $("heroTitle").textContent = game.title;
    $("heroMeta").innerHTML =
      `<span class="vote">★ ${ratingFor(game)}</span> &nbsp;` +
      escape(
        [...(game.tags || [])].slice(0, 3).join(" • ") || game.version || "",
      );
    $("heroOverview").textContent = game.description || "Ready to play.";
    $("heroCategories").textContent = [...(game.tags || [])]
      .slice(0, 4)
      .join("   •   ");
    $("heroPlay").dataset.play = game.id;
    $("heroPlay").setAttribute("aria-label", `Play ${game.title}`);
    $("heroDetails").dataset.details = game.id;
    const fav = $("heroFavorite");
    fav.dataset.favorite = game.id;
    const saved = favorites.includes(game.id);
    fav.classList.toggle("saved", saved);
    fav.setAttribute("aria-pressed", String(saved));
    fav.setAttribute(
      "aria-label",
      `${saved ? "Remove" : "Add"} ${game.title} ${saved ? "from" : "to"} My List`,
    );
    fav.querySelector("span").textContent = "My List";
    $("heroDots")
      .querySelectorAll("[data-slide]")
      .forEach((b) => {
        const active = Number(b.dataset.slide) === heroIndex;
        b.classList.toggle("selected", active);
        b.setAttribute("aria-pressed", String(active));
      });
  }

  function setHero(index) {
    if (!heroSlides.length) return;
    heroIndex = (index + heroSlides.length) % heroSlides.length;
    syncHero();
    restartHeroTimer();
  }

  function restartHeroTimer() {
    clearInterval(heroTimer);
    if (heroSlides.length > 1 && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      heroTimer = setInterval(() => {
        if (currentPage === 0 && !detailsId) {
          heroIndex = (heroIndex + 1) % heroSlides.length;
          syncHero();
        }
      }, 7000);
    }
  }

  /* ---------- Spotlight editor (the carousel at the top of the page) ------- */

  const STARTER_BLOCK = `[game]
id=retro-pong
title=Retro Pong
path=games/retro-pong.html
icon=assets/images/default-game.svg
version=HTML build
description=Two paddles, one ball, and a rivalry that never ends.
tags=Arcade, Action
hero=true`;

  let spotlightSelection = []; // [{ id, on }] in the order shown in the dialog

  function applySpotlight() {
    heroSlides = ExstArcade.spotlightGames(data.games, read(SPOTLIGHT_KEY, []));
    heroIndex = 0;
  }

  function buildSpotlightSelection() {
    const onIds = ExstArcade.spotlightGames(
      data.games,
      read(SPOTLIGHT_KEY, []),
    ).map((game) => game.id);
    const order = [
      ...onIds,
      ...data.games.map((game) => game.id).filter((id) => !onIds.includes(id)),
    ];
    return order.map((id) => ({ id, on: onIds.includes(id) }));
  }

  function syncSpotlightCount() {
    const count = $("spotCount");
    if (!count) return;
    const chosen = spotlightSelection.filter((row) => row.on).length;
    count.textContent =
      `${chosen} of ${spotlightSelection.length} game${spotlightSelection.length === 1 ? "" : "s"} in the spotlight.` +
      (chosen
        ? ""
        : " Nothing ticked, so the carousel falls back to games marked hero=true.");
  }

  /** Keep the ↑ ↓ buttons and their labels in step with the new order. */
  function renumberSpotlightRows() {
    [...$("spotlightList").children].forEach((row, i) => {
      const last = spotlightSelection.length - 1;
      const game = data.byId.get(spotlightSelection[i].id);
      row.querySelector("[data-spot-toggle]").dataset.spotToggle = String(i);
      const up = row.querySelector("[data-spot-up]");
      const down = row.querySelector("[data-spot-down]");
      up.dataset.spotUp = String(i);
      down.dataset.spotDown = String(i);
      up.disabled = i === 0;
      down.disabled = i === last;
      up.setAttribute("aria-label", `Move ${game.title} up`);
      down.setAttribute("aria-label", `Move ${game.title} down`);
    });
  }

  function moveSpotlightRow(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= spotlightSelection.length) return;
    [spotlightSelection[index], spotlightSelection[target]] = [
      spotlightSelection[target],
      spotlightSelection[index],
    ];
    const list = $("spotlightList");
    const nodes = [...list.children];
    if (delta < 0) list.insertBefore(nodes[index], nodes[target]);
    else list.insertBefore(nodes[target], nodes[index]);
    renumberSpotlightRows();
  }

  function renderSpotlightDialog() {
    const content = $("spotlightContent");
    if (!data.games.length) {
      content.innerHTML =
        `<p class="spot-note">There are no games in <code>website/data/games.js</code> yet, so there is nothing to cycle through. Add one game block and the carousel fills itself.</p>` +
        `<div class="spot-actions">` +
        `<button class="primary-button" data-starter="1">Show me a starter block</button>` +
        `<button class="ghost" data-spot-close="1">Close</button></div>`;
      return;
    }
    const last = spotlightSelection.length - 1;
    const rows = spotlightSelection
      .map((row, i) => {
        const game = data.byId.get(row.id);
        return (
          `<li class="spot-row${row.on ? " is-on" : ""}">` +
          `<label class="spot-pick"><input type="checkbox" data-spot-toggle="${i}"${row.on ? " checked" : ""} />` +
          `<span class="spot-title">${escape(game.title)}</span>` +
          `<small class="spot-id">${escape(game.id)}</small></label>` +
          `<span class="spot-move">` +
          `<button type="button" class="mini-button" data-spot-up="${i}" aria-label="Move ${escape(game.title)} up"${i === 0 ? " disabled" : ""}>↑</button>` +
          `<button type="button" class="mini-button" data-spot-down="${i}" aria-label="Move ${escape(game.title)} down"${i === last ? " disabled" : ""}>↓</button>` +
          `</span></li>`
        );
      })
      .join("");
    content.innerHTML =
      `<p class="spot-note">Tick the games that should cycle at the top of the home page and move them with ↑ ↓. ` +
      `The order in this list is the order they play.</p>` +
      `<ol class="spot-list" id="spotlightList">${rows}</ol>` +
      `<p class="spot-count" id="spotCount"></p>` +
      `<div class="spot-actions">` +
      `<button class="primary-button" data-spot-save="1">Save spotlight</button>` +
      `<button class="ghost" data-spot-copy="1">Copy for data/games.js</button>` +
      `<button class="ghost" data-spot-reset="1">Reset to catalog order</button>` +
      `</div>` +
      `<p class="spot-note">This choice is stored in this browser. To make it permanent for everyone, set <code>hero=true</code> on those games in ` +
      `<code>website/data/games.js</code> in the same order — or press “Copy for data/games.js” and paste the result over the <code>window.EXST_GAMES_TEXT</code> block.</p>` +
      `<div id="spotCopyBox" hidden><textarea id="spotCopyText" readonly aria-label="Catalog text to paste into games.js"></textarea></div>`;
    syncSpotlightCount();
  }

  /** The whole catalog as text, in the chosen spotlight order. */
  function catalogText() {
    const chosen = spotlightSelection.filter((row) => row.on).map((row) => row.id);
    const order = [
      ...chosen,
      ...data.games
        .map((game) => game.id)
        .filter((id) => !chosen.includes(id)),
    ];
    const lines = [
      "# Exst Arcade catalog — written by the home page spotlight editor.",
      "# The order of the [game] blocks below is the order in the carousel.",
      "",
    ];
    for (const id of order) {
      const game = data.byId.get(id);
      lines.push("[game]");
      lines.push(`id=${game.id}`);
      lines.push(`title=${game.title}`);
      if (game.version) lines.push(`version=${game.version}`);
      lines.push(`path=${game.path}`);
      lines.push(`icon=${game.icon}`);
      if (game.description) lines.push(`description=${game.description}`);
      if (game.tags.length) lines.push(`tags=${game.tags.join(", ")}`);
      if (game.badge) lines.push(`badge=${game.badge}`);
      if (game.featured) lines.push("featured=true");
      if (game.heroart) lines.push(`heroart=${game.heroart}`);
      lines.push(`hero=${chosen.includes(game.id) ? "true" : "false"}`);
      lines.push("");
    }
    return "window.EXST_GAMES_TEXT = `\n" + lines.join("\n") + "`;\n";
  }

  function saveSpotlight() {
    const ids = spotlightSelection.filter((row) => row.on).map((row) => row.id);
    const stored = save(SPOTLIGHT_KEY, ids);
    applySpotlight();
    renderHero();
    restartHeroTimer();
    if (!stored) {
      toast("This browser is not saving changes, so the spotlight lasts this visit only.");
      return;
    }
    toast(
      ids.length
        ? `Spotlight saved: ${ids.length} game${ids.length === 1 ? "" : "s"}.`
        : "Spotlight reset to the catalog order.",
    );
  }

  function resetSpotlight() {
    save(SPOTLIGHT_KEY, []);
    applySpotlight();
    spotlightSelection = buildSpotlightSelection();
    renderSpotlightDialog();
    renderHero();
    restartHeroTimer();
    toast("Back to the catalog order.");
  }

  async function copyCatalogText() {
    const text = catalogText();
    try {
      await navigator.clipboard.writeText(text);
      toast("Catalog text copied — paste it over the games.js block.");
    } catch {
      $("spotCopyBox").hidden = false;
      const box = $("spotCopyText");
      box.value = text;
      box.focus();
      box.select();
      toast("Clipboard blocked — the text is in the box at the bottom.");
    }
  }

  function showStarterBlock() {
    showInfo(
      "Add a game",
      `<p>Two steps, about a minute:</p>` +
        `<p><strong>1.</strong> Put the game file in <code>website/games/</code> — a single file such as ` +
        `<code>games/retro-pong.html</code>, or a folder whose main file is <code>index.html</code>.</p>` +
        `<p><strong>2.</strong> Paste this block into <code>website/data/games.js</code> (inside the backticked text) and change the values:</p>` +
        `<pre class="starter-block">${escape(STARTER_BLOCK)}</pre>` +
        `<p><code>hero=true</code> puts the game in the carousel at the top of this page. Save the file and refresh — ` +
        `no build step, no restart. The same file also documents every other field.</p>` +
        `<button class="primary-button" id="copyStarter">Copy the block</button>`,
    );
    $("copyStarter").onclick = async () => {
      try {
        await navigator.clipboard.writeText(STARTER_BLOCK);
        toast("Starter block copied.");
      } catch {
        toast("Clipboard blocked — select the block above and copy it.");
      }
    };
  }

  /* ---------- Rows / search / lists ---------- */

  function sortedGames(games) {
    const list = [...games];
    if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "played")
      list.sort((a, b) => (plays[b.id] || 0) - (plays[a.id] || 0));
    else if (sort === "newest")
      list.sort((a, b) => Number(b.badge === "NEW") - Number(a.badge === "NEW"));
    return list;
  }

  function matches(game) {
    if (
      category !== "All" &&
      !game.tags.some((t) => t.toLowerCase() === category.toLowerCase())
    )
      return false;
    if (
      query &&
      // The id is searchable too: it is what the catalog file and URLs use,
      // so "neon-pong" should find "Neon Pong".
      !`${game.title} ${game.id} ${game.description} ${(game.tags || []).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
      return false;
    return true;
  }

  /** Shown instead of the poster rows while the library has no games. */
  function emptyLibraryCard() {
    return (
      `<section class="flix-row" id="row-empty">` +
      `<h1>Your library<span class="row-count">nothing listed yet</span></h1>` +
      `<div class="empty-state">` +
      `<i data-icon="grid"></i>` +
      `<h3>Add your first game</h3>` +
      `<p>1. Drop the game file into <code>website/games/</code>.<br>` +
      `2. Paste a <code>[game]</code> block into <code>website/data/games.js</code>, save, and refresh.</p>` +
      `<button class="primary-button" data-starter="1">Show me a starter block</button>` +
      `</div></section>`
    );
  }

  function renderRows() {
    if (!data.games.length) {
      $("rows").innerHTML = emptyLibraryCard();
      return;
    }
    const myList = favorites.map((id) => data.byId.get(id)).filter(Boolean);
    const topRated = data.games.filter((g) => g.featured);
    const folders = data.folders
      .map((folder) => {
        const games = folder.games
          .map((id) => data.byId.get(id))
          .filter(Boolean);
        const slug = folder.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        return row(`row-folder-${slug}`, folder.title, games);
      })
      .join("");
    $("rows").innerHTML =
      (myList.length
        ? row("row-mylist", "My List", myList)
        : `<section class="flix-row" id="row-mylist" hidden></section>`) +
      row("row-top", "Top Rated on ExstArcade", topRated) +
      folders +
      row("row-all", "All Games on ExstArcade", data.games);
  }

  function renderSearch() {
    document.querySelectorAll("[data-filter]").forEach((b) => {
      const active = b.dataset.filter === category;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    const results = sortedGames(data.games.filter(matches));
    $("searchCount").textContent = query
      ? `${results.length} result${results.length === 1 ? "" : "s"} for “${query}”`
      : category !== "All"
        ? `${results.length} ${category} game${results.length === 1 ? "" : "s"}`
        : `${results.length} games in the library`;
    $("searchGrid").innerHTML = results.map(poster).join("");
    $("searchEmpty").hidden = results.length > 0;
    if (!results.length) {
      $("searchEmpty").querySelector("p").textContent = query
        ? "Try another title or choose a different category."
        : "Try another category to find something to play.";
    }
  }

  function renderNotifications() {
    const recentGames = recent
      .map((id) => data.byId.get(id))
      .filter(Boolean)
      .slice(0, 12);
    $("recentRow").innerHTML = recentGames.length
      ? `<h1>Recently played</h1><div class="gallery">${recentGames.map(poster).join("")}</div>`
      : `<div class="empty-state"><h3>Your next adventure awaits</h3><p>Play any game and it will appear here, ready for another round.</p></div>`;
  }

  function renderAbout() {
    $("statTried").textContent = String(recent.length);
    $("statPlays").textContent = String(
      Object.values(plays).reduce((a, b) => a + (Number(b) || 0), 0),
    );
    $("favoriteCount").textContent = String(favorites.length);
    renderCatalogStatus();
    const spotlightCount = $("aboutSpotlightCount");
    if (spotlightCount)
      spotlightCount.textContent = heroSlides.length
        ? `${heroSlides.length} game${heroSlides.length === 1 ? "" : "s"} in the carousel →`
        : "choose the top carousel →";
    $("aboutFolders").innerHTML = data.folders.length
      ? data.folders
          .map((folder) => {
            // Count the games that actually resolve, so a typo never claims a
            // game is on a shelf when it is not.
            const count = folder.games.filter((id) => data.byId.has(id)).length;
            return `<a href="${escape(asset(`folder.html?id=${encodeURIComponent(folder.id)}`))}"><span>${escape(folder.title)}</span><small>${count} game${count === 1 ? "" : "s"} →</small></a>`;
          })
          .join("")
      : `<p class="hint">No collections yet. Add one to <code>website/data/folders.js</code> to give your games their own shelf.</p>`;
  }

  function renderAll() {
    if (!data) return;
    renderRows();
    renderSearch();
    renderNotifications();
    renderAbout();
    syncHero();
    if (window.renderIcons) window.renderIcons(document);
  }

  /* ---------- Catalog edit feedback ---------- */

  /**
   * Every edit to website/data/games.js or folders.js is either read
   * correctly or reported here — a half-saved entry never disappears
   * without a word.
   */
  function renderCatalogNotice(problems) {
    const host = $("catalogNotice");
    if (!host) return;
    host.innerHTML = ExstArcade.catalogNoticeHtml(problems);
  }

  /**
   * A catalog edit that stops the library from loading is reported in the
   * hero, where the user is already looking — never as an empty arcade or a
   * page stuck on "Loading…".
   */
  function showCatalogFailure(error) {
    const hint =
      error.hint ||
      "Make sure website/data/games.js and website/data/folders.js are present, then try again.";
    const catalogError = error.name === "CatalogError";
    document.body.classList.add("catalog-broken");
    $("heroKicker").textContent = "CATALOG ERROR";
    $("heroTitle").textContent = catalogError
      ? "The game library could not be read"
      : "The arcade couldn’t load";
    $("heroOverview").textContent =
      "Fix the catalog file described below, save it, then reload this page.";
    $("heroMeta").innerHTML = "";
    $("heroCategories").textContent = "";
    $("heroDots").innerHTML = "";
    const options = document.querySelector(".hero-content .options");
    if (options) options.hidden = true;
    $("rows").innerHTML = "";
    const notice = document.createElement("section");
    notice.className = "catalog-notice hero-notice";
    notice.setAttribute("role", "alert");
    notice.innerHTML =
      `<div class="notice-head"><span class="notice-chip">CATALOG ERROR</span></div>` +
      `<p class="notice-lead">${escape(error.message)}</p>` +
      `<p class="notice-hint">${escape(hint)}</p>` +
      `<p class="notice-hint">Nothing is lost: fix the file and reload — every other page of the arcade is unaffected.</p>` +
      `<button class="primary-button" id="retryLoad">Reload the page</button>`;
    document.querySelector(".hero-content").appendChild(notice);
    $("retryLoad").addEventListener("click", () => location.reload());
  }

  function renderStorageStatus() {
    const notice = ExstArcade.storageNoticeText();
    if (!notice) return;
    const hint = document.querySelector(".pref-block .hint");
    if (hint)
      hint.innerHTML = `${escape(notice)} Keyboard tip: press <kbd>/</kbd> to find a game instantly.`;
  }

  function renderCatalogStatus() {
    const host = $("catalogStatus");
    if (!host) return;
    const files = ExstArcade.catalogFiles;
    const problems = (data && data.problems) || [];
    const storage = ExstArcade.storageNoticeText();
    host.innerHTML =
      `<strong>Catalog:</strong> ${data.games.length} game${
        data.games.length === 1 ? "" : "s"
      } and ${data.folders.length} collection${
        data.folders.length === 1 ? "" : "s"
      } read from <code>${escape(files.games)}</code> and <code>${escape(
        files.folders,
      )}</code> when this page loaded.${
        problems.length
          ? ` <strong>${problems.length} problem${
              problems.length === 1 ? "" : "s"
            } found</strong> — open the Catalog check notice on Home.`
          : " Your edits show up here as soon as the page is refreshed."
      }${storage ? ` <strong>${escape(storage)}</strong>` : ""}`;
  }

  /* ---------- Details slide-in ---------- */

  function openDetails(id) {
    const game = data.byId.get(id);
    if (!game) return;
    detailsId = id;
    $("detailsCover").style.backgroundImage = artLayers(heroArt(game));
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
    const game = data.byId.get(detailsId);
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
    const heroFav = $("heroFavorite");
    if (heroFav.dataset.favorite === game.id) {
      heroFav.classList.toggle("saved", saved);
      heroFav.setAttribute("aria-pressed", String(saved));
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

  /* ---------- Navigation (hash like JuegoAmigo) ---------- */

  function showPage(i) {
    currentPage = i;
    PAGES.forEach((name, n) => {
      $(`page-${name}`).hidden = n !== i;
    });
    document.querySelectorAll("#footerBar [ref]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("ref") === PAGES[i]);
    });
    if (detailsId) closeDetails();
    syncHeader();
    window.scrollTo({ top: 0 });
  }

  function syncHeader() {
    const bar = $("headerBar");
    if (currentPage !== 0) {
      bar.style.backgroundColor = "rgba(18,18,18,1)";
      return;
    }
    const h = window.innerHeight || 800;
    const alpha = Math.min(1, Math.max(0, window.scrollY / (h * 0.6)));
    bar.style.backgroundColor = `rgba(18,18,18,${alpha.toFixed(2)})`;
  }

  function routeFromHash() {
    const hash = (location.hash || "#home").replace("#", "");
    const i = PAGES.indexOf(hash);
    showPage(i === -1 ? 0 : i);
    if (hash === "search") setTimeout(() => $("searchInput").focus({ preventScroll: true }), 50);
  }

  /* ---------- Events ---------- */

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
    const filter = e.target.closest("[data-filter]");
    if (filter) {
      category = filter.dataset.filter;
      renderSearch();
      return;
    }
    const slide = e.target.closest("[data-slide]");
    if (slide) {
      setHero(Number(slide.dataset.slide));
      return;
    }
    const explore = e.target.closest("[data-goto]");
    if (explore) {
      location.hash = explore.dataset.goto;
      return;
    }
    if (e.target.closest("[data-starter]")) {
      showStarterBlock();
      return;
    }
    if (e.target.closest("#aboutSpotlight")) {
      e.preventDefault();
      $("heroEdit").click();
      return;
    }
  });

  /* ---------- Spotlight dialog events ---------- */

  $("heroEdit").addEventListener("click", () => {
    spotlightSelection = buildSpotlightSelection();
    renderSpotlightDialog();
    $("spotlightDialog").showModal();
  });

  $("heroHowTo").addEventListener("click", showStarterBlock);

  $("closeSpotlight").addEventListener("click", () => $("spotlightDialog").close());

  $("spotlightDialog").addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-spot-toggle]");
    if (toggle) {
      const index = Number(toggle.dataset.spotToggle);
      spotlightSelection[index].on = toggle.checked;
      toggle.closest(".spot-row").classList.toggle("is-on", toggle.checked);
      syncSpotlightCount();
      return;
    }
    const up = e.target.closest("[data-spot-up]");
    if (up) {
      moveSpotlightRow(Number(up.dataset.spotUp), -1);
      return;
    }
    const down = e.target.closest("[data-spot-down]");
    if (down) {
      moveSpotlightRow(Number(down.dataset.spotDown), 1);
      return;
    }
    if (e.target.closest("[data-spot-save]")) {
      saveSpotlight();
      $("spotlightDialog").close();
      return;
    }
    if (e.target.closest("[data-spot-copy]")) {
      copyCatalogText();
      return;
    }
    if (e.target.closest("[data-spot-reset]")) {
      resetSpotlight();
      return;
    }
    if (e.target.closest("[data-spot-close]")) {
      $("spotlightDialog").close();
      return;
    }
    // Clicking the dimmed area behind the dialog closes it.
    if (e.target === $("spotlightDialog")) {
      const rect = e.target.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      )
        e.target.close();
    }
  });

  document.querySelectorAll("#footerBar [ref]").forEach((b) => {
    b.addEventListener("click", () => {
      location.hash = b.getAttribute("ref");
    });
  });

  window.addEventListener("hashchange", routeFromHash);
  window.addEventListener("scroll", syncHeader, { passive: true });

  $("searchInput").addEventListener("input", (e) => {
    query = e.target.value.trim();
    renderSearch();
  });

  $("sortSelect").addEventListener("change", (e) => {
    sort = e.target.value;
    renderSearch();
  });

  $("detailsClose").addEventListener("click", closeDetails);
  $("detailsShare").addEventListener("click", async () => {
    const game = data.byId.get(detailsId);
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
    if (
      e.key === "/" &&
      !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) &&
      !$("infoDialog").open
    ) {
      e.preventDefault();
      if (location.hash !== "#search") location.hash = "#search";
      else $("searchInput").focus();
    }
    if (e.key === "Escape" && detailsId) closeDetails();
  });

  $("detailsPage").querySelector("main").addEventListener("scroll", (e) => {
    const top = e.target.scrollTop;
    $("detailsHeader").style.backgroundColor =
      top > 40 ? "rgba(16,16,16,1)" : "rgba(16,16,16,0)";
  });

  /* ---------- Boot ---------- */

  ExstArcade.loadArcadeData()
    .then((result) => {
      data = result;
      applySpotlight();
      renderHero();
      renderAll();
      renderCatalogNotice(result.problems);
      renderStorageStatus();
      ExstArcade.bindOpenModeSelect();
      routeFromHash();
      syncHeader();
      restartHeroTimer();
    })
    .catch(showCatalogFailure);
})();
