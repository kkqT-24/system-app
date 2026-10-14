/* ==========================================================
   CINEMATIC MOTION LAYER (Claude build)
   Watches the original app's own animation classes and layers
   cinematic effects on top: a particle/shockwave engine, warp
   streaks on boot, holographic tilt tiles, decoding text,
   panel glitch-in/out, and full-screen level/rank-up moments.
   It never changes app state — only visuals.
   ========================================================== */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var PAL = ["#8f5ef8", "#c3b8fe", "#da78f5", "#6f63f6", "#f2ecff", "#7dd7ff"];
  var RANK_COLORS = { e: "#b2b6d0", d: "#46dc78", c: "#50aaff", b: "#ffbe32", a: "#ff7a26", s: "#a855f7" };
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function center(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, r: r };
  }
  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }
  function restartClass(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms);
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  /* ============ FX ENGINE (one canvas, additive light) ============ */
  var cv = document.createElement("canvas");
  cv.id = "mxFx";
  cv.setAttribute("aria-hidden", "true");
  var flashEl = document.createElement("div");
  flashEl.id = "mxFlash";
  document.body.appendChild(cv);
  document.body.appendChild(flashEl);
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1;
  function size() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();
  window.addEventListener("resize", size);

  var sparks = [], rings = [], streaks = [], running = false, last = 0;

  function spark(x, y, o) {
    o = o || {};
    var n = o.n || 12;
    for (var i = 0; i < n; i++) {
      var a = o.angle != null ? o.angle + rnd(-o.spread || -0.5, o.spread || 0.5) : rnd(0, Math.PI * 2);
      var sp = rnd(o.min || 1.5, o.max || 6);
      sparks.push({
        x: x + (o.jx ? rnd(-o.jx, o.jx) : 0), y: y + (o.jy ? rnd(-o.jy, o.jy) : 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: o.gravity != null ? o.gravity : 0.05, drag: o.drag || 0.955,
        life: 0, max: rnd(o.life || 600, (o.life || 600) * 1.6),
        r: rnd(o.rmin || 0.8, o.rmax || 2.4), c: o.color || pick(PAL),
        tail: o.tail != null ? o.tail : 3
      });
    }
    go();
  }
  function ring(x, y, o) {
    o = o || {};
    rings.push({ x: x, y: y, r0: o.r0 || 4, r1: o.r1 || 60, life: 0, max: o.life || 520, c: o.color || "#c3b8fe", w: o.width || 2, delay: o.delay || 0 });
    go();
  }
  /* streaks fly outward from a center — warp speed */
  function warp(cx, cy, ms, count) {
    var t0 = performance.now();
    (function emit() {
      var el = performance.now() - t0;
      if (el > ms) return;
      var k = el / ms;
      for (var i = 0; i < (count || 6); i++) {
        var a = rnd(0, Math.PI * 2);
        var d = rnd(10, 60);
        streaks.push({
          x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, a: a,
          v: rnd(6, 14) * (1 + k * 2.5), acc: 1.07, len: rnd(20, 60),
          life: 0, max: rnd(420, 700), c: pick(PAL), w: rnd(0.8, 2)
        });
      }
      go();
      requestAnimationFrame(emit);
    })();
  }
  /* particles stream in from the edges and converge on a point */
  function converge(tx, ty, n, ms, color) {
    for (var i = 0; i < n; i++) {
      var a = rnd(0, Math.PI * 2), d = rnd(Math.max(W, H) * 0.45, Math.max(W, H) * 0.8);
      sparks.push({
        x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, tx: tx, ty: ty, home: true,
        sx: tx + Math.cos(a) * d, sy: ty + Math.sin(a) * d,
        life: -rnd(0, ms * 0.35), max: ms * rnd(0.55, 0.7), r: rnd(1, 2.6), c: color || pick(PAL), tail: 6
      });
    }
    go();
  }
  function flash(color, peak, ms) {
    flashEl.style.background = "radial-gradient(ellipse at 50% 45%, " + color + ", transparent 75%)";
    try {
      flashEl.animate([{ opacity: 0 }, { opacity: peak, offset: 0.15 }, { opacity: 0 }], { duration: ms || 600, easing: "ease-out" });
    } catch (e) {}
  }

  function go() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(ts) {
    var dt = Math.min(50, ts - last); last = ts;
    var f = dt / 16.67;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    var i, p, k;
    for (i = sparks.length - 1; i >= 0; i--) {
      p = sparks[i];
      p.life += dt;
      if (p.life < 0) continue;
      if (p.life >= p.max) { sparks.splice(i, 1); continue; }
      k = p.life / p.max;
      var px = p.x, py = p.y;
      if (p.home) {
        var e = k * k * (3 - 2 * k);
        p.x = p.sx + (p.tx - p.sx) * e; p.y = p.sy + (p.ty - p.sy) * e;
      } else {
        p.vx *= Math.pow(p.drag, f); p.vy = p.vy * Math.pow(p.drag, f) + p.g * f;
        p.x += p.vx * f; p.y += p.vy * f;
      }
      var alpha = p.home ? Math.min(1, k * 3) * (1 - Math.pow(k, 6)) : 1 - k;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = p.c; ctx.fillStyle = p.c;
      if (p.tail) {
        ctx.lineWidth = p.r; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.x - px) * p.tail, p.y - (p.y - py) * p.tail); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = alpha * 0.25;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, 6.2832); ctx.fill();
    }
    for (i = rings.length - 1; i >= 0; i--) {
      p = rings[i];
      p.life += dt;
      if (p.life < p.delay) continue;
      var lt = p.life - p.delay;
      if (lt >= p.max) { rings.splice(i, 1); continue; }
      k = lt / p.max;
      var ek = 1 - Math.pow(1 - k, 3);
      var rr = p.r0 + (p.r1 - p.r0) * ek;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = p.c; ctx.lineWidth = p.w * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.25;
      ctx.lineWidth = p.w * 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke();
    }
    for (i = streaks.length - 1; i >= 0; i--) {
      p = streaks[i];
      p.life += dt;
      if (p.life >= p.max) { streaks.splice(i, 1); continue; }
      k = p.life / p.max;
      p.v *= Math.pow(p.acc, f);
      p.x += Math.cos(p.a) * p.v * f; p.y += Math.sin(p.a) * p.v * f;
      var L = p.len + p.v * 2.5;
      ctx.globalAlpha = Math.min(1, k * 4) * (1 - k);
      ctx.strokeStyle = p.c; ctx.lineWidth = p.w; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - Math.cos(p.a) * L, p.y - Math.sin(p.a) * L); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (sparks.length || rings.length || streaks.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  /* ============ DECODING TEXT ============ */
  var GLYPHS = "ΞΣΔΛΠΦΨ#%&@<>/\\|01アカサタナハマヤラ▓▒░";
  function decode(el, opts) {
    if (!el || el.children.length) return;
    opts = opts || {};
    var final = el.textContent;
    if (!final || !final.trim()) return;
    var dur = opts.dur || Math.min(900, 260 + final.length * 32);
    var t0 = performance.now() + (opts.delay || 0);
    var lastWritten = null;
    if (el.__mxDecode) el.__mxDecode.cancel = true;
    var job = { cancel: false };
    el.__mxDecode = job;
    (function step(now) {
      if (job.cancel) return;
      if (lastWritten !== null && el.textContent !== lastWritten) return; /* app changed it — stop */
      var k = (now - t0) / dur;
      if (k < 0) { requestAnimationFrame(step); return; }
      if (k >= 1) { el.textContent = final; return; }
      var out = "";
      for (var i = 0; i < final.length; i++) {
        var ch = final[i];
        var reveal = i / final.length;
        if (ch === " " || reveal < k * 1.15 - 0.15) out += ch;
        else out += reveal < k * 1.15 + 0.1 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : (opts.blank ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0]);
      }
      el.textContent = out;
      lastWritten = out;
      requestAnimationFrame(step);
    })(performance.now());
  }

  /* ============ BANNERS / CINEMATIC MOMENTS ============ */
  var bars = document.createElement("div");
  bars.className = "mx-bars";
  document.body.appendChild(bars);
  var bannerBusy = 0, bannerQueue = [];
  function banner(kicker, main, sub, color, hold) {
    if (bannerBusy) { bannerQueue.push([kicker, main, sub, color, hold]); return; }
    showBanner(kicker, main, sub, color, hold);
  }
  function showBanner(kicker, main, sub, color, hold) {
    var b = document.createElement("div");
    b.className = "mx-banner";
    b.style.setProperty("--mx-c", color || "#c3b8fe");
    b.innerHTML = '<i class="mx-line t"></i><i class="mx-line b"></i><div class="mx-k"></div><div class="mx-main"></div>' + (sub ? '<div class="mx-sub"></div>' : "");
    b.querySelector(".mx-k").textContent = kicker;
    b.querySelector(".mx-main").textContent = main;
    if (sub) b.querySelector(".mx-sub").textContent = sub;
    document.body.appendChild(b);
    decode(b.querySelector(".mx-k"), { dur: 380 });
    decode(b.querySelector(".mx-main"), { dur: 620, delay: 120, blank: true });
    if (sub) decode(b.querySelector(".mx-sub"), { dur: 500, delay: 320, blank: true });
    bannerBusy++;
    setTimeout(function () { b.classList.add("out"); }, hold || 1500);
    setTimeout(function () {
      b.remove(); bannerBusy--;
      var nx = bannerQueue.shift();
      if (nx) setTimeout(function () { banner.apply(null, nx); }, 150);
    }, (hold || 1500) + 450);
  }
  function shake(el) { restartClass(el || document.querySelector(".main-inner"), "mx-shake", 520); }
  function punch(el) { restartClass(el || document.querySelector(".main-inner"), "mx-punch", 580); }

  var pendingLevel = null;
  function onLevelUp(levelBox) {
    if (pendingLevel) clearTimeout(pendingLevel);
    pendingLevel = setTimeout(function () {
      pendingLevel = null;
      if (Date.now() - lastRankFx < 4000) return;
      var lvEl = document.querySelector("#sec-quests .q-lv b");
      var lv = lvEl ? lvEl.textContent : "";
      var cx = W / 2, cy = H / 2;
      if (visible(levelBox)) { var c = center(levelBox); cx = c.x; cy = c.y; }
      flash("rgba(143,94,248,0.9)", 0.55, 700);
      ring(cx, cy, { r1: Math.max(W, H) * 0.8, life: 900, width: 3, color: "#c3b8fe" });
      ring(cx, cy, { r1: Math.max(W, H) * 0.5, life: 800, width: 2, color: "#da78f5", delay: 120 });
      spark(cx, cy, { n: 46, min: 3, max: 11, life: 900, gravity: 0.08, tail: 4 });
      warp(W / 2, H / 2, 380, 5);
      shake();
      buzz([18, 40, 30]);
      banner("System notice", "Level Up", lv ? "Now level " + lv : "", "#c3b8fe", 1500);
    }, 40);
  }
  var lastRankFx = 0;
  function onRankUp(rankEl) {
    if (pendingLevel) { clearTimeout(pendingLevel); pendingLevel = null; }
    if (Date.now() - lastRankFx < 4000) return;
    lastRankFx = Date.now();
    var r = (rankEl.getAttribute("data-rank") || "e").toLowerCase();
    var col = RANK_COLORS[r] || "#c3b8fe";
    bars.classList.add("on");
    converge(W / 2, H / 2, 70, 900, col);
    setTimeout(function () {
      flash(col, 0.75, 900);
      ring(W / 2, H / 2, { r1: Math.max(W, H), life: 1100, width: 4, color: col });
      ring(W / 2, H / 2, { r1: Math.max(W, H) * 0.6, life: 900, width: 2, color: "#ffffff", delay: 100 });
      spark(W / 2, H / 2, { n: 90, min: 4, max: 16, life: 1200, gravity: 0.06, color: col, tail: 5 });
      spark(W / 2, H / 2, { n: 30, min: 2, max: 8, life: 1000, gravity: 0.04, tail: 4 });
      warp(W / 2, H / 2, 600, 8);
      shake(); buzz([30, 50, 60, 50, 90]);
      banner("The System has granted you a new rank", "Rank " + r.toUpperCase(), "", col, 2100);
    }, 700);
    setTimeout(function () { bars.classList.remove("on"); }, 3200);
  }
  var lastWorkoutFx = 0;
  function onWorkoutComplete(box) {
    if (Date.now() - lastWorkoutFx < 5000) return;
    lastWorkoutFx = Date.now();
    var c = center(box);
    ring(c.x, c.y, { r1: W * 0.9, life: 900, width: 3, color: "#c3b8fe" });
    spark(c.x, c.y, { n: 40, min: 3, max: 10, life: 900, jx: c.w / 2, gravity: 0.1, tail: 4 });
    flash("rgba(143,94,248,0.8)", 0.4, 600);
    punch(); buzz([20, 40, 20]);
    banner("Daily quest", "Complete", "Minimum reps reached", "#c3b8fe", 1400);
  }

  /* ============ PANELS ============ */
  /* module open/close: no particles — RGB-split flash, decoding title, glitch tear */
  function onPanelOpen(sec) {
    restartClass(sec, "mx-chroma", 460);
    punch();
    decode(sec.querySelector(".s-name"), { dur: 520, delay: 180 });
    decode(sec.querySelector(".s-state"), { dur: 520, delay: 300 });
  }
  function onPanelClose(sec) {
    sec.classList.add("mx-tear");
    setTimeout(function () { sec.classList.remove("mx-tear"); }, 300);
  }
  function onCollapse() { buzz(10); }
  function onExpand() { setTimeout(shineTiles, 500); }
  function onShowcaseEnter() {
    var names = document.querySelectorAll(".tab-tile .t-name");
    for (var i = 0; i < names.length; i++) decode(names[i], { dur: 480, delay: 60 + i * 60 });
    setTimeout(shineTiles, 900);
  }
  function onMainArrive() {
    decode(document.getElementById("mainTitle"), { dur: 800, delay: 150 });
    decode(document.getElementById("mainGreet"), { dur: 700, delay: 380 });
  }

  /* ============ BOOT ============ */
  function onBootFly() {
    flash("rgba(195,184,254,0.9)", 0.35, 500);
    warp(W / 2, H * 0.42, 1000, 9);
    ring(W / 2, H * 0.42, { r1: Math.max(W, H), life: 1000, width: 3 });
    buzz(25);
  }
  function onBootDissolve() {
    flash("rgba(143,94,248,0.9)", 0.4, 800);
    spark(W / 2, H * 0.45, { n: 50, min: 2, max: 10, life: 900, gravity: -0.02, jx: W * 0.3, jy: H * 0.2 });
  }

  /* ============ HOLOGRAPHIC TILES ============ */
  var tiles = document.querySelectorAll(".tab-tile");
  for (var ti = 0; ti < tiles.length; ti++) {
    var sh = document.createElement("span"); sh.className = "mx-sheen"; sh.setAttribute("aria-hidden", "true");
    var gl = document.createElement("span"); gl.className = "mx-glint"; gl.setAttribute("aria-hidden", "true");
    tiles[ti].insertBefore(gl, tiles[ti].firstChild);
    tiles[ti].insertBefore(sh, tiles[ti].firstChild);
    bindTilt(tiles[ti]);
  }
  function bindTilt(t) {
    function set(e) {
      var sc = document.getElementById("showcase");
      if (sc && (sc.classList.contains("busy") || sc.classList.contains("collapsing"))) { reset(); return; }
      var r = t.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      nx = Math.max(-0.5, Math.min(0.5, nx)); ny = Math.max(-0.5, Math.min(0.5, ny));
      var ang = Math.min(14, Math.sqrt(nx * nx + ny * ny) * 26);
      t.classList.add("mx-tilting");
      t.style.rotate = (-ny).toFixed(3) + " " + nx.toFixed(3) + " 0 " + ang.toFixed(2) + "deg";
      t.style.setProperty("--mx-x", ((nx + 0.5) * 100).toFixed(1) + "%");
      t.style.setProperty("--mx-y", ((ny + 0.5) * 100).toFixed(1) + "%");
      t.style.setProperty("--mx-h", (100 - (nx + 0.5) * 100).toFixed(1) + "%");
    }
    function reset() {
      t.classList.remove("mx-tilting");
      t.style.rotate = "";
    }
    t.addEventListener("pointerdown", set);
    t.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse" || t.classList.contains("mx-tilting")) set(e); });
    t.addEventListener("pointerup", reset);
    t.addEventListener("pointercancel", reset);
    t.addEventListener("pointerleave", reset);
    t.addEventListener("click", reset);
  }
  function shineTiles() {
    var sc = document.getElementById("showcase");
    if (!sc || sc.classList.contains("is-hidden") || sc.classList.contains("busy") || document.hidden) return;
    for (var i = 0; i < tiles.length; i++) {
      (function (t, d) { setTimeout(function () { restartClass(t, "mx-shine", 1000); }, d); })(tiles[i], i * 90);
    }
  }
  setInterval(shineTiles, 7000);

  /* ============ TAP FEEDBACK ============ */
  var TAPPABLE = "button, .tab-tile, .q-row, .t-row, [role='button'], .enter-btn";
  document.addEventListener("pointerdown", function (e) {
    var t = e.target.closest ? e.target.closest(TAPPABLE) : null;
    if (!t || t.closest("canvas")) return;
    /* tiles and the handle open/close modules — no particles there */
    if (t.classList.contains("tab-tile") || t.id === "tabsHandle") return;
    ring(e.clientX, e.clientY, { r0: 2, r1: 30, life: 380, width: 1.5 });
    spark(e.clientX, e.clientY, { n: 6, min: 1, max: 3.5, life: 380, gravity: 0, tail: 2, rmax: 1.6 });
  }, { passive: true, capture: true });

  /* workouts: floating +N and a pop on the count */
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".w-step") : null;
    if (!b) return;
    var d = parseInt(b.getAttribute("data-delta"), 10) || 0;
    var ex = b.closest(".w-ex");
    var exKey = ex ? ex.getAttribute("data-ex") : null;
    if (d > 0) {
      var c = center(b);
      var f = document.createElement("div");
      f.className = "mx-float";
      f.textContent = "+" + d;
      f.style.left = c.x + "px"; f.style.top = (c.y - 6) + "px";
      if (d >= 10) f.style.fontSize = "26px";
      document.body.appendChild(f);
      try {
        var an = f.animate([
          { transform: "translate(-50%,-50%) scale(0.6)", opacity: 0 },
          { transform: "translate(-50%,-110%) scale(1.15)", opacity: 1, offset: 0.25 },
          { transform: "translate(-50%,-260%) scale(0.9)", opacity: 0 }
        ], { duration: 820, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" });
        an.onfinish = function () { f.remove(); };
      } catch (err) { setTimeout(function () { f.remove(); }, 850); }
      if (d >= 10) { ring(c.x, c.y, { r1: 54, life: 480, width: 2 }); buzz(12); } else buzz(6);
    }
    setTimeout(function () {
      var cnt = exKey ? document.querySelector('.w-ex[data-ex="' + exKey + '"] .w-ex-count b') : null;
      if (cnt) restartClass(cnt, "mx-pop", 450);
    }, 0);
  });

  /* ============ DEPTH PARALLAX ============ */
  var px = 0, py = 0, tx = 0, ty = 0;
  window.addEventListener("pointermove", function (e) { tx = (e.clientX / W - 0.5); ty = (e.clientY / H - 0.5); }, { passive: true });
  window.addEventListener("pointerdown", function (e) { tx = (e.clientX / W - 0.5); ty = (e.clientY / H - 0.5); }, { passive: true });
  var mainEl = document.getElementById("main");
  var glow = mainEl ? mainEl.querySelector(".bg-glow") : null;
  var amb = mainEl ? mainEl.querySelector("canvas.ambient") : null;
  var rings3 = document.querySelector(".main-rings-wrap");
  (function drift(ts) {
    if (mainEl && !mainEl.classList.contains("is-hidden") && !document.hidden) {
      var dx = Math.sin(ts * 0.00013) * 0.12, dy = Math.cos(ts * 0.00011) * 0.1;
      px += (tx + dx - px) * 0.04; py += (ty + dy - py) * 0.04;
      if (glow) glow.style.translate = (-px * 34).toFixed(1) + "px " + (-py * 26).toFixed(1) + "px";
      if (amb) amb.style.translate = (-px * 14).toFixed(1) + "px " + (-py * 10).toFixed(1) + "px";
      if (rings3) rings3.style.translate = (px * 10).toFixed(1) + "px " + (py * 8).toFixed(1) + "px";
    }
    requestAnimationFrame(drift);
  })(0);

  /* ============ WATCH THE APP ============ */
  function added(m, cls) {
    return m.target.classList.contains(cls) && !((" " + (m.oldValue || "") + " ").indexOf(" " + cls + " ") >= 0);
  }
  function removed(m, cls) {
    return !m.target.classList.contains(cls) && ((" " + (m.oldValue || "") + " ").indexOf(" " + cls + " ") >= 0);
  }
  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "attributes") {
        var t = m.target;
        if (!t.classList) continue;
        if (t.classList.contains("section")) {
          if (added(m, "assembling")) onPanelOpen(t);
          if (added(m, "closing")) onPanelClose(t);
        } else if (t.id === "showcase") {
          if (added(m, "collapsing")) onCollapse();
          if (added(m, "expanding")) onExpand();
          if (added(m, "enter")) onShowcaseEnter();
        } else if (t.id === "main") {
          if (added(m, "arrive") || removed(m, "is-hidden")) onMainArrive();
        } else if (t.classList.contains("boot-inner")) {
          if (added(m, "fly")) onBootFly();
          if (added(m, "dissolve")) onBootDissolve();
        } else if (t.classList.contains("q-level")) {
          if (added(m, "level-glow")) onLevelUp(t);
        } else if (t.classList.contains("q-rank") && !t.classList.contains("q-rank-burn-clone")) {
          if (added(m, "rank-arrive")) onRankUp(t);
        } else if (t.classList.contains("w-total")) {
          if (added(m, "celebrate")) onWorkoutComplete(t);
        } else if (t.classList.contains("q-row") || t.classList.contains("t-row")) {
          if (added(m, "bursting") && visible(t)) {
            var c = center(t);
            ring(c.x, c.y, { r1: c.w * 0.6, life: 520, width: 2 });
            spark(c.x, c.y, { n: 16, min: 2, max: 7, jx: c.w * 0.35, life: 600, gravity: -0.03 });
            buzz(14);
          }
        }
      } else if (m.type === "childList") {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1 && n.classList.contains("q-gain")) {
            var shell = document.querySelector("#sec-quests .q-bar-shell");
            if (visible(shell)) {
              restartClass(shell, "mx-surge", 800);
              var fill = shell.querySelector(".q-bar-fill");
              var fr = (fill || shell).getBoundingClientRect();
              spark(fr.right, fr.top + fr.height / 2, { n: 14, min: 1, max: 5, life: 520, gravity: 0 });
            }
          }
        }
      }
    }
  });
  /* shared with quests.js */
  window.__mx = { spark: spark, ring: ring, flash: flash, banner: banner, shake: shake, warp: warp, converge: converge, buzz: buzz };

  mo.observe(document.body, { attributes: true, attributeFilter: ["class"], attributeOldValue: true, subtree: true, childList: true });
})();
