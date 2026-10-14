/* ==========================================================
   QUEST DETAIL + SYSTEM CONSOLE (Claude build)
   • Secret Quest / Prayer Quest popup: sigil, hazard strip,
     objective / stakes blocks, draining timer bar, real cracks
   • Fulfill: card collapses into a pillar of light (prayer:
     golden rays). Defy: card shatters into falling shards.
   • Hidden Quest box: seal sigil, drifting red fog, glitching
     ???????? and a "break the seal" prompt
   • System Console: set level / EXP / rank, preview quests
   ========================================================== */
(function () {
  "use strict";
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- rune ring SVG (shared by both seals) ---------------- */
  function sigilSVG(cls) {
    var ticks = "", runes = "";
    for (var i = 0; i < 48; i++) {
      var a = i / 48 * Math.PI * 2, r1 = 46, r2 = i % 4 ? 43.5 : 41;
      ticks += '<line x1="' + (50 + Math.cos(a) * r1).toFixed(2) + '" y1="' + (50 + Math.sin(a) * r1).toFixed(2) + '" x2="' + (50 + Math.cos(a) * r2).toFixed(2) + '" y2="' + (50 + Math.sin(a) * r2).toFixed(2) + '"/>';
    }
    var glyphs = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ";
    for (var j = 0; j < 16; j++) {
      var b = j / 16 * Math.PI * 2;
      runes += '<text x="' + (50 + Math.cos(b) * 35).toFixed(2) + '" y="' + (50 + Math.sin(b) * 35).toFixed(2) + '" transform="rotate(' + (b * 180 / Math.PI + 90).toFixed(1) + ' ' + (50 + Math.cos(b) * 35).toFixed(2) + ' ' + (50 + Math.sin(b) * 35).toFixed(2) + ')">' + glyphs[j] + '</text>';
    }
    return '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true">' +
      '<g class="r1"><circle cx="50" cy="50" r="48"/><g class="ticks">' + ticks + '</g></g>' +
      '<g class="r2"><circle cx="50" cy="50" r="39"/><g class="runes">' + runes + '</g><circle cx="50" cy="50" r="30"/></g>' +
      '<g class="r3"><polygon points="50,24 72.5,63 27.5,63"/><polygon points="50,76 27.5,37 72.5,37"/><circle cx="50" cy="50" r="9"/></g>' +
      '</svg>';
  }

  /* ---------------- procedural cracks for DEFY ---------------- */
  function crackPath(x, y, ang, len, depth, out) {
    var pts = [[x, y]], cx = x, cy = y, seg = 5 + ((Math.random() * 4) | 0);
    for (var i = 0; i < seg; i++) {
      ang += rnd(-0.45, 0.45);
      var l = len / seg;
      cx += Math.cos(ang) * l; cy += Math.sin(ang) * l;
      pts.push([cx, cy]);
      if (depth > 0 && Math.random() < 0.3) crackPath(cx, cy, ang + rnd(-1.1, 1.1) * (Math.random() < 0.5 ? 1 : -1), len * rnd(0.3, 0.5), depth - 1, out);
    }
    out.push(pts);
  }
  function crackSVG(stage, ix, iy) {
    var paths = [];
    var n = stage === 1 ? 4 : stage === 2 ? 6 : 9;
    var len = stage === 1 ? 30 : stage === 2 ? 55 : 85;
    for (var i = 0; i < n; i++) crackPath(ix, iy, i / n * Math.PI * 2 + rnd(-0.3, 0.3), len * rnd(0.7, 1.2), stage, paths);
    var d = paths.map(function (p) { return "M" + p.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("L"); }).join("");
    var ring = "";
    if (stage === 3) {
      var rp = [];
      for (var k = 0; k <= 14; k++) { var a = k / 14 * Math.PI * 2, rr = 11 + rnd(-2, 2); rp.push((ix + Math.cos(a) * rr).toFixed(1) + " " + (iy + Math.sin(a) * rr * 1.4).toFixed(1)); }
      ring = '<path d="M' + rp.join("L") + '" />';
    }
    return '<svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><g class="glow"><path d="' + d + '"/>' + ring + '</g><g class="core"><path d="' + d + '"/>' + ring + '</g></svg>';
  }

  /* ================= SECRET / PRAYER QUEST CARD ================= */
  var card = document.getElementById("sqCard");
  var overlay = document.getElementById("sqOverlay");
  if (card && overlay) {
    var head = card.querySelector(".sq-head");
    var task = document.getElementById("sqTask");
    var exp = document.getElementById("sqExp");
    var timer = document.getElementById("sqTimer");
    card.insertBefore(el("div", "mx-sq-hazard"), card.firstChild);
    card.insertBefore(el("div", "mx-sq-scan"), card.firstChild);
    card.insertBefore(el("div", "mx-sq-rays"), card.firstChild);
    card.insertBefore(el("div", "mx-sq-rise"), card.firstChild);
    var sig = el("div", "mx-sq-sigil", sigilSVG("mx-sigil"));
    card.insertBefore(sig, head);
    card.insertBefore(el("div", "mx-sq-halo"), head);
    task.parentNode.insertBefore(el("div", "mx-sq-label", "<i></i><span>Objective</span><i></i>"), task);
    var stakes = el("div", "mx-sq-stakes mono", '<span class="pen">Defy or timeout <b>&minus;10 EXP</b></span>');
    timer.parentNode.insertBefore(stakes, timer.nextSibling);
    var tbar = el("div", "mx-sq-tbar", "<i></i>");
    timer.parentNode.insertBefore(tbar, timer.nextSibling);
    var tfill = tbar.firstChild;
    var crack = card.querySelectorAll(".sq-cracks");
    function rollCracks() {
      var ix = rnd(55, 85), iy = rnd(100, 125); /* impact near the DEFY button */
      for (var c = 0; c < crack.length; c++) crack[c].innerHTML = crackSVG(c + 1, ix, iy);
    }
    rollCracks();
    function syncTimer() {
      var m = /(\d+):(\d+)/.exec(timer.textContent || "");
      if (!m) return;
      var left = (+m[1]) * 60 + (+m[2]);
      var k = Math.max(0, Math.min(1, left / 900));
      tfill.style.width = (k * 100).toFixed(2) + "%";
      card.classList.toggle("mx-urgent", left <= 120);
    }
    new MutationObserver(syncTimer).observe(timer, { childList: true, characterData: true, subtree: true });
    new MutationObserver(function () {
      if (overlay.classList.contains("show")) {
        var w = card.classList.contains("white");
        head.innerHTML = w ? "&#10013; Prayer Quest &#10013;" : "&#9888; Secret Quest &#9888;";
        var sub = card.querySelector(".sq-sub");
        if (sub) sub.textContent = w ? "A call from above" : "Urgent directive from the System";
        rollCracks(); syncTimer();
        card.classList.remove("mx-arrive"); void card.offsetWidth; card.classList.add("mx-arrive");
        clearTimeout(card.__arr); card.__arr = setTimeout(function () { card.classList.remove("mx-arrive"); }, 950);
        if (window.__mx) window.__mx.buzz(card.classList.contains("white") ? 15 : [30, 40, 30]);
      }
    }).observe(overlay, { attributes: true, attributeFilter: ["class"] });

    /* ---------- fulfill / defy finales ---------- */
    window.__mxSqFx = function (type, q, src) {
      if (RM || !window.__mx) return false;
      var FX = window.__mx;
      var r = src.getBoundingClientRect();
      var white = !!q.white;
      var testing = window.__mxSqTesting; window.__mxSqTesting = false;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      function cloneCard() {
        var c = src.cloneNode(true);
        c.removeAttribute("id");
        var ids = c.querySelectorAll("[id]");
        for (var i = 0; i < ids.length; i++) ids[i].removeAttribute("id");
        c.classList.remove("fulfilling", "shake", "cracking", "mx-arrive");
        c.classList.add("mx-sq-ghost");
        c.style.cssText = "position:fixed;margin:0;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;animation:none;opacity:1;filter:none;z-index:93;pointer-events:none;";
        return c;
      }
      if (type === "fulfill") {
        var g = cloneCard();
        document.body.appendChild(g);
        var col = white ? "#ffe9a3" : "#ff2d55";
        g.animate([
          { transform: "none", filter: "brightness(1)", opacity: 1 },
          { transform: "scale(1.04)", filter: "brightness(2.4) saturate(1.4)", opacity: 1, offset: 0.25 },
          { transform: "scaleX(0.06) scaleY(1.15)", filter: "brightness(4)", opacity: 1, offset: 0.62 },
          { transform: "scaleX(0.02) scaleY(1.6) translateY(-30%)", filter: "brightness(6)", opacity: 0 }
        ], { duration: 820, easing: "cubic-bezier(0.6,0,0.3,1)" }).onfinish = function () { g.remove(); };
        /* the pillar of light it becomes */
        var beam = el("div", "mx-beam" + (white ? " holy" : ""));
        beam.style.left = cx + "px"; beam.style.top = "0px"; beam.style.height = (r.bottom) + "px";
        document.body.appendChild(beam);
        beam.animate([
          { opacity: 0, transform: "translateX(-50%) scaleX(0.2)" },
          { opacity: 1, transform: "translateX(-50%) scaleX(1)", offset: 0.55 },
          { opacity: 0, transform: "translateX(-50%) scaleX(2.4)" }
        ], { duration: 1100, delay: 380, easing: "ease-out", fill: "backwards" }).onfinish = function () { beam.remove(); };
        if (white) {
          var rays = el("div", "mx-holy-rays");
          rays.style.left = cx + "px"; rays.style.top = cy + "px";
          document.body.appendChild(rays);
          rays.animate([
            { opacity: 0, transform: "translate(-50%,-50%) scale(0.3) rotate(0deg)" },
            { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(25deg)", offset: 0.3 },
            { opacity: 0, transform: "translate(-50%,-50%) scale(1.6) rotate(60deg)" }
          ], { duration: 1900, easing: "ease-out" }).onfinish = function () { rays.remove(); };
        }
        setTimeout(function () {
          FX.flash(white ? "rgba(255,240,190,0.95)" : "rgba(255,60,90,0.85)", white ? 0.7 : 0.45, 700);
          FX.ring(cx, cy, { r1: Math.max(innerWidth, innerHeight) * 0.7, life: 900, width: 3, color: col });
          FX.spark(cx, cy, { n: 50, min: 2, max: 9, angle: -Math.PI / 2, spread: 1.3, gravity: -0.05, life: 1300, color: col, jx: 30 });
          FX.spark(cx, cy, { n: 24, min: 1, max: 5, gravity: -0.03, life: 1500, color: white ? "#ffffff" : "#ffb3c1" });
          FX.buzz([20, 30, 40]);
          FX.banner(white ? "The System has heard you" : "Secret quest", white ? "Prayer Received" : "Quest Complete",
            testing ? "Test run · no EXP change" : (q.exp > 0 ? "+" + q.exp + " EXP" : (white ? "Blessing granted" : "")), white ? "#ffd700" : "#ff4d6d", 1700);
        }, 520);
        return true;
      }
      /* DEFY / EXPIRE: the card shatters into falling shards */
      var cols = 3, rows = 4, pts = [];
      for (var y = 0; y <= rows; y++) {
        pts.push([]);
        for (var x = 0; x <= cols; x++) {
          var edgeX = x === 0 || x === cols, edgeY = y === 0 || y === rows;
          pts[y].push([x / cols * 100 + (edgeX ? 0 : rnd(-11, 11)), y / rows * 100 + (edgeY ? 0 : rnd(-8, 8))]);
        }
      }
      var shards = [];
      for (var yy = 0; yy < rows; yy++) for (var xx = 0; xx < cols; xx++) {
        var a = pts[yy][xx], b = pts[yy][xx + 1], c2 = pts[yy + 1][xx + 1], d = pts[yy + 1][xx];
        var flip = Math.random() < 0.5;
        shards.push(flip ? [a, b, c2] : [a, b, d]);
        shards.push(flip ? [a, c2, d] : [b, c2, d]);
      }
      shards.forEach(function (tri, i) {
        var s = cloneCard();
        s.style.clipPath = "polygon(" + tri.map(function (p) { return p[0].toFixed(1) + "% " + p[1].toFixed(1) + "%"; }).join(",") + ")";
        var mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        s.style.transformOrigin = mx + "% " + my + "%";
        document.body.appendChild(s);
        var dx = (mx - 50) * rnd(2.5, 5), dy = (my - 50) * rnd(1.5, 3) + rnd(160, 420);
        var rot = rnd(-140, 140);
        s.animate([
          { transform: "none", filter: "brightness(1.6)", opacity: 1 },
          { transform: "translate(" + (dx * 0.15).toFixed(0) + "px," + (-rnd(10, 40)).toFixed(0) + "px) rotate(" + (rot * 0.2).toFixed(0) + "deg)", opacity: 1, offset: 0.18 },
          { transform: "translate(" + dx.toFixed(0) + "px," + dy.toFixed(0) + "px) rotate(" + rot.toFixed(0) + "deg) scale(0.7)", filter: "brightness(0.6)", opacity: 0 }
        ], { duration: rnd(900, 1300), delay: i * 6, easing: "cubic-bezier(0.3,0.1,0.6,1)", fill: "backwards" }).onfinish = function () { s.remove(); };
      });
      FX.flash("rgba(255,30,60,0.9)", 0.55, 650);
      FX.ring(cx, cy, { r1: Math.max(innerWidth, innerHeight) * 0.8, life: 700, width: 4, color: "#ff2d55" });
      FX.spark(cx, cy, { n: 60, min: 3, max: 12, gravity: 0.25, life: 1100, color: "#ff2d55", jx: r.width / 3, jy: r.height / 3 });
      FX.shake(); FX.buzz([60, 40, 90]);
      FX.banner(type === "expire" ? "Time limit exceeded" : "You have refused the System", type === "expire" ? "Quest Failed" : "Quest Defied",
        testing ? "Test run · no EXP change" : "Penalty · −10 EXP", "#ff2d55", 1700);
      return true;
    };
  }

  /* ================= HIDDEN QUEST BOX ================= */
  var hq = document.querySelector(".q-group.q-hidden");
  var veil = document.getElementById("hiddenVeil");
  if (hq && veil) {
    hq.insertBefore(el("div", "mx-hq-fog", "<i></i><i></i><i></i>"), hq.firstChild);
    hq.insertBefore(el("div", "mx-hq-corners"), hq.firstChild);
    veil.insertBefore(el("div", "mx-hq-sigil", sigilSVG("mx-sigil")), veil.firstChild);
    veil.appendChild(el("span", "mx-hq-cta mono", "Tap to break the seal"));
    var qm = veil.querySelector(".q-hidden-qmarks");
    if (qm && !RM) {
      var base = qm.textContent, G = "?¿#%&∆Ξ▓▒";
      setInterval(function () {
        if (!hq.classList.contains("sealed") || !qm.offsetParent) return;
        var out = "";
        for (var i = 0; i < base.length; i++) out += Math.random() < 0.12 ? G[(Math.random() * G.length) | 0] : base[i];
        qm.textContent = out;
        clearTimeout(qm.__t);
        qm.__t = setTimeout(function () { qm.textContent = base; }, 90);
      }, 700);
    }
  }

  /* ================= SYSTEM CONSOLE ================= */
  var lvBox = document.querySelector("#sec-quests .q-level");
  if (lvBox && window.__mxHunter) {
    var btn = el("button", "mx-console-btn mono", "Console");
    btn.type = "button";
    btn.setAttribute("aria-label", "Open System Console");
    lvBox.appendChild(btn);
    var sheet = el("div", "mx-console", '' +
      '<div class="mx-c-card" role="dialog" aria-label="System Console">' +
      '<div class="mx-c-head"><span>System Console</span><button type="button" class="mx-c-x" aria-label="Close">&times;</button></div>' +
      '<div class="mx-c-row"><span class="mx-c-k">Level</span><div class="mx-c-step">' +
      '<button type="button" data-l="-10">&minus;10</button><button type="button" data-l="-1">&minus;1</button><b class="mx-c-lv">1</b><button type="button" data-l="1">+1</button><button type="button" data-l="10">+10</button></div></div>' +
      '<div class="mx-c-row"><span class="mx-c-k">EXP</span><input type="range" class="mx-c-exp" min="0" max="99" value="0" /><b class="mx-c-ev">0</b></div>' +
      '<div class="mx-c-row col"><span class="mx-c-k">Jump to rank</span><div class="mx-c-ranks">' +
      '<button type="button" data-r="1">E</button><button type="button" data-r="10">D</button><button type="button" data-r="20">C</button><button type="button" data-r="30">B</button><button type="button" data-r="40">A</button><button type="button" data-r="50">S</button></div></div>' +
      '<div class="mx-c-row col"><span class="mx-c-k">Preview <em>(no EXP change)</em></span><div class="mx-c-tests">' +
      '<button type="button" data-t="secret">Secret quest</button><button type="button" data-t="prayer">Prayer quest</button></div></div>' +
      '<div class="mx-c-note mono">Changes save instantly</div>' +
      '</div>');
    document.body.appendChild(sheet);
    var lvOut = sheet.querySelector(".mx-c-lv"), expIn = sheet.querySelector(".mx-c-exp"), expOut = sheet.querySelector(".mx-c-ev");
    function refresh() {
      var h = window.__mxHunter.get();
      lvOut.textContent = h.level;
      var maxed = h.level >= h.max;
      expIn.max = maxed ? 0 : h.cap - 1; expIn.value = maxed ? 0 : h.exp; expIn.disabled = maxed;
      expOut.textContent = maxed ? "MAX" : h.exp + " / " + h.cap;
      var rb = sheet.querySelectorAll(".mx-c-ranks button");
      for (var i = 0; i < rb.length; i++) rb[i].classList.toggle("on", rb[i].textContent === h.rank);
    }
    function open() { refresh(); sheet.classList.add("show"); }
    function close() { sheet.classList.remove("show"); }
    btn.addEventListener("click", function (e) { e.stopPropagation(); open(); });
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.closest(".mx-c-x")) { close(); return; }
      var b = e.target.closest("button");
      if (!b) return;
      var h = window.__mxHunter.get();
      if (b.hasAttribute("data-l")) window.__mxHunter.set(h.level + (+b.getAttribute("data-l")), h.exp);
      else if (b.hasAttribute("data-r")) window.__mxHunter.set(+b.getAttribute("data-r"), 0);
      else if (b.hasAttribute("data-t")) {
        close();
        window.__mxSqTesting = true;
        if (!window.__mxSqTest || !window.__mxSqTest(b.getAttribute("data-t") === "prayer")) {
          window.__mxSqTesting = false;
          alert("A real Secret Quest is active right now — finish it first.");
        }
        return;
      }
      refresh();
    });
    expIn.addEventListener("input", function () {
      var h = window.__mxHunter.get();
      window.__mxHunter.set(h.level, +expIn.value);
      refresh();
    });
  }
})();
