/* Discovery dashboard. The editable catalog lives in website/data/games.js. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const escape = ExstArcade.escapeHtml;
  const asset = ExstArcade.assetUrl;
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
  let favorites = read("exst-favorites", []),
    recent = read("exst-recent", []),
    plays = read("exst-game-plays", {});
  if (!Array.isArray(favorites)) favorites = [];
  if (!Array.isArray(recent)) recent = [];
  if (!plays || typeof plays !== "object") plays = {};
  let data,
    view = "discover",
    category = "All",
    query = "",
    sort = "popular",
    slide = 0;
  let toastTimer;
  const slides = [
    {
      id: "neon-drift",
      title: "Neon Drift",
      genre: "RACING",
      image: asset("assets/images/neon-drift-hero.webp"),
      description:
        "Own the night. Chase the rush.<br>The city is your playground.",
      alt: "Silver sports car on a neon-lit city street",
    },
    {
      id: "cosmic-escape",
      title: "Cosmic Escape",
      genre: "ADVENTURE",
      image: asset("assets/images/cosmic-escape.webp"),
      description: "A universe of possibility.<br>One mission: keep flying.",
      alt: "Spaceship navigating a purple asteroid belt",
    },
    {
      id: "brick-breaker",
      title: "Brick Breaker",
      genre: "ARCADE",
      image: asset("assets/images/brick-breaker.webp"),
      description:
        "A classic, with a little extra glow.<br>Make every bounce count.",
      alt: "Glowing arcade bricks in blue and coral",
    },
  ];
  function toast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2500);
  }
  function isAvailable(game) {
    return game.available !== false && game.available !== "false";
  }
  function setFavorite(id) {
    const game = data.byId.get(id);
    if (!game) return;
    const exists = favorites.includes(id);
    favorites = exists ? favorites.filter((x) => x !== id) : [...favorites, id];
    save("exst-favorites", favorites);
    toast(
      exists
        ? `${game.title} removed from favorites`
        : `${game.title} added to your favorites`,
    );
    render();
  }
  function play(id, event) {
    const game = data.byId.get(id);
    if (!game) return;
    if (!isAvailable(game)) {
      showInfo(
        "This game needs its files",
        `<p>${escape(game.title)} is a starter entry in your editable library. Its playable build hasn’t been added yet.</p><p>Put your licensed game files at <code>${escape(asset(game.path))}</code>, then remove the <code>available=false</code> line from its entry in <code>website/data/games.js</code>.</p><p>In the meantime, all six Arcade Originals are ready to play.</p><button class="primary-button" id="tryOriginal">Try an arcade original ${icon("arrow-right")}</button>`,
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
  function gameCard(game) {
    const saved = favorites.includes(game.id),
      available = isAvailable(game),
      tags = game.tags
        .filter((t) => !["featured", "quick play"].includes(t))
        .slice(0, 2);
    let badge = available ? game.badge : "SETUP NEEDED";
    const best = read(`exst-best-${game.id}`, 0);
    return `<article class="arcade-game-card col-md-4"><div class="game-cover"><a href="${escape(ExstArcade.gameUrl(game))}" data-play="${escape(game.id)}" aria-label="Play ${escape(game.title)}"><img src="${escape(asset(game.icon))}" alt="${escape(game.title)} game artwork" loading="lazy" decoding="async"><span class="cover-play">${icon("play")}</span></a>${badge ? `<span class="game-badge ${badge === "NEW" ? "new" : ""}">${icon(badge === "HOT" ? "flame" : badge === "NEW" ? "zap" : "star")}${escape(badge)}</span>` : ""}<button class="favorite-button ${saved ? "saved" : ""}" data-favorite="${escape(game.id)}" aria-label="${saved ? "Remove" : "Add"} ${escape(game.title)} ${saved ? "from" : "to"} favorites" aria-pressed="${saved}">${icon("heart")}</button></div><div class="card-body"><div class="card-title-row"><h3><a href="${escape(ExstArcade.gameUrl(game))}" data-play="${escape(game.id)}">${escape(game.title)}</a></h3><span class="card-rating" title="${best ? "Your best score" : "Free to play"}">${icon(best ? "trophy" : "zap")}${best ? escape(best) : "Free"}</span></div><p>${escape(game.description)}</p><div class="card-bottom"><span class="card-tags">${tags.map((t) => `<span>${escape(t.charAt(0).toUpperCase() + t.slice(1))}</span>`).join("")}</span><a class="card-play" href="${escape(ExstArcade.gameUrl(game))}" data-play="${escape(game.id)}">${available ? "Play now" : "Set up"} ${icon("arrow-up-right")}</a></div></div></article>`;
  }
  function render() {
    if (!data) return;
    const titles = {
      discover: [
        "Good times start here",
        "Take a break. Find your game. Make a new high score.",
        "Find your next obsession",
      ],
      all: [
        "Your next favorite is here",
        "Explore the whole collection. There’s a game for every kind of day.",
        "All games",
      ],
      recent: [
        "Welcome back to the fun",
        "Pick up where you left off. Your recent adventures are right here.",
        "Recently played",
      ],
      favorites: [
        "All your favorites. One place",
        "The games you love, ready whenever you are.",
        "My favorites",
      ],
    };
    const names = {
      discover: "Discover",
      all: "All games",
      recent: "Recently played",
      favorites: "My favorites",
    };
    const info = titles[view];
    $("pageHeading").innerHTML = `${info[0]}<span>.</span>`;
    $("pageSubtitle").textContent = info[1];
    $("breadcrumb").textContent = names[view];
    $("favoriteCount").textContent = favorites.length;
    $("allCount").textContent = data.games.length;
    const discovery = view === "discover" && !query && category === "All";
    $("discoveryContent").hidden = !discovery;
    $("collections").hidden = !discovery;
    $("gridHeading").textContent = query
      ? `Results for “${query}”`
      : category !== "All"
        ? `${category} games`
        : info[2];
    $("gridSubtitle").textContent = query
      ? "A little searching. A lot of playing."
      : view === "all"
        ? "Six ready-to-play originals, plus your editable game library."
        : view === "favorites"
          ? "Hit the heart on any game to keep it close."
          : view === "recent"
            ? "Your most recent games, saved on this device."
            : "Big adventures and little distractions. There’s something for everyone.";
    $("viewAll").hidden = view === "all";
    document.querySelectorAll("#mainNav [data-view]").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === view);
      if (b.dataset.view === view) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    document
      .querySelectorAll("[data-category]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.category === category),
      );
    document.querySelectorAll("[data-filter]").forEach((b) => {
      const active = b.dataset.filter === category;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active);
    });
    let games = data.games.filter((game) => {
      if (view === "favorites" && !favorites.includes(game.id)) return false;
      if (view === "recent" && !recent.includes(game.id)) return false;
      if (view === "discover" && !isAvailable(game)) return false;
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
    });
    if (sort === "az") games.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "played")
      games.sort((a, b) => (plays[b.id] || 0) - (plays[a.id] || 0));
    else if (sort === "newest")
      games.sort(
        (a, b) => Number(b.badge === "NEW") - Number(a.badge === "NEW"),
      );
    else if (view === "recent")
      games.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
    $("gameGrid").innerHTML =
      games.map(gameCard).join("") ||
      `<div class="empty-state">${icon(view === "favorites" ? "heart" : view === "recent" ? "clock" : "search")}<h3>${query ? "No games found" : view === "favorites" ? "Your favorites start here" : view === "recent" ? "Your next adventure awaits" : "More adventures are on the way"}</h3><p>${query ? "Try another title or choose a different category." : view === "favorites" ? "Tap the heart on a game to add it to your own little arcade." : view === "recent" ? "Play any game and it will appear here, ready for another round." : "Try another category to find something to play."}</p><button class="primary-button" data-view="discover">Explore games ${icon("arrow-right")}</button></div>`;
    document.querySelectorAll(".hero-heart").forEach((b) => {
      const saved = favorites.includes(b.dataset.favorite);
      b.classList.toggle("saved", saved);
      b.setAttribute("aria-pressed", saved);
      b.setAttribute(
        "aria-label",
        `${saved ? "Remove" : "Add"} ${data.byId.get(b.dataset.favorite)?.title} ${saved ? "from" : "to"} favorites`,
      );
    });
    $("gameGrid")
      .querySelectorAll("img")
      .forEach((img) => {
        img.onerror = () => {
          img.onerror = null;
          img.src = asset("assets/images/default-game.svg");
        };
      });
  }
  function navigate(next, cat = "All") {
    view = next;
    category = cat;
    query = "";
    $("searchInput").value = "";
    const params = new URLSearchParams();
    if (view !== "discover") params.set("view", view);
    if (category !== "All") params.set("category", category);
    try {
      // Some browsers refuse pushState on file://; state still works without it.
      history.pushState(
        {},
        "",
        location.pathname + (params.size ? "?" + params : ""),
      );
    } catch {
      /* View state is still tracked in memory. */
    }
    $("sidebar").classList.remove("open");
    $("menuToggle").setAttribute("aria-expanded", "false");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showInfo(title, content) {
    $("dialogTitle").textContent = title;
    $("dialogContent").innerHTML = content;
    $("infoDialog").showModal();
  }
  function setSlide(index) {
    slide = index;
    const item = slides[index];
    const hero = document.querySelector(".hero-feature");
    hero.querySelector(".hero-art").src = item.image;
    hero.querySelector(".hero-art").alt = item.alt;
    hero.querySelector("h2").textContent = item.title;
    hero.querySelector(".hero-copy p").innerHTML = item.description;
    hero.querySelector(".hero-genre").innerHTML =
      `${item.genre} <span>•</span> ARCADE ORIGINAL`;
    hero.querySelector("[data-play]").dataset.play = item.id;
    hero.querySelector("[data-favorite]").dataset.favorite = item.id;
    hero.querySelector(".hero-pagination>span").innerHTML =
      `0${index + 1} <small>/ 03</small>`;
    hero.querySelectorAll("[data-slide]").forEach((b) => {
      b.classList.toggle("selected", Number(b.dataset.slide) === slide);
      b.setAttribute("aria-pressed", Number(b.dataset.slide) === slide);
    });
    render();
  }
  document.addEventListener("click", (e) => {
    const favorite = e.target.closest("[data-favorite]");
    if (favorite) {
      e.preventDefault();
      setFavorite(favorite.dataset.favorite);
      return;
    }
    const launch = e.target.closest("[data-play]");
    if (launch) {
      e.preventDefault();
      play(launch.dataset.play, e);
      return;
    }
    const nav = e.target.closest("[data-view]");
    if (nav) {
      navigate(nav.dataset.view);
      return;
    }
    const cat = e.target.closest("[data-category]");
    if (cat) {
      navigate("all", cat.dataset.category);
      return;
    }
    const filter = e.target.closest("[data-filter]");
    if (filter) {
      category = filter.dataset.filter;
      render();
      return;
    }
    const carousel = e.target.closest("[data-slide]");
    if (carousel) {
      setSlide(Number(carousel.dataset.slide));
      return;
    }
    const collection = e.target.closest("[data-collection]");
    if (collection) {
      navigate(
        "all",
        collection.dataset.collection === "puzzle"
          ? "Puzzle"
          : collection.dataset.collection === "quick"
            ? "Arcade"
            : "Action",
      );
      return;
    }
    if (
      $("sidebar").classList.contains("open") &&
      !e.target.closest("#sidebar,#menuToggle")
    ) {
      $("sidebar").classList.remove("open");
      $("menuToggle").setAttribute("aria-expanded", "false");
    }
  });
  $("searchInput").addEventListener("input", (e) => {
    query = e.target.value.trim();
    render();
  });
  $("sortSelect").addEventListener("change", (e) => {
    sort = e.target.value;
    render();
  });
  $("viewAll").onclick = () => navigate("all");
  $("randomGame").onclick = () => {
    if (!data) return;
    const games = data.games.filter(isAvailable);
    if (games.length) play(games[Math.floor(Math.random() * games.length)].id);
  };
  $("menuToggle").onclick = () => {
    const open = $("sidebar").classList.toggle("open");
    $("menuToggle").setAttribute("aria-expanded", open);
  };
  $("settingsButton").onclick = () => {
    showInfo(
      "Make yourself at home",
      `<p>Your arcade, your rules. Preferences are saved on this device.</p><label for="openMode">When I play a game</label><select id="openMode"><option value="page">Open in the arcade player</option><option value="same">Open game in this tab</option><option value="new">Open game in a new tab</option></select><p>Keyboard tip: press <kbd>/</kbd> to find a game instantly.</p><button class="primary-button" id="savePreferences">Done ${icon("check")}</button>`,
    );
    ExstArcade.bindOpenModeSelect();
    $("savePreferences").onclick = () => {
      $("infoDialog").close();
      toast("Your preferences are saved.");
    };
  };
  $("foldersButton").onclick = () => {
    if (!data) return;
    showInfo(
      "Your game collections",
      `<p>Handpicked folders from your editable arcade library.</p><div class="folder-links">${data.folders.map((folder) => `<a href="${escape(asset(`folder.html?id=${encodeURIComponent(folder.id)}`))}"><span>${icon("folder")} ${escape(folder.title)}</span><small>${folder.games.length} games ${icon("arrow-right")}</small></a>`).join("")}</div>`,
    );
  };
  $("newsButton").onclick = () =>
    showInfo(
      "Fresh from the arcade",
      `<span class="daily-chip">THE ORIGINALS ARE HERE</span><h3>Six little escapes. Zero downloads.</h3><p>Meet Neon Drift, Neon Snake, 2048, Cosmic Escape, Memory Match, and Brick Breaker. Each one is built into your arcade and ready to play.</p><h3>A home for your favorites</h3><p>Tap the heart on a game to save it. Your favorites, recent games, and high scores stay on this device.</p>`,
    );
  $("profileButton").onclick = () =>
    showInfo(
      "Hey, Player One.",
      `<p>This is your little corner of the arcade. No account needed — just you and your next high score.</p><div class="profile-stats"><div><strong>${recent.length}</strong><span>Games tried</span></div><div><strong>${Object.values(plays).reduce((a, b) => a + (Number(b) || 0), 0)}</strong><span>Total plays</span></div><div><strong>${favorites.length}</strong><span>Favorites</span></div></div><p>Progress is stored locally in this browser. Clear your browser data and your arcade gets a fresh start.</p>`,
    );
  $("aboutButton").onclick = () =>
    showInfo(
      "A little less scrolling.",
      `<p>A little more playing. Exst Arcade is a free, lightweight home for browser games — no accounts, subscriptions, or downloads required.</p><h3>Made for a quick escape</h3><p>Six original minigames are included. Keep building your collection by editing <code>website/data/games.js</code> and dropping your game files into <code>website/games/</code>.</p><p>Based on the <a href="https://github.com/learning-zone/website-templates/tree/master/hybrid-bootstrap-admin-template" target="_blank" rel="noopener">Hybrid Bootstrap Admin Template</a> by <a href="https://webthemez.com/" target="_blank" rel="noopener">WebThemez</a>, licensed under Creative Commons Attribution 3.0. Game artwork is AI-generated.</p>`,
    );
  $("closeDialog").onclick = () => $("infoDialog").close();
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
      $("searchInput").focus();
    }
    if (e.key === "Escape") {
      $("sidebar").classList.remove("open");
      $("menuToggle").setAttribute("aria-expanded", "false");
    }
  });
  function restoreRoute() {
    const p = new URLSearchParams(location.search);
    view = ["all", "recent", "favorites"].includes(p.get("view"))
      ? p.get("view")
      : "discover";
    category = ["Action", "Adventure", "Racing", "Puzzle", "Arcade"].includes(
      p.get("category"),
    )
      ? p.get("category")
      : "All";
    query = "";
    $("searchInput").value = "";
    render();
  }
  window.addEventListener("popstate", restoreRoute);
  ExstArcade.loadArcadeData()
    .then((result) => {
      data = result;
      restoreRoute();
    })
    .catch((error) => {
      $("gameGrid").innerHTML =
        `<div class="empty-state"><h3>The arcade couldn’t load</h3><p>${escape(error.message)}. Make sure <code>website/data/games.js</code> and <code>website/data/folders.js</code> are present, then try again.</p><button class="primary-button" id="retryLoad">Try again</button></div>`;
      $("retryLoad").addEventListener("click", () => location.reload());
    });
})();
