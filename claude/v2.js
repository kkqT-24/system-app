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
  var STAT_COLORS = { STR: "#ff5a6e", AGI: "#3ee6a0", VIT: "#ffa24c", INT: "#5aa8ff", PER: "#c77dff" };
  var D = { v: 2, history: [], shadows: [], earned: { STR: 0, AGI: 0, VIT: 0, INT: 0, PER: 0 }, alloc: { STR: 0, AGI: 0, VIT: 0, INT: 0, PER: 0 }, extracted: {}, workoutDays: {}, places: [], settings: { sound: false, view3d: true } };
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
      if (Array.isArray(raw.places)) D.places = raw.places.filter(function (x) { return x && isFinite(+x.lat) && isFinite(+x.lon) && typeof x.quest === "string"; });
      if (isFinite(+raw.lastBackup)) D.lastBackup = +raw.lastBackup;
      if (isFinite(+raw.firstOpen)) D.firstOpen = +raw.firstOpen;
      if (isFinite(+raw.backupSnooze)) D.backupSnooze = +raw.backupSnooze;
      if (raw.settings && typeof raw.settings === "object") { D.settings.sound = !!raw.settings.sound; if (raw.settings.view3d === false) D.settings.view3d = false; }
    }
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }
  if (!D.firstOpen) { D.firstOpen = Date.now(); save(); }

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
    { id: "marshal", name: "Marshal", min: 30, color: "#ffd166", base: 2500 },
    { id: "monarch", name: "Monarch", min: Infinity, color: "#ffd166", base: 9000 }
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
  /* Shadow soldiers: pitch-black armoured silhouettes with a cold rim
     light, burning eyes and a black-violet aura licking up off them.
     Each class has its own body and weapon. */
  var BODIES = {
    Knight:
      '<path class="plume" d="M53 15c9-9 26-8 36 6-9-4-19-2-26 4z"/>' +
      '<path d="M41 22q9-12 18 0l1 14q-10 7-20 0z"/>' +
      '<path d="M26 47q7-11 18-5l-2 11-18 3zM74 47q-7-11-18-5l2 11 18 3zM28 44l-6-11 10 8zM72 44l6-11-10 8z"/>' +
      '<path d="M22 108l7-50q21-10 42 0l7 50q-28-6-56 0z"/>' +
      '<path d="M38 42h24l4 38-8 20H42l-8-20z"/>' +
      '<g class="blade"><path d="M48.5 57h3v47l-1.5 5-1.5-5zM41 56h18v3H41zM49 45h2v11h-2z"/><circle cx="50" cy="43.5" r="2"/></g>',
    Archer:
      '<path d="M50 13q15 4 12 25l-6 6H44l-6-6q-3-21 12-25z"/>' +
      '<path d="M29 106l7-56q14-9 28 0l10 56q-12-7-24-2-12-5-21 2z"/>' +
      '<g class="bow"><path d="M73 24q22 36 0 74" fill="none" stroke-width="3.2" class="wpn"/><path class="str string" d="M73 24L73 98" fill="none" stroke-width="0.6"/></g>' +
      '<path d="M36 52l-12 10 3 3 13-8z"/>',
    Mage:
      '<path d="M50 2l11 28q2 10-5 14H44q-7-4-5-14z"/>' +
      '<path d="M30 108l9-62h22l9 62q-20-8-40 0z"/><path d="M36 60q14 8 28 0l2 8q-16 8-32 0z"/>' +
      '<path d="M75 22h2.6v86H75z"/><circle class="orb" cx="76.3" cy="17" r="5.5"/>',
    Assassin:
      '<path d="M50 16q13 4 10 20l-6 6h-8l-6-6q-3-16 10-20z"/>' +
      '<path class="scarf" d="M56 40c14 2 26-4 36-10-8 10-20 16-34 16zM55 44c10 6 18 6 26 4-8 6-18 6-27 2z"/>' +
      '<path d="M42 42h16l4 28 4 38H56l-6-28-6 28H34l4-38z"/>' +
      '<path class="dag l" d="M31 63l-9 17 2 1 10-16z"/><path class="dag r" d="M69 63l9 17-2 1-10-16z"/>',
    Lancer:
      '<path d="M43 22c-7-8-9-14-5-20 2 8 6 12 9 16zM57 22c7-8 9-14 5-20-2 8-6 12-9 16z"/>' +
      '<path d="M42 24q8-10 16 0v12q-8 5-16 0z"/>' +
      '<path d="M27 48q7-10 17-5l-2 10-17 3zM73 48q-7-10-17-5l2 10 17 3z"/>' +
      '<path d="M36 42h28l4 38-6 28H38l-6-28z"/>' +
      '<g class="spear"><path d="M17 106l64-90 2 1.4-64 90z"/><path d="M80 14l8-12-1 14z"/></g>',
    Bulwark:
      '<path d="M44 26q6-8 12 0v10H44z"/>' +
      '<path d="M12 108l3-50q4-20 23-24h24q19 4 23 24l3 50z"/>' +
      '<path d="M40 26l-6-6 2 9zM60 26l6-6-2 9z"/><g class="shield"><path class="wpn" d="M28 54h44v32q-22 22-44 0z" stroke-width="1.6"/><path d="M50 58v30M34 70h32" fill="none" class="str" stroke-width="0.8"/></g>',
    Healer:
      '<path d="M50 14q14 4 12 22l-6 7H44l-6-7q-2-18 12-22z"/>' +
      '<path d="M26 108l12-62q12-6 24 0l12 62q-24-8-48 0z"/><path d="M38 64q12 6 24 0" fill="none" class="str" stroke-width="0.8"/>' +
      '<path d="M24 26h2.4v82H24z"/><path class="orb" d="M25 12a7 7 0 1 0 0.1 0zM25 15a4 4 0 1 1-0.1 0z" fill-rule="evenodd"/>',
    Berserker:
      '<path d="M40 24c-9-2-14 2-16-6 6 2 10 0 16 2zM60 24c9-2 14 2 16-6-6 2-10 0-16 2z"/>' +
      '<path d="M41 24q9-10 18 0v13q-9 6-18 0z"/>' +
      '<path d="M18 62q4-24 24-24h16q20 0 24 24l-6 4-4-12 2 54H26l2-54-4 12z"/>' +
      '<g class="axe"><path d="M76 28l-10 80 2.6.4 10-80z"/><path class="wpn" d="M72 18q24 2 22 26-10-8-22-6z"/></g>'
  };
  /* engraved detail drawn over each body: armour seams, folds, trims */
  var DETAILS = {
    Knight: "M50 12v11M43 31h14M28 46q6-6 14-4M72 46q-6-6-14-4M40 50h20M42 57h16M44 64h12M36 80h28M30 80l-4 26M70 80l4 26M36 92l-2 14M64 92l2 14M50 60v42",
    Archer: "M40 38q10 6 20 0M40 62l-6 42M60 62l6 42M50 64v40M58 46l9-13M61 47l9-13M66 31l2-4M69 33l3-3",
    Mage: "M41 34h18M34 92q16 6 32 0M46 72a4 4 0 1 0 8 0a4 4 0 1 0-8 0M50 66v-3M50 78v3M75 40h3M75 46h3M75 52h3",
    Assassin: "M44 34h12M42 62h16M37 50l-4 10M63 50l4 10M50 80v26M46 44l4 6 4-6",
    Lancer: "M50 18v8M44 30h12M40 54h20M41 62h18M42 70h16M38 80l-2 14M50 80v16M62 80l2 14",
    Bulwark: "M18 60q8-14 22-18M82 60q-8-14-22-18M44 64l12 12M56 64l-12 12M50 64a6 6 0 1 0 0.1 0M24 96h52M30 102h40",
    Healer: "M40 38q10 6 20 0M44 46l12 30M30 96q20 8 40 0M38 70q12 6 24 0",
    Berserker: "M42 50l8 10M58 48l-6 12M30 84h40M30 44l4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4M44 30h12"
  };
  var figN = 0;
  function shadowFigure(sh, still) {
    if (sh.monarch) { var mm = monarchByKey(sh.monarch); if (mm) return monarchFigure(mm, still); }
    var T = TIERS[sh.tier] || TIERS[0], c = T.color, id = "f" + (++figN);
    var body = BODIES[sh.cls] || BODIES.Knight;
    var flames = "";
    for (var i = 0; i < 7; i++) {
      var x = 22 + i * 9.3, h = 34 + (i % 3) * 12 + (i === 3 ? 18 : 0);
      flames += '<path class="fl" style="animation-delay:-' + (i * 0.37).toFixed(2) + 's;transform-origin:' + x + 'px 108px" d="M' + (x - 9) + ' 108 Q' + (x - 6) + ' ' + (108 - h * 0.6) + ' ' + x + ' ' + (108 - h) + ' Q' + (x + 6) + ' ' + (108 - h * 0.6) + ' ' + (x + 9) + ' 108Z" fill="url(#' + id + 'f)"/>';
    }
    var motes = "";
    for (var m = 0; m < 5; m++) motes += '<circle class="mt" cx="' + (28 + m * 11) + '" cy="100" r="' + (0.9 + (m % 2) * 0.6) + '" fill="' + c + '" style="animation-delay:-' + (m * 0.9).toFixed(1) + 's"/>';
    return '<svg class="mx-sh-fig cls-' + (sh.cls || "Knight").toLowerCase() + (still ? " still" : "") + '" viewBox="0 0 100 112" aria-hidden="true" style="--tc:' + c + '">' +
      '<defs><linearGradient id="' + id + 'f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + c + '" stop-opacity="0.75"/><stop offset="0.45" stop-color="#2a0a52" stop-opacity="0.55"/><stop offset="1" stop-color="#05010d" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + id + 'g" cx="50%" cy="62%" r="50%"><stop offset="0" stop-color="' + c + '" stop-opacity="0.35"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="50" cy="66" rx="48" ry="44" fill="url(#' + id + 'g)"/>' +
      '<g class="aura">' + flames + '</g>' +
      '<g class="body" fill="#020007" stroke="' + c + '" stroke-opacity="0.75" stroke-width="0.7" stroke-linejoin="round">' + body + '</g>' +
      '<path class="det" d="' + (DETAILS[sh.cls] || DETAILS.Knight) + '" fill="none" stroke="' + c + '" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle class="core" cx="50" cy="' + (sh.cls === "Bulwark" ? 70 : 56) + '" r="1.7" fill="' + c + '"/>' +
      '<g class="wisps" fill="none" stroke="' + c + '" stroke-width="0.8" stroke-linecap="round"><path d="M30 52C25 42 34 34 27 22"/><path d="M70 52C75 42 66 34 73 22"/><path d="M50 18C46 10 54 6 50 -4"/></g>' +
      '<g class="eyes" fill="#e8f4ff"><ellipse cx="45.5" cy="29.5" rx="2.6" ry="0.9"/><ellipse cx="54.5" cy="29.5" rx="2.6" ry="0.9"/></g>' +
      '<ellipse cx="50" cy="109" rx="30" ry="3" fill="#000" opacity="0.8"/>' +
      motes + '</svg>';
  }
  /* ---------------- THE HUNTER (placeholder) ----------------
     Kent's own figure, drawn in the same line style as the shadows: middle-part
     wolf-cut hair, long coat, twin daggers in a reverse grip. Stand-in until the game
     art is settled (the pixel shadow knight is archived in game/shadow-knight/). */
  var HUNTER_C = "#9ad0ff";
  var HUNTER_BODY = "<path d=\"M34 42Q50 35 66 42L78 108H59L55.5 78H44.5L41 108H22Z\"/><path d=\"M37 41L43 34H57L63 41L50 48Z\"/><path d=\"M34 44L25 71L30 73L39 48ZM66 44L75 71L70 73L61 48Z\"/><path class=\"wpn\" d=\"M26 71L11 91L14 93.4L30 73.4ZM74 71L89 91L86 93.4L70 73.4Z\"/><path d=\"M23 69.5l9 4.5-1.4 2.4-9-4.5zM77 69.5l-9 4.5 1.4 2.4 9-4.5z\"/><path d=\"M41.5 25L34.5 33L38 32.5L35.5 39L40.5 34.5L42.5 30ZM58.5 25L65.5 33L62 32.5L64.5 39L59.5 34.5L57.5 30Z\"/><path d=\"M42 19Q50 14 58 19L57.5 30L50 36L42.5 30Z\"/><path d=\"M50 11.5Q41 10 39 17Q38 22 39.5 27.5L41 25.5L41.8 28.5L42.5 23Q46 17.5 50 14.5Q54 17.5 57.5 23L58.2 28.5L59 25.5L60.5 27.5Q62 22 61 17Q59 10 50 11.5Z\"/>";
  var HUNTER_DET = "M50 48v28M43 58h14M42 64h16M38 74l-5 30M62 74l5 30M40 50q-2 8 1 14M60 50q2 8-1 14M44 34l6 6 6-6M15 89l12-15M85 89l-12-15M46 32l4 2 4-2M50 12v3M41 18.5q-1 4 0 7M59 18.5q1 4 0 7M37.5 34l3-4M62.5 34l-3-4";
  function hunterFigure(still) {
    var c = HUNTER_C, id = "h" + (++figN), flames = "";
    for (var i = 0; i < 7; i++) {
      var x = 22 + i * 9.3, hh = 34 + (i % 3) * 12 + (i === 3 ? 18 : 0);
      flames += '<path class="fl" style="animation-delay:-' + (i * 0.37).toFixed(2) + 's;transform-origin:' + x + 'px 108px" d="M' + (x - 9) + ' 108 Q' + (x - 6) + ' ' + (108 - hh * 0.6) + ' ' + x + ' ' + (108 - hh) + ' Q' + (x + 6) + ' ' + (108 - hh * 0.6) + ' ' + (x + 9) + ' 108Z" fill="url(#' + id + 'f)"/>';
    }
    return '<svg class="mx-sh-fig cls-hunter' + (still ? " still" : "") + '" viewBox="0 0 100 112" aria-hidden="true" style="--tc:' + c + '">' +
      '<defs><linearGradient id="' + id + 'f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + c + '" stop-opacity="0.7"/><stop offset="0.45" stop-color="#14204a" stop-opacity="0.55"/><stop offset="1" stop-color="#05010d" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + id + 'g" cx="50%" cy="62%" r="50%"><stop offset="0" stop-color="' + c + '" stop-opacity="0.3"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="50" cy="66" rx="48" ry="44" fill="url(#' + id + 'g)"/>' +
      '<g class="aura">' + flames + '</g>' +
      '<g class="body" fill="#020007" stroke="' + c + '" stroke-opacity="0.85" stroke-width="0.7" stroke-linejoin="round">' + HUNTER_BODY + '</g>' +
      '<path class="det" d="' + HUNTER_DET + '" fill="none" stroke="' + c + '" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<g class="eyes" fill="#e8f4ff"><ellipse cx="45.5" cy="25.5" rx="2.6" ry="0.9"/><ellipse cx="54.5" cy="25.5" rx="2.6" ry="0.9"/></g>' +
      '<ellipse cx="50" cy="109" rx="30" ry="3" fill="#000" opacity="0.8"/></svg>';
  }
  window.MXHunterFigure = hunterFigure;
  /* ---------------- MONARCH'S GUARD: four legendary shadows ----------------
     Not rolled at random — each answers only when you earn it. */
  var MONARCHS = [
    { key: "regent", c1: "#ffc94d", c2: "#ff2a3d", ce: "#ff3b5c", name: "Aurex, the Shadow Regent", cls: "Regent", need: "Reach Rank S", power: 9000,
      eyes: [[45.5, 23.5], [54.5, 23.5]],
      body: '<path d="M39 15l3-9 4 6 4-10 4 10 4-6 3 9z"/><path d="M40 17q10-7 20 0v15q-10 8-20 0z"/>' +
        '<path class="cape" d="M50 34C28 36 8 62 2 110h96C92 62 72 36 50 34z"/>' +
        '<path d="M37 38h26l4 40-7 30H40l-7-30zM24 46q8-12 20-6l-2 12-20 4zM76 46q-8-12-20-6l2 12 20 4z"/>' +
        '<g class="raise"><path d="M63 44l24-38 2.2 1.4-24 38z"/><path d="M60 40l10 6-1.4 2.2-10-6z"/></g>',
      det: "M50 18v12M43 25h14M40 50h20M42 58h16M44 66h12M36 80h28M20 80l-8 28M80 80l8 28M30 70l-10 38M70 70l10 38" },
    { key: "wyrm", c1: "#ff7a2e", c2: "#ff2d1a", ce: "#ffb020", name: "Vorhal, Wyrm of the Abyss", cls: "Wyrm", need: "Hold a 30-day workout streak", power: 12000,
      eyes: [[35, 22], [42, 21]],
      body: '<path d="M50 52C32 22 10 16 2 28c10 0 16 5 19 13C11 39 5 45 3 54c12-6 22-4 31 6z"/><path d="M50 52C68 22 90 16 98 28c-10 0-16 5-19 13 10-2 16 4 18 13-12-6-22-4-31 6z"/><path d="M37 60q13-10 26 0l7 30q-20 17-40 0z"/><path d="M42 63L35 50L36 40L41 31L50 27L53 40L58 63Z"/><path d="M40 14L45 0L47 15ZM45 17L61 6L51 21ZM49 22L65 18L53 26Z"/><path d="M45 32L32 35L15 42L19 37L31 31Z"/><path d="M52 23L50 30L44 33L34 31L13 26L22 21L33 18L39 11L47 13Z"/><path d="M17 27L19.5 32L21.5 28ZM23.5 28.3L26 34L28 29ZM30 29.8L32 34L33.6 30.6Z" fill="#fff6f0" stroke="none"/><path d="M19.5 38.5L21 34L23.4 37.4ZM26 36.2L28 31.5L30 35Z" fill="#fff6f0" stroke="none"/><path d="M62 94c14 6 25 1 34 10-12-1-24 5-37-3z"/>',
      det: "M8 30l14 10M92 30l-14 10M14 46l16 8M86 46l-16 8M40 70h20M38 78h24M40 86h20M15 25l3-1M31 18l13 4M40 40l10-2M40 48l11-2M42 56l11-2" },
    { key: "archon", c1: "#bfe9ff", c2: "#7dd3fc", ce: "#e0f2ff", name: "Seraphine, Archon of Night", cls: "Archon", need: "Raise 25 shadows", power: 10500,
      eyes: [[45.5, 27], [54.5, 27]],
      body: '<ellipse class="halo" cx="50" cy="9" rx="13" ry="3.4" fill="none" stroke-width="1.6"/>' +
        '<g class="wingL"><path d="M48 42C34 22 14 6 3 10c6 8 10 17 12 27 8-2 17 0 33 7zM46 54C34 50 18 52 8 62c10 0 18 2 24 8 4-6 8-10 14-12z"/></g>' +
        '<g class="wingR"><path d="M52 42C66 22 86 6 97 10c-6 8-10 17-12 27-8-2-17 0-33 7zM54 54C66 50 82 52 92 62c-10 0-18 2-24 8-4-6-8-10-14-12z"/></g>' +
        '<path d="M50 14q12 4 10 22l-5 6H45l-5-6q-2-18 10-22z"/><path d="M36 44h28l11 66H25z"/>',
      det: "M40 36q10 6 20 0M38 60h24M34 80q16 6 32 0M30 100q20 6 40 0M50 44v64M16 18l18 18M84 18l-18 18" },
    { key: "fenris", c1: "#34f5a0", c2: "#10b981", ce: "#6effc8", name: "Fenrath, the Black Wolf", cls: "Wolf", need: "Clear every daily quest 7 days in a row", power: 8000,
      eyes: [[44, 48], [56, 48]],
      body: '<path d="M70 104c12-2 22-12 22-28-6 10-14 14-24 16z"/><path d="M28 108c-3-20 0-34 10-44q12-7 24 0c10 10 13 24 10 44z"/><path d="M37 64l-7 3 5 3-4 6 8-2 3 6 3-6 5 5 5-5 3 6 3-6 8 2-4-6 5-3-7-3z"/><path d="M36 42L27 12L44 30ZM64 42L73 12L56 30Z"/><path d="M36 50L24 52L35 57ZM64 50L76 52L65 57Z"/><path d="M33 44L42 31L50 34L58 31L67 44L64 56L57 62L54 73L50 76L46 73L43 62L36 56Z"/><path d="M43.5 63L50 68L56.5 63L55 71L50 74L45 71Z" fill="#000"/><path d="M44 62.5L46 71L48 64.5ZM56 62.5L54 71L52 64.5Z" fill="#fff6f0" stroke="none"/><path d="M46.5 73L47.5 69.5L49 73ZM53.5 73L52.5 69.5L51 73Z" fill="#fff6f0" stroke="none"/><path d="M46.5 57h7l-3.5 3.5z" fill="#d8ffe9" stroke="none"/>',
      det: "M30 18l6 9M70 18l-6 9M37 42l9 5M63 42l-9 5M50 50v6M50 80v26M40 92h20" }
  ];
  function monarchFigure(m, still) {
    var id = "m" + (++figN), gold = m.c1 || "#ffd166", vio = m.c2 || "#a855f7";
    /* three aura layers: a towering violet-gold blaze, a black smoke
       curtain licking through it, and a crimson heat at the base */
    var flames = "", smoke = "";
    for (var i = 0; i < 11; i++) {
      var x = 2 + i * 9.6, h = 62 + (i % 3) * 16 + (Math.abs(i - 5) < 2 ? 38 : 0);
      flames += '<path class="fl big" style="animation-delay:-' + (i * 0.23).toFixed(2) + 's;transform-origin:' + x + 'px 112px" d="M' + (x - 11) + ' 112 Q' + (x - 7) + ' ' + (112 - h * 0.55) + ' ' + (x + (i % 2 ? 4 : -4)) + ' ' + (112 - h) + ' Q' + (x + 7) + ' ' + (112 - h * 0.6) + ' ' + (x + 11) + ' 112Z" fill="url(#' + id + (i % 2 ? "v" : "g") + ')"/>';
    }
    for (var k = 0; k < 7; k++) {
      var sx = 12 + k * 13, sh = 48 + (k % 2) * 22;
      smoke += '<path class="sm" style="animation-delay:-' + (k * 0.41).toFixed(2) + 's;transform-origin:' + sx + 'px 112px" d="M' + (sx - 9) + ' 112 C' + (sx - 12) + ' ' + (112 - sh * 0.5) + ' ' + (sx + 6) + ' ' + (112 - sh * 0.7) + ' ' + sx + ' ' + (112 - sh) + ' C' + (sx + 10) + ' ' + (112 - sh * 0.6) + ' ' + (sx + 4) + ' ' + (112 - sh * 0.3) + ' ' + (sx + 9) + ' 112Z" fill="url(#' + id + 's)"/>';
    }
    var bolts = '<g class="bolts" fill="none" stroke="#f3e8ff" stroke-width="0.9" stroke-linejoin="round">' +
      '<path d="M8 34l7 6-5 5 8 9-4 4 7 8"/><path d="M92 28l-6 8 5 4-8 8 4 5-7 9"/><path d="M50 -10l-4 7 5 3-5 8"/><path d="M22 6l4 8-4 3 5 6"/><path d="M80 4l-3 7 4 3-4 7"/></g>';
    var embers = "";
    for (var e2 = 0; e2 < 8; e2++) embers += '<circle class="mt" cx="' + (12 + e2 * 11) + '" cy="108" r="' + (0.9 + (e2 % 3) * 0.5) + '" fill="' + (e2 % 2 ? gold : vio) + '" style="animation-delay:-' + (e2 * 0.6).toFixed(1) + 's"/>';
    var eyes = m.eyes.map(function (e) { return '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="3" ry="1.1"/>'; }).join("");
    return '<svg class="mx-sh-fig monarch mon-' + m.key + (still ? " still" : "") + '" viewBox="0 0 100 112" aria-hidden="true" style="--tc:' + gold + ';--tv:' + vio + '">' +
      '<defs><linearGradient id="' + id + 'g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + vio + '" stop-opacity="0.9"/><stop offset="0.25" stop-color="' + gold + '" stop-opacity="0.75"/><stop offset="0.6" stop-color="#14062a" stop-opacity="0.55"/><stop offset="1" stop-color="#05010d" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + id + 'v" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + gold + '" stop-opacity="0.8"/><stop offset="0.4" stop-color="' + vio + '" stop-opacity="0.7"/><stop offset="0.75" stop-color="#1a0638" stop-opacity="0.45"/><stop offset="1" stop-color="#05010d" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + id + 's" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.95"/><stop offset="0.6" stop-color="#0b0216" stop-opacity="0.7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + id + 'r" cx="50%" cy="60%" r="58%"><stop offset="0" stop-color="' + gold + '" stop-opacity="0.3"/><stop offset="0.35" stop-color="' + vio + '" stop-opacity="0.28"/><stop offset="1" stop-color="' + vio + '" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse class="dome" cx="50" cy="64" rx="56" ry="56" fill="url(#' + id + 'r)"/>' +
      '<ellipse class="quake" cx="50" cy="110" rx="40" ry="5" fill="none" stroke="' + vio + '" stroke-width="1"/>' +
      '<g class="aura">' + flames + '</g><g class="smoke">' + smoke + '</g>' + bolts +
      '<g class="body" fill="#010005" stroke="' + gold + '" stroke-opacity="0.9" stroke-width="0.8" stroke-linejoin="round">' + m.body + '</g>' +
      '<path class="det" d="' + m.det + '" fill="none" stroke="' + gold + '" stroke-width="0.55" stroke-linecap="round"/>' +
      '<g class="eyes" fill="#fff6f0" style="filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px ' + (m.ce || vio) + ') drop-shadow(0 0 12px ' + (m.ce || vio) + ')">' + eyes + '</g>' + embers +
      '<ellipse cx="50" cy="111" rx="38" ry="3" fill="#000" opacity="0.9"/></svg>';
  }
  function monarchByKey(k) { for (var i = 0; i < MONARCHS.length; i++) if (MONARCHS[i].key === k) return MONARCHS[i]; return null; }
  function bestDayRun() {
    var days = Object.keys(D.extracted).filter(function (k) { return D.extracted[k] && D.extracted[k] !== "pending"; }).sort();
    var best = 0, run = 0, prev = null;
    days.forEach(function (d) {
      var t = new Date(d + "T12:00:00").getTime();
      run = prev !== null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
      prev = t; if (run > best) best = run;
    });
    return best;
  }
  function monarchEarned(m, s) {
    if (m.key === "regent") return s.rank === "S";
    if (m.key === "wyrm") return (s.streak || 0) >= 30;
    if (m.key === "archon") return D.shadows.filter(function (x) { return !x.monarch; }).length >= 25;
    if (m.key === "fenris") return bestDayRun() >= 7;
    return false;
  }
  function hasMonarch(k) { return D.shadows.some(function (x) { return x.monarch === k; }); }
  function monarchShadow(m, preview) {
    return { id: "M" + m.key + (preview ? "p" : ""), monarch: m.key, name: m.name, cls: m.cls, tier: 5, power: m.power, t: Date.now(), day: (st() || {}).day || "", preview: !!preview };
  }
  var monarchBusy = false;
  function checkMonarchs() {
    var s = st(), mainEl = document.getElementById("main");
    if (!s || monarchBusy || !mainEl || mainEl.classList.contains("is-hidden") || document.hidden || document.querySelector(".mx-arise")) return;
    for (var i = 0; i < MONARCHS.length; i++) {
      var m = MONARCHS[i];
      if (!hasMonarch(m.key) && monarchEarned(m, s)) {
        var sh = monarchShadow(m, false);
        D.shadows.push(sh); save();
        log("shadow", "A Monarch's shadow answered — " + m.name, { tier: 5 });
        renderShadows(); renderTiles();
        monarchBusy = true;
        arise(sh, false);
        setTimeout(function () { monarchBusy = false; }, 4000);
        return;
      }
    }
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
    var all = s.daily.filter(function (q) { return !offToday(q.name); }).every(function (q) { return q.done; });
    if (all && !D.extracted[s.day]) {
      D.extracted[s.day] = "pending"; save();
      setTimeout(function () { extract(false); }, 2400);
    }
  }

  /* ---------------- ARISE cinematic ---------------- */
  function arise(sh, preview) {
    var T = TIERS[sh.tier];
    if (sh.monarch) { var mk = monarchByKey(sh.monarch); if (mk) T = { name: T.name, color: mk.c1 }; }
    var isMon = !!sh.monarch;
    var ov = el("div", "mx-arise" + (RM ? " rm" : "") + (isMon ? " monarch" : ""), '' +
      '<div class="mx-ar-smoke"><i></i><i></i><i></i><i></i></div>' +
      '<div class="mx-ar-word">Arise</div>' +
      '<div class="mx-ar-card" style="--tc:' + T.color + '">' +
      '<div class="mx-ar-k">' + (preview ? "Preview · not saved" : isMon ? "A Monarch's shadow answers your call" : "Shadow extraction complete") + '</div>' +
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
    var labels = STATS.map(function (k, i) { var p = pt(i, R + 16); return '<text x="' + p[0] + '" y="' + (p[1] + 4) + '" fill="' + STAT_COLORS[k] + '">' + k + '</text>'; }).join("");
    var dots = STATS.map(function (k, i) { var p = pt(i, R * Math.min(1, statValue(k) / max)); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.4" fill="' + STAT_COLORS[k] + '" style="filter:drop-shadow(0 0 4px ' + STAT_COLORS[k] + ')"/>'; }).join("");
    var spokes = STATS.map(function (k, i) { var p = pt(i, R * Math.min(1, statValue(k) / max)); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="' + STAT_COLORS[k] + '" stroke-width="1.4" stroke-opacity="0.7"/>'; }).join("");
    var defs = '<defs><linearGradient id="mxRadG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a6e" stop-opacity="0.45"/><stop offset="0.35" stop-color="#c77dff" stop-opacity="0.4"/><stop offset="0.7" stop-color="#5aa8ff" stop-opacity="0.4"/><stop offset="1" stop-color="#3ee6a0" stop-opacity="0.45"/></linearGradient></defs>';
    return '<svg class="mx-radar" viewBox="0 0 220 210" aria-label="Stat chart">' + defs + grid + axes + '<polygon class="sh" points="' + shape + '"/>' + spokes + dots + labels + '</svg>';
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
          var vmax = Math.max.apply(null, STATS.map(statValue));
          return '<div class="mx-st-row" style="--sc:' + STAT_COLORS[k] + '"><span class="nm"><b>' + k + '</b> ' + STAT_NAMES[k] + '<i class="bar"><i style="width:' + Math.round(statValue(k) / vmax * 100) + '%"></i></i></span><span class="val">' + statValue(k) + '</span>' +
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
        if (logFilter === "quest") return h.type === "quest" || h.type === "workout" || h.type === "secret" || h.type === "undo" || h.type === "place";
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
    /* the codex: every class × tier is a figure to collect */
    var have = {};
    D.shadows.forEach(function (sh) { have[sh.cls + "|" + sh.tier] = (have[sh.cls + "|" + sh.tier] || 0) + 1; });
    var found = Object.keys(have).filter(function (k) { return !/\|5$/.test(k); }).length, total = CLASSES.length * 5;
    var guard = '<div class="mx-guard"><div class="mx-guard-h"><span>Monarch\'s Guard</span><span>' + MONARCHS.filter(function (m) { return hasMonarch(m.key); }).length + ' / ' + MONARCHS.length + '</span></div><div class="mx-guard-row">' +
      MONARCHS.map(function (m) {
        var own = hasMonarch(m.key);
        return own ? '<button type="button" class="g on" data-sh="M' + m.key + '">' + monarchFigure(m) + '<b>' + esc(m.name.split(",")[0]) + '</b><i>' + esc(m.cls) + '</i></button>'
          : '<div class="g off">' + monarchFigure(m, true) + '<b>???</b><i>' + esc(m.need) + '</i></div>';
      }).join("") + '</div></div>';
    var codex = guard + '<div class="mx-codex"><div class="mx-codex-h"><span>Codex</span><span><b>' + found + '</b> / ' + total + ' discovered</span></div>' +
      '<div class="mx-codex-bar"><i style="width:' + (found / total * 100).toFixed(1) + '%"></i></div><div class="mx-codex-grid">' +
      TIERS.slice(0, 5).map(function (t, ti) {
        return '<div class="mx-codex-tier" style="color:' + t.color + '">' + t.name + '</div>' + CLASSES.map(function (cl) {
          var n = have[cl + "|" + ti];
          return n ? '<div class="cx on" title="' + t.name + " " + cl + '">' + shadowFigure({ id: "c", tier: ti, cls: cl }, true) + (n > 1 ? '<em>×' + n + '</em>' : "") + '</div>'
            : '<div class="cx off" title="Undiscovered">?</div>';
        }).join("");
      }).join("") + '</div><div class="mx-codex-cls">' + CLASSES.map(function (c) { return "<span>" + c + "</span>"; }).join("") + '</div></div>';
    if (!D.shadows.length) {
      root.innerHTML = '<div class="mx-sh-empty">' + shadowFigure({ id: "empty", tier: 0, cls: "Knight" }) + '<div>Your army is empty.</div></div>' + rules + codex;
      return;
    }
    /* the army: your strongest shadows stand in formation, idling */
    var ranked = D.shadows.slice().sort(function (x, y) { return y.power - x.power; }).slice(0, 9);
    var slots = [[50, 104, 1], [33, 84, 0.85], [67, 84, 0.85], [19, 68, 0.72], [81, 68, 0.72], [8, 56, 0.6], [92, 56, 0.6], [26, 48, 0.5], [74, 48, 0.5]];
    var use3d = D.settings.view3d && window.__mx3d;
    var viewSw = '<div class="mx-view"><button type="button" data-view="3d" class="' + (use3d ? "on" : "") + '">3D</button><button type="button" data-view="2d" class="' + (use3d ? "" : "on") + '">2D</button></div>';
    var army3d = '<div class="mx-army3d"><div class="cap">Shadow army · ' + D.shadows.length + ' strong · tap one to inspect</div><div class="mx-stage" id="mxStage"></div></div>';
    var army = '<div class="mx-army"><div class="cap">Shadow army · ' + D.shadows.length + ' strong · tap one to inspect</div>' + ranked.map(function (sh, i) {
      var sl = slots[i];
      return '<button type="button" class="u" data-sh="' + sh.id + '" style="left:' + sl[0] + '%;width:' + sl[1] + 'px;z-index:' + (20 - i) + ';opacity:' + (0.5 + sl[2] * 0.5).toFixed(2) + ';bottom:' + ((1 - sl[2]) * 34 + 6).toFixed(0) + 'px;animation-delay:-' + (i * 0.7).toFixed(1) + 's" aria-label="' + esc(sh.name) + '">' + shadowFigure(sh) + '</button>';
    }).join("") + '</div>';
    var cards = D.shadows.slice().reverse().map(function (sh) {
      var T = TIERS[sh.tier] || TIERS[0];
      return '<button type="button" class="mx-sh-card" data-sh="' + sh.id + '" style="--tc:' + T.color + '">' + shadowFigure(sh) +
        '<div class="nm">' + esc(sh.name) + '</div><div class="cl">' + T.name + ' · ' + esc(sh.cls) + '</div><div class="pw">PWR ' + sh.power + '</div></button>';
    }).join("");
    if (stage3d) { stage3d.destroy(); stage3d = null; }
    root.innerHTML = viewSw + (use3d ? army3d : army) + codex + '<div class="mx-sh-sub">Roster</div><div class="mx-sh-grid">' + cards + '</div>' + rules;
    liveCards();
    if (use3d) {
      try { stage3d = window.__mx3d.stage($("#mxStage"), ranked, function (id) { inspect(id); }); } catch (err) { stage3d = null; }
    }
  }
  var stage3d = null, turn3d = null;
  document.addEventListener("click", function (e) {
    var v = e.target.closest ? e.target.closest("#mxShadows [data-view]") : null;
    if (!v) return;
    D.settings.view3d = v.getAttribute("data-view") === "3d"; save(); renderShadows();
  });
  /* only cards on screen animate, so a big army stays smooth */
  var liveIO = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.classList.toggle("live", e.isIntersecting); });
  }) : null;
  function liveCards() {
    var cs = document.querySelectorAll("#mxShadows .mx-sh-card");
    for (var i = 0; i < cs.length; i++) { if (liveIO) liveIO.observe(cs[i]); else cs[i].classList.add("live"); }
  }
  function inspect(id) {
    var sh = null;
    D.shadows.forEach(function (x) { if (x.id === id) sh = x; });
    if (!sh) return;
    var T = TIERS[sh.tier] || TIERS[0];
    if (sh.monarch) { var mk2 = monarchByKey(sh.monarch); if (mk2) T = { name: T.name, color: mk2.c1 }; }
    var when = sh.t ? new Date(sh.t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : sh.day;
    var rank = D.shadows.slice().sort(function (a, b) { return b.power - a.power; }).indexOf(sh) + 1;
    var ov = el("div", "mx-inspect", '<div class="mx-ar-card" style="--tc:' + T.color + '"><div class="mx-ar-k">' + T.name + ' · ' + esc(sh.cls) + '</div>' + shadowFigure(sh) +
      '<div class="mx-ar-name">' + esc(sh.name) + '</div>' +
      '<div class="mx-in-stats"><span><b>' + sh.power + '</b>Power</span><span><b>#' + rank + '</b>In army</span><span><b>' + (sh.streak || 1) + '</b>Streak</span></div>' +
      '<div class="mx-ar-meta">Extracted ' + esc(when || "") + '</div><div class="mx-ar-tap">Tap to close</div></div>');
    document.body.appendChild(ov);
    if (D.settings.view3d && window.__mx3d) {
      var fig = ov.querySelector(".mx-sh-fig");
      var box = el("div", "mx-turn"); fig.parentNode.replaceChild(box, fig);
      try { turn3d = window.__mx3d.turntable(box, sh); } catch (err) { turn3d = null; }
    }
    requestAnimationFrame(function () { ov.classList.add("on"); });
    snd("tick");
    ov.addEventListener("click", function () { ov.classList.remove("on"); if (turn3d) { turn3d.destroy(); turn3d = null; } setTimeout(function () { ov.remove(); }, 300); });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("#mxShadows [data-sh]") : null;
    if (b) inspect(b.getAttribute("data-sh"));
  });

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
    if (!brief) {
      brief = el("div", "mx-brief");
      /* the briefing lives inside the weather card, under High / Low / Wind */
      var card = $("#phaseGreet .weather-card"), note = card ? $(".weather-note", card) : null;
      if (card) card.insertBefore(brief, note); else headEl.appendChild(brief);
    }
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
      var mb = el("button", "", "Monarch"); mb.type = "button";
      mb.addEventListener("click", function (e) { e.stopPropagation(); var sh2 = $(".mx-console"); if (sh2) sh2.classList.remove("show"); arise(monarchShadow(MONARCHS[(Math.random() * MONARCHS.length) | 0], true), true); });
      tests.appendChild(mb);
    }
    var row = el("div", "mx-c-row", '<span class="mx-c-k">Sound</span><button type="button" class="mx-c-sound"></button>');
    var row2 = el("div", "mx-c-row col", '<span class="mx-c-k">Save transfer <em>(Safari ↔ home-screen app)</em></span><div class="mx-c-tests"><button type="button" class="mx-c-exp-save">Copy save</button><button type="button" class="mx-c-imp-save">Paste save</button></div>');
    var row3 = el("div", "mx-c-row col", '<span class="mx-c-k">Location quests <em>(auto-complete when you open the app there)</em></span><div class="mx-c-places"></div><div class="mx-c-tests"><button type="button" class="mx-c-place-add">Link this spot</button></div>');
    card.insertBefore(row, note); card.insertBefore(row2, note); card.insertBefore(row3, note);
    paintPlaces(row3);
    $(".mx-c-place-add", row3).addEventListener("click", function (e) { e.stopPropagation(); linkPlace(row3); });
    var sb = $(".mx-c-sound", row);
    function paint() { sb.textContent = D.settings.sound ? "On" : "Off"; sb.classList.toggle("on", D.settings.sound); }
    paint();
    sb.addEventListener("click", function (e) { e.stopPropagation(); D.settings.sound = !D.settings.sound; save(); paint(); if (D.settings.sound) snd("quest"); });
    $(".mx-c-exp-save", row2).addEventListener("click", function (e) {
      e.stopPropagation();
      copySave("Save copied. Paste it into Notes as a backup, or into the other copy of the app → Console → Paste save.");
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



  /* ---------------- location quests ----------------
     A spot saved in Console is linked to a quest by name. Whenever the
     app is opened (or brought back) within ~150 m of that spot, on one
     of its days, the quest completes itself — full EXP, logged as a
     check-in. On its off days the quest doesn't block ARISE. iOS only
     allows location while the app is open, so nothing runs in the
     background. */
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function parseDays(t) {
    t = String(t || "").toLowerCase();
    if (!t.trim() || /every|daily|all/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
    var out = [];
    var rng = t.match(/(sun|mon|tue|wed|thu|fri|sat)\w*\s*[-–]\s*(sun|mon|tue|wed|thu|fri|sat)/);
    if (rng) {
      var a = DAYS.map(function (d) { return d.toLowerCase(); }).indexOf(rng[1]), b = DAYS.map(function (d) { return d.toLowerCase(); }).indexOf(rng[2]);
      for (var i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b) break; }
      return out;
    }
    DAYS.forEach(function (d, i) { if (t.indexOf(d.toLowerCase()) >= 0) out.push(i); });
    return out.length ? out : [0, 1, 2, 3, 4, 5, 6];
  }
  function daysLabel(ds) {
    if (!ds || ds.length === 7) return "every day";
    return ds.map(function (i) { return DAYS[i]; }).join(" ");
  }
  function offToday(questName) {
    var n = String(questName || "").trim().toLowerCase(), today = new Date().getDay();
    var linked = (D.places || []).filter(function (p) { return p.quest.trim().toLowerCase() === n; });
    if (!linked.length) return false;
    return !linked.some(function (p) { return !p.days || p.days.indexOf(today) >= 0; });
  }
  function distM(a, b, c, d) {
    var R = 6371000, toR = Math.PI / 180, dLa = (c - a) * toR, dLo = (d - b) * toR;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function paintPlaces(row3) {
    var box = $(".mx-c-places", row3); if (!box) return;
    box.innerHTML = (D.places || []).length ? "" : '<div class="mx-c-pl-empty">No spots linked yet</div>';
    (D.places || []).forEach(function (p, i) {
      var r = el("div", "mx-c-pl", '<span><b>' + esc(p.quest) + '</b> · ' + esc(daysLabel(p.days)) + '</span><button type="button">Remove</button>');
      $("button", r).addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm('Unlink "' + p.quest + '" from this spot?')) return;
        D.places.splice(i, 1); save(); paintPlaces(row3);
      });
      box.appendChild(r);
    });
  }
  function linkPlace(row3) {
    if (!navigator.geolocation) { alert("Location isn't available on this device."); return; }
    var s = st() || { daily: [], weekly: [] };
    var names = s.daily.concat(s.weekly || []).map(function (q) { return q.name; }).filter(function (n) { return n !== "Workout"; });
    var quest = prompt("Which quest should complete at this spot? Type its name exactly.\n\nYour quests: " + names.join(", "), names.indexOf("Work") >= 0 ? "Work" : "");
    if (!quest || !quest.trim()) return;
    quest = quest.trim();
    var match = names.filter(function (n) { return n.toLowerCase() === quest.toLowerCase(); })[0];
    if (!match) { alert('No quest named "' + quest + '". Add it in Quests first, then link it here.'); return; }
    var days = prompt("Which days? e.g. Wed-Sat, or Mon Wed Fri. Leave blank for every day.", "");
    if (days === null) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      D.places = D.places || [];
      D.places.push({ quest: match, lat: pos.coords.latitude, lon: pos.coords.longitude, r: 150, days: parseDays(days) });
      save(); paintPlaces(row3);
      alert('Linked. "' + match + '" will complete when you open the app here (' + daysLabel(parseDays(days)) + ').');
      lastPlaceCheck = 0; checkPlaces();
    }, function () {
      alert("Couldn't get your location. Allow location for this app and try again.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  var lastPlaceCheck = 0;
  function checkPlaces() {
    if (!(D.places || []).length || !navigator.geolocation || !window.__mxCompleteQuest) return;
    var now = Date.now(); if (now - lastPlaceCheck < 60000) return; lastPlaceCheck = now;
    var s = st(); if (!s) return;
    var today = new Date().getDay();
    var due = D.places.filter(function (p) {
      if (p.days && p.days.indexOf(today) < 0) return false;
      var q = s.daily.concat(s.weekly || []).filter(function (x) { return x.name.trim().toLowerCase() === p.quest.trim().toLowerCase(); })[0];
      return q && !q.done;
    });
    if (!due.length) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      due.forEach(function (p) {
        var d = distM(pos.coords.latitude, pos.coords.longitude, +p.lat, +p.lon);
        if (d <= (p.r || 150) + Math.min(pos.coords.accuracy || 0, 100)) {
          if (window.__mxCompleteQuest(p.quest) === true) {
            log("place", "Checked in — " + p.quest + " auto-completed");
            if (D.settings.sound) snd("quest");
            placeNotice(p.quest);
          }
        }
      });
    }, function () {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 });
  }
  function placeNotice(q) {
    var b = el("div", "mx-backup mx-place-note", '<div class="mx-bk-k">System notice</div><div class="mx-bk-t">Location confirmed</div><div class="mx-bk-d">Quest cleared: <b>' + esc(q) + '</b></div>');
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add("show"); });
    setTimeout(function () { b.classList.remove("show"); setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 400); }, 3200);
  }
  setTimeout(checkPlaces, 2500);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { lastPlaceCheck = 0; setTimeout(checkPlaces, 800); } });

  /* ---------------- weekly backup reminder ----------------
     Deleting the home-screen app deletes its save, so once a week the
     System asks for a backup: one tap copies the save code to paste
     into Notes. "Later" snoozes it a day. */
  var WEEK = 7 * 864e5;
  function saveCode() {
    return "SYSTEM-SAVE:" + btoa(unescape(encodeURIComponent(JSON.stringify({ v1: localStorage.getItem("systemApp.v1"), v2: localStorage.getItem(KEY) }))));
  }
  function copySave(msg) {
    D.lastBackup = Date.now(); save();
    var blob = saveCode();
    var done = function () { alert(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(blob).then(done, function () { prompt("Copy this save code:", blob); });
    else prompt("Copy this save code:", blob);
  }
  function checkBackup() {
    var now = Date.now(), mainEl = document.getElementById("main");
    if (!mainEl || mainEl.classList.contains("is-hidden") || document.hidden || $(".mx-backup") || document.querySelector(".mx-arise")) return;
    if ((D.backupSnooze || 0) > now) return;
    if (now - (D.lastBackup || D.firstOpen || now) < WEEK) return;
    var b = el("div", "mx-backup", '<div class="mx-bk-k">System notice</div><div class="mx-bk-t">Back up your progress</div>' +
      '<div class="mx-bk-d">Copy your save code and paste it into Notes. If the app is ever deleted, Paste save brings everything back.</div>' +
      '<div class="mx-bk-b"><button type="button" class="later">Later</button><button type="button" class="go">Copy save</button></div>');
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add("show"); });
    function close() { b.classList.remove("show"); setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 400); }
    $(".go", b).addEventListener("click", function (e) { e.stopPropagation(); close(); copySave("Save copied — paste it into Notes. Next reminder in a week."); });
    $(".later", b).addEventListener("click", function (e) { e.stopPropagation(); D.backupSnooze = Date.now() + 864e5; save(); close(); });
  }
  setTimeout(checkBackup, 6000);
  setInterval(checkBackup, 60000);

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
    /* re-render only when the panel goes from hidden to shown — re-rendering on
       other class flips (like the swipe-to-close drag) would pull the touched
       element out from under the finger and break the swipe */
    if (sec) new MutationObserver(function (list) {
      list.forEach(function (m) {
        var was = /\bis-hidden\b/.test(m.oldValue || ""), now = sec.classList.contains("is-hidden");
        if (was && !now) { renderStatus(); renderShadows(); }
        if (!was && now && id === "sec-shadows" && stage3d) { stage3d.destroy(); stage3d = null; }
      });
    }).observe(sec, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  });
  setInterval(function () { checkDaily(); checkMonarchs(); renderTiles(); }, 5000);
  setTimeout(checkDaily, 4000);
})();
