/* Six dependency-free games for Exst Arcade. All game state remains in this browser. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    canvas = $("canvas"),
    ctx = canvas.getContext("2d"),
    W = 720,
    H = 450;
  const configs = {
    "neon-drift": {
      title: "Neon Drift",
      symbol: "↗",
      intro:
        "Weave through the midnight traffic. Stay on the road and see how far you can go.",
      hint: "← → or A / D to change lanes. Dodge the traffic.",
      tip: "The city never sleeps. Neither does the traffic.",
    },
    "neon-snake": {
      title: "Neon Snake",
      symbol: "⌁",
      intro:
        "Collect glowing snacks, grow your snake, and don’t run into yourself — or the walls.",
      hint: "Arrow keys or W A S D to steer. Collect the coral squares.",
      tip: "One snack. Ten points. One more try.",
    },
    2048: {
      title: "2048",
      symbol: "✧",
      intro:
        "Slide the tiles. Match two of the same number to merge them. Can you make it all the way to 2048?",
      hint: "Arrow keys, W A S D, or swipe to move the tiles.",
      tip: "Make every move count.",
    },
    "cosmic-escape": {
      title: "Cosmic Escape",
      symbol: "✦",
      intro:
        "Pilot your ship through an asteroid field. Dodge the rocks and collect the golden stars.",
      hint: "Arrow keys / W A S D or drag to fly. Avoid asteroids.",
      tip: "A small ship in a very big universe.",
    },
    "memory-match": {
      title: "Memory Match",
      symbol: "♡",
      intro:
        "Sixteen cards. Eight perfect pairs. Flip two at a time and find every match in as few moves as you can.",
      hint: "Click or tap two cards to find a matching pair.",
      tip: "A little focus goes a long way.",
    },
    "brick-breaker": {
      title: "Brick Breaker",
      symbol: "▦",
      intro:
        "Keep the ball bouncing and clear every brick. You have three lives to make it happen.",
      hint: "Move mouse / touch, or use ← → to control the paddle.",
      tip: "Find your angle. Break the pattern.",
    },
  };
  const requested = new URLSearchParams(location.search).get("game");
  const id = configs[requested] ? requested : "neon-snake",
    config = configs[id];
  document.title = `${config.title} — Exst Arcade`;
  $("title").textContent = config.title;
  $("overlayTitle").textContent = config.title;
  $("overlaySymbol").textContent = config.symbol;
  $("instructions").textContent = config.intro;
  $("controlHint").textContent = config.hint;
  $("overlayTip").textContent = config.tip;
  if (id === "memory-match") {
    $("touchControls").hidden = true;
    $("scoreLabel").textContent = "POINTS";
  }
  let best = 0;
  try {
    best = Number(JSON.parse(localStorage.getItem(`exst-best-${id}`))) || 0;
  } catch {}
  $("best").textContent = best;
  let score = 0,
    running = false,
    paused = false,
    started = false,
    ended = false,
    last = 0,
    elapsed = 0,
    keys = {},
    state = {},
    raf = 0,
    memoryTimer = 0;
  function setScore(n) {
    score = Math.floor(n);
    $("score").textContent = score;
    if (score > best) {
      best = score;
      $("best").textContent = best;
      try {
        localStorage.setItem(`exst-best-${id}`, JSON.stringify(best));
      } catch {}
    }
  }
  function announce(text) {
    $("announcer").textContent = text;
  }
  function overlay(title, description, button) {
    $("overlay").hidden = false;
    $("overlayTitle").textContent = title;
    $("instructions").textContent = description;
    $("startButton").innerHTML = button + " <span>→</span>";
    $("overlayTip").textContent = ended
      ? "Your best score is saved. Ready for another round?"
      : config.tip;
  }
  function gameOver(win = false, message = "") {
    running = false;
    ended = true;
    paused = false;
    keys = {};
    $("pauseButton").disabled = true;
    cancelAnimationFrame(raf);
    overlay(
      win ? "Nicely played." : "One more try?",
      message || `You scored ${score} points. Your best is ${best}.`,
      "Play again",
    );
    announce(`${win ? "You won!" : "Game over."} Score: ${score}`);
  }
  function start() {
    cancelAnimationFrame(raf);
    clearTimeout(memoryTimer);
    score = 0;
    setScore(0);
    running = true;
    paused = false;
    started = true;
    ended = false;
    elapsed = 0;
    keys = {};
    state = {};
    $("overlay").hidden = true;
    $("pauseButton").disabled = false;
    $("pauseButton").textContent = "Ⅱ Pause";
    $("board2048").hidden = id !== "2048";
    $("memoryBoard").hidden = id !== "memory-match";
    canvas.hidden = ["2048", "memory-match"].includes(id);
    if (id === "neon-snake") initSnake();
    if (id === "2048") init2048();
    if (id === "memory-match") initMemory();
    if (id === "neon-drift") initDrift();
    if (id === "cosmic-escape") initCosmic();
    if (id === "brick-breaker") initBricks();
    last = performance.now();
    raf = requestAnimationFrame(loop);
    announce(`${config.title} started`);
  }
  function togglePause() {
    if (!started || ended) return;
    paused = !paused;
    keys = {};
    if (paused) {
      overlay(
        "Take a breather.",
        "Your game will be right here when you get back.",
        "Keep playing",
      );
      $("pauseButton").textContent = "▶ Resume";
      cancelAnimationFrame(raf);
    } else {
      $("overlay").hidden = true;
      $("pauseButton").textContent = "Ⅱ Pause";
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  $("startButton").onclick = () => {
    if (paused) togglePause();
    else start();
  };
  $("restartButton").onclick = start;
  $("pauseButton").onclick = togglePause;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running && !paused) togglePause();
  });
  function background(color = "#131925") {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
  }
  function glow(color, blur = 15) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() {
    ctx.shadowBlur = 0;
  }
  function roundRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }
  function text(value, x, y, color = "#aaa5bf", size = 12) {
    ctx.fillStyle = color;
    ctx.font = `${size}px Trebuchet MS`;
    ctx.textAlign = "center";
    ctx.fillText(value, x, y);
  }
  function random(min, max) {
    return Math.random() * (max - min) + min;
  }
  function loop(t) {
    if (!running || paused) return;
    const dt = Math.min((t - last) / 1000, 0.04);
    last = t;
    elapsed += dt;
    if (id === "neon-snake") updateSnake(dt);
    if (id === "neon-drift") updateDrift(dt);
    if (id === "cosmic-escape") updateCosmic(dt);
    if (id === "brick-breaker") updateBricks(dt);
    if (running && !paused) raf = requestAnimationFrame(loop);
  }
  const mapping = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    a: "left",
    d: "right",
    w: "up",
    s: "down",
  };
  function direction(dir) {
    if (!running || paused) return;
    if (id === "neon-snake") {
      const dirs = {
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
      };
      const next = dirs[dir];
      if (next.x !== -state.dir.x || next.y !== -state.dir.y) state.next = next;
    }
    if (id === "2048") move2048(dir);
    if (id === "neon-drift") {
      if (dir === "left") state.lane = Math.max(0, state.lane - 1);
      if (dir === "right") state.lane = Math.min(3, state.lane + 1);
    }
  }
  document.addEventListener("keydown", (e) => {
    if (mapping[e.key]) {
      e.preventDefault();
      const d = mapping[e.key];
      keys[d] = true;
      if (!e.repeat) direction(d);
    }
    if (e.code === "Space" && !e.target.closest("button")) {
      e.preventDefault();
      if (!started || ended) start();
      else togglePause();
    }
    if (e.key === "Escape" && running) {
      togglePause();
    }
  });
  document.addEventListener("keyup", (e) => {
    if (mapping[e.key]) keys[mapping[e.key]] = false;
  });
  window.addEventListener("blur", () => {
    keys = {};
  });
  document.querySelectorAll("[data-direction]").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      keys[b.dataset.direction] = true;
      direction(b.dataset.direction);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) =>
      b.addEventListener(ev, () => (keys[b.dataset.direction] = false)),
    );
  });
  let pointerStart;
  $("playArea").addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    pointerStart = { x: e.clientX, y: e.clientY };
    if (id === "brick-breaker" || id === "cosmic-escape") {
      e.preventDefault();
      $("playArea").setPointerCapture(e.pointerId);
      movePointer(e);
    }
  });
  $("playArea").addEventListener("pointermove", (e) => {
    if (id === "brick-breaker" || (id === "cosmic-escape" && e.buttons))
      movePointer(e);
  });
  $("playArea").addEventListener("pointerup", (e) => {
    if (!pointerStart) return;
    const dx = e.clientX - pointerStart.x,
      dy = e.clientY - pointerStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 20)
      direction(
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up",
      );
    pointerStart = null;
  });
  function movePointer(e) {
    if (!running || paused) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * H;
    if (id === "brick-breaker")
      state.paddle = Math.max(60, Math.min(W - 60, x));
    if (id === "cosmic-escape") {
      state.x = Math.max(22, Math.min(W - 22, x));
      state.y = Math.max(25, Math.min(H - 25, y));
    }
  }
  // NEON SNAKE — grid-based, with input buffered for each tick.
  function initSnake() {
    state = {
      snake: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ],
      dir: { x: 1, y: 0 },
      next: { x: 1, y: 0 },
      timer: 0,
      food: null,
    };
    snakeFood();
    drawSnake();
  }
  function snakeFood() {
    const cells = [];
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 28; x++)
        if (!state.snake.some((p) => p.x === x && p.y === y))
          cells.push({ x, y });
    if (!cells.length) {
      gameOver(true);
      return;
    }
    state.food = cells[Math.floor(Math.random() * cells.length)];
  }
  function updateSnake(dt) {
    state.timer += dt;
    if (state.timer < Math.max(0.07, 0.145 - score * 0.00025)) return;
    state.timer = 0;
    state.dir = state.next;
    const head = {
      x: state.snake[0].x + state.dir.x,
      y: state.snake[0].y + state.dir.y,
    };
    const food = head.x === state.food.x && head.y === state.food.y;
    const body = food ? state.snake : state.snake.slice(0, -1);
    if (
      head.x < 0 ||
      head.x >= 28 ||
      head.y < 0 ||
      head.y >= 18 ||
      body.some((p) => p.x === head.x && p.y === head.y)
    ) {
      gameOver();
      return;
    }
    state.snake.unshift(head);
    if (food) {
      setScore(score + 10);
      snakeFood();
    } else state.snake.pop();
    drawSnake();
  }
  function drawSnake() {
    background("#111f21");
    ctx.strokeStyle = "#203032";
    ctx.lineWidth = 0.6;
    for (let x = 10; x < W; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 25) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(710, y);
      ctx.stroke();
    }
    glow("#ff8b6f");
    roundRect(
      state.food.x * 25 + 13,
      state.food.y * 25 + 3,
      19,
      19,
      5,
      "#ff9279",
    );
    noGlow();
    state.snake.forEach((p, i) => {
      if (i === 0) glow("#89e3aa", 10);
      roundRect(
        p.x * 25 + 12,
        p.y * 25 + 2,
        21,
        21,
        5,
        i === 0 ? "#b8f4c4" : `hsl(155 47% ${Math.max(25, 58 - i)}%)`,
      );
      noGlow();
    });
  }
  // 2048 — merge once per move, spawn only when the board changes.
  function init2048() {
    state = { cells: Array(16).fill(0), won: false };
    spawnTile();
    spawnTile();
    draw2048();
  }
  function spawnTile() {
    const empty = state.cells
      .map((n, i) => (n ? null : i))
      .filter((i) => i !== null);
    if (empty.length)
      state.cells[empty[Math.floor(Math.random() * empty.length)]] =
        Math.random() < 0.9 ? 2 : 4;
  }
  function move2048(dir) {
    const before = state.cells.join(",");
    for (let line = 0; line < 4; line++) {
      const indices = Array.from({ length: 4 }, (_, i) =>
        dir === "left"
          ? line * 4 + i
          : dir === "right"
            ? line * 4 + 3 - i
            : dir === "up"
              ? i * 4 + line
              : (3 - i) * 4 + line,
      );
      const values = indices.map((i) => state.cells[i]).filter(Boolean),
        result = [];
      for (let i = 0; i < values.length; i++) {
        if (values[i] === values[i + 1]) {
          const n = values[i] * 2;
          result.push(n);
          setScore(score + n);
          i++;
        } else result.push(values[i]);
      }
      while (result.length < 4) result.push(0);
      indices.forEach((index, i) => (state.cells[index] = result[i]));
    }
    if (before !== state.cells.join(",")) {
      spawnTile();
      draw2048();
    }
    if (state.cells.some((n) => n >= 2048) && !state.won) {
      state.won = true;
      gameOver(
        true,
        `You reached 2048! Final score: ${score}. That’s some serious brain energy.`,
      );
      return;
    }
    if (!state.cells.includes(0)) {
      let possible = false;
      for (let i = 0; i < 16; i++) {
        if (i % 4 < 3 && state.cells[i] === state.cells[i + 1]) possible = true;
        if (i < 12 && state.cells[i] === state.cells[i + 4]) possible = true;
      }
      if (!possible)
        gameOver(
          false,
          `No more moves. You scored ${score} points. Try keeping your biggest tile in a corner.`,
        );
    }
  }
  function draw2048() {
    $("board2048").innerHTML = state.cells
      .map(
        (n) =>
          `<div class="tile" data-value="${n}" aria-label="${n || "Empty"}">${n || ""}</div>`,
      )
      .join("");
  }
  // MEMORY MATCH — all eight pairs, with a short mismatch reveal.
  function initMemory() {
    const symbols = ["✦", "♡", "☾", "⚡", "☀", "♣", "♠", "♫"];
    const cards = [...symbols, ...symbols];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    state = { cards, flipped: [], matched: [], moves: 0, busy: false };
    drawMemory();
    $("controlHint").textContent = config.hint;
  }
  function drawMemory() {
    const focused = document.activeElement?.dataset?.card;
    $("memoryBoard").innerHTML = state.cards
      .map((symbol, i) => {
        const matched = state.matched.includes(i),
          open = state.flipped.includes(i) || matched;
        return `<button class="memory-card ${open ? "revealed" : ""} ${matched ? "matched" : ""}" data-card="${i}" ${open ? "disabled" : ""} aria-label="${matched ? "Matched" : open ? "Revealed" : "Hidden"} card ${i + 1}${open ? ": " + symbol : ""}">${open ? symbol : "✧"}</button>`;
      })
      .join("");
    $("memoryBoard")
      .querySelectorAll("button")
      .forEach((b) => (b.onclick = () => flipCard(Number(b.dataset.card))));
    if (focused !== undefined) {
      const next =
        $("memoryBoard").querySelector(
          `[data-card="${focused}"]:not(:disabled)`,
        ) || $("memoryBoard").querySelector("button:not(:disabled)");
      next?.focus({ preventScroll: true });
    }
  }
  function flipCard(i) {
    if (
      !running ||
      paused ||
      state.busy ||
      state.matched.includes(i) ||
      state.flipped.includes(i)
    )
      return;
    state.flipped.push(i);
    if (state.flipped.length === 2) {
      state.moves++;
      $("controlHint").textContent =
        `${state.moves} moves · ${state.matched.length / 2} / 8 pairs found`;
      const [a, b] = state.flipped;
      if (state.cards[a] === state.cards[b]) {
        state.matched.push(a, b);
        state.flipped = [];
        setScore(score + 100);
        $("controlHint").textContent =
          `${state.moves} moves · ${state.matched.length / 2} / 8 pairs found`;
        announce(`Pair found. ${state.matched.length / 2} of 8.`);
        if (state.matched.length === 16) {
          setScore(800 + Math.max(0, 40 - state.moves) * 25);
          drawMemory();
          gameOver(
            true,
            `All eight pairs in ${state.moves} moves! You earned ${score} points.`,
          );
          return;
        }
      } else {
        state.busy = true;
        memoryTimer = setTimeout(() => {
          state.flipped = [];
          state.busy = false;
          drawMemory();
        }, 850);
      }
    }
    drawMemory();
  }
  // NEON DRIFT — four lanes, increasing traffic, distance scoring.
  function initDrift() {
    state = { lane: 1, x: 315, traffic: [], spawn: 0.7, distance: 0 };
    drawDrift();
  }
  function car(x, y, color, player = false) {
    glow(player ? "#ff765f" : "#628ac5", player ? 12 : 4);
    roundRect(x - 22, y - 38, 44, 77, 8, color);
    noGlow();
    roundRect(x - 16, y - 20, 32, 20, 3, "#111e30");
    roundRect(x - 16, y + 14, 32, 12, 3, "#162230");
    ctx.fillStyle = player ? "#ff665d" : "#cbd9ed";
    ctx.fillRect(x - 19, y + 31, 10, 4);
    ctx.fillRect(x + 9, y + 31, 10, 4);
    ctx.fillStyle = "#040b12";
    ctx.fillRect(x - 26, y - 20, 5, 15);
    ctx.fillRect(x + 21, y - 20, 5, 15);
    ctx.fillRect(x - 26, y + 17, 5, 15);
    ctx.fillRect(x + 21, y + 17, 5, 15);
  }
  function updateDrift(dt) {
    const speed = 185 + Math.min(elapsed * 3.3, 220);
    state.distance += dt * speed * 0.06;
    setScore(state.distance);
    state.x += (225 + state.lane * 90 - state.x) * Math.min(1, dt * 15);
    state.spawn -= dt;
    if (state.spawn <= 0) {
      state.traffic.push({
        lane: Math.floor(Math.random() * 4),
        y: -80,
        color: ["#516779", "#634b68", "#657060", "#9a6a62"][
          Math.floor(Math.random() * 4)
        ],
      });
      state.spawn = Math.max(0.48, 1.25 - elapsed * 0.008);
    }
    for (const c of state.traffic) {
      c.y += dt * speed;
      if (
        Math.abs(c.lane * 90 + 225 - state.x) < 43 &&
        Math.abs(c.y - 355) < 68
      ) {
        drawDrift();
        gameOver(
          false,
          `You made it ${score} city blocks. The night is young — take another drive.`,
        );
        return;
      }
    }
    state.traffic = state.traffic.filter((c) => c.y < H + 90);
    drawDrift();
  }
  function drawDrift() {
    background("#101722");
    for (let i = 0; i < 10; i++) {
      const yy = ((i * 65 + elapsed * 75) % 650) - 80;
      roundRect(12, yy, 125, 42, 2, i % 2 ? "#1d223b" : "#192e3d");
      roundRect(583, yy - 30, 125, 53, 2, i % 2 ? "#292039" : "#172e36");
      ctx.fillStyle = i % 2 ? "#644456" : "#2a6471";
      ctx.fillRect(20, yy + 5, 50, 3);
      ctx.fillRect(595, yy - 20, 75, 3);
    }
    ctx.fillStyle = "#1b2030";
    ctx.fillRect(180, 0, 360, H);
    glow("#d56774", 9);
    ctx.fillStyle = "#c96171";
    ctx.fillRect(176, 0, 3, H);
    ctx.fillStyle = "#6096a9";
    ctx.fillRect(541, 0, 3, H);
    noGlow();
    ctx.strokeStyle = "#566274";
    ctx.setLineDash([25, 25]);
    ctx.lineDashOffset = -elapsed * 200;
    for (let x = 270; x < 540; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    state.traffic.forEach((c) => car(c.lane * 90 + 225, c.y, c.color));
    car(state.x, 355, "#c1c6cd", true);
    text("MIDNIGHT EXPRESS", W / 2, 27, "#9399ae", 10);
  }
  // COSMIC ESCAPE — free movement, stars to collect, asteroids to avoid.
  function initCosmic() {
    state = {
      x: W / 2,
      y: H - 70,
      rocks: [],
      stars: [],
      spawn: 0.3,
      starSpawn: 1.5,
      points: 0,
      backdrop: Array.from({ length: 65 }, () => ({
        x: random(0, W),
        y: random(0, H),
        r: random(0.5, 1.8),
      })),
    };
    drawCosmic();
  }
  function updateCosmic(dt) {
    const speed = 285;
    if (keys.left) state.x -= speed * dt;
    if (keys.right) state.x += speed * dt;
    if (keys.up) state.y -= speed * dt;
    if (keys.down) state.y += speed * dt;
    state.x = Math.max(20, Math.min(W - 20, state.x));
    state.y = Math.max(25, Math.min(H - 25, state.y));
    state.spawn -= dt;
    state.starSpawn -= dt;
    state.points += dt * 3;
    setScore(state.points);
    if (state.spawn <= 0) {
      state.rocks.push({
        x: random(20, W - 20),
        y: -30,
        r: random(15, 32),
        speed: random(80, 140) + elapsed * 2,
        rot: random(0, 6),
      });
      state.spawn = Math.max(0.22, 0.65 - elapsed * 0.006);
    }
    if (state.starSpawn <= 0) {
      state.stars.push({ x: random(30, W - 30), y: -20 });
      state.starSpawn = 2;
    }
    for (const rock of state.rocks) {
      rock.y += rock.speed * dt;
      rock.rot += dt * 0.6;
      if (Math.hypot(rock.x - state.x, rock.y - state.y) < rock.r + 12) {
        drawCosmic();
        gameOver();
        return;
      }
    }
    for (const star of state.stars) {
      star.y += 100 * dt;
      if (Math.hypot(star.x - state.x, star.y - state.y) < 28) {
        star.y = H + 100;
        state.points += 25;
        setScore(state.points);
      }
    }
    state.rocks = state.rocks.filter((r) => r.y < H + 45);
    state.stars = state.stars.filter((s) => s.y < H + 30);
    drawCosmic();
  }
  function drawCosmic() {
    background("#171429");
    const gradient = ctx.createRadialGradient(560, 80, 10, 560, 80, 220);
    gradient.addColorStop(0, "#473360");
    gradient.addColorStop(1, "#171429");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#a8a0bb";
    state.backdrop.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x, (s.y + elapsed * 20) % H, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = "#685077";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(570, 85, 84, 18, -0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#594171";
    ctx.beginPath();
    ctx.arc(570, 85, 42, 0, Math.PI * 2);
    ctx.fill();
    state.rocks.forEach((r) => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.fillStyle = "#64546d";
      ctx.strokeStyle = "#aa859c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          rr = r.r * (i % 2 ? 0.83 : 1);
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#42384e";
      ctx.beginPath();
      ctx.arc(r.r * 0.2, -r.r * 0.25, r.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    state.stars.forEach((s) => {
      glow("#ffd489", 15);
      text("✦", s.x, s.y, "#ffdb93", 27);
      noGlow();
    });
    const { x, y } = state;
    glow("#ff8d82", 20);
    ctx.fillStyle = "#ffb278";
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 17);
    ctx.lineTo(x, y + 35 + Math.sin(elapsed * 30) * 7);
    ctx.lineTo(x + 7, y + 17);
    ctx.fill();
    noGlow();
    ctx.fillStyle = "#ddd3e3";
    ctx.beginPath();
    ctx.moveTo(x, y - 23);
    ctx.lineTo(x + 21, y + 21);
    ctx.lineTo(x, y + 12);
    ctx.lineTo(x - 21, y + 21);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ad5a73";
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 6, y + 10);
    ctx.lineTo(x - 6, y + 10);
    ctx.closePath();
    ctx.fill();
  }
  // BRICK BREAKER — paddle physics, three lives, thirty bricks.
  function initBricks() {
    state = {
      paddle: W / 2,
      ball: { x: W / 2, y: 330, vx: 170, vy: -235 },
      lives: 3,
      bricks: [],
    };
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 9; col++)
        state.bricks.push({
          x: 35 + col * 73,
          y: 50 + row * 27,
          w: 65,
          h: 19,
          row,
          alive: true,
        });
    drawBricks();
  }
  function updateBricks(dt) {
    if (keys.left) state.paddle -= 430 * dt;
    if (keys.right) state.paddle += 430 * dt;
    state.paddle = Math.max(60, Math.min(W - 60, state.paddle));
    const b = state.ball,
      prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 8) {
      b.x = 8;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > W - 8) {
      b.x = W - 8;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < 8) {
      b.y = 8;
      b.vy = Math.abs(b.vy);
    }
    if (
      b.vy > 0 &&
      prevY + 8 <= 410 &&
      b.y + 8 >= 410 &&
      Math.abs(b.x - state.paddle) < 64
    ) {
      b.y = 402;
      const angle = (((b.x - state.paddle) / 60) * Math.PI) / 3;
      const velocity = Math.min(440, Math.hypot(b.vx, b.vy) + 7);
      b.vx = Math.sin(angle) * velocity;
      b.vy = -Math.abs(Math.cos(angle) * velocity);
    }
    if (b.y > H + 10) {
      state.lives--;
      if (!state.lives) {
        gameOver();
        return;
      }
      state.ball = { x: state.paddle, y: 340, vx: random(-150, 150), vy: -250 };
    }
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      if (
        b.x + 8 > brick.x &&
        b.x - 8 < brick.x + brick.w &&
        b.y + 8 > brick.y &&
        b.y - 8 < brick.y + brick.h
      ) {
        brick.alive = false;
        if (prevY + 8 <= brick.y || prevY - 8 >= brick.y + brick.h) b.vy *= -1;
        else b.vx *= -1;
        setScore(score + 10);
        break;
      }
    }
    drawBricks();
    if (state.bricks.every((b) => !b.alive)) {
      setScore(score + state.lives * 100);
      gameOver(
        true,
        `Every brick cleared! ${state.lives} lives left. Final score: ${score}.`,
      );
    }
  }
  function drawBricks() {
    background("#111c30");
    ctx.strokeStyle = "#1e2b41";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const colors = ["#e48d84", "#d19bd9", "#a29ee9", "#76b1df", "#72c8c3"];
    state.bricks
      .filter((b) => b.alive)
      .forEach((b) => {
        glow(colors[b.row], 6);
        roundRect(b.x, b.y, b.w, b.h, 4, colors[b.row]);
        noGlow();
      });
    glow("#85c8f1", 14);
    roundRect(state.paddle - 55, 410, 110, 12, 6, "#83c8e8");
    ctx.fillStyle = "#f5d3c8";
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, 8, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    text("♡ ".repeat(state.lives), W / 2, 28, "#db9ba0", 17);
  }
  background();
})();
