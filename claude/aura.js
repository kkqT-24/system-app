/* ==========================================================
   RANK AURAS (Claude build)
   A living, emitting aura for every rank — soft flame-shaped
   plasma that pours up off the rank letter, tinted per rank and
   growing stronger as the rank climbs. Rank A burns as real fire,
   including flames licking off the EXP bar. Rank S pours dark
   violet energy with black smoke threaded through it.
   Drawn on small canvases around:
     • the rank badge letter in the Quests panel
     • the rank letter on the Quests module tile
     • the EXP bar (rank A only)
   ========================================================== */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* soft round sprite per colour, pre-rendered once */
  var spriteCache = {};
  function sprite(rgb, hot) {
    var key = rgb.join(",") + (hot ? "h" : "");
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    var core = hot ? "255,255,255" : rgb.map(function (v) { return Math.min(255, v + 90); }).join(",");
    gr.addColorStop(0, "rgba(" + core + ",1)");
    gr.addColorStop(0.25, "rgba(" + rgb.join(",") + ",0.85)");
    gr.addColorStop(0.6, "rgba(" + rgb.join(",") + ",0.25)");
    gr.addColorStop(1, "rgba(" + rgb.join(",") + ",0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    spriteCache[key] = c;
    return c;
  }
  /* dark smoke puff for rank S */
  var smokeSprite = (function () {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(6,0,16,0.9)");
    gr.addColorStop(0.5, "rgba(20,4,44,0.5)");
    gr.addColorStop(1, "rgba(20,4,44,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  })();

  /* per-rank look: colour stages over a particle's life, how much
     it emits, how tall it burns, how big the tongues are */
  var RANKS = {
    e: { stages: [[235, 238, 255], [178, 182, 208], [120, 124, 160]], rate: 0.10, rise: [0.35, 0.8], size: [5, 9], life: [700, 1100], spread: 0.55 },
    d: { stages: [[200, 255, 215], [70, 220, 120], [20, 120, 60]], rate: 0.14, rise: [0.45, 1.0], size: [5, 10], life: [750, 1150], spread: 0.6 },
    c: { stages: [[210, 235, 255], [80, 170, 255], [30, 80, 200]], rate: 0.18, rise: [0.5, 1.1], size: [6, 11], life: [800, 1200], spread: 0.65 },
    b: { stages: [[255, 248, 205], [255, 190, 50], [200, 110, 10]], rate: 0.22, rise: [0.55, 1.2], size: [6, 12], life: [800, 1250], spread: 0.7 },
    a: { stages: [[255, 225, 200], [255, 70, 50], [215, 20, 25], [95, 4, 8]], rate: 0.32, rise: [0.75, 1.6], size: [6, 14], life: [650, 1100], spread: 0.75, fire: true },
    s: { stages: [[225, 200, 255], [150, 80, 250], [90, 30, 200], [40, 10, 90]], rate: 0.36, rise: [0.7, 1.5], size: [7, 15], life: [800, 1350], spread: 0.8, smoke: true }
  };

  function Emitter(host, mount, pad) {
    this.host = host; this.pad = pad;
    this.cv = document.createElement("canvas");
    this.cv.className = "mx-aura-cv";
    this.cv.setAttribute("aria-hidden", "true");
    this.ctx = this.cv.getContext("2d");
    this.mount = mount;
    mount.insertBefore(this.cv, mount.firstChild);
    this.parts = []; this.acc = 0;
  }
  Emitter.prototype.layout = function () {
    var r = this.host.getBoundingClientRect();
    if (!r.width) return false;
    var mr = this.mount.getBoundingClientRect();
    var p = this.pad; /* [top, right, bottom, left] */
    var w = r.width + p[1] + p[3], h = r.height + p[0] + p[2];
    /* mount may be transformed (skewed letter): position in its own box */
    var ox = r.left - mr.left - p[3], oy = r.top - mr.top - p[0];
    if (this.mount === this.host) { ox = -p[3]; oy = -p[0]; }
    this.cv.style.left = ox + "px"; this.cv.style.top = oy + "px";
    this.cv.style.width = w + "px"; this.cv.style.height = h + "px";
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.W !== w || this.H !== h) {
      this.W = w; this.H = h;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.bx = p[3]; this.by = p[0]; this.bw = r.width; this.bh = r.height;
    return true;
  };
  Emitter.prototype.step = function (dt, cfg, mode, scale, am, ring) {
    am = am || 1; ring = ring || 1;
    var f = dt / 16.67;
    /* spawn */
    this.acc += cfg.rate * (mode === "bar" ? 2.2 : 1) * scale * dt / 16.67 * 3;
    while (this.acc >= 1) {
      this.acc--;
      var x, y;
      if (mode === "bar") {
        x = this.bx + rnd(0, this.bw);
        var bottom = Math.random() < 0.18;
        y = bottom ? this.by + this.bh : this.by + rnd(-1, 2);
      } else {
        /* around the letter: mostly its lower half and flanks, so the
           aura wraps the letter and pours upward off it */
        var a = rnd(-0.15, Math.PI + 0.15);
        var rx = (this.bw * 0.5 * cfg.spread + 2) * ring, ry = (this.bh * 0.5 * cfg.spread + 2) * ring;
        x = this.bx + this.bw / 2 + Math.cos(a) * rx * (Math.random() < 0.5 ? 1 : -1) * rnd(0.7, 1.15);
        y = this.by + this.bh / 2 + Math.sin(a) * ry * rnd(0.4, 1.05);
      }
      var sz = rnd(cfg.size[0], cfg.size[1]) * (mode === "bar" ? 0.75 : 1) * Math.sqrt(scale);
      this.parts.push({
        x: x, y: y, vx: rnd(-0.12, 0.12), vy: -rnd(cfg.rise[0], cfg.rise[1]) * (mode === "bar" ? 0.85 : 1),
        sz: sz, life: 0, max: rnd(cfg.life[0], cfg.life[1]) * (mode === "bar" ? 0.7 : 1),
        ph: rnd(0, 6.28), smoke: cfg.smoke && Math.random() < 0.28
      });
    }
    /* move + draw */
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    var t = performance.now() * 0.004;
    /* smoke first (normal blending), then light on top (additive) */
    for (var pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass ? "lighter" : "source-over";
      for (var i = this.parts.length - 1; i >= 0; i--) {
        var p = this.parts[i];
        if (pass === 0) {
          p.life += dt;
          if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
          /* curl: a little sideways wobble that grows as it rises,
             and the tongue drifts in toward the centre line */
          p.vx += Math.sin(t + p.ph + p.y * 0.08) * 0.03 * f;
          if (mode !== "bar") p.vx += ((this.bx + this.bw / 2) - p.x) * 0.0016 * f;
          p.vx *= Math.pow(0.96, f);
          p.vy *= Math.pow(cfg.fire ? 1.006 : 1.0, f);
          p.x += p.vx * f; p.y += p.vy * f;
        }
        if (!!p.smoke !== (pass === 0)) continue;
        var k = p.life / p.max;
        var grow = k < 0.3 ? 0.7 + k : 1 - (k - 0.3) * 1.1;
        var s = p.sz * Math.max(0.15, grow);
        var alpha = (k < 0.12 ? k / 0.12 : 1) * (1 - k) * (p.smoke ? 0.8 : 0.9) * am;
        var img;
        if (p.smoke) img = smokeSprite;
        else {
          var st = cfg.stages, si = Math.min(st.length - 1, Math.floor(k * st.length));
          img = sprite(st[si], si === 0 && cfg.fire);
        }
        ctx.globalAlpha = alpha;
        /* flame tongues are taller than wide */
        ctx.drawImage(img, p.x - s, p.y - s * 1.5, s * 2, s * 3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };
  Emitter.prototype.destroy = function () { this.cv.remove(); };

  /* ---------- bind to the app ---------- */
  function rankOf(el) { return el ? (el.getAttribute("data-rank") || "e").toLowerCase() : "e"; }
  var targets = [];
  var wrap = document.querySelector("#sec-quests .q-rank-wrap");
  var badgeLetter = wrap ? wrap.querySelector(".q-rank-letter") : null;
  if (wrap && badgeLetter) targets.push({
    host: badgeLetter, mount: wrap, pad: [44, 26, 10, 26], mode: "letter", scale: 1.15,
    rank: function () { return rankOf(wrap); }, active: function () { return true; },
    on: function () { wrap.classList.add("mx-aura"); }, off: function () { wrap.classList.remove("mx-aura"); }
  });
  var tileLetter = document.querySelector(".tab-tile .t-letter");
  if (tileLetter) targets.push({
    host: tileLetter, mount: tileLetter, pad: [30, 18, 6, 18], mode: "letter", scale: 0.5, alpha: 0.6, ring: 1.35,
    rank: function () { return rankOf(tileLetter); }, active: function () { return true; },
    on: function () {}, off: function () {}
  });
  var shell = document.querySelector("#sec-quests .q-bar-shell");
  if (shell && wrap) targets.push({
    host: shell, mount: shell, pad: [30, 8, 8, 8], mode: "bar", scale: 1,
    rank: function () { return rankOf(wrap); }, active: function () { return rankOf(wrap) === "a"; },
    on: function () { shell.classList.add("mx-fire"); }, off: function () { shell.classList.remove("mx-fire"); }
  });

  var last = performance.now();
  function frame(now) {
    /* ~30 fps: the flames already move by elapsed time */
    if (now - last < 30) { requestAnimationFrame(frame); return; }
    var dt = Math.min(50, now - last); last = now;
    var any = false;
    for (var i = 0; i < targets.length; i++) {
      var T = targets[i];
      var vis = !document.hidden && T.active() && T.host.getBoundingClientRect().width > 0;
      if (vis) {
        if (!T.E) { T.E = new Emitter(T.host, T.mount, T.pad); T.on(); }
        if (T.E.layout()) {
          var cfg = RANKS[T.rank()] || RANKS.e;
          T.E.step(dt, cfg, T.mode, T.scale, T.alpha, T.ring);
          any = true;
        }
      } else if (T.E && !T.active()) {
        T.E.destroy(); T.E = null; T.off();
      }
    }
    if (any) requestAnimationFrame(frame);
    else setTimeout(function () { last = performance.now(); requestAnimationFrame(frame); }, 300);
  }
  requestAnimationFrame(frame);
})();
