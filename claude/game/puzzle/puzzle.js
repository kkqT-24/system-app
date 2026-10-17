/* Shadow Runes — match-3 battle for the System app (test build).
   Swap runes to match 3+. Each rune color powers one shadow in your squad; the squad hits the gate's monsters.
   Monsters count down and strike back. Clear 3 waves (the last is the gate boss) to clear a floor, then climb.
   Everything is drawn in code; world is a fixed 400x720 portrait field scaled to fit. */
(function () {
  "use strict";

  var W = 400, H = 720, TAU = Math.PI * 2;
  var COLS = 7, ROWS = 6, CELL = 54, BX = 11, BY = 388;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function $(id) { return document.getElementById(id); }
  var FAST = false;
  function sleep(ms) { return new Promise(function (r) { if (FAST) r(); else setTimeout(r, ms); }); }

  /* ------------------------------------------------------------------ squad */
  var COLORS = [
    { name: "Blade", role: "Vanguard", base: "#ff4d6d", light: "#ffd0d8", dark: "#6e0a1f", glow: "255,77,109", does: "Heavy hit on your target" },
    { name: "Arrow", role: "Ranger", base: "#38bdf8", light: "#dcf4ff", dark: "#0a3f63", glow: "56,189,248", does: "Hits your target, splashes the next" },
    { name: "Arcane", role: "Arcane", base: "#a66bff", light: "#efe4ff", dark: "#33107a", glow: "166,107,255", does: "Hits every monster" },
    { name: "Mend", role: "Healer", base: "#34d399", light: "#d6fbe9", dark: "#05523c", glow: "52,211,153", does: "Heals the squad" },
    { name: "Ward", role: "Bulwark", base: "#fbbf24", light: "#fff4cc", dark: "#704404", glow: "251,191,36", does: "Shields the next hits" }
  ];
  var CLS_COLOR = { Knight: 0, Berserker: 0, Lancer: 0, Archer: 1, Assassin: 1, Mage: 2, Healer: 3, Bulwark: 4 };
  var DEFAULT_CLS = ["Knight", "Archer", "Mage", "Healer", "Bulwark"];
  var POW = [15, 12, 8, 7, 6];
  var ARMY = (function () {
    var out = { lv: [1, 1, 1, 1, 1], cls: DEFAULT_CLS.slice(), total: 0, real: false };
    try {
      var raw = JSON.parse(localStorage.getItem("systemApp.v2"));
      if (raw && Array.isArray(raw.shadows)) {
        var seen = [false, false, false, false, false];
        raw.shadows.forEach(function (s) {
          if (!s || s.preview) return;
          out.total++;
          if (s.monarch) { for (var i = 0; i < 5; i++) out.lv[i]++; return; }
          var ci = CLS_COLOR[s.cls];
          if (ci === undefined) return;
          out.lv[ci]++;
          if (!seen[ci]) { seen[ci] = true; out.cls[ci] = s.cls; }
        });
        out.real = out.total > 0;
      }
    } catch (e) {}
    if (!out.real) out.lv = [3, 3, 3, 3, 3];
    out.lv = out.lv.map(function (v) { return Math.min(10, v); });
    return out;
  })();
  function lvMul(i) { return 1 + 0.12 * (ARMY.lv[i] - 1); }

  /* ------------------------------------------------------------------ monsters */
  var ED = {
    ghoul: { name: "Ghoul", hp: 70, atk: 12, cd: 2, sc: 4.1, top: 17 },
    bat: { name: "Gate Bat", hp: 60, atk: 9, cd: 1, sc: 3.8, weak: 1, top: 25 },
    orc: { name: "Orc Brute", hp: 150, atk: 24, cd: 3, sc: 3.5, top: 23 },
    cultist: { name: "Red Cultist", hp: 130, atk: 20, cd: 2, sc: 3.5, res: [2], weak: 0, top: 25 },
    golem: { name: "Stone Golem", hp: 240, atk: 32, cd: 4, sc: 3.0, res: [0, 1], weak: 2, top: 26 },
    boss: { name: "Gate Boss", hp: 950, atk: 55, cd: 3, sc: 2.15, boss: true, top: 64 }
  };
  var BOSS_NAMES = ["Grath the Gatekeeper", "Morrow, Bone Tyrant", "The Ashen Ogre", "Hollow King Vess", "Ruun of the Red Gate", "Skarn, the Iron Maw", "Velka, Blood Matron", "The Sunken Colossus"];
  function modFor(e, col) { var d = e.d; if (d.weak === col) return 1.5; if (d.res && d.res.indexOf(col) >= 0) return 0.55; return 1; }

  var BOONS = [
    { id: "c0", name: "Crimson Edge", desc: "Blade runes deal +25% damage.", col: 0 },
    { id: "c1", name: "Piercing Volley", desc: "Arrow runes deal +25% damage.", col: 1 },
    { id: "c2", name: "Abyssal Focus", desc: "Arcane runes deal +25% damage.", col: 2 },
    { id: "c3", name: "Deep Mend", desc: "Mend runes heal 35% more.", col: 3 },
    { id: "c4", name: "Iron Ward", desc: "Ward runes shield 35% more.", col: 4 },
    { id: "chain", name: "Chain Fury", desc: "Combo bonus grows 50% faster.", col: -1 },
    { id: "well", name: "Deep Well", desc: "ARISE charges 30% faster.", col: -1 },
    { id: "start", name: "Monarch's Call", desc: "Start each floor with ARISE half charged.", col: -1 },
    { id: "vital", name: "Vitality", desc: "+20% max HP, and heal to full now.", col: -1 },
    { id: "wind", name: "Second Wind", desc: "Heal 20% after each wave.", col: -1 },
    { id: "exec", name: "Executioner", desc: "+40% damage to monsters under 30% HP.", col: -1 }
  ];
  var TIERS = [{ name: "Soldier", color: "#8f86c9" }, { name: "Elite", color: "#6f9bff" }, { name: "Knight", color: "#a855f7" }, { name: "Commander", color: "#e879f9" }, { name: "Marshal", color: "#ffd166" }];
  var CLASSES = ["Knight", "Archer", "Mage", "Assassin", "Lancer", "Bulwark", "Healer", "Berserker"];

  /* ------------------------------------------------------------------ save */
  var SKEY = "systemPZ.v1";
  var SAVE = (function () { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } })();
  if (!SAVE.best) SAVE.best = 0;
  if (!SAVE.log) SAVE.log = [];
  function persist() { try { localStorage.setItem(SKEY, JSON.stringify(SAVE)); } catch (e) {} }

  /* ------------------------------------------------------------------ state */
  var G = null, tileId = 0;
  function B(id) { return (G && G.boons[id]) || 0; }
  function newRun() { return { floor: 1, hp: null, boons: {}, extracted: [] }; }
  function maxHpFor(boons) { return Math.round(360 * (1 + 0.2 * (boons.vital || 0))); }
  function startFloor(run) {
    var mh = maxHpFor(run.boons);
    G = {
      run: run, floor: run.floor, boons: run.boons, maxHp: mh, hp: run.hp == null ? mh : Math.min(mh, run.hp), shield: 0,
      hpShown: 0, wave: 0, enemies: [], grid: [], busy: false, sel: null, target: null, arise: 50 * Math.min(1, B("start")),
      moves: 0, parts: [], floats: [], banners: [], shake: 0, t: 0, partyFlash: 0, idle: 0, hint: null, cards: [0, 0, 0, 0, 0].map(function () { return { pulse: 0, swing: 0 }; }),
      bossName: BOSS_NAMES[(run.floor - 1) % BOSS_NAMES.length], over: false
    };
    G.hpShown = G.hp;
    makeGrid();
    SAVE.run = { floor: run.floor, hp: G.hp, boons: run.boons, extracted: run.extracted }; persist();
    nextWave(true);
    hud();
  }

  /* ------------------------------------------------------------------ grid */
  function cx(c) { return BX + c * CELL + CELL / 2; }
  function cy(r) { return BY + r * CELL + CELL / 2; }
  function mkTile(col, r, c, sp) { return { id: ++tileId, col: col, sp: sp || null, x: cx(c), y: cy(r), vy: 0, mv: null, pop: 0, squash: 0 }; }
  function makeGrid() {
    var g = [];
    for (var r = 0; r < ROWS; r++) {
      g.push([]);
      for (var c = 0; c < COLS; c++) {
        var col, tries = 0;
        do { col = (Math.random() * 5) | 0; tries++; }
        while (tries < 30 && ((c >= 2 && g[r][c - 1].col === col && g[r][c - 2].col === col) || (r >= 2 && g[r - 1][c].col === col && g[r - 2][c].col === col)));
        var t = mkTile(col, r, c); t.y = cy(r) - 420 - (ROWS - r) * 30; g[r].push(t);
      }
    }
    G.grid = g;
    if (!findMove()) makeGrid();
  }
  function at(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS ? G.grid[r][c] : null; }
  function findRuns() {
    var runs = [], g = G.grid, r, c, e, t;
    for (r = 0; r < ROWS; r++) {
      c = 0;
      while (c < COLS) {
        t = g[r][c]; if (!t || t.col < 0) { c++; continue; }
        e = c + 1; while (e < COLS && g[r][e] && g[r][e].col === t.col) e++;
        if (e - c >= 3) { var cells = []; for (var k = c; k < e; k++) cells.push(r * COLS + k); runs.push({ dir: "h", col: t.col, cells: cells }); }
        c = e;
      }
    }
    for (c = 0; c < COLS; c++) {
      r = 0;
      while (r < ROWS) {
        t = g[r][c]; if (!t || t.col < 0) { r++; continue; }
        e = r + 1; while (e < ROWS && g[e][c] && g[e][c].col === t.col) e++;
        if (e - r >= 3) { var cl = []; for (var k2 = r; k2 < e; k2++) cl.push(k2 * COLS + c); runs.push({ dir: "v", col: t.col, cells: cl }); }
        r = e;
      }
    }
    return runs;
  }
  function swapGrid(r1, c1, r2, c2) { var t = G.grid[r1][c1]; G.grid[r1][c1] = G.grid[r2][c2]; G.grid[r2][c2] = t; }
  function findMove() {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = G.grid[r][c];
      if (t && t.sp === "orb") return [[r, c], c + 1 < COLS ? [r, c + 1] : [r, c - 1]];
      var dirs = [[0, 1], [1, 0]];
      for (var d = 0; d < 2; d++) {
        var r2 = r + dirs[d][0], c2 = c + dirs[d][1];
        if (r2 >= ROWS || c2 >= COLS) continue;
        var u = G.grid[r2][c2];
        if (t.sp && u.sp) return [[r, c], [r2, c2]];
        swapGrid(r, c, r2, c2); var ok = findRuns().length > 0; swapGrid(r, c, r2, c2);
        if (ok) return [[r, c], [r2, c2]];
      }
    }
    return null;
  }
  function gravity() {
    for (var c = 0; c < COLS; c++) {
      var stack = [];
      for (var r = ROWS - 1; r >= 0; r--) if (G.grid[r][c]) stack.push(G.grid[r][c]);
      var spawned = 0;
      for (var r2 = ROWS - 1; r2 >= 0; r2--) {
        var i = ROWS - 1 - r2;
        if (i < stack.length) G.grid[r2][c] = stack[i];
        else { var t = mkTile((Math.random() * 5) | 0, r2, c); spawned++; t.y = BY - 30 - spawned * CELL; G.grid[r2][c] = t; }
      }
    }
  }
  function settled() {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var t = G.grid[r][c]; if (t && (t.mv || Math.abs(t.y - cy(r)) > 0.5 || Math.abs(t.x - cx(c)) > 0.5)) return false; }
    return true;
  }
  function snapAll() { for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var t = G.grid[r][c]; if (t) { t.mv = null; t.x = cx(c); t.y = cy(r); t.vy = 0; } } }
  function waitSettle() {
    if (FAST) { snapAll(); return Promise.resolve(); }
    return new Promise(function (res) { (function chk() { if (settled()) res(); else setTimeout(chk, 16); })(); });
  }
  function moveTile(t, r, c, dur) { t.mv = { fx: t.x, fy: t.y, tx: cx(c), ty: cy(r), t: 0, dur: dur }; }

  /* ------------------------------------------------------------------ fx */
  function part(o) { if (G.parts.length > 700) G.parts.shift(); o.life0 = o.life; G.parts.push(o); return o; }
  function burst(x, y, col, n) {
    var C = COLORS[col] || { glow: "196,181,253", base: "#c4b5fd" };
    for (var i = 0; i < n; i++) { var a = rnd(0, TAU), v = rnd(60, 220); part({ t: "shard", x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: rnd(0, TAU), vr: rnd(-12, 12), s: rnd(2.5, 5.5), life: rnd(0.35, 0.6), c: C.base }); }
    part({ t: "flash", x: x, y: y, r: CELL * 0.6, life: 0.22, c: C.glow });
  }
  function sparks(x, y, rgb, n, sp) { for (var i = 0; i < n; i++) { var a = rnd(0, TAU), v = rnd(40, sp || 160); part({ t: "spark", x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.2, 0.45), c: rgb, w: rnd(1, 2) }); } }
  function ring(x, y, rgb, r0, r1, life, w) { part({ t: "ring", x: x, y: y, r0: r0, r1: r1, life: life, c: rgb, w: w || 2 }); }
  function floatText(x, y, txt, col, size, life) { G.floats.push({ x: x, y: y, txt: txt, c: col, life: life || 0.9, life0: life || 0.9, size: size || 16, vy: -40 }); }
  function banner(txt, sub, col, life) { G.banners = [{ txt: txt, sub: sub || "", c: col || "#c3b8fe", life: life || 1.6, life0: life || 1.6 }]; }
  function shake(n) { G.shake = Math.max(G.shake, n); }
  function cardX(i) { return 8 + i * 78 + 36; }
  var CARD_Y = 296, CARD_H = 70;

  /* ------------------------------------------------------------------ waves */
  function waveTypes(f, w) {
    if (w === 1) return f < 3 ? [pick(["ghoul", "bat", "ghoul"]), pick(["ghoul", "orc", "bat"])] : [pick(["ghoul", "bat"]), pick(["orc", "ghoul"]), pick(["bat", "cultist"])];
    if (w === 2) { var pool = f < 2 ? ["orc", "ghoul", "bat", "cultist"] : ["orc", "cultist", "golem", "bat", "ghoul"]; return [pick(pool), pick(pool), pick(pool)]; }
    return f >= 3 ? ["boss", pick(["ghoul", "bat", "cultist"])] : ["boss"];
  }
  function nextWave(first) {
    G.wave++;
    var types = waveTypes(G.floor, G.wave), n = types.length, hpMul = Math.pow(1.22, G.floor - 1), atkMul = Math.pow(1.13, G.floor - 1);
    var xs = n === 1 ? [200] : n === 2 ? (types[0] === "boss" ? [235, 78] : [125, 275]) : [72, 200, 328];
    G.enemies = types.map(function (ty, i) {
      var d = ED[ty], hp = Math.round(d.hp * hpMul * (d.boss ? 1 + 0.08 * (G.floor - 1) : 1));
      return { type: ty, d: d, hp: hp, max: hp, shown: hp, atk: Math.round(d.atk * atkMul), cdMax: d.cd, cd: d.cd + (i % 2), x: xs[i], y: d.boss ? 262 : 250,
        flash: 0, lunge: 0, dead: false, fade: 0, enter: 1 + i * 0.25, ph: rnd(0, TAU) };
    });
    G.target = null;
    if (G.wave === 3) banner("BOSS", G.bossName, "#ff6b7a", 2);
    else banner(first ? "FLOOR " + G.floor : "WAVE " + G.wave, first ? "Match runes to strike" : "", "#c3b8fe", 1.6);
    hud();
  }
  function alive() { return G.enemies.filter(function (e) { return !e.dead; }); }
  function currentTarget() {
    if (G.target && !G.target.dead) return G.target;
    var a = alive(); if (!a.length) return null;
    a.sort(function (x, y) { return x.hp - y.hp; });
    return a[0];
  }

  /* ------------------------------------------------------------------ turn */
  async function trySwap(r1, c1, r2, c2) {
    if (G.busy || G.over) return;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    G.busy = true; G.hint = null; G.idle = 0; G.sel = null;
    var a = G.grid[r1][c1], b = G.grid[r2][c2];
    moveTile(a, r2, c2, 0.14); moveTile(b, r1, c1, 0.14); swapGrid(r1, c1, r2, c2);
    await waitSettle();
    var forced = null;
    if (a.sp === "orb" || b.sp === "orb") {
      forced = [];
      if (a.sp === "orb" && b.sp === "orb") { for (var k = 0; k < ROWS * COLS; k++) forced.push(k); }
      else {
        var orb = a.sp === "orb" ? a : b, other = orb === a ? b : a, oc = other.col;
        orb.sp = "orbfired";
        forced.push(orb === a ? r2 * COLS + c2 : r1 * COLS + c1);
        for (var rr = 0; rr < ROWS; rr++) for (var cc = 0; cc < COLS; cc++) { var t = G.grid[rr][cc]; if (t && t.col === oc) { forced.push(rr * COLS + cc); if (other.sp && t !== other) t.sp = other.sp === "h" || other.sp === "v" ? (Math.random() < 0.5 ? "h" : "v") : other.sp; } }
        vortex(cx(orb === a ? c2 : c1), cy(orb === a ? r2 : r1), oc);
      }
    } else if (a.sp && b.sp) {
      forced = [r1 * COLS + c1, r2 * COLS + c2];
    } else if (!findRuns().length) {
      moveTile(a, r1, c1, 0.14); moveTile(b, r2, c2, 0.14); swapGrid(r1, c1, r2, c2);
      a.nope = 0.3; b.nope = 0.3;
      await waitSettle(); G.busy = false; return;
    }
    G.moves++; hud();
    var res = await cascade([r2 * COLS + c2, r1 * COLS + c1], forced);
    await attackPhase(res);
    if (G.over) return;
    if (!alive().length) await waveCleared();
    else await enemyPhase();
    if (G.over) return;
    if (!findMove()) await reshuffle();
    G.busy = false;
  }

  async function cascade(pref, forced) {
    var counts = [0, 0, 0, 0, 0], combo = 0, total = 0;
    while (true) {
      var runs = findRuns();
      if (!runs.length && !forced) break;
      combo++;
      var clear = new Set(forced || []); forced = null;
      runs.forEach(function (rn) { rn.cells.forEach(function (k) { clear.add(k); }); });
      // specials born from big matches
      var creates = {}, used = {};
      var hr = runs.filter(function (x) { return x.dir === "h"; }), vr = runs.filter(function (x) { return x.dir === "v"; });
      hr.forEach(function (h, hi) {
        vr.forEach(function (v, vi) {
          if (h.col !== v.col || used["h" + hi] || used["v" + vi]) return;
          var inter = h.cells.filter(function (k) { return v.cells.indexOf(k) >= 0; })[0];
          if (inter === undefined) return;
          used["h" + hi] = used["v" + vi] = true; creates[inter] = { col: h.col, sp: "bomb" };
        });
      });
      function spot(cells) {
        if (pref) for (var i = 0; i < pref.length; i++) if (cells.indexOf(pref[i]) >= 0 && !creates[pref[i]]) return pref[i];
        var m = cells[Math.floor((cells.length - 1) / 2)]; return creates[m] ? cells[0] : m;
      }
      hr.forEach(function (h, hi) { if (used["h" + hi]) return; if (h.cells.length >= 5) creates[spot(h.cells)] = { col: -1, sp: "orb" }; else if (h.cells.length === 4) creates[spot(h.cells)] = { col: h.col, sp: "h" }; });
      vr.forEach(function (v, vi) { if (used["v" + vi]) return; if (v.cells.length >= 5) creates[spot(v.cells)] = { col: -1, sp: "orb" }; else if (v.cells.length === 4) creates[spot(v.cells)] = { col: v.col, sp: "v" }; });
      // specials caught in the blast go off
      var queue = Array.from(clear), fired = {};
      while (queue.length) {
        var k = queue.pop(), t = G.grid[(k / COLS) | 0][k % COLS];
        if (!t || !t.sp || t.sp === "orbfired" || fired[t.id] || t.fresh) continue;
        fired[t.id] = true;
        effectCells(t, k).forEach(function (k2) { if (!clear.has(k2)) { clear.add(k2); queue.push(k2); } });
      }
      // break them
      var delay = 0;
      clear.forEach(function (k) {
        var r = (k / COLS) | 0, c = k % COLS, t = G.grid[r][c];
        if (!t) return;
        if (t.col >= 0) { counts[t.col]++; total++; flyOrb(t.x, t.y, t.col, delay); delay += 0.012; }
        burst(t.x, t.y, t.col, t.col >= 0 ? 6 : 14);
        G.grid[r][c] = null;
      });
      Object.keys(creates).forEach(function (kk) {
        var k = +kk, r = (k / COLS) | 0, c = k % COLS, cr = creates[k], t = mkTile(cr.col, r, c, cr.sp);
        t.pop = 1; t.fresh = true; G.grid[r][c] = t;
        ring(t.x, t.y, cr.col >= 0 ? COLORS[cr.col].glow : "196,181,253", 6, 40, 0.45, 3);
      });
      if (combo >= 2) { floatText(BX + COLS * CELL / 2, BY - 8, "COMBO ×" + combo, combo >= 4 ? "#ffd166" : "#e9d5ff", 14 + Math.min(10, combo * 2), 0.8); }
      shake(Math.min(6, 1 + clear.size * 0.15));
      await sleep(170);
      gravity();
      await waitSettle();
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (G.grid[r][c]) G.grid[r][c].fresh = false;
      pref = null;
    }
    return { counts: counts, combo: combo, total: total };
  }
  function effectCells(t, k) {
    var r = (k / COLS) | 0, c = k % COLS, out = [], i, j;
    if (t.sp === "h") { for (i = 0; i < COLS; i++) out.push(r * COLS + i); beam(cy(r), true, t.col); }
    else if (t.sp === "v") { for (i = 0; i < ROWS; i++) out.push(i * COLS + c); beam(cx(c), false, t.col); }
    else if (t.sp === "bomb") { for (i = -1; i <= 1; i++) for (j = -1; j <= 1; j++) if (at(r + i, c + j)) out.push((r + i) * COLS + c + j); ring(cx(c), cy(r), COLORS[t.col].glow, 10, CELL * 1.8, 0.45, 4); shake(5); }
    else if (t.sp === "orb") {
      var n = [0, 0, 0, 0, 0]; G.grid.forEach(function (row) { row.forEach(function (u) { if (u && u.col >= 0) n[u.col]++; }); });
      var best = n.indexOf(Math.max.apply(null, n));
      G.grid.forEach(function (row, ri) { row.forEach(function (u, ci) { if (u && u.col === best) out.push(ri * COLS + ci); }); });
      vortex(cx(c), cy(r), best);
    }
    return out;
  }
  function beam(pos, horiz, col) { part({ t: "beam", p: pos, h: horiz, life: 0.35, c: COLORS[col] ? COLORS[col].glow : "196,181,253" }); shake(4); }
  function vortex(x, y, col) { ring(x, y, "196,181,253", 4, 90, 0.6, 4); ring(x, y, COLORS[col] ? COLORS[col].glow : "196,181,253", 4, 60, 0.45, 3); shake(7); }
  function flyOrb(x, y, col, delay) {
    part({ t: "orb", sx: x, sy: y, ex: cardX(col), ey: CARD_Y + 30, mx: (x + cardX(col)) / 2 + rnd(-40, 40), my: Math.min(y, CARD_Y) - rnd(30, 70), life: 0.5, delay: delay, col: col, x: x, y: y });
  }

  async function attackPhase(res) {
    var cm = 1 + 0.25 * (res.combo - 1) * (1 + 0.5 * B("chain"));
    G.arise = Math.min(100, G.arise + (res.total * 1.25 + (res.combo - 1) * 5) * (1 + 0.3 * B("well")));
    await sleep(380);
    for (var col = 0; col < 5; col++) {
      var n = res.counts[col]; if (!n) continue;
      var card = G.cards[col]; card.pulse = 1; card.swing = 0.25;
      var amt = n * POW[col] * lvMul(col) * cm * (1 + 0.25 * B("c" + col));
      if (col === 3) {
        var heal = Math.round(amt * 1.1); G.hp = Math.min(G.maxHp, G.hp + heal);
        floatText(cardX(3), CARD_Y + 6, "+" + heal, "#6ee7b7", 15); sparks(cardX(3), CARD_Y + 76, "52,211,153", 14, 140);
        await sleep(120); continue;
      }
      if (col === 4) {
        var sh = Math.round(Math.min(amt, G.maxHp * 0.3 - G.shield)); if (sh < 1) sh = 0; G.shield += sh;
        floatText(cardX(4), CARD_Y + 6, "+" + sh + " ward", "#fde68a", 14); sparks(cardX(4), CARD_Y + 76, "251,191,36", 14, 140);
        await sleep(120); continue;
      }
      var tg = currentTarget(); if (!tg) break;
      var hits;
      if (col === 0) hits = [[tg, 1]];
      else if (col === 1) { var others = alive().filter(function (e) { return e !== tg; }); hits = [[tg, 1]]; if (others.length) hits.push([others[0], 0.4]); }
      else hits = alive().map(function (e) { return [e, 1]; });
      hits.forEach(function (h) { shoot(col, h[0]); });
      await sleep(FAST ? 0 : 230);
      hits.forEach(function (h) { var e = h[0]; if (e.dead) return; dealDamage(e, amt * h[1] * modFor(e, col), col); });
      await sleep(90);
    }
    await sleep(160);
  }
  function dealDamage(e, amt, col) {
    if (e.dead) return;
    if (e.hp < e.max * 0.3) amt *= 1 + 0.4 * B("exec");
    amt = Math.max(1, Math.round(amt));
    e.hp -= amt; e.flash = 0.12;
    var m = col >= 0 ? modFor(e, col) : 1;
    var hy = e.y - e.d.top * e.d.sc * 0.6;
    floatText(e.x + rnd(-10, 10), hy, amt + (m > 1 ? "!" : ""), col >= 0 ? COLORS[col].light : "#e9d5ff", m > 1 ? 22 : m < 1 ? 14 : 18);
    if (m > 1) floatText(e.x, hy - 20, "WEAK", "#ffd166", 10, 0.7);
    if (m < 1) floatText(e.x, hy - 18, "RESIST", "#94a3b8", 9, 0.7);
    sparks(e.x, e.y - 30, col >= 0 ? COLORS[col].glow : "196,181,253", 10, 180);
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.hp = 0; e.dead = true; e.fade = 1;
    for (var i = 0; i < 26; i++) part({ t: "smoke", x: e.x + rnd(-20, 20), y: e.y - rnd(0, 50), vx: rnd(-20, 20), vy: -rnd(20, 60), r: rnd(4, 10), life: rnd(0.6, 1.2), c: e.d.boss ? "200,60,60" : "120,100,150" });
    sparks(e.x, e.y - 30, "253,164,175", e.d.boss ? 40 : 14, 220);
    shake(e.d.boss ? 12 : 4);
    if (G.target === e) G.target = null;
  }
  function shoot(col, e) {
    var sx = cardX(col), sy = CARD_Y + 10, ex = e.x + rnd(-8, 8), ey = e.y - e.d.top * e.d.sc * 0.45;
    part({ t: "shot", col: col, sx: sx, sy: sy, ex: ex, ey: ey, x: sx, y: sy, life: 0.23 });
  }
  async function enemyPhase() {
    var list = alive();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      e.cd--;
      if (e.cd > 0) continue;
      var enraged = e.d.boss && e.hp < e.max * 0.3;
      e.cd = enraged ? Math.max(2, e.cdMax - 1) : e.cdMax;
      e.lunge = 1;
      await sleep(180);
      var dmg = Math.round(e.atk * (enraged ? 1.25 : 1) * rnd(0.9, 1.1)), absorbed = Math.min(G.shield, dmg);
      G.shield -= absorbed; dmg -= absorbed; G.hp = Math.max(0, G.hp - dmg);
      G.partyFlash = absorbed && !dmg ? -0.6 : 0.6; shake(e.d.boss ? 9 : 5);
      part({ t: "claw", x: rnd(80, 320), y: CARD_Y + 34, life: 0.3, big: !!e.d.boss });
      floatText(200 + rnd(-40, 40), CARD_Y + 20, dmg ? "-" + dmg : "WARDED", dmg ? "#ff8291" : "#fde68a", dmg ? 20 : 14);
      if (absorbed && dmg) floatText(200, CARD_Y + 44, absorbed + " warded", "#fde68a", 11);
      await sleep(320);
      if (G.hp <= 0) { G.over = true; banner("THE SQUAD FALLS", "", "#ff4d5e", 2); await sleep(1400); showDefeat(); return; }
    }
  }
  async function waveCleared() {
    await sleep(500);
    if (G.wave >= 3) {
      G.over = true; banner("GATE CLEARED", G.bossName + " falls", "#ffd166", 2.2);
      await sleep(1700); showVictory(); return;
    }
    if (B("wind")) { var h = Math.round(G.maxHp * 0.2 * B("wind")); G.hp = Math.min(G.maxHp, G.hp + h); floatText(200, CARD_Y + 20, "+" + h, "#6ee7b7", 16); }
    nextWave(false);
    await sleep(900);
  }
  async function reshuffle() {
    banner("RESHUFFLE", "", "#c3b8fe", 1.2);
    do {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var t = G.grid[r][c]; if (!t.sp) { t.col = (Math.random() * 5) | 0; t.pop = 1; } }
    } while (findRuns().length || !findMove());
    await sleep(600);
  }
  async function doArise() {
    if (G.busy || G.over || G.arise < 100) return;
    G.busy = true; G.arise = 0; G.hint = null;
    banner("ARISE", "Your army answers", "#c4b5fd", 1.8);
    for (var i = 0; i < 5; i++) { part({ t: "pillar", x: cardX(i), y: CARD_Y + CARD_H, life: 1.0, delay: i * 0.06 }); G.cards[i].pulse = 1; G.cards[i].swing = 0.25; }
    G.ariseFx = 1.4; shake(8);
    await sleep(650);
    var dmg = (POW[0] * lvMul(0) + POW[1] * lvMul(1) + POW[2] * lvMul(2)) * 6;
    alive().forEach(function (e) { for (var k = 0; k < 3; k++) shoot(k, e); });
    await sleep(240);
    alive().forEach(function (e) { dealDamage(e, dmg, -1); ring(e.x, e.y - 20, "196,181,253", 6, 70, 0.5, 3); });
    var heal = Math.round(G.maxHp * 0.15); G.hp = Math.min(G.maxHp, G.hp + heal); floatText(cardX(3), CARD_Y + 6, "+" + heal, "#6ee7b7", 15);
    shake(10);
    await sleep(500);
    if (!alive().length) await waveCleared();
    if (!G.over) G.busy = false;
  }

  /* ------------------------------------------------------------------ update */
  function update(dt) {
    G.t += dt;
    G.shake = Math.max(0, G.shake - dt * 24);
    G.partyFlash = G.partyFlash > 0 ? Math.max(0, G.partyFlash - dt * 2) : Math.min(0, G.partyFlash + dt * 2);
    if (G.ariseFx) G.ariseFx = Math.max(0, G.ariseFx - dt);
    G.hpShown = lerp(G.hpShown, G.hp, Math.min(1, dt * 6));
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var t = G.grid[r][c]; if (!t) continue;
      if (t.mv) { t.mv.t += dt; var k = easeInOut(Math.min(1, t.mv.t / t.mv.dur)); t.x = lerp(t.mv.fx, t.mv.tx, k); t.y = lerp(t.mv.fy, t.mv.ty, k); if (k >= 1) t.mv = null; }
      else {
        var ty = cy(r);
        t.x = cx(c);
        if (t.y < ty) { t.vy += 2800 * dt; t.y += t.vy * dt; if (t.y >= ty) { t.y = ty; if (t.vy > 350) t.squash = 0.14; t.vy = 0; } }
        else if (t.y > ty) { t.y = ty; t.vy = 0; }
      }
      if (t.pop) t.pop = Math.max(0, t.pop - dt * 3); if (t.squash) t.squash = Math.max(0, t.squash - dt); if (t.nope) t.nope = Math.max(0, t.nope - dt);
    }
    G.enemies.forEach(function (e) {
      e.flash = Math.max(0, e.flash - dt); e.lunge = Math.max(0, e.lunge - dt * 2.2); e.enter = Math.max(0, e.enter - dt * 2.2);
      e.shown = lerp(e.shown, Math.max(0, e.hp), Math.min(1, dt * 5));
      if (e.dead) e.fade = Math.max(0, e.fade - dt * 1.6);
    });
    G.cards.forEach(function (cd) { cd.pulse = Math.max(0, cd.pulse - dt * 2.5); cd.swing = Math.max(0, cd.swing - dt); });
    var ps = G.parts;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.t === "shard" || p.t === "spark" || p.t === "smoke") { p.x += p.vx * dt; p.y += p.vy * dt; if (p.t === "shard") { p.vy += 520 * dt; p.rot += p.vr * dt; } else if (p.t === "spark") { p.vx *= 0.9; p.vy *= 0.9; } else { p.r += dt * 8; } }
      if (p.t === "orb") {
        var k2 = easeInOut(1 - p.life / p.life0), u = 1 - k2;
        p.x = u * u * p.sx + 2 * u * k2 * p.mx + k2 * k2 * p.ex; p.y = u * u * p.sy + 2 * u * k2 * p.my + k2 * k2 * p.ey;
        if (p.life <= 0) G.cards[p.col].pulse = Math.max(G.cards[p.col].pulse, 0.6);
      }
      if (p.t === "shot") { var k3 = easeOut(1 - p.life / p.life0); p.x = lerp(p.sx, p.ex, k3); p.y = lerp(p.sy, p.ey, k3) - Math.sin(k3 * Math.PI) * (p.col === 1 ? 40 : 14); }
    }
    G.parts = ps.filter(function (p) { return p.life > 0 || p.delay > 0; });
    G.floats.forEach(function (f) { f.life -= dt; f.y += f.vy * dt; f.vy *= 0.94; });
    G.floats = G.floats.filter(function (f) { return f.life > 0; });
    G.banners.forEach(function (b) { b.life -= dt; });
    G.banners = G.banners.filter(function (b) { return b.life > 0; });
    if (Math.random() < dt * 5) part({ t: "mote", x: rnd(0, W), y: rnd(40, 280), vx: rnd(-5, 5), vy: -rnd(4, 12), life: rnd(2, 4), r: rnd(0.6, 1.5), c: Math.random() < 0.6 ? "147,197,253" : "196,181,253" });
    if (!G.busy && !G.over) { G.idle += dt; if (G.idle > 6 && !G.hint) G.hint = findMove(); }
  }

  /* ------------------------------------------------------------------ rendering */
  var cv = $("cv"), c = cv.getContext("2d"), scale = 1, dpr = Math.min(2, window.devicePixelRatio || 1);
  var GEMS = [], BG = null;
  function resize() {
    var st = $("stage"), aw = st.clientWidth - 12, ah = st.clientHeight - 4;
    scale = Math.min(aw / W, ah / H);
    var fw = Math.floor(W * scale), fh = Math.floor(H * scale);
    $("frame").style.width = fw + "px"; $("frame").style.height = fh + "px";
    cv.style.width = fw + "px"; cv.style.height = fh + "px";
    cv.width = Math.round(fw * dpr); cv.height = Math.round(fh * dpr);
  }
  function shapePath(g, col, R) {
    g.beginPath();
    if (col === 0) { g.moveTo(0, -R); g.lineTo(R * 0.8, -R * 0.1); g.lineTo(0, R); g.lineTo(-R * 0.8, -R * 0.1); g.closePath(); }
    else if (col === 1) { for (var i = 0; i < 6; i++) { var a = -Math.PI / 2 + i * TAU / 6; g.lineTo(Math.cos(a) * R, Math.sin(a) * R); } g.closePath(); }
    else if (col === 2) { g.arc(0, 0, R * 0.9, 0, TAU); }
    else if (col === 3) { var s = R * 0.78, rr = R * 0.3; g.moveTo(-s + rr, -s); g.arcTo(s, -s, s, s, rr); g.arcTo(s, s, -s, s, rr); g.arcTo(-s, s, -s, -s, rr); g.arcTo(-s, -s, s, -s, rr); g.closePath(); }
    else { g.moveTo(-R * 0.8, -R * 0.75); g.quadraticCurveTo(0, -R * 1.05, R * 0.8, -R * 0.75); g.lineTo(R * 0.8, -R * 0.05); g.quadraticCurveTo(R * 0.7, R * 0.6, 0, R); g.quadraticCurveTo(-R * 0.7, R * 0.6, -R * 0.8, -R * 0.05); g.closePath(); }
  }
  function glyph(g, col, R) {
    g.save(); g.strokeStyle = "rgba(255,255,255,0.85)"; g.fillStyle = "rgba(255,255,255,0.85)"; g.lineWidth = R * 0.11; g.lineCap = "round"; g.lineJoin = "round";
    g.shadowColor = "rgba(255,255,255,0.8)"; g.shadowBlur = R * 0.2;
    var s = R * 0.36;
    if (col === 0) { g.beginPath(); g.moveTo(0, -s * 1.2); g.lineTo(0, s * 0.9); g.moveTo(-s * 0.5, s * 0.35); g.lineTo(s * 0.5, s * 0.35); g.stroke(); }
    else if (col === 1) { g.beginPath(); g.moveTo(-s * 0.8, s * 0.8); g.lineTo(s * 0.8, -s * 0.8); g.moveTo(s * 0.05, -s * 0.8); g.lineTo(s * 0.8, -s * 0.8); g.lineTo(s * 0.8, -s * 0.05); g.stroke(); }
    else if (col === 2) { g.beginPath(); for (var i = 0; i < 8; i++) { var a = i * TAU / 8 - Math.PI / 2, rr = i % 2 ? s * 0.38 : s * 1.05; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }
    else if (col === 3) { g.beginPath(); g.moveTo(0, -s); g.lineTo(0, s); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke(); }
    else { g.beginPath(); g.moveTo(-s * 0.7, -s * 0.25); g.lineTo(0, s * 0.55); g.lineTo(s * 0.7, -s * 0.25); g.stroke(); }
    g.restore();
  }
  function buildGems() {
    var S = 128, R = 50;
    COLORS.forEach(function (C, col) {
      var cvs = document.createElement("canvas"); cvs.width = cvs.height = S; var g = cvs.getContext("2d"); g.translate(S / 2, S / 2);
      g.save(); g.shadowColor = "rgba(" + C.glow + ",0.75)"; g.shadowBlur = 14; shapePath(g, col, R); g.fillStyle = C.base; g.fill(); g.restore();
      var gr = g.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.05, 0, 0, R * 1.25);
      gr.addColorStop(0, C.light); gr.addColorStop(0.32, C.base); gr.addColorStop(1, C.dark);
      shapePath(g, col, R); g.fillStyle = gr; g.fill();
      g.lineWidth = 3; g.strokeStyle = C.dark; g.stroke();
      g.save(); g.scale(0.66, 0.66); shapePath(g, col, R); g.restore(); g.lineWidth = 2; g.strokeStyle = "rgba(255,255,255,0.22)"; g.stroke();
      g.save(); shapePath(g, col, R); g.clip();
      g.fillStyle = "rgba(255,255,255,0.32)"; g.beginPath(); g.ellipse(-R * 0.32, -R * 0.5, R * 0.42, R * 0.2, -0.5, 0, TAU); g.fill();
      g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.ellipse(R * 0.2, R * 0.75, R * 0.8, R * 0.35, 0, 0, TAU); g.fill();
      g.restore();
      glyph(g, col, R);
      GEMS[col] = cvs;
    });
    // battle backdrop
    var b = document.createElement("canvas"); b.width = W * 2; b.height = 292 * 2; var g2 = b.getContext("2d"); g2.scale(2, 2);
    var bg = g2.createLinearGradient(0, 0, 0, 292); bg.addColorStop(0, "#0a0a1c"); bg.addColorStop(0.55, "#141230"); bg.addColorStop(1, "#1a1530");
    g2.fillStyle = bg; g2.fillRect(0, 0, W, 292);
    // far pillars
    for (var i = 0; i < 6; i++) {
      var px = 20 + i * 72 + (i % 2) * 8, ph = 150 + (i % 3) * 20;
      var pg = g2.createLinearGradient(px, 0, px + 26, 0); pg.addColorStop(0, "#0c0b1a"); pg.addColorStop(0.5, "#17142c"); pg.addColorStop(1, "#0c0b1a");
      g2.fillStyle = pg; g2.fillRect(px, 210 - ph, 26, ph); g2.fillStyle = "#1d1936"; g2.fillRect(px - 4, 210 - ph, 34, 8);
    }
    // floor
    var fl = g2.createLinearGradient(0, 205, 0, 292); fl.addColorStop(0, "#1b1730"); fl.addColorStop(1, "#0e0c1d");
    g2.fillStyle = fl; g2.beginPath(); g2.moveTo(0, 210); g2.lineTo(W, 210); g2.lineTo(W, 292); g2.lineTo(0, 292); g2.fill();
    g2.strokeStyle = "rgba(143,94,248,0.08)"; g2.lineWidth = 1;
    for (var j = -6; j <= 6; j++) { g2.beginPath(); g2.moveTo(200 + j * 18, 210); g2.lineTo(200 + j * 80, 292); g2.stroke(); }
    for (var k = 0; k < 4; k++) { var yy = 214 + k * k * 6 + k * 6; g2.beginPath(); g2.moveTo(0, yy); g2.lineTo(W, yy); g2.stroke(); }
    BG = b;
  }

  /* figure drawing shared with the TD test build (game/td/td.js) */
  function outline(fill, line, lw) { c.fillStyle = fill; c.fill(); if (line) { c.lineWidth = lw || 1.2; c.strokeStyle = line; c.stroke(); } }
  function groundShadow(x, y, rx, ry) { c.fillStyle = "rgba(0,0,0,0.38)"; c.beginPath(); c.ellipse(x, y, rx, ry || rx * 0.38, 0, 0, TAU); c.fill(); }
  function eyes(pts, col, glow) { c.save(); c.shadowColor = glow || col; c.shadowBlur = 6; c.fillStyle = col; pts.forEach(function (p) { c.fillRect(p[0], p[1], p[2] || 1.3, p[3] || 1); }); c.restore(); }

  var RISEN = { body: "#100d1d", dark: "#08070f", acc: "#241d3d", acc2: "#2e2550", eye: "#ddd6fe", line: "rgba(167,139,250,0.9)" };
  var PAL = {
    ghoul: { body: "#8c9c86", dark: "#55634f", acc: "#6b7a65", acc2: "#b7c4ae", eye: "#ff4545", line: "#0d0f0c" },
    orc: { body: "#5f7a3a", dark: "#3a4a22", acc: "#7b5a3a", acc2: "#e8dcc0", eye: "#ffcc33", line: "#10130a" },
    golem: { body: "#6b7280", dark: "#3f4450", acc: "#545b69", acc2: "#5eead4", eye: "#5eead4", line: "#111318" },
    bat: { body: "#3b2f4a", dark: "#241b30", acc: "#5b4470", acc2: "#7d6299", eye: "#ff3b5c", line: "#0b0810" },
    cultist: { body: "#7f1d2d", dark: "#4c0d18", acc: "#2a1418", acc2: "#86efac", eye: "#fde047", line: "#140508" },
    boss: { body: "#5b1a1a", dark: "#2e0b0b", acc: "#d6c7a1", acc2: "#9ca3af", eye: "#ffb020", line: "#120404" }
  };
  function F(col, fl) { return fl > 0 ? "#ffffff" : col; }

  function drawMonster(type, x, y, t, face, fl, pal, swing, walk, scaleMul) {
    var P = pal || PAL[type], risen = pal === RISEN, ln = P.line, lw = risen ? 1 : 1.2;
    var sw = swing ? Math.sin((1 - swing / 0.25) * Math.PI) : 0;
    c.save(); c.translate(x, y); if (scaleMul) c.scale(scaleMul, scaleMul); c.scale(face, 1);
    var step = Math.sin(walk * 11), bob = Math.abs(step) * 0.8;
    if (type === "ghoul") {
      groundShadow(0, 1, 7);
      c.strokeStyle = F(P.dark, fl); c.lineWidth = 2; c.lineCap = "round";
      c.beginPath(); c.moveTo(-2, -4); c.lineTo(-3 + step * 2, 0); c.moveTo(2, -4); c.lineTo(3 - step * 2, 0); c.stroke();
      c.beginPath(); c.ellipse(0, -7 - bob, 5.5, 4.4, -0.45, 0, TAU); outline(F(P.body, fl), ln, lw);
      c.beginPath(); c.arc(4, -11 - bob, 3.2, 0, TAU); outline(F(P.body, fl), ln, lw);
      c.strokeStyle = F(P.acc2, fl); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(2, -8 - bob); c.lineTo(6 + sw * 4, -3 - sw * 4); c.stroke();
      c.strokeStyle = F(P.dark, fl); c.lineWidth = 0.8; c.beginPath(); c.moveTo(-3, -9 - bob); c.lineTo(-1, -6 - bob); c.moveTo(-1, -10 - bob); c.lineTo(1, -7 - bob); c.stroke();
      eyes([[4.6, -12 - bob], [6.2, -12 - bob, 1, 1]], P.eye);
    } else if (type === "orc") {
      groundShadow(0, 1, 9);
      c.fillStyle = F(P.dark, fl);
      c.fillRect(-4 + step, -5, 3, 5); c.fillRect(1 - step, -5, 3, 5);
      c.beginPath(); c.moveTo(-6, -5); c.lineTo(6, -5); c.lineTo(7, -14 - bob); c.lineTo(-6, -14 - bob); c.closePath(); outline(F(P.body, fl), ln, lw);
      c.fillStyle = F(P.acc, fl); c.fillRect(-6, -7, 12, 2);
      c.beginPath(); c.arc(1, -17 - bob, 4.2, 0, TAU); outline(F(P.body, fl), ln, lw);
      c.fillStyle = F(P.acc2, fl); c.fillRect(2.4, -15.5 - bob, 1, 1.8); c.fillRect(4.2, -15.5 - bob, 1, 1.8);
      eyes([[2, -18.5 - bob], [4, -18.5 - bob]], P.eye);
      c.save(); c.translate(5, -10 - bob); c.rotate(-1.2 + sw * 2.2);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(10, -1.5); c.lineTo(10, 2.5); c.lineTo(0, 1.4); c.closePath(); outline(F(P.acc, fl), ln, 1);
      c.restore();
    } else if (type === "golem") {
      groundShadow(0, 1, 11);
      c.fillStyle = F(P.dark, fl); c.fillRect(-6 + step * 0.6, -6, 5, 6); c.fillRect(1 - step * 0.6, -6, 5, 6);
      c.beginPath(); c.moveTo(-9, -6); c.lineTo(9, -6); c.lineTo(10, -19 - bob); c.lineTo(3, -22 - bob); c.lineTo(-8, -20 - bob); c.closePath(); outline(F(P.body, fl), ln, lw);
      c.beginPath(); c.moveTo(-12, -18 - bob); c.lineTo(-7, -21 - bob); c.lineTo(-6, -11 - bob); c.lineTo(-11, -9 - bob); c.closePath(); outline(F(P.acc, fl), ln, 1);
      c.beginPath(); c.moveTo(8, -19 - bob); c.lineTo(13 + sw * 3, -15 - sw * 3); c.lineTo(12 + sw * 3, -8); c.lineTo(8, -10 - bob); c.closePath(); outline(F(P.acc, fl), ln, 1);
      c.beginPath(); c.moveTo(-2, -22 - bob); c.lineTo(5, -24 - bob); c.lineTo(7, -19 - bob); c.lineTo(-1, -18 - bob); c.closePath(); outline(F(P.body, fl), ln, 1);
      c.save(); c.shadowColor = P.acc2; c.shadowBlur = 5; c.strokeStyle = risen ? "#a78bfa" : P.acc2; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(-3, -9); c.lineTo(0, -13 - bob); c.lineTo(-2, -16 - bob); c.moveTo(4, -8); c.lineTo(3, -13 - bob); c.stroke(); c.restore();
      eyes([[3, -21.5 - bob, 1.5], [5.5, -21.5 - bob, 1.3]], P.eye);
    } else if (type === "bat") {
      var fy = -14 + Math.sin(t * 6 + x) * 2;
      groundShadow(0, 1, 6, 2);
      var fl2 = Math.sin(t * 22 + x);
      c.translate(0, fy);
      c.fillStyle = F(P.acc, fl);
      c.beginPath(); c.moveTo(-1, -1); c.quadraticCurveTo(-8, -7 - fl2 * 6, -12, -2 - fl2 * 4); c.lineTo(-8, 0); c.lineTo(-5, -1 - fl2); c.closePath(); outline(F(P.acc, fl), ln, 1);
      c.beginPath(); c.moveTo(1, -1); c.quadraticCurveTo(8, -7 - fl2 * 6, 12, -2 - fl2 * 4); c.lineTo(8, 0); c.lineTo(5, -1 - fl2); c.closePath(); outline(F(P.acc, fl), ln, 1);
      c.beginPath(); c.ellipse(0, 0, 3.4, 3.8, 0, 0, TAU); outline(F(P.body, fl), ln, 1);
      c.fillStyle = F(P.body, fl); c.beginPath(); c.moveTo(-2.6, -2.5); c.lineTo(-1.6, -6); c.lineTo(-0.6, -3); c.moveTo(2.6, -2.5); c.lineTo(1.6, -6); c.lineTo(0.6, -3); c.fill();
      eyes([[-1.8, -1.2, 1.2, 1.2], [0.8, -1.2, 1.2, 1.2]], P.eye);
    } else if (type === "cultist") {
      groundShadow(0, 1, 8);
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.lineTo(3.5, -14 - bob); c.lineTo(-3.5, -14 - bob); c.closePath(); outline(F(P.body, fl), ln, lw);
      c.fillStyle = F(P.dark, fl); c.beginPath(); c.moveTo(-6, 0); c.lineTo(-2, 0); c.lineTo(-1.5, -10 - bob); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-4.5, -12 - bob); c.quadraticCurveTo(0, -24 - bob, 4.5, -12 - bob); c.closePath(); outline(F(P.dark, fl), ln, lw);
      c.fillStyle = "#050203"; c.beginPath(); c.ellipse(1.2, -14.5 - bob, 2.3, 2.2, 0, 0, TAU); c.fill();
      eyes([[0.6, -15 - bob, 1, 1], [2.2, -15 - bob, 1, 1]], P.eye);
      c.strokeStyle = F(risen ? "#3b3160" : "#5b3a1e", fl); c.lineWidth = 1.3; c.beginPath(); c.moveTo(6, 1); c.lineTo(7 + sw * 2, -19 - bob); c.stroke();
      c.save(); c.shadowColor = P.acc2; c.shadowBlur = 8; c.fillStyle = risen ? "#c4b5fd" : P.acc2; c.beginPath(); c.arc(7 + sw * 2, -20.5 - bob, 2.1 + Math.sin(t * 5) * 0.3, 0, TAU); c.fill(); c.restore();
    } else if (type === "boss") {
      groundShadow(0, 2, 22, 7);
      c.fillStyle = F(P.dark, fl); c.fillRect(-11 + step * 1.5, -12, 8, 12); c.fillRect(3 - step * 1.5, -12, 8, 12);
      c.beginPath(); c.moveTo(-15, -12); c.lineTo(15, -12); c.lineTo(18, -36 - bob); c.lineTo(-16, -38 - bob); c.closePath(); outline(F(P.body, fl), ln, 1.6);
      c.fillStyle = F("#3d1010", fl); c.beginPath(); c.moveTo(-10, -16); c.lineTo(10, -16); c.lineTo(8, -30 - bob); c.lineTo(-9, -31 - bob); c.closePath(); c.fill();
      c.strokeStyle = F("#7a2424", fl); c.lineWidth = 1; for (var r = 0; r < 4; r++) { c.beginPath(); c.moveTo(-7, -19 - r * 3.4 - bob); c.lineTo(7, -19 - r * 3.4 - bob); c.stroke(); }
      c.beginPath(); c.ellipse(-16, -34 - bob, 6, 5, 0, 0, TAU); outline(F(P.dark, fl), ln, 1.2);
      c.beginPath(); c.ellipse(16, -33 - bob, 6, 5, 0, 0, TAU); outline(F(P.dark, fl), ln, 1.2);
      c.beginPath(); c.arc(1, -43 - bob, 8, 0, TAU); outline(F(P.body, fl), ln, 1.4);
      c.fillStyle = F(P.acc, fl);
      c.beginPath(); c.moveTo(-5, -48 - bob); c.quadraticCurveTo(-14, -52 - bob, -12, -62 - bob); c.quadraticCurveTo(-9, -54 - bob, -2, -50 - bob); c.closePath(); outline(F(P.acc, fl), ln, 1);
      c.beginPath(); c.moveTo(6, -48 - bob); c.quadraticCurveTo(15, -52 - bob, 13, -62 - bob); c.quadraticCurveTo(10, -54 - bob, 3, -50 - bob); c.closePath(); outline(F(P.acc, fl), ln, 1);
      eyes([[1, -45 - bob, 2.4, 1.6], [5, -45 - bob, 2.4, 1.6]], P.eye);
      c.save(); c.translate(16, -30 - bob); c.rotate(-1.5 + sw * 2.4);
      c.strokeStyle = F("#4a3020", fl); c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(28, 0); c.stroke();
      c.beginPath(); c.moveTo(22, 0); c.quadraticCurveTo(26, -12, 34, -10); c.quadraticCurveTo(31, 0, 34, 10); c.quadraticCurveTo(26, 12, 22, 0); outline(F(P.acc2, fl), ln, 1.2);
      c.restore();
    }
    c.restore();
  }

  function weaponFor(cls, swing, tc) {
    var sw = swing ? Math.sin((1 - swing / 0.22) * Math.PI) : 0;
    c.save(); c.shadowColor = tc; c.shadowBlur = 4;
    var blade = "#c4b5fd";
    if (cls === "Archer") {
      c.strokeStyle = blade; c.lineWidth = 1.1; c.beginPath(); c.arc(4, -9, 6, -1.2, 1.2); c.stroke();
      c.strokeStyle = "rgba(221,214,254,.6)"; c.lineWidth = 0.5; c.beginPath(); c.moveTo(4 + 6 * Math.cos(-1.2), -9 + 6 * Math.sin(-1.2)); c.lineTo(4 - sw * 3, -9); c.lineTo(4 + 6 * Math.cos(1.2), -9 + 6 * Math.sin(1.2)); c.stroke();
    } else if (cls === "Mage" || cls === "Healer") {
      c.strokeStyle = "#2e2550"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(5, 0); c.lineTo(5.5 + sw, -19); c.stroke();
      c.fillStyle = cls === "Healer" ? "#e0f2fe" : "#e879f9"; c.shadowColor = c.fillStyle; c.shadowBlur = 8; c.beginPath(); c.arc(5.6 + sw, -20.5, 2, 0, TAU); c.fill();
    } else if (cls === "Lancer") {
      c.translate(3, -8); c.rotate(-0.25 + sw * 0.5);
      c.strokeStyle = "#3b3160"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, 4); c.lineTo(10 + sw * 4, -4); c.stroke();
      c.fillStyle = blade; c.beginPath(); c.moveTo(10 + sw * 4, -4); c.lineTo(15 + sw * 4, -6.5); c.lineTo(11 + sw * 4, -2); c.closePath(); c.fill();
    } else if (cls === "Berserker") {
      c.translate(3, -9); c.rotate(-1.3 + sw * 2.4);
      c.strokeStyle = "#3b3160"; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 0); c.lineTo(11, 0); c.stroke();
      c.fillStyle = blade; c.beginPath(); c.moveTo(8, 0); c.quadraticCurveTo(10, -6, 14, -5); c.quadraticCurveTo(12, 0, 14, 5); c.quadraticCurveTo(10, 6, 8, 0); c.fill();
    } else if (cls === "Assassin") {
      [[3.5, -7, -0.6], [-3, -7, 0.6]].forEach(function (d, i) { c.save(); c.translate(d[0], d[1]); c.rotate(d[2] + (i ? -sw : sw) * 1.4); c.strokeStyle = blade; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(5, -2); c.stroke(); c.restore(); });
    } else {
      c.translate(3, -8); c.rotate(-1.1 + sw * 2.3);
      c.strokeStyle = blade; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 0); c.lineTo(10, 0); c.stroke();
      c.strokeStyle = "#3b3160"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(1, -2); c.lineTo(1, 2); c.stroke();
    }
    c.restore();
    if (cls === "Bulwark" || cls === "Knight") {
      var big = cls === "Bulwark";
      c.beginPath(); c.ellipse(-4.5, -7.5, big ? 3.6 : 2.4, big ? 5.6 : 4, 0, 0, TAU); outline("#17132b", "rgba(167,139,250,0.9)", 0.9);
    }
  }

  function drawShadow(cls, x, y, t, face, swing, walk, lvl, fl, tierCol, sc) {
    var tc = tierCol || (lvl >= 2 ? "#e9d5ff" : "#c4b5fd");
    c.save(); c.translate(x, y); c.scale((sc || 1) * face, sc || 1);
    var lk = 1 / Math.max(1, (sc || 1) * 0.6), step = Math.sin(walk * 11), bob = Math.abs(step) * 0.6, rim = "rgba(167,139,250," + (0.75 + (lvl || 0) * 0.1) + ")";
    groundShadow(0, 1, 7);
    var ag = c.createRadialGradient(0, -9, 0, 0, -9, 13); ag.addColorStop(0, "rgba(139,92,246," + (0.18 + (lvl || 0) * 0.07) + ")"); ag.addColorStop(1, "rgba(139,92,246,0)");
    c.fillStyle = ag; c.beginPath(); c.arc(0, -9, 13, 0, TAU); c.fill();
    c.strokeStyle = fl > 0 ? "#fff" : "#0a0814"; c.lineWidth = 2.2; c.lineCap = "round";
    c.beginPath(); c.moveTo(-1.8, -4); c.lineTo(-2.4 + step * 1.6, 0); c.moveTo(1.8, -4); c.lineTo(2.4 - step * 1.6, 0); c.stroke();
    c.beginPath(); c.moveTo(-4.2, -3.5); c.lineTo(4.2, -3.5); c.lineTo(3.4, -12 - bob); c.lineTo(-3.4, -12 - bob); c.closePath(); outline(F("#0e0b1b", fl), rim, 0.9 * lk);
    c.beginPath(); c.arc(-3.6, -11 - bob, 2, 0, TAU); outline(F("#151129", fl), rim, 0.7 * lk);
    c.beginPath(); c.arc(3.6, -11 - bob, 2, 0, TAU); outline(F("#151129", fl), rim, 0.7 * lk);
    c.beginPath(); c.arc(0.4, -15 - bob, 3.3, 0, TAU); outline(F("#0e0b1b", fl), rim, 0.9 * lk);
    c.fillStyle = F("#0e0b1b", fl); c.beginPath(); c.moveTo(-1.5, -17.8 - bob); c.lineTo(-3.6, -21 - bob - (lvl || 0)); c.lineTo(0.5, -18.2 - bob); c.fill();
    eyes([[0.8, -15.6 - bob, 1.3, 0.9], [2.6, -15.6 - bob, 1.2, 0.9]], tc, tc);
    c.translate(0, -bob);
    weaponFor(cls, swing, tc);
    c.restore();
  }


  function rrect(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function drawBattle(t) {
    c.drawImage(BG, 0, 0, W, 292);
    // the gate behind them
    var gx = 200, gy = 132, pul = Math.sin(t * 1.6) * 0.08;
    var g = c.createRadialGradient(gx, gy, 0, gx, gy, 150); g.addColorStop(0, "rgba(147,197,253," + (0.32 + pul) + ")"); g.addColorStop(0.4, "rgba(59,130,246,0.14)"); g.addColorStop(1, "rgba(30,64,175,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, 292);
    c.save(); c.beginPath(); c.ellipse(gx, gy, 62, 84, 0, 0, TAU);
    var g2 = c.createRadialGradient(gx, gy, 0, gx, gy, 84); g2.addColorStop(0, "rgba(239,246,255,0.95)"); g2.addColorStop(0.25, "rgba(147,197,253,0.85)"); g2.addColorStop(0.7, "rgba(37,99,235,0.7)"); g2.addColorStop(1, "rgba(30,58,138,0.2)");
    c.fillStyle = g2; c.fill();
    c.strokeStyle = "rgba(219,234,254,0.6)"; c.lineWidth = 1.4;
    for (var i = 0; i < 4; i++) { var a = t * (0.8 + i * 0.35) + i * 1.7; c.beginPath(); c.ellipse(gx, gy, 52 - i * 11, 72 - i * 15, 0, a, a + 2.2); c.stroke(); }
    c.restore();
    // floor shadow under the gate glow
    var fg = c.createRadialGradient(200, 250, 0, 200, 250, 200); fg.addColorStop(0, "rgba(96,165,250,0.12)"); fg.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = fg; c.fillRect(0, 200, W, 92);

    // monsters
    var tg = currentTarget();
    G.enemies.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (e) {
      if (e.dead && e.fade <= 0) return;
      var ent = easeOut(1 - e.enter), lunge = Math.sin(e.lunge * Math.PI) * 18, bob = Math.sin(t * 2 + e.ph) * 1.5;
      var x = e.x, y = e.y + lunge - (1 - ent) * 30;
      c.save(); c.globalAlpha = (e.dead ? e.fade : 1) * ent;
      if (e === tg && !e.dead) {
        c.strokeStyle = "rgba(255,209,102,0.85)"; c.lineWidth = 1.5; c.setLineDash([6, 5]); c.lineDashOffset = -t * 20;
        c.beginPath(); c.ellipse(x, y + 2, e.d.boss ? 54 : 32, e.d.boss ? 13 : 9, 0, 0, TAU); c.stroke(); c.setLineDash([]);
      }
      var face = x > 210 ? -1 : 1;
      drawMonster(e.type, x, y + bob * (e.type === "bat" ? 0 : 0.3), t, face, e.flash, null, e.lunge > 0.5 ? 0.2 : 0, 0, e.d.sc);
      c.restore();
      if (e.dead) return;
      var top = y - e.d.top * e.d.sc - 14, bw = e.d.boss ? 120 : 64;
      c.save(); c.globalAlpha = ent;
      c.fillStyle = "rgba(0,0,0,0.6)"; rrect(x - bw / 2, top, bw, 6, 3); c.fill();
      c.fillStyle = "rgba(255,255,255,0.35)"; rrect(x - bw / 2, top, bw * clamp(e.shown / e.max, 0, 1), 6, 3); c.fill();
      var hg = c.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0); hg.addColorStop(0, "#ef4444"); hg.addColorStop(1, "#fb7185");
      c.fillStyle = hg; rrect(x - bw / 2, top, bw * clamp(e.hp / e.max, 0, 1), 6, 3); c.fill();
      var bxp = x - bw / 2 - 12, urgent = e.cd <= 1;
      c.beginPath(); c.arc(bxp, top + 3, 9, 0, TAU); c.fillStyle = urgent ? "#7f1d1d" : "#1e1b3a"; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = urgent ? "rgba(255,120,120," + (0.6 + Math.sin(t * 8) * 0.4) + ")" : "rgba(196,181,253,0.6)"; c.stroke();
      c.fillStyle = "#fff"; c.font = "700 10px Orbitron, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(e.cd, bxp, top + 3.5);
      if (e.d.weak !== undefined || e.d.res) {
        var tags = []; if (e.d.weak !== undefined) tags.push(["▲", COLORS[e.d.weak].base]); if (e.d.res) e.d.res.forEach(function (r) { tags.push(["▼", COLORS[r].base]); });
        tags.forEach(function (tg2, i2) { c.fillStyle = tg2[1]; c.font = "700 8px sans-serif"; c.fillText(tg2[0], x + bw / 2 + 7 + i2 * 9, top + 3); });
      }
      if (e.d.boss) { c.font = "600 12px Rajdhani, sans-serif"; c.fillStyle = "#ffb4b4"; c.fillText(G.bossName, x, top - 10); }
      c.restore();
    });
  }
  function drawParty(t) {
    for (var i = 0; i < 5; i++) {
      var C = COLORS[i], cd = G.cards[i], x = 8 + i * 78, y = CARD_Y, w = 72, h = CARD_H, p = cd.pulse;
      c.save();
      c.translate(x + w / 2, y + h / 2); var sc = 1 + p * 0.06; c.scale(sc, sc); c.translate(-(x + w / 2), -(y + h / 2));
      rrect(x, y, w, h, 12);
      var bg = c.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, "rgba(" + C.glow + "," + (0.14 + p * 0.25) + ")"); bg.addColorStop(1, "rgba(10,8,28,0.95)");
      c.fillStyle = bg; c.fill();
      c.lineWidth = 1.2 + p * 1.5; c.strokeStyle = "rgba(" + C.glow + "," + (0.45 + p * 0.5) + ")"; c.shadowColor = "rgba(" + C.glow + ",0.8)"; c.shadowBlur = 4 + p * 14; c.stroke(); c.shadowBlur = 0;
      c.save(); rrect(x, y, w, h, 12); c.clip();
      drawShadow(ARMY.cls[i], x + w / 2, y + h - 6, t, 1, cd.swing, 0, ARMY.lv[i] >= 5 ? 2 : 1, 0, null, 2.15);
      c.restore();
      c.font = "700 9px Orbitron, sans-serif"; c.textAlign = "left"; c.textBaseline = "top"; c.fillStyle = C.light; c.fillText("Lv" + ARMY.lv[i], x + 6, y + 5);
      c.save(); c.translate(x + w - 11, y + 11); c.scale(0.17, 0.17); c.drawImage(GEMS[i], -64, -64); c.restore();
      c.restore();
    }
    // squad HP
    var y2 = 372, k = clamp(G.hpShown / G.maxHp, 0, 1), kr = clamp(G.hp / G.maxHp, 0, 1);
    c.fillStyle = "rgba(0,0,0,0.6)"; rrect(8, y2, 384, 9, 4.5); c.fill();
    var hc = kr < 0.3 ? ["#ef4444", "#f97316"] : ["#10b981", "#6ee7b7"];
    var hg = c.createLinearGradient(8, 0, 392, 0); hg.addColorStop(0, hc[0]); hg.addColorStop(1, hc[1]);
    if (k > kr) { c.fillStyle = "rgba(255,120,120,0.7)"; rrect(8, y2, 384 * k, 9, 4.5); c.fill(); }
    c.fillStyle = hg; rrect(8, y2, 384 * kr, 9, 4.5); c.fill();
    if (G.shield > 0) { var ks = clamp(G.shield / G.maxHp, 0, 1); c.strokeStyle = "rgba(251,191,36,0.95)"; c.lineWidth = 2; c.shadowColor = "#fbbf24"; c.shadowBlur = 8; rrect(8, y2 - 1, Math.max(12, 384 * ks), 11, 5); c.stroke(); c.shadowBlur = 0; }
    c.font = "700 9px Orbitron, sans-serif"; c.textBaseline = "middle"; c.textAlign = "center"; c.fillStyle = "#fff"; c.strokeStyle = "rgba(0,0,0,0.7)"; c.lineWidth = 3;
    var txt = Math.ceil(G.hp) + " / " + G.maxHp + (G.shield > 0 ? "   +" + Math.round(G.shield) + " WARD" : "");
    c.strokeText(txt, 200, y2 + 5); c.fillText(txt, 200, y2 + 5);
    if (G.partyFlash) { c.fillStyle = G.partyFlash > 0 ? "rgba(255,40,60," + G.partyFlash * 0.35 + ")" : "rgba(251,191,36," + (-G.partyFlash) * 0.3 + ")"; c.fillRect(0, CARD_Y - 6, W, 92); }
  }
  function drawBoard(t) {
    rrect(BX - 6, BY - 6, COLS * CELL + 12, ROWS * CELL + 12, 14);
    var pg = c.createLinearGradient(0, BY, 0, BY + ROWS * CELL); pg.addColorStop(0, "#0e0b26"); pg.addColorStop(1, "#08071a");
    c.fillStyle = pg; c.fill(); c.strokeStyle = "rgba(143,94,248,0.35)"; c.lineWidth = 1; c.stroke();
    for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < COLS; cc++) if ((r + cc) % 2) { c.fillStyle = "rgba(143,94,248,0.045)"; c.fillRect(BX + cc * CELL, BY + r * CELL, CELL, CELL); }
    c.save(); c.beginPath(); c.rect(BX - 6, BY - 6, COLS * CELL + 12, ROWS * CELL + 12); c.clip();
    var hint = G.hint;
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      var tl = G.grid[r2][c2]; if (!tl) continue;
      var s = CELL * 0.92, sx = 1, sy = 1, ox = 0;
      if (tl.squash) { var q = Math.sin(tl.squash / 0.14 * Math.PI) * 0.12; sx += q; sy -= q; }
      if (tl.pop) { var pp = 1 + Math.sin(tl.pop * Math.PI) * 0.35; sx *= pp; sy *= pp; }
      if (tl.nope) ox = Math.sin(tl.nope * 50) * 3;
      var sel = G.sel && G.sel[0] === r2 && G.sel[1] === c2;
      var hinted = hint && ((hint[0][0] === r2 && hint[0][1] === c2) || (hint[1][0] === r2 && hint[1][1] === c2));
      if (sel) { sx *= 1.1; sy *= 1.1; }
      if (hinted) { var hw = 1 + Math.sin(t * 9) * 0.07; sx *= hw; sy *= hw; }
      var x = tl.x + ox, y = tl.y;
      if (y < BY - CELL) continue;
      if (sel || hinted) { c.save(); c.globalCompositeOperation = "lighter"; var hg2 = c.createRadialGradient(x, y, 0, x, y, CELL * 0.62); hg2.addColorStop(0, "rgba(255,255,255,0.28)"); hg2.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = hg2; c.fillRect(x - CELL, y - CELL, CELL * 2, CELL * 2); c.restore(); }
      if (tl.sp === "orb" || tl.sp === "orbfired") drawOrbRune(x, y, s * 0.5 * sx, t);
      else {
        var D = CELL * 1.1; c.drawImage(GEMS[tl.col], x - D * sx / 2, y - D * sy / 2, D * sx, D * sy);
        if (tl.sp) drawSpecial(tl, x, y, t);
      }
    }
    c.restore();
  }
  function drawSpecial(tl, x, y, t) {
    var C = COLORS[tl.col], k = 0.6 + Math.sin(t * 6 + tl.id) * 0.4;
    c.save(); c.globalCompositeOperation = "lighter";
    if (tl.sp === "h" || tl.sp === "v") {
      c.translate(x, y); if (tl.sp === "v") c.rotate(Math.PI / 2);
      var lg = c.createLinearGradient(-CELL / 2, 0, CELL / 2, 0); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255," + 0.9 * k + ")"); lg.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = lg; c.fillRect(-CELL / 2, -2.2, CELL, 4.4);
      c.fillStyle = "rgba(255,255,255," + (0.6 + k * 0.4) + ")";
      [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * 23, 0); c.lineTo(d * 16, -5); c.lineTo(d * 16, 5); c.closePath(); c.fill(); });
    } else if (tl.sp === "bomb") {
      c.strokeStyle = "rgba(" + C.glow + "," + (0.5 + k * 0.5) + ")"; c.lineWidth = 2.5; c.shadowColor = "rgb(" + C.glow + ")"; c.shadowBlur = 10;
      c.beginPath(); c.arc(x, y, 20 + k * 3, 0, TAU); c.stroke();
      c.fillStyle = "rgba(255,255,255," + 0.5 * k + ")"; c.beginPath(); c.arc(x, y, 5 + k * 2, 0, TAU); c.fill();
    }
    c.restore();
  }
  function drawOrbRune(x, y, R, t) {
    c.save();
    var g = c.createRadialGradient(x, y, 0, x, y, R * 1.7); g.addColorStop(0, "rgba(167,139,250,0.55)"); g.addColorStop(1, "rgba(167,139,250,0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, R * 1.7, 0, TAU); c.fill();
    var g2 = c.createRadialGradient(x - R * 0.3, y - R * 0.35, 0, x, y, R); g2.addColorStop(0, "#3b2a6e"); g2.addColorStop(0.6, "#120a2a"); g2.addColorStop(1, "#000");
    c.fillStyle = g2; c.beginPath(); c.arc(x, y, R * 0.85, 0, TAU); c.fill();
    c.lineWidth = 1.6; c.strokeStyle = "rgba(196,181,253,0.9)"; c.shadowColor = "#a78bfa"; c.shadowBlur = 10; c.stroke();
    c.strokeStyle = "rgba(221,214,254,0.75)"; c.lineWidth = 1.2;
    for (var i = 0; i < 3; i++) { var a = t * 2.4 + i * TAU / 3; c.beginPath(); c.arc(x, y, R * (0.35 + i * 0.15), a, a + 1.8); c.stroke(); }
    c.shadowBlur = 6; c.fillStyle = "#ede9fe"; c.fillRect(x - 5, y - 2, 3.5, 2); c.fillRect(x + 1.5, y - 2, 3.5, 2);
    c.restore();
  }
  function drawParts(add) {
    G.parts.forEach(function (p) {
      if (p.delay > 0) return;
      var k = clamp(p.life / p.life0, 0, 1);
      if (!add) {
        if (p.t === "shard") { c.save(); c.globalAlpha = Math.min(1, k * 2); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.c; c.beginPath(); c.moveTo(0, -p.s); c.lineTo(p.s * 0.7, p.s * 0.5); c.lineTo(-p.s * 0.7, p.s * 0.5); c.closePath(); c.fill(); c.restore(); }
        else if (p.t === "claw") {
          c.save(); c.globalAlpha = k; c.strokeStyle = p.big ? "#ff5a5a" : "#ffb4b4"; c.lineWidth = p.big ? 4 : 2.6; c.lineCap = "round";
          for (var i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(p.x - 22 + i * 10, p.y - 26); c.lineTo(p.x + 14 + i * 10, p.y + 22); c.stroke(); } c.restore();
        }
        return;
      }
      if (p.t === "flash") { var g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, "rgba(255,255,255," + 0.8 * k + ")"); g.addColorStop(0.4, "rgba(" + p.c + "," + 0.5 * k + ")"); g.addColorStop(1, "rgba(" + p.c + ",0)"); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
      else if (p.t === "spark") { c.strokeStyle = "rgba(" + p.c + "," + k + ")"; c.lineWidth = p.w; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke(); }
      else if (p.t === "ring") { var rr = lerp(p.r1, p.r0, k); c.strokeStyle = "rgba(" + p.c + "," + k + ")"; c.lineWidth = p.w * k + 0.4; c.beginPath(); c.arc(p.x, p.y, rr, 0, TAU); c.stroke(); }
      else if (p.t === "mote") { c.fillStyle = "rgba(" + p.c + "," + Math.sin(k * Math.PI) * 0.7 + ")"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
      else if (p.t === "smoke") { var g2 = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g2.addColorStop(0, "rgba(" + p.c + "," + 0.35 * k + ")"); g2.addColorStop(1, "rgba(" + p.c + ",0)"); c.fillStyle = g2; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
      else if (p.t === "orb") { var C = COLORS[p.col]; var g3 = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7); g3.addColorStop(0, "rgba(255,255,255,0.95)"); g3.addColorStop(0.4, "rgba(" + C.glow + ",0.9)"); g3.addColorStop(1, "rgba(" + C.glow + ",0)"); c.fillStyle = g3; c.beginPath(); c.arc(p.x, p.y, 7, 0, TAU); c.fill(); }
      else if (p.t === "shot") {
        var C2 = COLORS[p.col], col = C2.glow;
        if (p.col === 0) { c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.ey - p.sy, p.ex - p.sx)); c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 3; c.shadowColor = C2.base; c.shadowBlur = 14; c.beginPath(); c.arc(-6, 0, 14, -1, 1); c.stroke(); c.restore(); }
        else if (p.col === 1) { c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.ey - p.sy, p.ex - p.sx)); c.strokeStyle = "rgba(220,244,255,0.95)"; c.lineWidth = 2; c.shadowColor = C2.base; c.shadowBlur = 10; c.beginPath(); c.moveTo(-14, 0); c.lineTo(4, 0); c.stroke(); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(7, 0); c.lineTo(1, -3); c.lineTo(1, 3); c.fill(); c.restore(); }
        else { var g4 = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12); g4.addColorStop(0, "#fff"); g4.addColorStop(0.35, "rgba(" + col + ",0.95)"); g4.addColorStop(1, "rgba(" + col + ",0)"); c.fillStyle = g4; c.beginPath(); c.arc(p.x, p.y, 12, 0, TAU); c.fill(); }
      }
      else if (p.t === "beam") {
        var wdt = 26 * k + 4;
        var lg = p.h ? c.createLinearGradient(0, p.p - wdt / 2, 0, p.p + wdt / 2) : c.createLinearGradient(p.p - wdt / 2, 0, p.p + wdt / 2, 0);
        lg.addColorStop(0, "rgba(" + p.c + ",0)"); lg.addColorStop(0.5, "rgba(255,255,255," + k + ")"); lg.addColorStop(1, "rgba(" + p.c + ",0)");
        c.fillStyle = lg; if (p.h) c.fillRect(BX - 6, p.p - wdt / 2, COLS * CELL + 12, wdt); else c.fillRect(p.p - wdt / 2, BY - 6, wdt, ROWS * CELL + 12);
      }
      else if (p.t === "pillar") {
        var hh = 300 * Math.sin(Math.min(1, (1 - k) * 2.5) * Math.PI * 0.5), w2 = 26 * k + 6;
        var pg = c.createLinearGradient(0, p.y - hh, 0, p.y);
        pg.addColorStop(0, "rgba(167,139,250,0)"); pg.addColorStop(0.6, "rgba(167,139,250," + 0.5 * k + ")"); pg.addColorStop(1, "rgba(237,233,254," + 0.85 * k + ")");
        c.fillStyle = pg; c.fillRect(p.x - w2 / 2, p.y - hh, w2, hh);
      }
    });
  }
  function render() {
    var t = G.t;
    c.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    c.fillStyle = "#06051a"; c.fillRect(0, 0, W, H);
    c.save();
    if (G.shake > 0) c.translate(rnd(-1, 1) * G.shake * 0.6, rnd(-1, 1) * G.shake * 0.6);
    drawBattle(t);
    var sep = c.createLinearGradient(0, 286, 0, 296); sep.addColorStop(0, "rgba(6,5,26,0)"); sep.addColorStop(1, "rgba(6,5,26,1)"); c.fillStyle = sep; c.fillRect(0, 286, W, 10);
    drawParty(t);
    drawBoard(t);
    drawParts(false);
    c.save(); c.globalCompositeOperation = "lighter"; drawParts(true); c.restore();
    c.restore();
    if (G.ariseFx) { c.fillStyle = "rgba(76,29,149," + (G.ariseFx / 1.4 * 0.3) + ")"; c.fillRect(0, 0, W, H); }
    c.save(); c.textAlign = "center"; c.textBaseline = "middle";
    G.floats.forEach(function (f) {
      var k = f.life / f.life0, pop = 1 + Math.max(0, (k - 0.8)) * 2.5;
      c.globalAlpha = Math.min(1, k * 2.5); c.font = "900 " + Math.round(f.size * pop) + "px Orbitron, sans-serif"; c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,0.75)"; c.strokeText(f.txt, f.x, f.y); c.fillStyle = f.c; c.fillText(f.txt, f.x, f.y);
    });
    c.restore();
    G.banners.forEach(function (b) {
      var k = b.life / b.life0, a = Math.min(1, (1 - k) * 6, k * 3), s = 1 + (1 - Math.min(1, (1 - k) * 5)) * 0.25, big = b.txt === "ARISE";
      c.save(); c.globalAlpha = a; c.translate(W / 2, 150); c.scale(s, s); c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = "rgba(4,4,16,0.45)"; c.fillRect(-W / 2, -34, W, b.sub ? 70 : 56);
      c.font = "900 " + (big ? 50 : 30) + "px Orbitron, sans-serif"; c.shadowColor = b.c; c.shadowBlur = big ? 26 : 16; c.fillStyle = "#fff"; c.fillText(b.txt, 0, -4); c.shadowBlur = 0;
      if (b.sub) { c.font = "600 15px Rajdhani, sans-serif"; c.fillStyle = b.c; c.fillText(b.sub, 0, 24); }
      c.restore();
    });
  }

  /* ------------------------------------------------------------------ input */
  var drag = null;
  function toWorld(ev) { var r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }; }
  function cellAt(p) { var c2 = Math.floor((p.x - BX) / CELL), r2 = Math.floor((p.y - BY) / CELL); return r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS ? [r2, c2] : null; }
  cv.addEventListener("pointerdown", function (ev) {
    ev.preventDefault(); if (!G || G.paused) return;
    var p = toWorld(ev);
    if (p.y < 290) {
      var best = null, bd = 80;
      alive().forEach(function (e) { var d = Math.abs(e.x - p.x) + Math.abs(e.y - 40 - p.y) * 0.3; if (d < bd) { bd = d; best = e; } });
      if (best) { G.target = best; ring(best.x, best.y, "255,209,102", 6, 40, 0.35, 2); }
      return;
    }
    var cell = cellAt(p); if (!cell || G.busy || G.over) return;
    G.idle = 0; G.hint = null;
    if (G.sel && Math.abs(G.sel[0] - cell[0]) + Math.abs(G.sel[1] - cell[1]) === 1) { var s = G.sel; G.sel = null; trySwap(s[0], s[1], cell[0], cell[1]); return; }
    G.sel = (G.sel && G.sel[0] === cell[0] && G.sel[1] === cell[1]) ? null : cell;
    drag = { cell: cell, x: p.x, y: p.y };
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  cv.addEventListener("pointermove", function (ev) {
    if (!drag || !G || G.busy) return;
    var p = toWorld(ev), dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
    var r = drag.cell[0], cc = drag.cell[1];
    if (Math.abs(dx) > Math.abs(dy)) cc += dx > 0 ? 1 : -1; else r += dy > 0 ? 1 : -1;
    var o = drag.cell; drag = null; G.sel = null;
    if (r >= 0 && r < ROWS && cc >= 0 && cc < COLS) trySwap(o[0], o[1], r, cc);
  });
  cv.addEventListener("pointerup", function () { drag = null; });
  cv.addEventListener("pointercancel", function () { drag = null; });

  $("bArise").addEventListener("click", function () { doArise(); });
  $("bPause").addEventListener("click", function () { if (!G.over) showPause(); });

  /* ------------------------------------------------------------------ HUD + overlays */
  function hud() {
    if (!G) return;
    $("hFloor").textContent = G.floor; $("hWave").textContent = Math.min(3, G.wave) + "/3"; $("hMoves").textContent = G.moves;
    var a = Math.floor(G.arise); $("ariseFill").style.width = a + "%"; $("arisePct").textContent = a >= 100 ? "READY" : a + "%";
    $("bArise").classList.toggle("ready", a >= 100);
  }
  var OV = $("overlay"), ovLoop = null;
  function overlay(html) { OV.innerHTML = html; OV.classList.remove("hide"); if (G) G.paused = true; }
  function hideOverlay() { OV.classList.add("hide"); OV.innerHTML = ""; if (ovLoop) { cancelAnimationFrame(ovLoop); ovLoop = null; } if (G) G.paused = false; }
  function legend() {
    return '<div class="legend">' + COLORS.map(function (C, i) { return '<div><i style="background:' + C.base + '"></i><span><b>' + C.name + "</b> · " + C.does + "</span></div>"; }).join("") +
      '<div><i style="background:#1a0f3a;border:1px solid #a78bfa"></i><span><b>4 / 5 / L</b> · Line, Monarch, Burst runes</span></div></div>';
  }
  function armyLine() { return '<p class="small">' + (ARMY.real ? "Squad levels come from your army: " + ARMY.total + " shadow" + (ARMY.total === 1 ? "" : "s") + " raised in the System." : "No army found on this device, so your squad is a Lv3 test squad.") + "</p>"; }
  function showIntro() {
    var resume = SAVE.run && SAVE.run.floor > 1;
    overlay('<div class="card"><div class="k">Shadow Runes · test build</div><h2>' + (resume ? "Floor " + SAVE.run.floor : "The Gate Opens") + "</h2>" +
      "<p>Swipe runes to match 3 or more. Each color powers one of your shadows. Monsters strike when their counter hits zero. Tap a monster to focus it.</p>" + legend() + armyLine() +
      '<div class="row">' + (resume ? '<button class="btn ghost" id="oNew">New climb</button>' : "") + '<button class="btn" id="oGo">' + (resume ? "Resume climb" : "Enter the gate") + "</button></div>" +
      (SAVE.best ? '<p class="small" style="margin-top:10px">Best: floor ' + SAVE.best + "</p>" : "") + "</div>");
    $("oGo").onclick = function () { hideOverlay(); startFloor(resume ? SAVE.run : newRun()); };
    if (resume) $("oNew").onclick = function () { hideOverlay(); startFloor(newRun()); };
  }
  function showPause() {
    overlay('<div class="card"><div class="k">Paused</div><h2>Floor ' + G.floor + "</h2><p>Wave " + G.wave + " of 3 · " + Math.ceil(G.hp) + " HP</p>" + legend() + armyLine() +
      '<div class="row"><button class="btn ghost" id="oAbandon">Abandon climb</button><button class="btn" id="oResume">Resume</button></div></div>');
    $("oResume").onclick = hideOverlay;
    $("oAbandon").onclick = function () { SAVE.run = null; persist(); hideOverlay(); G.over = true; showIntro(); };
  }
  function rollTier(f) {
    var w = [60, 28, 9, 2.5, 0.5], shift = Math.min(40, (f - 1) * 4);
    w[0] -= shift; w[1] += shift * 0.5; w[2] += shift * 0.3; w[3] += shift * 0.15; w[4] += shift * 0.05;
    var tot = w.reduce(function (a, b) { return a + b; }), r = Math.random() * tot;
    for (var i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return 0;
  }
  function showVictory() {
    var f = G.floor, tier = rollTier(f), cls = pick(CLASSES), T = TIERS[tier];
    var sh = { cls: cls, tier: tier, floor: f, from: G.bossName, t: Date.now() };
    G.run.extracted.push(sh); SAVE.log.unshift(sh); SAVE.log = SAVE.log.slice(0, 40); SAVE.best = Math.max(SAVE.best, f); persist();
    overlay('<div class="card"><div class="k">Floor ' + f + " cleared · " + G.moves + " moves</div><h2>ARISE</h2>" +
      '<canvas id="oFig" width="320" height="300" style="width:160px;height:150px"></canvas>' +
      '<div class="tier" style="color:' + T.color + '">' + T.name.toUpperCase() + " · " + cls.toUpperCase() + "</div><p>" + G.bossName + "'s shadow kneels.</p>" +
      '<p class="small">Test build: kept in the climb log, not added to your System army yet.</p>' +
      '<div class="row"><button class="btn" id="oNext">Choose a boon</button></div></div>');
    var oc = $("oFig").getContext("2d"), t0 = performance.now(), wisps = [];
    (function loop() {
      var tt = (performance.now() - t0) / 1000, k = Math.min(1, tt / 1.1), keep = c; c = oc;
      oc.setTransform(2, 0, 0, 2, 0, 0); oc.clearRect(0, 0, 160, 150);
      var g = oc.createRadialGradient(80, 110, 0, 80, 110, 70); g.addColorStop(0, "rgba(139,92,246," + 0.35 * k + ")"); g.addColorStop(1, "rgba(139,92,246,0)"); oc.fillStyle = g; oc.fillRect(0, 0, 160, 150);
      if (Math.random() < 0.7) wisps.push({ x: 80 + rnd(-16, 16), y: 126 - rnd(0, 50) * k, vy: -rnd(14, 30), vx: rnd(-4, 4), r: rnd(4, 9), l: 1 });
      oc.save(); oc.globalCompositeOperation = "lighter";
      wisps.forEach(function (w) { w.l -= 0.016; w.y += w.vy * 0.016; w.x += w.vx * 0.016; w.r += 0.12; var gg = oc.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r); gg.addColorStop(0, "rgba(139,92,246," + 0.22 * w.l * k + ")"); gg.addColorStop(1, "rgba(139,92,246,0)"); oc.fillStyle = gg; oc.beginPath(); oc.arc(w.x, w.y, w.r, 0, TAU); oc.fill(); });
      wisps = wisps.filter(function (w) { return w.l > 0; }); oc.restore();
      oc.save(); oc.beginPath(); oc.rect(0, 0, 160, 128); oc.clip();
      drawShadow(cls, 80, 128 + (1 - easeOut(k)) * 80, tt, 1, (tt % 2.4) > 2.1 ? 0.22 - ((tt % 2.4) - 2.1) * 0.7 : 0, 0, Math.min(2, tier), 0, T.color, 4.2);
      oc.restore();
      oc.strokeStyle = "rgba(196,181,253," + 0.6 * k + ")"; oc.lineWidth = 1; oc.beginPath(); oc.ellipse(80, 128, 34, 8, 0, 0, TAU); oc.stroke();
      c = keep; ovLoop = requestAnimationFrame(loop);
    })();
    $("oNext").onclick = showBoons;
  }
  function showBoons() {
    if (ovLoop) { cancelAnimationFrame(ovLoop); ovLoop = null; }
    var pool = BOONS.slice(), picks = [];
    while (picks.length < 3) picks.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    overlay('<div class="card"><div class="k">Floor ' + (G.floor + 1) + " awaits</div><h2>Choose a Boon</h2><p>It lasts for the rest of this climb.</p>" +
      '<div class="boons">' + picks.map(function (b, i) {
        var have = G.boons[b.id] || 0, C = b.col >= 0 ? COLORS[b.col] : { base: "#c4b5fd", glow: "167,139,250" };
        return '<button class="boon" data-i="' + i + '"><span class="gl" style="color:' + C.base + ';background:radial-gradient(circle, rgba(' + C.glow + ',.35), rgba(' + C.glow + ',.05))">' + (b.col >= 0 ? "◆" : "✦") + "</span><span><b>" + b.name + "</b><small>" + b.desc + "</small>" + (have ? "<em>Owned ×" + have + "</em>" : "") + "</span></button>";
      }).join("") + "</div></div>");
    OV.querySelectorAll(".boon").forEach(function (el) {
      el.onclick = function () {
        var b = picks[+el.getAttribute("data-i")], run = G.run;
        run.boons[b.id] = (run.boons[b.id] || 0) + 1;
        var mh = maxHpFor(run.boons);
        run.hp = b.id === "vital" ? mh : Math.min(mh, Math.round(G.hp + mh * 0.3));
        run.floor = G.floor + 1;
        hideOverlay(); startFloor(run);
      };
    });
  }
  function showDefeat() {
    SAVE.best = Math.max(SAVE.best, G.floor - 1); var got = G.run.extracted.length; SAVE.run = null; persist();
    overlay('<div class="card"><div class="k">The squad fell</div><h2>Floor ' + G.floor + "</h2><p>Wave " + G.wave + " of 3, after " + G.moves + " moves.</p>" +
      "<p>" + (got ? got + " shadow" + (got > 1 ? "s" : "") + " extracted this climb." : "No extractions this climb.") + '</p><p class="small">Best: floor ' + SAVE.best + "</p>" +
      '<div class="row"><button class="btn" id="oAgain">Climb again</button></div></div>');
    $("oAgain").onclick = function () { hideOverlay(); startFloor(newRun()); };
  }

  /* ------------------------------------------------------------------ loop */
  var last = performance.now(), hudT = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G && !G.paused) { update(dt); hudT -= dt; if (hudT <= 0) { hudT = 0.1; hud(); } }
    if (G) render();
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () { if (document.hidden && G && !G.over && !G.paused) showPause(); });
  buildGems();
  startFloor(SAVE.run || newRun());
  G.paused = true;
  resize(); showIntro();
  requestAnimationFrame(frame);

  window.__pz = {
    get G() { return G; }, set fast(v) { FAST = v; }, trySwap: trySwap, findMove: findMove, update: update, hide: hideOverlay, startFloor: startFloor, newRun: newRun, doArise: doArise,
    snap: snapAll,
    bestMove: function () {
      var best = null, bs = -1;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) [[0, 1], [1, 0]].forEach(function (d) {
        var r2 = r + d[0], c2 = c + d[1]; if (r2 >= ROWS || c2 >= COLS) return;
        var a = G.grid[r][c], b = G.grid[r2][c2], sc = 0;
        if (a.sp === "orb" || b.sp === "orb" || (a.sp && b.sp)) sc = 20;
        else { swapGrid(r, c, r2, c2); findRuns().forEach(function (rn) { sc += rn.cells.length * (rn.col < 3 ? 1.3 : (rn.col === 3 && G.hp < G.maxHp * 0.6 ? 1.5 : 0.8)); }); swapGrid(r, c, r2, c2); }
        if (sc > bs) { bs = sc; best = [r, c, r2, c2]; }
      });
      return best;
    }
  };
})();
