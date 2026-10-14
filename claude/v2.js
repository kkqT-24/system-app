/* ==========================================================
   SYSTEM v2 (Claude build)
   • History log of everything the System records
   • Status window: STR / AGI / VIT / INT / PER, grown by the
     quests you clear, plus 3 free points every level
   • Shadow army: clear every daily quest in a day → ARISE
   • Login briefing on the boot greeting
   • Optional synthesized sound
   • Live Louisville weather (Open-Meteo, no key)
   • Installable home-screen app (service worker) + save export
   Its own save lives under systemApp.v2 — Muse's save
   (systemApp.v1) is only read, never reshaped.
   ========================================================== */
(function () {
  "use strict";
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var KEY = "systemApp.v2";
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function st() { try { return window.__mxState ? window.__mxState() : null; } catch (e) { return null; } }

  /* ---------------- save ---------------- */
  var STATS = ["STR", "AGI", "VIT", "INT", "PER"];
  var STAT_NAMES = { STR: "Strength", AGI: "Agility", VIT: "Vitality", INT: "Intelligence", PER: "Perception" };
  var D = { v: 2, history: [], shadows: [], earned: { STR: 0, AGI: 0, VIT: 0, INT: 0, PER: 0 }, alloc: { STR: 0, AGI: 0, VIT: 0, INT: 0, PER: 0 }, extracted: {}, workoutDays: {}, settings: { sound: false } };
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw === "object") {
      if (Array.isArray(raw.history)) D.history = raw.history.slice(-400);
      if (Array.isArray(raw.shadows)) D.shadows = raw.shadows;
      STATS.forEach(function (k) {
        if (raw.earned && isFinite(+raw.earned[k])) D.earned[k] = Math.max(0, +raw.earned[k]);
        if (raw.alloc && isFinite(+raw.alloc[k])) D.alloc[k] = Math.max(0, +raw.alloc[k]);
      });
      if (raw.extracted && typeof raw.extracted === "object") D.extracted = raw.extracted;
      if (raw.workoutDays && typeof raw.workoutDays === "object") D.workoutDays = raw.workoutDays;
      if (raw.settings && typeof raw.settings === "object") D.settings.sound = !!raw.settings.sound;
    }
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  /* ---------------- history ---------------- */
  function log(type, text, extra) {
    var e = { t: Date.now(), type: type, text: text };
    if (extra) for (var k in extra) e[k] = extra[k];
    D.history.push(e);
    if (D.history.length > 400) D.history.splice(0, D.history.length - 400);
    save();
    renderStatus(); renderTiles();
  }

  /* ---------------- stats ---------------- */
  function statsFor(name, weight) {
    var n = (name || "").toLowerCase(), g = {};
    if (/workout|push|sit-?up|squat|curl|press|dip|jack|knee|plank|lift|gym|burpee/.test(n)) g = { STR: 1, VIT: 1 };
    else if (/cardio|run|walk|jog|bike|cycl|swim|stretch|yoga|hike/.test(n)) g = { AGI: 1, VIT: 1 };
    else if (/read|study|learn|course|review|journal|write|trade|research|code/.test(n)) g = { INT: 2 };
    else if (/meditat|pray|breath|church|bible|gratitude|reflect/.test(n)) g = { PER: 2 };
    else g = { VIT: 1 };
    if (weight > 1) for (var k in g) g[k] *= weight;
    return g;
  }
  function addStats(g, sign) {
    for (var k in g) D.earned[k] = Math.max(0, (D.earned[k] || 0) + g[k] * sign);
  }
  function freePoints() {
    var s = st(); var lv = s ? s.level : 1;
    var spent = 0; STATS.forEach(function (k) { spent += D.alloc[k] || 0; });
    return Math.max(0, 3 * (lv - 1) - spent);
  }
  function statValue(k) { return 10 + (D.earned[k] || 0) + (D.alloc[k] || 0); }
  function gainText(g) { var a = []; for (var k in g) a.push("+" + g[k] + " " + k); return a.join(" "); }

  /* ---------------- shadows ---------------- */
  var CLASSES = ["Knight", "Archer", "Mage", "Assassin", "Lancer", "Bulwark", "Healer", "Berserker"];
  var NAMES = ["Vael", "Korr", "Ishra", "Mordane", "Thessa", "Grimm", "Aurel", "Nyx", "Kael", "Varo", "Sable", "Ruun", "Draven", "Oryn", "Lys", "Tarn", "Veyra", "Hask", "Cinder", "Azul", "Brann", "Corvin", "Esk", "Fenra"];
  var EPITHETS = ["the Unbroken", "of the Ninth Gate", "the Silent", "Ashbound", "the Red Vow", "of the Black Tide", "the Last Watch", "Ironsworn", "the Hollow Crown", "Duskborn"];
  var TIERS = [
    { id: "soldier", name: "Soldier", min: 0, color: "#8f86c9", base: 100 },
    { id: "elite", name: "Elite", min: 3, color: "#6f9bff", base: 250 },
    { id: "knight", name: "Knight", min: 7, color: "#a855f7", base: 600 },
    { id: "commander", name: "Commander", min: 14, color: "#e879f9", base: 1200 },
    { id: "marshal", name: "Marshal", min: 30, color: "#ffd166", base: 2500 }
  ];
  function tierFor(streak) {
    var t = 0;
    for (var i = 0; i < TIERS.length; i++) if (streak >= TIERS[i].min) t = i;
    if (Math.random() < 0.06 && t < TIERS.length - 1) t++; /* a lucky extraction */
    return t;
  }
  function makeShadow(streak, preview) {
    var ti = tierFor(streak), T = TIERS[ti];
    var cls = pick(CLASSES), nm = pick(NAMES);
    var name = ti >= 2 ? nm + " " + pick(EPITHETS) : nm;
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, cls: cls, tier: ti,
      power: Math.round(T.base * rnd(0.85, 1.25)), day: (st() || {}).day || "", t: Date.now(), streak: streak, preview: !!preview };
  }
  var EMBLEMS = {
    Knight: '<path d="M12 3v13M8 7h8M10 16h4l-2 5z"/>',
    Archer: '<path d="M6 4c8 2 8 14 0 16M6 4v16M6 12h13M16 9l3 3-3 3"/>',
    Mage: '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8 9.5 8z"/>',
    Assassin: '<path d="M5 19L17 7M14 4l6 6M9 15l-2 2M15 5l4 4"/>',
    Lancer: '<path d="M4 20L18 6M14 4h6v6M7 17l-2-2"/>',
    Bulwark: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
    Healer: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="8"/>',
    Berserker: '<path d="M5 5l14 14M19 5L5 19M3 9l6-6M15 21l6-6"/>'
  };
  function shadowFigure(sh) {
    var c = TIERS[sh.tier].color;
    return '<svg class="mx-sh-fig" viewBox="0 0 100 110" aria-hidden="true">' +
      '<defs><radialGradient id="g' + sh.id + '" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="' + c + '" stop-opacity="0.45"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="50" cy="62" rx="46" ry="46" fill="url(#g' + sh.id + ')"/>' +
      /* a hooded / helmed shadow: crest, head, pauldrons, cloak */
      '<path fill="#05030c" stroke="' + c + '" stroke-opacity="0.55" stroke-width="0.8" d="M50 14c-3 5-9 7-12 14-2 5-1 11 1 15-8 3-17 8-21 15-4 8-5 22-6 38h76c-1-16-2-30-6-38-4-7-13-12-21-15 2-4 3-10 1-15-3-7-9-9-12-14z"/>' +
      '<path fill="none" stroke="' + c + '" stroke-opacity="0.35" stroke-width="0.8" d="M30 66c6 6 14 9 20 9s14-3 20-9M50 75v28"/>' +
      '<g class="eyes"><ellipse cx="44" cy="33" rx="3.2" ry="1.4" fill="' + c + '"/><ellipse cx="56" cy="33" rx="3.2" ry="1.4" fill="' + c + '"/></g>' +
      '<g transform="translate(38 80) scale(1)" fill="none" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">' + (EMBLEMS[sh.cls] || "") + '</g>' +
      '</svg>';
  }
  function extract(preview) {
    var s = st() || { streak: 0, day: "" };
    var eff = (s.streak || 0) + 1; /* today's cleared day counts */
    var sh = makeShadow(eff, preview);
    if (!preview) {
      D.shadows.push(sh);
      D.extracted[s.day] = sh.id;
      save();
      log("shadow", "Extracted " + TIERS[sh.tier].name + " " + sh.cls + " — " + sh.name, { tier: sh.tier });
      renderShadows(); renderTiles();
    }
    arise(sh, preview);
  }
  function checkDaily() {
    var s = st();
    if (!s || !s.daily || !s.daily.length) return;
    var mainEl = document.getElementById("main");
    if (!mainEl || mainEl.classList.contains("is-hidden") || document.hidden) return; /* wait until you're in the app */
    var all = s.daily.every(function (q) { return q.done; });
    if (all && !D.extracted[s.day]) {
      D.extracted[s.day] = "pending"; save();
      setTimeout(function () { extract(false); }, 2400);
    }
  }

  /* ---------------- ARISE cinematic ---------------- */
  function arise(sh, preview) {
    var T = TIERS[sh.tier];
    var ov = el("div", "mx-arise" + (RM ? " rm" : ""), '' +
      '<div class="mx-ar-smoke"><i></i><i></i><i></i><i></i></div>' +
      '<div class="mx-ar-word">Arise</div>' +
      '<div class="mx-ar-card" style="--tc:' + T.color + '">' +
      '<div class="mx-ar-k">' + (preview ? "Preview · not saved" : "Shadow extraction complete") + '</div>' +
      shadowFigure(sh) +
      '<div class="mx-ar-name">' + esc(sh.name) + '</div>' +
      '<div class="mx-ar-meta">' + esc(T.name) + ' · ' + esc(sh.cls) + ' · Power ' + sh.power + '</div>' +
      '<div class="mx-ar-tap">Tap to continue</div></div>');
    document.body.appendChild(ov);
    snd("arise");
    var FX = window.__mx;
    if (FX && !RM) {
      FX.converge(innerWidth / 2, innerHeight * 0.45, 70, 1100, "#7c3aed");
      setTimeout(function () { FX.flash("rgba(124,58,237,0.9)", 0.5, 800); FX.ring(innerWidth / 2, innerHeight * 0.45, { r1: Math.max(innerWidth, innerHeight), life: 1100, width: 3, color: T.color }); FX.shake(); FX.buzz([40, 60, 80]); }, 1250);
    }
    requestAnimationFrame(function () { ov.classList.add("on"); });
    setTimeout(function () { ov.classList.add("reveal"); }, RM ? 0 : 1300);
    var close = function () { ov.classList.add("out"); setTimeout(function () { ov.remove(); }, 450); };
    setTimeout(function () { ov.addEventListener("click", close); }, RM ? 0 : 1800);
  }

  /* ---------------- events from the app ---------------- */
  window.__mxEvt = function (type, d) {
    d = d || {};
    var s = st() || {};
    if (type === "quest") {
      var w = d.key === "weekly" ? 2 : 1;
      var g = d.key === "hidden" ? { VIT: 1, PER: 1 } : statsFor(d.name, w);
      addStats(g, 1);
      log("quest", (d.key === "weekly" ? "Weekly quest" : d.key === "hidden" ? "Hidden quest" : "Daily quest") + " cleared — " + d.name,
        { exp: d.exp || 0, gain: gainText(g), name: d.name, key: d.key });
      snd("quest");
      setTimeout(checkDaily, 600);
    } else if (type === "undo") {
      /* take back the stats the matching completion gave */
      for (var i = D.history.length - 1; i >= 0; i--) {
        var h = D.history[i];
        if (h.type === "quest" && h.name === d.name && !h.undone) {
          h.undone = true;
          var g2 = h.key === "hidden" ? { VIT: 1, PER: 1 } : statsFor(h.name, h.key === "weekly" ? 2 : 1);
          addStats(g2, -1);
          break;
        }
      }
      log("undo", "Undid — " + (d.name || "last action"));
    } else if (type === "levelup") {
      log("level", "Level up — now level " + d.level, { level: d.level });
      snd("level");
    } else if (type === "rankup") {
      log("rank", "Rank up — " + d.from + " → " + d.rank, { rank: d.rank });
      snd("rank");
    } else if (type === "workout") {
      if (!D.workoutDays[s.day]) {
        D.workoutDays[s.day] = 1;
        var gw = { STR: 2, VIT: 1 };
        addStats(gw, 1);
        log("workout", "Daily workout complete — " + d.total + " reps", { gain: gainText(gw) });
      }
      setTimeout(checkDaily, 900);
    } else if (type === "secret") {
      if (d.result === "fulfilled") {
        var gs = d.white ? { PER: 2 } : statsFor(d.name, 1);
        addStats(gs, 1);
        log("secret", (d.white ? "Prayer quest fulfilled" : "Secret quest fulfilled") + " — " + d.name, { exp: d.exp || 0, gain: gainText(gs) });
        snd(d.white ? "prayer" : "fulfill");
      } else {
        log("penalty", (d.result === "expired" ? "Secret quest expired" : "Secret quest defied") + " — " + d.name, { exp: d.exp || 0 });
        snd("defy");
      }
    } else if (type === "penalty") {
      log("penalty", "Missed workout minimum — penalty", { exp: -(d.lost || 0) });
    }
  };

  /* ---------------- STATUS window ---------------- */
  var TITLES = { E: "Awakened", D: "Hunter", C: "Seasoned Hunter", B: "Elite Hunter", A: "Crimson Vanguard", S: "Monarch of Shadows" };
  var stTab = "stats";
  function radar() {
    var vals = STATS.map(statValue);
    var max = Math.max(16, Math.max.apply(null, vals) * 1.2);
    var cx = 110, cy = 104, R = 78;
    function pt(i, r) { var a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
    var grid = "";
    for (var g = 1; g <= 4; g++) grid += '<polygon class="gr" points="' + STATS.map(function (_, i) { return pt(i, R * g / 4).join(","); }).join(" ") + '"/>';
    var axes = STATS.map(function (_, i) { var p = pt(i, R); return '<line class="ax" x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '"/>'; }).join("");
    var shape = STATS.map(function (k, i) { return pt(i, R * Math.min(1, statValue(k) / max)).join(","); }).join(" ");
    var labels = STATS.map(function (k, i) { var p = pt(i, R + 16); return '<text x="' + p[0] + '" y="' + (p[1] + 4) + '">' + k + '</text>'; }).join("");
    var dots = STATS.map(function (k, i) { var p = pt(i, R * Math.min(1, statValue(k) / max)); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3"/>'; }).join("");
    return '<svg class="mx-radar" viewBox="0 0 220 210" aria-label="Stat chart">' + grid + axes + '<polygon class="sh" points="' + shape + '"/>' + dots + labels + '</svg>';
  }
  function fmtTime(t) { var d = new Date(t); return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function fmtDay(t) {
    var d = new Date(t), now = new Date();
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  var ICONS = { quest: "&#10003;", workout: "&#9650;", level: "&#8679;", rank: "&#9733;", secret: "&#9888;", penalty: "&#10007;", shadow: "&#9670;", undo: "&#8630;" };
  var logFilter = "all";
  function renderStatus() {
    var root = $("#mxStatus");
    if (!root) return;
    var s = st() || { level: 1, rank: "E", streak: 0 };
    var fp = freePoints();
    var head = '<div class="mx-st-head">' +
      '<div><div class="mx-st-k">Name</div><div class="mx-st-v">Kent</div></div>' +
      '<div><div class="mx-st-k">Title</div><div class="mx-st-v">' + esc(TITLES[s.rank] || "Hunter") + '</div></div>' +
      '<div><div class="mx-st-k">Level</div><div class="mx-st-v big">' + s.level + '</div></div>' +
      '<div><div class="mx-st-k">Rank</div><div class="mx-st-v big r-' + s.rank.toLowerCase() + '">' + s.rank + '</div></div>' +
      '<div><div class="mx-st-k">Streak</div><div class="mx-st-v">' + (s.streak || 0) + ' day' + (s.streak === 1 ? "" : "s") + '</div></div>' +
      '<div><div class="mx-st-k">Shadows</div><div class="mx-st-v">' + D.shadows.length + '</div></div>' +
      '</div>';
    var tabs = '<div class="mx-tabs"><button type="button" data-tab="stats" class="' + (stTab === "stats" ? "on" : "") + '">Stats</button><button type="button" data-tab="log" class="' + (stTab === "log" ? "on" : "") + '">Log</button></div>';
    var body = "";
    if (stTab === "stats") {
      body = '<div class="mx-st-stats">' + radar() + '<div class="mx-st-list">' +
        STATS.map(function (k) {
          return '<div class="mx-st-row"><span class="nm"><b>' + k + '</b> ' + STAT_NAMES[k] + '</span><span class="val">' + statValue(k) + '</span>' +
            '<button type="button" class="plus" data-stat="' + k + '"' + (fp ? "" : " disabled") + ' aria-label="Add a point to ' + STAT_NAMES[k] + '">+</button></div>';
        }).join("") +
        '<div class="mx-st-pts">Available points <b>' + fp + '</b></div>' +
        '<div class="mx-st-help">Clearing quests grows the matching stat on its own: workouts → STR, cardio → AGI, reading &amp; review → INT, meditation &amp; prayer → PER, everything else → VIT. Each level grants 3 free points.</div>' +
        '</div></div>';
    } else {
      var filters = '<div class="mx-log-f">' + [["all", "All"], ["quest", "Quests"], ["exp", "Levels"], ["penalty", "Penalties"], ["shadow", "Shadows"]].map(function (f) {
        return '<button type="button" data-f="' + f[0] + '" class="' + (logFilter === f[0] ? "on" : "") + '">' + f[1] + '</button>';
      }).join("") + '</div>';
      var items = D.history.slice().reverse().filter(function (h) {
        if (logFilter === "all") return true;
        if (logFilter === "quest") return h.type === "quest" || h.type === "workout" || h.type === "secret" || h.type === "undo";
        if (logFilter === "exp") return h.type === "level" || h.type === "rank";
        return h.type === logFilter;
      });
      var html = "", lastDay = "";
      if (!items.length) html = '<div class="mx-empty">Nothing recorded yet. Every quest, level, penalty and shadow from now on lands here.</div>';
      items.slice(0, 150).forEach(function (h) {
        var dl = fmtDay(h.t);
        if (dl !== lastDay) { html += '<div class="mx-log-day">' + dl + '</div>'; lastDay = dl; }
        var ex = h.exp ? '<span class="ex ' + (h.exp < 0 ? "neg" : "") + '">' + (h.exp > 0 ? "+" : "") + h.exp + ' EXP</span>' : "";
        html += '<div class="mx-log-row t-' + h.type + (h.undone ? " undone" : "") + '"><span class="ic">' + (ICONS[h.type] || "&#8226;") + '</span><span class="tx">' + esc(h.text) +
          (h.gain ? '<span class="gn">' + esc(h.gain) + '</span>' : "") + '</span><span class="rt">' + ex + '<span class="tm">' + fmtTime(h.t) + '</span></span></div>';
      });
      body = filters + '<div class="mx-log">' + html + '</div>';
    }
    root.innerHTML = head + tabs + body;
  }
  document.addEventListener("click", function (e) {
    var root = $("#mxStatus");
    if (!root || !root.contains(e.target)) return;
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-tab")) { stTab = b.getAttribute("data-tab"); renderStatus(); }
    else if (b.hasAttribute("data-f")) { logFilter = b.getAttribute("data-f"); renderStatus(); }
    else if (b.hasAttribute("data-stat") && freePoints() > 0) {
      var k = b.getAttribute("data-stat");
      D.alloc[k] = (D.alloc[k] || 0) + 1; save(); renderStatus(); renderTiles(); snd("tick");
      var row = $('.mx-st-row button[data-stat="' + k + '"]', root);
      if (row) { var v = row.parentNode.querySelector(".val"); if (v) { v.classList.remove("mx-pop"); void v.offsetWidth; v.classList.add("mx-pop"); } }
    }
  });

  /* ---------------- SHADOWS panel ---------------- */
  function renderShadows() {
    var root = $("#mxShadows");
    if (!root) return;
    var stEl = $("#mxShState");
    var power = D.shadows.reduce(function (a, s) { return a + (s.power || 0); }, 0);
    if (stEl) stEl.textContent = D.shadows.length ? D.shadows.length + " soldiers · power " + power.toLocaleString() : "Shadow army";
    var rules = '<div class="mx-sh-rules"><b>How to extract</b> Clear every daily quest in a day and the System raises one shadow. The longer your workout streak, the stronger it rises: ' +
      TIERS.map(function (t) { return '<span style="color:' + t.color + '">' + t.name + (t.min ? " " + t.min + "+" : "") + '</span>'; }).join(" · ") + '</div>';
    if (!D.shadows.length) {
      root.innerHTML = '<div class="mx-sh-empty">' + shadowFigure({ id: "empty", tier: 0, cls: "Knight" }) + '<div>Your army is empty.</div></div>' + rules;
      return;
    }
    var cards = D.shadows.slice().reverse().map(function (sh) {
      var T = TIERS[sh.tier] || TIERS[0];
      return '<div class="mx-sh-card" style="--tc:' + T.color + '">' + shadowFigure(sh) +
        '<div class="nm">' + esc(sh.name) + '</div><div class="cl">' + T.name + ' · ' + esc(sh.cls) + '</div><div class="pw">PWR ' + sh.power + '</div></div>';
    }).join("");
    root.innerHTML = '<div class="mx-sh-grid">' + cards + '</div>' + rules;
  }

  /* ---------------- tiles ---------------- */
  function renderTiles() {
    var a = $("#mxStatusTile"), b = $("#mxShadowTile");
    var fp = freePoints();
    if (a) a.textContent = fp ? fp + " points to spend" : "Stats · Log";
    if (b) b.textContent = "Army · " + D.shadows.length;
  }

  /* ---------------- login briefing ---------------- */
  var headEl = $("#phaseGreetHead");
  var brief = null;
  function renderBriefing() {
    if (!headEl) return;
    var s = st();
    if (!s) return;
    if (!brief) { brief = el("div", "mx-brief"); headEl.appendChild(brief); }
    var dDone = s.daily.filter(function (q) { return q.done; }).length;
    var line;
    if (s.secretActive) line = "A secret quest is waiting for you.";
    else if (dDone === s.daily.length) line = "All daily quests cleared. Well done, Hunter.";
    else if (s.reps >= s.repsMin) line = "Workout cleared. " + (s.daily.length - dDone) + " daily quest" + (s.daily.length - dDone === 1 ? "" : "s") + " remain.";
    else if (new Date().getHours() >= 18) line = "The day is ending. " + (s.repsMin - s.reps) + " reps stand between you and the penalty.";
    else line = "Daily quests have arrived. Do not fall behind.";
    brief.innerHTML =
      '<div class="mx-chips">' +
      '<span class="chip r-' + s.rank.toLowerCase() + '"><b>LV ' + s.level + '</b> · Rank ' + s.rank + '</span>' +
      '<span class="chip"><i class="fl"></i>' + s.streak + '-day streak</span>' +
      '<span class="chip">Quests <b>' + dDone + '/' + s.daily.length + '</b></span>' +
      '<span class="chip">Reps <b>' + Math.min(s.reps, s.repsMin) + '/' + s.repsMin + '</b></span>' +
      '<span class="chip">Shadows <b>' + D.shadows.length + '</b></span>' +
      '</div><div class="mx-brief-line">' + esc(line) + '</div>';
  }
  if (headEl) {
    renderBriefing();
    new MutationObserver(function () { if (!headEl.classList.contains("is-hidden")) renderBriefing(); }).observe(headEl, { attributes: true, attributeFilter: ["class"] });
    /* a slow rune ring behind the core while the greeting is up */
    var hud = $("#hud");
    if (hud && window.__mxSigil) {
      var ring = el("div", "mx-boot-sigil", window.__mxSigil("mx-sigil"));
      hud.insertBefore(ring, hud.firstChild);
    }
  }

  /* ---------------- SOUND (synthesized, off by default) ---------------- */
  var AC = null;
  function ac() {
    if (!D.settings.sound) return null;
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
    } catch (e) { return null; }
    return AC;
  }
  document.addEventListener("pointerdown", function () { if (D.settings.sound) ac(); }, { passive: true });
  function tone(a, f, t0, dur, type, vol, f2) {
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(a, t0, dur, vol, lp, lp2) {
    var n = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = n.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = n; f.type = "lowpass"; f.frequency.setValueAtTime(lp || 1200, t0);
    if (lp2) f.frequency.exponentialRampToValueAtTime(lp2, t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t0);
  }
  function snd(name) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + 0.01;
    switch (name) {
      case "tick": tone(a, 1400, t, 0.05, "square", 0.03); break;
      case "quest": tone(a, 880, t, 0.25, "sine", 0.12); tone(a, 1320, t + 0.08, 0.35, "sine", 0.1); break;
      case "level": [523, 659, 784, 1047].forEach(function (f, i) { tone(a, f, t + i * 0.09, 0.4, "triangle", 0.1); }); break;
      case "rank": noise(a, t, 1.2, 0.25, 300, 60); tone(a, 55, t, 1.4, "sine", 0.35, 40); [392, 494, 587, 784].forEach(function (f) { tone(a, f, t + 0.25, 1.6, "triangle", 0.06); }); break;
      case "alarm": for (var i = 0; i < 3; i++) { tone(a, 740, t + i * 0.36, 0.15, "square", 0.05); tone(a, 554, t + i * 0.36 + 0.17, 0.15, "square", 0.05); } break;
      case "fulfill": tone(a, 440, t, 0.9, "sawtooth", 0.04, 1760); tone(a, 880, t + 0.5, 0.6, "sine", 0.1); break;
      case "prayer": [523, 659, 784].forEach(function (f, i) { tone(a, f, t + i * 0.02, 2.2, "sine", 0.07); }); tone(a, 1568, t + 0.3, 1.8, "sine", 0.04); break;
      case "defy": noise(a, t, 0.6, 0.35, 3000, 200); tone(a, 90, t, 0.6, "sawtooth", 0.18, 40); break;
      case "arise": tone(a, 70, t, 2.2, "sine", 0.35, 35); noise(a, t, 1.6, 0.12, 200, 2000); tone(a, 220, t + 1.2, 1.2, "triangle", 0.06, 110); break;
      case "enter": noise(a, t, 0.9, 0.15, 400, 5000); tone(a, 180, t, 0.9, "sine", 0.1, 900); break;
    }
  }
  /* sounds for things the app does on its own */
  var sqOv = $("#sqOverlay");
  if (sqOv) new MutationObserver(function () { if (sqOv.classList.contains("show")) snd($("#sqCard") && $("#sqCard").classList.contains("white") ? "prayer" : "alarm"); }).observe(sqOv, { attributes: true, attributeFilter: ["class"] });
  var bootInner = $("#bootInner");
  if (bootInner) new MutationObserver(function (l) { l.forEach(function (m) { if (bootInner.classList.contains("fly") && !(m.oldValue || "").match(/\bfly\b/)) snd("enter"); }); }).observe(bootInner, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });

  /* ---------------- LIVE WEATHER (Open-Meteo, Louisville) ---------------- */
  var WX_KEY = "systemApp.v2.wx";
  var WMO = [
    [[0], "Sunny", "Clear", "sun", "moon"], [[1], "Mostly Sunny", "Mostly Clear", "partlyDay", "partlyNight"],
    [[2], "Partly Cloudy", "Partly Cloudy", "partlyDay", "partlyNight"], [[3], "Cloudy", "Cloudy", "cloud", "cloud"],
    [[45, 48], "Fog", "Fog", "fog", "fog"], [[51, 53, 55, 56, 57], "Drizzle", "Drizzle", "rain", "rain"],
    [[61, 63, 65, 66, 67], "Rain", "Rain", "rain", "rain"], [[71, 73, 75, 77, 85, 86], "Snow", "Snow", "snow", "snow"],
    [[80, 81, 82], "Showers", "Showers", "showerDay", "rain"], [[95, 96, 99], "Thunderstorms", "Thunderstorms", "tstormsDay", "storm"]
  ];
  function wmo(code, day) {
    for (var i = 0; i < WMO.length; i++) if (WMO[i][0].indexOf(code) >= 0) return { cond: day ? WMO[i][1] : WMO[i][2], glyph: day ? WMO[i][3] : WMO[i][4] };
    return { cond: "Cloudy", glyph: "cloud" };
  }
  function compass(deg) { return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round((deg % 360) / 22.5) % 16]; }
  function hm(iso) { var m = /T(\d\d):(\d\d)/.exec(iso || ""); return m ? (+m[1]) * 60 + (+m[2]) : NaN; }
  function clock(min) { var h = Math.floor(min / 60), m = min % 60; return ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " AM" : " PM"); }
  function applyWeather(w, live) {
    if (!w) return;
    var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    var isDay = nowMin >= w.sunriseMin && nowMin < w.sunsetMin;
    var c = wmo(w.code, isDay);
    var upd = new Date(w.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    var note = (live ? "Live" : "Last update") + " — " + new Date(w.at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " + upd + " · Open-Meteo";
    try { window.__mxWeatherApply && window.__mxWeatherApply({ cond: isDay ? c.cond : (w.code === 0 ? "Clear" : c.cond), temp: w.temp, sunsetMin: w.sunsetMin, sunriseMin: w.sunriseMin }); } catch (e) {}
    /* boot card */
    var bt = $("#phaseGreet .weather-temp"); if (bt) bt.textContent = Math.round(w.temp) + "°";
    var meta = document.querySelectorAll("#phaseGreet .weather-meta b");
    var vals = [Math.round(w.hi) + "°", Math.round(w.lo) + "°", compass(w.windDir) + " " + Math.round(w.wind) + " MPH", Math.round(w.hum) + "%", clock(w.sunsetMin)];
    for (var i = 0; i < meta.length && i < vals.length; i++) meta[i].textContent = vals[i];
    var bn = $("#phaseGreet .weather-note"); if (bn) bn.textContent = note;
    /* weather panel */
    var sec = $("#sec-weather");
    if (sec) {
      var t = $(".wx-temp", sec); if (t) t.textContent = Math.round(w.temp) + "°";
      var rows = sec.querySelectorAll(".s-row .v");
      var rv = [Math.round(w.hi) + "° / " + Math.round(w.lo) + "°", compass(w.windDir) + " " + Math.round(w.wind) + " MPH", Math.round(w.hum) + "%", clock(w.sunsetMin)];
      for (var j = 0; j < rows.length && j < rv.length; j++) rows[j].textContent = rv[j];
      var days = sec.querySelectorAll(".wx-day");
      for (var k = 0; k < days.length && k < (w.days || []).length; k++) {
        var dd = w.days[k], dc = wmo(dd.code, true);
        var dt = new Date(dd.date + "T12:00:00");
        $(".d", days[k]).textContent = dt.toLocaleDateString("en-US", { weekday: "short" }) + " · " + dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        $(".c", days[k]).textContent = ({ "Partly Cloudy": "Partly", "Mostly Sunny": "Mostly Sun", "Thunderstorms": "T-Storms" })[dc.cond] || dc.cond;
        $(".t", days[k]).textContent = Math.round(dd.hi) + "° / " + Math.round(dd.lo) + "°";
        var ic = $(".weather-icon", days[k]);
        if (ic && window.__mxGlyph) { ic.setAttribute("data-icon", dc.glyph); ic.innerHTML = window.__mxGlyph(dc.glyph); }
      }
      var sn = $(".weather-note", sec); if (sn) sn.textContent = note;
    }
  }
  function fetchWeather() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=38.2527&longitude=-85.7585" +
      "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset" +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=5";
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var c = j.current, d = j.daily;
      var w = { at: Date.now(), temp: c.temperature_2m, hum: c.relative_humidity_2m, code: c.weather_code, wind: c.wind_speed_10m, windDir: c.wind_direction_10m,
        hi: d.temperature_2m_max[0], lo: d.temperature_2m_min[0], sunriseMin: hm(d.sunrise[0]), sunsetMin: hm(d.sunset[0]), days: [] };
      for (var i = 0; i < d.time.length; i++) w.days.push({ date: d.time[i], code: d.weather_code[i], hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i] });
      try { localStorage.setItem(WX_KEY, JSON.stringify(w)); } catch (e) {}
      applyWeather(w, true);
    }).catch(function () {});
  }
  var cachedWx = null;
  try { cachedWx = JSON.parse(localStorage.getItem(WX_KEY) || "null"); } catch (e) {}
  if (cachedWx) applyWeather(cachedWx, Date.now() - cachedWx.at < 30 * 60000);
  fetchWeather();
  setInterval(fetchWeather, 20 * 60000);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    var c = null; try { c = JSON.parse(localStorage.getItem(WX_KEY) || "null"); } catch (e) {}
    if (!c || Date.now() - c.at > 15 * 60000) fetchWeather();
    checkDaily(); renderStatus(); renderTiles();
  });

  /* ---------------- CONSOLE additions: sound, preview arise, save transfer ---------------- */
  function addConsoleRows() {
    var card = $(".mx-console .mx-c-card");
    if (!card || card.__v2) return !!card;
    card.__v2 = true;
    var note = $(".mx-c-note", card);
    var tests = $(".mx-c-tests", card);
    if (tests) {
      var ab = el("button", "", "Arise"); ab.type = "button";
      ab.addEventListener("click", function (e) { e.stopPropagation(); var sh = $(".mx-console"); if (sh) sh.classList.remove("show"); extract(true); });
      tests.appendChild(ab);
    }
    var row = el("div", "mx-c-row", '<span class="mx-c-k">Sound</span><button type="button" class="mx-c-sound"></button>');
    var row2 = el("div", "mx-c-row col", '<span class="mx-c-k">Save transfer <em>(Safari ↔ home-screen app)</em></span><div class="mx-c-tests"><button type="button" class="mx-c-exp-save">Copy save</button><button type="button" class="mx-c-imp-save">Paste save</button></div>');
    card.insertBefore(row, note); card.insertBefore(row2, note);
    var sb = $(".mx-c-sound", row);
    function paint() { sb.textContent = D.settings.sound ? "On" : "Off"; sb.classList.toggle("on", D.settings.sound); }
    paint();
    sb.addEventListener("click", function (e) { e.stopPropagation(); D.settings.sound = !D.settings.sound; save(); paint(); if (D.settings.sound) snd("quest"); });
    $(".mx-c-exp-save", row2).addEventListener("click", function (e) {
      e.stopPropagation();
      var blob = "SYSTEM-SAVE:" + btoa(unescape(encodeURIComponent(JSON.stringify({ v1: localStorage.getItem("systemApp.v1"), v2: localStorage.getItem(KEY) }))));
      var done = function () { alert("Save copied. Open the other copy of the app → Console → Paste save."); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(blob).then(done, function () { prompt("Copy this save code:", blob); });
      else prompt("Copy this save code:", blob);
    });
    $(".mx-c-imp-save", row2).addEventListener("click", function (e) {
      e.stopPropagation();
      var code = prompt("Paste your save code. This replaces the progress in this copy of the app.");
      if (!code) return;
      try {
        var o = JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/^SYSTEM-SAVE:/, "")))));
        if (o.v1) localStorage.setItem("systemApp.v1", o.v1);
        if (o.v2) localStorage.setItem(KEY, o.v2);
        alert("Save loaded. Reloading.");
        location.reload();
      } catch (err) { alert("That code didn't work — copy it again and paste the whole thing."); }
    });
    return true;
  }
  if (!addConsoleRows()) { var tries = 0, iv = setInterval(function () { if (addConsoleRows() || ++tries > 20) clearInterval(iv); }, 250); }

  /* ---------------- install (service worker) ---------------- */
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  /* ---------------- first paint ---------------- */
  /* clear a stale "pending" extraction left by a reload mid-cinematic */
  var s0 = st();
  for (var k in D.extracted) if (D.extracted[k] === "pending" && (!s0 || k !== s0.day)) delete D.extracted[k];
  if (s0 && D.extracted[s0.day] === "pending") delete D.extracted[s0.day];
  renderStatus(); renderShadows(); renderTiles();
  /* panels refresh whenever they open */
  ["sec-status", "sec-shadows"].forEach(function (id) {
    var sec = document.getElementById(id);
    if (sec) new MutationObserver(function () { if (!sec.classList.contains("is-hidden")) { renderStatus(); renderShadows(); } }).observe(sec, { attributes: true, attributeFilter: ["class"] });
  });
  setInterval(function () { checkDaily(); renderTiles(); }, 5000);
  setTimeout(checkDaily, 4000);
})();
