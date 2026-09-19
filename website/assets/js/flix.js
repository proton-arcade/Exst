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

  const HERO_ART = {
    "neon-drift": "assets/images/neon-drift-hero.webp",
  };
  const CATEGORIES = ["All", "Action", "Adventure", "Racing", "Puzzle", "Arcade"];

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("Your browser could not save this preference.");
    }
  }

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

  function isAvailable(game) {
    return game.available !== false && game.available !== "false";
  }

  function heroArt(game) {
    return asset(HERO_ART[game.id] || game.icon);
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
    if (!isAvailable(game)) {
      showInfo(
        "This game needs its files",
        `<p>${escape(game.title)} is a starter entry in your editable library. Its playable build hasn’t been added yet.</p><p>Put your licensed game files at <code>${escape(asset(game.path))}</code>, then remove the <code>available=false</code> line from its entry in <code>website/data/games.js</code>.</p><p>In the meantime, all six Arcade Originals are ready to play.</p><button class="primary-button" id="tryOriginal">Try an arcade original</button>`,
      );
      $("tryOriginal").onclick = () => {
        $("infoDialog").close();
        play("neon-snake");
      };
      return;
    }
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
    save("exst-favorites", favorites);
    toast(
      exists
        ? `${game.title} removed from My List`
        : `${game.title} added to My List`,
    );
    renderAll();
    if (detailsId) syncDetailsFavorite();
  }

  /* ---------- Posters ---------- */

  function poster(game) {
    const available = isAvailable(game);
    const badge = available ? game.badge : "SETUP";
    return (
      `<div class="movie">` +
      `<button class="item${available ? "" : " is-setup"}" data-details="${escape(game.id)}" ` +
      `style="background-image:url('${escape(asset(game.icon))}')" ` +
      `aria-label="${available ? "View" : "Set up"} ${escape(game.title)}" title="${escape(game.title)}">` +
      (badge
        ? `<span class="item-badge${available ? "" : " setup"}">${escape(badge)}</span>`
        : "") +
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

  function syncHero() {
    const game = heroSlides[heroIndex];
    if (!game) return;
    $("heroCover").style.backgroundImage = `url('${heroArt(game)}')`;
    $("heroKicker").textContent = `${(game.version || game.id).toUpperCase()} • IN THE SPOTLIGHT`;
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
      !`${game.title} ${game.description} ${game.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
      return false;
    return true;
  }

  function renderRows() {
    const myList = favorites.map((id) => data.byId.get(id)).filter(Boolean);
    const topRated = data.games.filter((g) => g.featured && isAvailable(g));
    const originals = data.games.filter((g) => g.original);
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
      row("row-originals", "Arcade Originals on ExstArcade", originals) +
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
    $("aboutFolders").innerHTML = data.folders
      .map(
        (folder) =>
          `<a href="${escape(asset(`folder.html?id=${encodeURIComponent(folder.id)}`))}"><span>${escape(folder.title)}</span><small>${folder.games.length} games →</small></a>`,
      )
      .join("");
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

  function renderCatalogStatus() {
    const host = $("catalogStatus");
    if (!host) return;
    const files = ExstArcade.catalogFiles;
    const problems = (data && data.problems) || [];
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
      }`;
  }

  /* ---------- Details slide-in ---------- */

  function openDetails(id) {
    const game = data.byId.get(id);
    if (!game) return;
    if (!isAvailable(game)) {
      play(id);
      return;
    }
    detailsId = id;
    $("detailsCover").style.backgroundImage = `url('${heroArt(game)}')`;
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
      heroSlides = data.games.filter((g) => g.featured && isAvailable(g));
      if (!heroSlides.length)
        heroSlides = data.games.filter(isAvailable).slice(0, 6);
      if (!heroSlides.length) heroSlides = data.games.slice(0, 6);
      renderHero();
      renderAll();
      renderCatalogNotice(result.problems);
      ExstArcade.bindOpenModeSelect();
      routeFromHash();
      syncHeader();
      restartHeroTimer();
    })
    .catch(showCatalogFailure);
})();
