/* Shadow Gates — Kingdom Rush-style roguelike tower defense (test build).
   One floor = 10 waves + a gate boss. Clear it, extract the boss, pick a boon, climb.
   Everything is drawn in code; world is a fixed 400x720 portrait field scaled to fit. */
(function () {
  "use strict";

  var W = 400, H = 720, TAU = Math.PI * 2;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function $(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------ path */
  var CTRL = [[300, 10], [300, 90], [255, 140], [120, 148], [68, 205], [95, 268], [290, 292], [338, 352], [305, 418],
    [125, 438], [68, 498], [112, 560], [255, 585], [288, 640], [268, 740]];
  var PTS = [], LEN = 0;
  (function buildPath() {
    function cr(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return [0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)];
    }
    var raw = [];
    for (var i = 0; i < CTRL.length - 1; i++) {
      var p0 = CTRL[Math.max(0, i - 1)], p1 = CTRL[i], p2 = CTRL[i + 1], p3 = CTRL[Math.min(CTRL.length - 1, i + 2)];
      for (var j = 0; j < 16; j++) raw.push(cr(p0, p1, p2, p3, j / 16));
    }
    raw.push(CTRL[CTRL.length - 1]);
    var s = 0;
    for (var k = 0; k < raw.length; k++) {
      if (k) s += dist(raw[k][0], raw[k][1], raw[k - 1][0], raw[k - 1][1]);
      PTS.push({ x: raw[k][0], y: raw[k][1], s: s });
    }
    LEN = s;
  })();
  function posAt(s) {
    s = clamp(s, 0, LEN);
    var lo = 0, hi = PTS.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (PTS[m].s < s) lo = m; else hi = m; }
    var a = PTS[lo], b = PTS[hi], d = (b.s - a.s) || 1, t = (s - a.s) / d;
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), dx: (b.x - a.x) / d, dy: (b.y - a.y) / d };
  }
  function nearestOnPath(x, y) {
    var best = PTS[0], bd = 1e9;
    for (var i = 0; i < PTS.length; i++) { var d = dist(x, y, PTS[i].x, PTS[i].y); if (d < bd) { bd = d; best = PTS[i]; } }
    return { x: best.x, y: best.y, s: best.s, d: bd };
  }
  function pathDist(x, y) { return nearestOnPath(x, y).d; }

  var SPOTS = [[205, 75], [200, 215], [195, 365], [365, 430], [195, 512], [40, 560]].map(function (p, i) { return { i: i, x: p[0], y: p[1], post: null }; });
  var GATE = { x: 300, y: 12 }, SEAL = { x: 268, y: 716 };

  /* ------------------------------------------------------------------ save + army */
  var SKEY = "systemTD.v1";
  var SAVE = (function () { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } })();
  if (!SAVE.best) SAVE.best = 0;
  if (!SAVE.log) SAVE.log = [];
  function persist() { try { localStorage.setItem(SKEY, JSON.stringify(SAVE)); } catch (e) {} }

  var ROLE = { Knight: "vanguard", Bulwark: "vanguard", Berserker: "vanguard", Lancer: "vanguard", Archer: "ranger", Assassin: "ranger", Mage: "arcane", Healer: "arcane" };
  var ARMY = (function readArmy() {
    var out = { vanguard: 0, ranger: 0, arcane: 0, total: 0, real: false, cls: { vanguard: [], ranger: [], arcane: [] } };
    try {
      var raw = JSON.parse(localStorage.getItem("systemApp.v2"));
      if (raw && Array.isArray(raw.shadows) && raw.shadows.length) {
        raw.shadows.forEach(function (s) {
          if (!s || s.preview) return;
          out.total++;
          if (s.monarch) { out.vanguard++; out.ranger++; out.arcane++; return; }
          var r = ROLE[s.cls];
          if (r) { out[r]++; out.cls[r].push(s.cls); }
        });
        out.real = out.total > 0;
      }
    } catch (e) {}
    if (!out.real) { out.vanguard = out.ranger = out.arcane = 2; out.cls = { vanguard: ["Knight", "Bulwark"], ranger: ["Archer"], arcane: ["Mage"] }; }
    if (!out.cls.vanguard.length) out.cls.vanguard = ["Knight"];
    return out;
  })();
  function capFor(role) { return SAVE.ignoreCaps ? 6 : Math.max(1, ARMY[role]); }
  function builtOf(role) { return SPOTS.filter(function (s) { return s.post && s.post.type === role; }).length; }

  /* ------------------------------------------------------------------ definitions */
  var ET = {
    ghoul: { name: "Ghoul", hp: 38, spd: 40, arm: 0, mr: 0, bounty: 5, dmg: 4, cd: 1, r: 8, lives: 1 },
    orc: { name: "Orc Brute", hp: 105, spd: 28, arm: 0.1, mr: 0, bounty: 9, dmg: 9, cd: 1.1, r: 10, lives: 1 },
    golem: { name: "Stone Golem", hp: 240, spd: 20, arm: 0.55, mr: 0, bounty: 16, dmg: 14, cd: 1.4, r: 12, lives: 2 },
    bat: { name: "Gate Bat", hp: 48, spd: 46, arm: 0, mr: 0, bounty: 7, dmg: 0, cd: 1, r: 8, lives: 1, fly: true },
    cultist: { name: "Red Cultist", hp: 90, spd: 27, arm: 0, mr: 0.6, bounty: 11, dmg: 7, cd: 1, r: 9, lives: 1 },
    boss: { name: "Gate Boss", hp: 2400, spd: 14, arm: 0.3, mr: 0.25, bounty: 140, dmg: 38, cd: 1.5, r: 22, lives: 10, boss: true }
  };
  var BOSS_NAMES = ["Grath the Gatekeeper", "Morrow, Bone Tyrant", "The Ashen Ogre", "Hollow King Vess", "Ruun of the Red Gate", "Skarn, the Iron Maw", "Velka, Blood Matron", "The Sunken Colossus"];
  var WAVES = [
    [["ghoul", 6, 0.9]],
    [["ghoul", 8, 0.8], ["orc", 2, 1.6]],
    [["orc", 5, 1.4], ["ghoul", 6, 0.7]],
    [["bat", 6, 0.9], ["ghoul", 6, 0.8]],
    [["ghoul", 6, 0.6], ["orc", 4, 1.3], ["golem", 2, 2.4]],
    [["cultist", 5, 1.3], ["orc", 4, 1.3], ["bat", 4, 0.9]],
    [["ghoul", 10, 0.5], ["golem", 4, 2.2], ["cultist", 4, 1.3]],
    [["bat", 10, 0.6], ["orc", 6, 1.1], ["golem", 2, 2.2]],
    [["ghoul", 10, 0.45], ["orc", 6, 1], ["cultist", 6, 1.1], ["golem", 5, 2]],
    [["ghoul", 12, 0.5], ["orc", 6, 1], ["boss", 1, 0], ["cultist", 4, 1.2]]
  ];
  var PT = {
    vanguard: { name: "Vanguard Rift", desc: "Shadow knights step out and hold the road.", cost: [70, 90, 140],
      n: [2, 3, 3], hp: [90, 150, 240], dmg: [6, 10, 15], cd: 0.9, respawn: 9, range: 52 },
    ranger: { name: "Ranger Spire", desc: "Fast arrows. Hits fliers.", cost: [70, 90, 140],
      range: [112, 124, 138], dmg: [8, 13, 19], cd: [0.8, 0.7, 0.58] },
    arcane: { name: "Arcane Obelisk", desc: "Heavy magic that ignores armor.", cost: [100, 120, 180],
      range: [100, 108, 118], dmg: [24, 40, 62], cd: [1.7, 1.55, 1.4], splash: [0, 0, 26] }
  };
  var BOONS = [
    { id: "arrows", name: "Piercing Volley", desc: "Ranger Spires deal +25% damage.", ic: "bow" },
    { id: "arcane", name: "Abyssal Focus", desc: "Arcane Obelisks deal +25% damage.", ic: "orb" },
    { id: "iron", name: "Iron Ranks", desc: "Vanguard knights get +35% HP.", ic: "shield" },
    { id: "swift", name: "Swift Return", desc: "Fallen knights reform 40% faster.", ic: "loop" },
    { id: "greed", name: "Monarch's Tithe", desc: "+20% mana from kills.", ic: "mana" },
    { id: "stock", name: "War Chest", desc: "+80 starting mana every floor.", ic: "mana" },
    { id: "rush", name: "Dagger Mastery", desc: "Dagger Rush: +40% damage, −25% cooldown.", ic: "dagger" },
    { id: "arise", name: "Deeper Call", desc: "ARISE raises 2 more, and they last 50% longer.", ic: "arise" },
    { id: "haste", name: "Quickened Posts", desc: "All posts attack 15% faster.", ic: "loop" },
    { id: "hunter", name: "Hunter's Body", desc: "Hunter: +40% HP, +25% damage.", ic: "dagger" },
    { id: "wall", name: "Sealed Gate", desc: "+6 gate integrity right now.", ic: "shield" },
    { id: "reach", name: "Long Sight", desc: "All posts get +12% range.", ic: "eye" }
  ];
  var TIERS = [
    { name: "Soldier", color: "#8f86c9" }, { name: "Elite", color: "#6f9bff" }, { name: "Knight", color: "#a855f7" },
    { name: "Commander", color: "#e879f9" }, { name: "Marshal", color: "#ffd166" }
  ];
  var CLASSES = ["Knight", "Archer", "Mage", "Assassin", "Lancer", "Bulwark", "Healer", "Berserker"];

  /* ------------------------------------------------------------------ state */
  var G = null;
  function B(id) { return (G && G.boons[id]) || 0; }
  function newRun() { return { floor: 1, lives: 20, boons: {}, extracted: [] }; }
  function startFloor(run) {
    SPOTS.forEach(function (s) { s.post = null; });
    var f = run.floor;
    G = {
      run: run, floor: f, boons: run.boons, lives: run.lives, mana: 240 + 80 * (run.boons.stock || 0) + 15 * (f - 1),
      hpMul: Math.pow(1.17, f - 1), bountyMul: 1 + 0.06 * (f - 1), countMul: Math.min(1.8, 1 + 0.08 * (f - 1)),
      wave: 0, queue: [], waveT: 0, nextIn: null, state: "ready", speed: G ? G.speed : 1, paused: false, t: 0,
      enemies: [], allies: [], shots: [], parts: [], corpses: [], floats: [], banners: [],
      armed: null, sel: null, shake: 0, sealFlash: 0, gateFlare: 0, bossName: BOSS_NAMES[(f - 1) % BOSS_NAMES.length],
      cdRush: 0, cdArise: 0, endT: 0
    };
    var hmax = 260 * (1 + 0.4 * B("hunter"));
    G.hunter = { kind: "hunter", x: 150, y: 300, hx: 150, hy: 300, tx: 150, ty: 300, moving: false, hp: hmax, max: hmax,
      dmg: 14 * (1 + 0.25 * B("hunter")), cd: 0.55, atkT: 0, throwT: 0, eng: null, dead: false, respawn: 0, face: 1, swing: 0, hand: 0, dash: 0, walk: 0 };
    G.allies.push(G.hunter);
    SAVE.run = { floor: run.floor, lives: run.lives, boons: run.boons, extracted: run.extracted };
    persist();
    closeMenu(); hud(true);
    banner("FLOOR " + f, "Build on the glowing runes", "#c3b8fe");
  }

  /* ------------------------------------------------------------------ fx helpers */
  function part(o) { if (G.parts.length > 520) G.parts.shift(); o.life0 = o.life; G.parts.push(o); return o; }
  function smoke(x, y, col, n, spread, up) {
    for (var i = 0; i < n; i++) part({ t: "smoke", x: x + rnd(-spread, spread), y: y + rnd(-spread, spread) * 0.5, vx: rnd(-8, 8), vy: -rnd(8, up || 26), r: rnd(2, 5), g: rnd(0.4, 0.9), life: rnd(0.5, 1.1), c: col });
  }
  function sparks(x, y, col, n, sp) {
    for (var i = 0; i < n; i++) { var a = rnd(0, TAU), v = rnd(30, sp || 110); part({ t: "spark", x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.15, 0.35), c: col, w: rnd(0.8, 1.6) }); }
  }
  function ring(x, y, col, r0, r1, life, w) { part({ t: "ring", x: x, y: y, r0: r0, r1: r1, life: life, c: col, w: w || 2 }); }
  function slash(x, y, ang, col, r) { part({ t: "slash", x: x, y: y, a: ang, life: 0.18, c: col, r: r || 11 }); }
  function floatText(x, y, txt, col, size) { G.floats.push({ x: x, y: y, txt: txt, c: col, life: 0.9, life0: 0.9, size: size || 11 }); }
  function banner(txt, sub, col) { G.banners = [{ txt: txt, sub: sub || "", c: col || "#c3b8fe", life: 2.2, life0: 2.2 }]; }
  function shake(n) { G.shake = Math.max(G.shake, n); }

  /* ------------------------------------------------------------------ waves */
  function startWave() {
    if (G.wave >= WAVES.length) return;
    var idx = G.wave, groups = WAVES[idx], q = [];
    groups.forEach(function (g, gi) {
      var n = g[0] === "boss" ? 1 : Math.round(g[1] * G.countMul);
      var t0 = g[0] === "boss" ? 6 : gi * 2.5;
      for (var i = 0; i < n; i++) q.push({ t: t0 + i * g[2], type: g[0] });
    });
    q.sort(function (a, b) { return a.t - b.t; });
    G.queue = q; G.waveT = 0; G.wave++; G.nextIn = null; G.state = "play"; G.gateFlare = 1;
    if (G.wave === WAVES.length) banner("BOSS WAVE", G.bossName, "#ff6b7a");
    else banner("WAVE " + G.wave, "", "#c3b8fe");
    hud();
  }
  function callWave() {
    if (G.state !== "ready" && G.state !== "play") return;
    if (G.wave >= WAVES.length || (G.state === "play" && G.nextIn === null)) return;
    if (G.nextIn !== null && G.nextIn > 0) {
      var bonus = Math.ceil(G.nextIn * 1.5);
      G.mana += bonus; floatText(GATE.x, GATE.y + 34, "+" + bonus + " early", "#8fb4ff", 12); flash("hMana", "gain");
    }
    startWave();
  }
  function spawn(type) {
    var d = ET[type], boss = type === "boss";
    var hp = d.hp * 1.1 * G.hpMul * (boss ? 1 + 0.1 * (G.floor - 1) : 1);
    var e = { type: type, d: d, hp: hp, max: hp, s: 0, lane: boss ? 0 : rnd(-7, 7) * (d.fly ? 1.6 : 1), x: GATE.x, y: GATE.y, face: 1,
      blocker: null, atkT: 0.5, flash: 0, dead: false, gone: false, ph: rnd(0, TAU), born: 0, stompT: 4, fly: !!d.fly, walk: 0 };
    G.enemies.push(e);
    smoke(GATE.x, GATE.y + 4, "rgba(96,165,250,", 5, 10, 18);
    if (boss) { shake(7); ring(GATE.x, GATE.y, "rgba(255,90,110,", 6, 70, 0.8, 3); }
  }

  /* ------------------------------------------------------------------ posts */
  function build(spot, type) {
    var cost = PT[type].cost[0];
    if (G.mana < cost || builtOf(type) >= capFor(type)) return;
    G.mana -= cost;
    var np = nearestOnPath(spot.x, spot.y);
    var p = { type: type, lvl: 0, x: spot.x, y: spot.y, spot: spot, cdT: 0.3, invest: cost, fireT: 0, aim: 0, built: 0, units: [],
      rx: np.x + (spot.x - np.x) * 0.12, ry: np.y + (spot.y - np.y) * 0.12 };
    spot.post = p;
    if (type === "vanguard") syncKnights(p);
    smoke(spot.x, spot.y, "rgba(143,94,248,", 14, 14, 40); ring(spot.x, spot.y, "rgba(167,139,250,", 6, 34, 0.5, 2); shake(2);
    hud();
  }
  function upgrade(p) {
    if (p.lvl >= 2) return;
    var cost = PT[p.type].cost[p.lvl + 1];
    if (G.mana < cost) return;
    G.mana -= cost; p.invest += cost; p.lvl++; p.built = 0;
    if (p.type === "vanguard") { p.units.forEach(function (u) { var m = vgHp(p); u.max = m; if (!u.dead) u.hp = m; u.dmg = PT.vanguard.dmg[p.lvl]; }); syncKnights(p); }
    smoke(p.x, p.y - 14, "rgba(196,181,253,", 18, 14, 50); ring(p.x, p.y, "rgba(255,209,102,", 8, 40, 0.6, 2.5); sparks(p.x, p.y - 20, "#e9d5ff", 14, 120);
    hud();
  }
  function sell(p) {
    var back = Math.round(p.invest * 0.6);
    G.mana += back; floatText(p.x, p.y - 30, "+" + back, "#8fb4ff", 12);
    p.units.forEach(function (u) { releaseAlly(u); u.gone = true; u.dead = true; });
    G.allies = G.allies.filter(function (a) { return !a.gone; });
    p.spot.post = null; smoke(p.x, p.y - 8, "rgba(120,110,160,", 16, 14, 30);
    hud();
  }
  function vgHp(p) { return PT.vanguard.hp[p.lvl] * (1 + 0.35 * B("iron")); }
  function syncKnights(p) {
    var need = PT.vanguard.n[p.lvl];
    while (p.units.length < need) {
      var i = p.units.length, cls = ARMY.cls.vanguard[i % ARMY.cls.vanguard.length];
      var u = { kind: "knight", cls: cls, post: p, slot: i, x: p.x, y: p.y - 4, hx: 0, hy: 0, hp: vgHp(p), max: vgHp(p), dmg: PT.vanguard.dmg[p.lvl],
        cd: PT.vanguard.cd, atkT: rnd(0, 0.5), eng: null, dead: false, respawn: 0, face: 1, swing: 0, walk: 0, aura: rnd(0, 0.3) };
      p.units.push(u); G.allies.push(u);
    }
    var off = [[0, -9], [-9, 6], [9, 6]];
    p.units.forEach(function (u, i) { u.hx = p.rx + off[i][0]; u.hy = p.ry + off[i][1]; });
  }
  function rangeOf(p) { return (p.type === "vanguard" ? PT.vanguard.range : PT[p.type].range[p.lvl]) * (1 + 0.12 * B("reach")); }

  /* ------------------------------------------------------------------ combat */
  function hurt(e, dmg, kind) {
    if (e.dead) return;
    var red = kind === "magic" ? e.d.mr : kind === "phys" ? e.d.arm : 0;
    e.hp -= dmg * (1 - red); e.flash = 0.06;
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {
    e.dead = true;
    var b = Math.round(e.d.bounty * G.bountyMul * (1 + 0.2 * B("greed")));
    G.mana += b; floatText(e.x, e.y - 16, "+" + b, "#8fb4ff", 10); flash("hMana", "gain");
    releaseEnemy(e);
    var col = e.type === "golem" ? "rgba(140,150,170," : e.type === "boss" ? "rgba(200,60,60," : "rgba(70,60,90,";
    smoke(e.x, e.y - 6, col, e.d.boss ? 40 : 8, e.d.r * 0.6, 30); sparks(e.x, e.y - 6, "#fda4af", e.d.boss ? 30 : 5, 90);
    if (!e.d.boss) G.corpses.push({ x: e.x, y: e.y, type: e.type, t: 10, fly: e.fly, ph: rnd(0, TAU) });
    if (e.d.boss) { shake(12); ring(e.x, e.y, "rgba(255,120,120,", 10, 120, 1, 4); }
  }
  function releaseEnemy(e) { G.allies.forEach(function (a) { if (a.eng === e) a.eng = null; }); e.blocker = null; }
  function releaseAlly(a) { G.enemies.forEach(function (e) { if (e.blocker === a) e.blocker = null; }); a.eng = null; }
  function hitAlly(a, dmg) {
    if (a.dead) return;
    a.hp -= dmg; a.flash = 0.06;
    if (a.hp <= 0) {
      a.hp = 0; a.dead = true; releaseAlly(a);
      smoke(a.x, a.y - 6, "rgba(143,94,248,", 10, 6, 34);
      if (a.kind === "knight") a.respawn = PT.vanguard.respawn * (1 - 0.4 * Math.min(1, B("swift")));
      else if (a.kind === "hunter") { a.respawn = 12; banner("HUNTER DOWN", "Back in 12s", "#ff8291"); }
      else a.gone = true;
    }
  }
  function aliveEnemies() { return G.enemies.filter(function (e) { return !e.dead && !e.gone; }); }

  /* ------------------------------------------------------------------ abilities */
  function rushCd() { return 14 * (1 - 0.25 * Math.min(2, B("rush"))); }
  function doRush(x, y) {
    var h = G.hunter; G.armed = null; setHint("");
    if (h.dead || G.cdRush > 0) return;
    var d = dist(h.x, h.y, x, y), max = 170;
    if (d > max) { x = h.x + (x - h.x) / d * max; y = h.y + (y - h.y) / d * max; d = max; }
    x = clamp(x, 10, W - 10); y = clamp(y, 20, H - 20);
    var ax = h.x, ay = h.y, dmg = 70 * (1 + 0.4 * B("rush")) * (1 + 0.25 * B("hunter")) * (1 + 0.1 * (G.floor - 1));
    releaseAlly(h);
    var hit = 0;
    aliveEnemies().forEach(function (e) {
      var t = clamp(((e.x - ax) * (x - ax) + (e.y - ay) * (y - ay)) / (d * d || 1), 0, 1);
      var px = ax + (x - ax) * t, py = ay + (y - ay) * t;
      if (dist(e.x, e.y - (e.fly ? 12 : 0), px, py) < 22 + e.d.r * 0.4) { hurt(e, dmg, "phys"); sparks(e.x, e.y - 6, "#ffb066", 8, 140); hit++; }
    });
    for (var i = 0; i <= 8; i++) { var t2 = i / 8; part({ t: "ghost", x: lerp(ax, x, t2), y: lerp(ay, y, t2), life: 0.25 + t2 * 0.25, face: x > ax ? 1 : -1 }); }
    part({ t: "streak", x: ax, y: ay - 8, x2: x, y2: y - 8, life: 0.35 });
    h.x = h.tx = h.hx = x; h.y = h.ty = h.hy = y; h.moving = false; h.face = x > ax ? 1 : -1; h.dash = 0.25;
    G.cdRush = rushCd(); shake(hit ? 5 : 2);
  }
  function ariseCd() { return 32; }
  function doArise() {
    if (G.cdArise > 0 || !G.corpses.length || G.state !== "play") return;
    var n = 5 + 2 * B("arise"), life = 18 * (1 + 0.5 * B("arise"));
    var list = G.corpses.slice().sort(function (a, b) { return b.t - a.t; }).slice(0, n);
    list.forEach(function (c, i) {
      var d = ET[c.type], hp = Math.min(420, d.hp * G.hpMul * 0.7 + 30);
      var r = { kind: "risen", etype: c.type, x: c.x, y: c.y, hx: c.x, hy: c.y, hp: hp, max: hp, dmg: (d.dmg || 5) * 1.6 + 6, cd: 0.9, atkT: 0.4 + i * 0.05,
        eng: null, dead: false, gone: false, face: 1, swing: 0, walk: 0, life: life, life0: life, fly: c.fly, rise: 0.6 + i * 0.08, ph: rnd(0, TAU) };
      G.allies.push(r);
      part({ t: "pillar", x: c.x, y: c.y, life: 0.9, delay: i * 0.08 });
      smoke(c.x, c.y, "rgba(143,94,248,", 14, 8, 60);
    });
    G.corpses = G.corpses.filter(function (c) { return list.indexOf(c) < 0; });
    G.cdArise = ariseCd(); G.ariseFx = 1.2; shake(6);
    banner("ARISE", list.length + " shadow" + (list.length > 1 ? "s" : "") + " answer", "#c4b5fd");
  }

  /* ------------------------------------------------------------------ update */
  function update(dt) {
    G.t += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 22);
    G.sealFlash = Math.max(0, G.sealFlash - dt * 1.5); G.gateFlare = Math.max(0, G.gateFlare - dt * 0.8);
    if (G.ariseFx) G.ariseFx = Math.max(0, G.ariseFx - dt);
    G.cdRush = Math.max(0, G.cdRush - dt); G.cdArise = Math.max(0, G.cdArise - dt);

    if (G.state === "play") {
      G.waveT += dt;
      while (G.queue.length && G.queue[0].t <= G.waveT) spawn(G.queue.shift().type);
      if (!G.queue.length && G.wave < WAVES.length) {
        if (G.nextIn === null) G.nextIn = 20;
        G.nextIn -= dt;
        if (G.nextIn <= 0) { G.nextIn = null; startWave(); }
      }
    }

    var en = G.enemies;
    for (var i = 0; i < en.length; i++) updEnemy(en[i], dt);
    G.enemies = en.filter(function (e) { return !e.dead && !e.gone; });

    for (var j = 0; j < G.allies.length; j++) updAlly(G.allies[j], dt);
    G.allies = G.allies.filter(function (a) { return !a.gone; });

    SPOTS.forEach(function (s) { if (s.post) updPost(s.post, dt); });
    updShots(dt);

    G.corpses.forEach(function (c) { c.t -= dt; if (G.cdArise <= 0 && Math.random() < dt * 3) part({ t: "smoke", x: c.x + rnd(-3, 3), y: c.y - 2, vx: rnd(-2, 2), vy: -rnd(12, 24), r: rnd(1.5, 2.5), g: 0.8, life: rnd(0.6, 1), c: "rgba(167,139,250," }); });
    G.corpses = G.corpses.filter(function (c) { return c.t > 0; });

    var ps = G.parts;
    for (var k = 0; k < ps.length; k++) {
      var p = ps[k];
      if (p.delay) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.t === "smoke") { p.vx *= 0.96; p.r += dt * 6 * (p.g || 1); } if (p.t === "spark") { p.vx *= 0.9; p.vy *= 0.9; } if (p.t === "mote") { p.vx += Math.sin(G.t * 2 + p.y) * 2 * dt; } }
    }
    G.parts = ps.filter(function (p) { return p.life > 0; });
    G.floats.forEach(function (f) { f.life -= dt; f.y -= 16 * dt; });
    G.floats = G.floats.filter(function (f) { return f.life > 0; });
    G.banners.forEach(function (b) { b.life -= dt; });
    G.banners = G.banners.filter(function (b) { return b.life > 0; });

    // ambience
    if (Math.random() < dt * 6) part({ t: "mote", x: rnd(0, W), y: rnd(0, H), vx: rnd(-4, 4), vy: -rnd(3, 10), life: rnd(3, 6), r: rnd(0.6, 1.4), c: Math.random() < 0.7 ? "196,181,253" : "125,211,252" });
    if (Math.random() < dt * 10) part({ t: "mote", x: GATE.x + rnd(-26, 26), y: GATE.y + rnd(-6, 8), vx: rnd(-6, 6), vy: rnd(4, 16), life: rnd(0.8, 1.6), r: rnd(0.8, 1.8), c: "147,197,253" });

    // win / lose
    if (G.state === "play" && G.wave >= WAVES.length && !G.queue.length && !aliveEnemies().length) {
      G.state = "won"; G.endT = 1.6; banner("GATE CLEARED", G.bossName + " falls", "#ffd166");
    }
    if (G.state === "won" || G.state === "lost") { G.endT -= dt; if (G.endT <= 0 && !G.endShown) { G.endShown = true; G.state === "won" ? showVictory() : showDefeat(); } }
  }

  function updEnemy(e, dt) {
    if (e.dead) return;
    e.born += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.blocker && (e.blocker.dead || e.blocker.gone || e.blocker.eng !== e)) e.blocker = null;
    if (e.blocker && !e.fly) {
      var a = e.blocker;
      e.face = a.x > e.x ? 1 : -1;
      e.atkT -= dt;
      if (e.atkT <= 0) {
        e.atkT = e.d.cd; e.swing = 0.25;
        hitAlly(a, e.d.dmg * (1 + 0.12 * (G.floor - 1)));
        slash(a.x, a.y - 8, e.face > 0 ? 0 : Math.PI, e.d.boss ? "rgba(255,120,90," : "rgba(255,210,210,", e.d.boss ? 18 : 9);
      }
      if (e.d.boss) {
        e.stompT -= dt;
        if (e.stompT <= 0) {
          e.stompT = 5;
          G.allies.forEach(function (al) { if (!al.dead && dist(al.x, al.y, e.x, e.y) < 46) hitAlly(al, 55 * (1 + 0.12 * (G.floor - 1))); });
          ring(e.x, e.y, "rgba(255,170,120,", 10, 56, 0.5, 3); smoke(e.x, e.y, "rgba(120,100,90,", 16, 26, 14); shake(7);
        }
      }
    } else {
      e.s += e.d.spd * dt; e.walk += dt;
      var p = posAt(e.s);
      var nx = p.x - p.dy * e.lane, ny = p.y + p.dx * e.lane;
      if (Math.abs(nx - e.x) > 0.05) e.face = nx > e.x ? 1 : -1;
      e.x = nx; e.y = ny;
      if (e.s >= LEN) {
        e.gone = true; releaseEnemy(e);
        G.lives -= e.d.lives; G.sealFlash = 1; shake(e.d.boss ? 10 : 4); flash("hLives", "hit");
        ring(SEAL.x, SEAL.y - 10, "rgba(255,77,94,", 6, 50, 0.5, 3);
        if (G.lives <= 0) { G.lives = 0; G.state = "lost"; G.endT = 1.4; banner("THE GATE BREAKS", "", "#ff4d5e"); }
      }
    }
    if (e.swing) e.swing = Math.max(0, e.swing - dt);
  }

  function updAlly(a, dt) {
    a.flash = Math.max(0, (a.flash || 0) - dt); if (a.swing) a.swing = Math.max(0, a.swing - dt); if (a.dash) a.dash = Math.max(0, a.dash - dt);
    if (a.rise) { a.rise = Math.max(0, a.rise - dt); return; }
    if (a.dead) {
      if (a.kind === "knight" && !a.post.spot.post) { a.gone = true; return; }
      if (a.kind === "knight" || a.kind === "hunter") {
        a.respawn -= dt;
        if (a.respawn <= 0) {
          a.dead = false; a.hp = a.max;
          if (a.kind === "knight") { a.x = a.post.x; a.y = a.post.y - 4; smoke(a.x, a.y, "rgba(143,94,248,", 8, 6, 30); }
          else { a.x = a.hx; a.y = a.hy; a.moving = false; ring(a.x, a.y, "rgba(125,211,252,", 4, 30, 0.5, 2); smoke(a.x, a.y, "rgba(125,211,252,", 10, 6, 40); }
        }
      }
      return;
    }
    if (a.kind === "risen") {
      a.life -= dt;
      if (a.life <= 0) { a.dead = true; a.gone = true; releaseAlly(a); smoke(a.x, a.y - 6, "rgba(143,94,248,", 10, 6, 30); return; }
    }
    if (a.kind === "hunter") {
      if (!a.eng && a.hp < a.max) a.hp = Math.min(a.max, a.hp + 9 * dt);
      if (a.moving) {
        var d = dist(a.x, a.y, a.tx, a.ty);
        if (d < 2) { a.moving = false; a.hx = a.tx; a.hy = a.ty; }
        else { var sp = 92 * dt; a.x += (a.tx - a.x) / d * Math.min(sp, d); a.y += (a.ty - a.y) / d * Math.min(sp, d); a.face = a.tx > a.x ? 1 : -1; a.walk += dt; }
        return;
      }
      a.throwT -= dt;
      if (a.throwT <= 0) {
        var fl = null, fd = 86;
        G.enemies.forEach(function (e) { if (!e.dead && e.fly) { var dd = dist(a.x, a.y, e.x, e.y); if (dd < fd) { fd = dd; fl = e; } } });
        if (fl) { a.throwT = 0.8; a.face = fl.x > a.x ? 1 : -1; G.shots.push({ k: "dagger", x: a.x, y: a.y - 12, tg: fl, tx: fl.x, ty: fl.y - 12, sp: 420, dmg: 9 * (1 + 0.25 * B("hunter")), dt: "phys" }); }
      }
    }
    if (a.eng && (a.eng.dead || a.eng.gone)) a.eng = null;
    if (!a.eng) a.eng = findTarget(a);
    var spd = a.kind === "risen" ? 62 : a.kind === "hunter" ? 92 : 58;
    if (a.eng) {
      var e = a.eng, side = a.x <= e.x ? -1 : 1;
      if (e.blocker && e.blocker !== a) side = e.blocker.x <= e.x ? 1 : -1;
      var gx = e.x + side * (e.d.r + 6), gy = e.y + (a.fly ? -10 : 0);
      var dd2 = dist(a.x, a.y, gx, gy);
      if (dd2 > 3) { var st = spd * dt; a.x += (gx - a.x) / dd2 * Math.min(st, dd2); a.y += (gy - a.y) / dd2 * Math.min(st, dd2); a.walk += dt; }
      a.face = e.x > a.x ? 1 : -1;
      if (dd2 < 10) {
        if (!e.blocker && !e.fly && !a.fly) e.blocker = a;
        a.atkT -= dt;
        if (a.atkT <= 0) {
          a.atkT = a.cd; a.swing = 0.22; a.hand = 1 - (a.hand || 0);
          var dmg = a.dmg;
          if (a.kind === "hunter" || a.kind === "knight") hurt(e, dmg, "phys"); else hurt(e, dmg, "true");
          var col = a.kind === "hunter" ? (a.hand ? "rgba(255,170,90," : "rgba(240,244,255,") : "rgba(196,181,253,";
          slash(e.x - a.face * 3, e.y - 8 - (e.fly ? 12 : 0), a.face > 0 ? 0 : Math.PI, col, a.kind === "hunter" ? 12 : 9);
          sparks(e.x, e.y - 7 - (e.fly ? 12 : 0), a.kind === "hunter" ? "#fde68a" : "#ddd6fe", 3, 70);
        }
      }
    } else {
      var hd = dist(a.x, a.y, a.hx, a.hy);
      if (a.kind === "risen") { a.hx = a.x; a.hy = a.y; }
      else if (hd > 1.5) { var s2 = spd * dt; a.x += (a.hx - a.x) / hd * Math.min(s2, hd); a.y += (a.hy - a.y) / hd * Math.min(s2, hd); a.face = a.hx > a.x ? 1 : -1; a.walk += dt; }
    }
    if (a.kind === "knight" || a.kind === "risen") {
      a.aura = (a.aura || 0) - dt;
      if (a.aura <= 0) { a.aura = rnd(0.18, 0.32); part({ t: "smoke", x: a.x + rnd(-3, 3), y: a.y - rnd(2, 12), vx: rnd(-3, 3), vy: -rnd(10, 22), r: rnd(1.5, 3), g: 0.5, life: rnd(0.5, 0.9), c: "rgba(139,92,246," }); }
    }
  }
  function findTarget(a) {
    var cx, cy, R;
    if (a.kind === "knight") { cx = a.post.rx; cy = a.post.ry; R = PT.vanguard.range * (1 + 0.12 * B("reach")); }
    else if (a.kind === "hunter") { cx = a.hx; cy = a.hy; R = 58; }
    else { cx = a.x; cy = a.y; R = 120; }
    var free = null, fd = 1e9, any = null, ad = 1e9;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead || e.gone) continue;
      if (e.fly && !a.fly) continue;
      if (dist(cx, cy, e.x, e.y) > R) continue;
      var d = dist(a.x, a.y, e.x, e.y);
      if (!e.blocker || e.fly) { if (d < fd) { fd = d; free = e; } }
      else if (d < ad) { ad = d; any = e; }
    }
    return free || any;
  }

  function updPost(p, dt) {
    p.built = Math.min(1, p.built + dt * 2.5); p.fireT = Math.max(0, p.fireT - dt);
    if (p.type === "vanguard") return;
    p.cdT -= dt;
    if (p.cdT > 0) return;
    var R = rangeOf(p), best = null;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead || e.gone) continue;
      if (dist(p.x, p.y - 10, e.x, e.y) > R) continue;
      if (!best || e.s > best.s) best = e;
    }
    if (!best) { p.cdT = 0.1; return; }
    var haste = 1 - 0.15 * Math.min(2, B("haste"));
    var def = PT[p.type];
    p.cdT = def.cd[p.lvl] * haste; p.fireT = 0.2; p.aim = Math.atan2(best.y - p.y, best.x - p.x);
    if (p.type === "ranger") {
      G.shots.push({ k: "arrow", x: p.x, y: p.y - 34 - p.lvl * 5, tg: best, tx: best.x, ty: best.y - (best.fly ? 12 : 6), sp: 520, dmg: def.dmg[p.lvl] * (1 + 0.25 * B("arrows")), dt: "phys" });
    } else {
      var oy = p.y - 50 - p.lvl * 4;
      G.shots.push({ k: "orb", x: p.x, y: oy, tg: best, tx: best.x, ty: best.y - (best.fly ? 12 : 6), sp: 270, dmg: def.dmg[p.lvl] * (1 + 0.25 * B("arcane")), dt: "magic", splash: def.splash[p.lvl], lvl: p.lvl });
      sparks(p.x, oy, "#f0abfc", 5, 60);
    }
  }
  function updShots(dt) {
    G.shots.forEach(function (s) {
      if (s.tg && !s.tg.dead && !s.tg.gone) { s.tx = s.tg.x; s.ty = s.tg.y - (s.tg.fly ? 12 : 6); }
      else s.tg = null;
      var d = dist(s.x, s.y, s.tx, s.ty), st = s.sp * dt;
      s.ang = Math.atan2(s.ty - s.y, s.tx - s.x);
      if (d <= st + 2) {
        s.done = true;
        if (s.tg) {
          hurt(s.tg, s.dmg, s.dt);
          if (s.k === "orb") {
            ring(s.tx, s.ty, "rgba(232,121,249,", 2, 16 + (s.splash || 0) * 0.6, 0.35, 2); sparks(s.tx, s.ty, "#f5d0fe", 8, 100);
            if (s.splash) G.enemies.forEach(function (e) { if (e !== s.tg && !e.dead && dist(e.x, e.y, s.tx, s.ty) < s.splash) hurt(e, s.dmg * 0.5, "magic"); });
          } else sparks(s.tx, s.ty, s.k === "dagger" ? "#fed7aa" : "#e0e7ff", 3, 60);
        }
      } else {
        s.x += (s.tx - s.x) / d * st; s.y += (s.ty - s.y) / d * st;
        if (s.k === "orb" && Math.random() < 0.8) part({ t: "spark", x: s.x, y: s.y, vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.25, c: "#e879f9", w: 1.6 });
      }
    });
    G.shots = G.shots.filter(function (s) { return !s.done; });
  }

  /* ------------------------------------------------------------------ rendering */
  var cv = $("world"), c = cv.getContext("2d"), scale = 1, dpr = Math.min(2, window.devicePixelRatio || 1);
  var terrain = null;
  function resize() {
    var st = $("stage"), aw = st.clientWidth - 12, ah = st.clientHeight - 6;
    scale = Math.min(aw / W, ah / H);
    var fw = Math.floor(W * scale), fh = Math.floor(H * scale);
    $("frame").style.width = fw + "px"; $("frame").style.height = fh + "px";
    cv.style.width = fw + "px"; cv.style.height = fh + "px";
    cv.width = Math.round(fw * dpr); cv.height = Math.round(fh * dpr);
    if (G && G.sel) openMenu(G.sel);
  }

  function seeded(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function buildTerrain() {
    var k = 2, t = document.createElement("canvas"); t.width = W * k; t.height = H * k;
    var g = t.getContext("2d"); g.scale(k, k);
    var R = seeded(1337);
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1b2324"); bg.addColorStop(0.5, "#1a2122"); bg.addColorStop(1, "#171d22");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // ground variation
    for (var i = 0; i < 70; i++) {
      var x = R() * W, y = R() * H, r = 18 + R() * 60, gg = g.createRadialGradient(x, y, 0, x, y, r);
      var cols = ["rgba(48,66,52,0.35)", "rgba(36,44,58,0.35)", "rgba(58,54,72,0.22)", "rgba(28,34,30,0.4)"];
      gg.addColorStop(0, cols[(R() * cols.length) | 0]); gg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (i = 0; i < 2600; i++) { g.fillStyle = R() < 0.5 ? "rgba(255,255,255," + (0.015 + R() * 0.04) + ")" : "rgba(0,0,0," + (0.05 + R() * 0.08) + ")"; g.fillRect(R() * W, R() * H, 1, 1); }
    // grass tufts
    for (i = 0; i < 260; i++) {
      var tx = R() * W, ty = R() * H;
      if (pathDist(tx, ty) < 24) continue;
      g.strokeStyle = R() < 0.6 ? "rgba(92,122,88,0.55)" : "rgba(120,140,96,0.45)"; g.lineWidth = 0.8;
      for (var b = 0; b < 4; b++) { g.beginPath(); g.moveTo(tx + b * 1.2, ty); g.quadraticCurveTo(tx + b * 1.2 + (R() - 0.5) * 3, ty - 3, tx + b * 1.2 + (R() - 0.5) * 4, ty - 4 - R() * 3); g.stroke(); }
    }
    // the road
    function stroke(w, col) { g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = w; g.strokeStyle = col; g.beginPath(); PTS.forEach(function (p, j) { j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.stroke(); }
    stroke(40, "rgba(0,0,0,0.35)");
    stroke(35, "#2c2924");
    stroke(31, "#4a443b");
    stroke(25, "#56503f");
    stroke(12, "rgba(98,90,74,0.35)");
    for (i = 0; i < 900; i++) {
      var p = PTS[(R() * PTS.length) | 0], ox = (R() - 0.5) * 28, oy = (R() - 0.5) * 28;
      if (dist(p.x + ox, p.y + oy, p.x, p.y) > 14) continue;
      g.fillStyle = R() < 0.5 ? "rgba(30,26,22,0.35)" : "rgba(140,128,104,0.25)";
      g.beginPath(); g.ellipse(p.x + ox, p.y + oy, 1 + R() * 2.4, 0.8 + R() * 1.6, R() * 3, 0, TAU); g.fill();
    }
    // rocks, bones, crystals
    for (i = 0; i < 46; i++) {
      var rx = R() * W, ry = R() * H;
      if (pathDist(rx, ry) < 28) continue;
      if (SPOTS.some(function (s) { return dist(s.x, s.y, rx, ry) < 34; })) continue;
      var kind = R();
      if (kind < 0.55) {
        var rs = 3 + R() * 7; g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(rx + 1, ry + 2, rs * 1.1, rs * 0.5, 0, 0, TAU); g.fill();
        g.fillStyle = "#3d3f47"; g.beginPath();
        for (var v = 0; v < 7; v++) { var a = v / 7 * TAU, rr = rs * (0.75 + R() * 0.35); g.lineTo(rx + Math.cos(a) * rr, ry + Math.sin(a) * rr * 0.7); }
        g.closePath(); g.fill(); g.fillStyle = "rgba(160,165,185,0.18)"; g.beginPath(); g.ellipse(rx - rs * 0.25, ry - rs * 0.25, rs * 0.45, rs * 0.25, -0.4, 0, TAU); g.fill();
      } else if (kind < 0.8) {
        var cs = 4 + R() * 6; g.save(); g.translate(rx, ry);
        var cg = g.createRadialGradient(0, -cs * 0.4, 0, 0, -cs * 0.4, cs * 2.2); cg.addColorStop(0, "rgba(167,139,250,0.35)"); cg.addColorStop(1, "rgba(167,139,250,0)");
        g.fillStyle = cg; g.beginPath(); g.arc(0, -cs * 0.4, cs * 2.2, 0, TAU); g.fill();
        [[-2, 0.7, -0.35], [1.5, 1, 0.1], [3.5, 0.6, 0.45]].forEach(function (q) {
          g.save(); g.translate(q[0], 0); g.rotate(q[2]); var hh = cs * q[1] * 1.6;
          g.fillStyle = "#5b3fb0"; g.beginPath(); g.moveTo(-1.6, 0); g.lineTo(0, -hh); g.lineTo(1.6, 0); g.closePath(); g.fill();
          g.fillStyle = "rgba(221,214,254,0.6)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -hh); g.lineTo(1.2, -0.5); g.closePath(); g.fill(); g.restore();
        });
        g.restore();
      } else {
        g.strokeStyle = "rgba(205,198,180,0.45)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(rx - 4, ry); g.lineTo(rx + 4, ry - 1); g.stroke();
        g.fillStyle = "rgba(205,198,180,0.45)"; [[-4, 0], [4, -1]].forEach(function (q) { g.beginPath(); g.arc(rx + q[0], ry + q[1], 1.2, 0, TAU); g.fill(); });
      }
    }
    // seal arch footing at the bottom
    g.fillStyle = "#16141f"; g.fillRect(SEAL.x - 46, H - 18, 92, 18);
    terrain = t;
  }

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

  function drawHunter(h, t) {
    var fl = h.flash, x = h.x, y = h.y;
    c.save();
    c.strokeStyle = "rgba(125,211,252,0.55)"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y + 1, 10 + Math.sin(t * 3) * 0.6, 4, 0, 0, TAU); c.stroke();
    c.translate(x, y); c.scale(1.3 * h.face, 1.3);
    var step = Math.sin((h.walk || 0) * 12), bob = Math.abs(step) * 0.6, sw = h.swing ? Math.sin((1 - h.swing / 0.22) * Math.PI) : 0;
    groundShadow(0, 1, 7);
    c.strokeStyle = F("#0d0c14", fl); c.lineWidth = 2; c.lineCap = "round";
    c.beginPath(); c.moveTo(-1.6, -5); c.lineTo(-2.2 + step * 1.8, 0); c.moveTo(1.6, -5); c.lineTo(2.2 - step * 1.8, 0); c.stroke();
    c.beginPath(); c.moveTo(-4, -2.5 + Math.sin(t * 4) * 0.3); c.lineTo(4.5, -3); c.lineTo(3.4, -12.5 - bob); c.lineTo(-3.4, -12.5 - bob); c.closePath(); outline(F("#191726", fl), "#05040a", 0.9);
    c.strokeStyle = "rgba(125,211,252,0.35)"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0.4, -12 - bob); c.lineTo(0.8, -3); c.stroke();
    c.beginPath(); c.arc(0.6, -15.5 - bob, 3.1, 0, TAU); outline(F("#d8cbbd", fl), "#05040a", 0.8);
    c.fillStyle = F("#0c0b12", fl);
    c.beginPath(); c.moveTo(-2.8, -14 - bob); c.quadraticCurveTo(-3.4, -19.5 - bob, 0.6, -19.2 - bob); c.quadraticCurveTo(4.2, -19.4 - bob, 3.8, -16.2 - bob); c.lineTo(2.2, -17 - bob); c.lineTo(0.8, -16 - bob); c.lineTo(-0.6, -16.8 - bob); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-2.8, -16 - bob); c.lineTo(-4.4, -12.6 - bob); c.lineTo(-2.2, -13.6 - bob); c.lineTo(-3.4, -11.6 - bob); c.lineTo(-1.2, -13 - bob); c.closePath(); c.fill();
    eyes([[2, -15.8 - bob, 1, 0.8]], h.dash > 0 || G.ariseFx ? "#7dd3fc" : "#1e293b", "#7dd3fc");
    function dagger(px, py, a, edge) { c.save(); c.translate(px, py); c.rotate(a); c.strokeStyle = "#1f2937"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-1.5, 0); c.lineTo(1, 0); c.stroke();
      c.fillStyle = "#cbd5e1"; c.beginPath(); c.moveTo(1, -0.9); c.lineTo(8.5, 0); c.lineTo(1, 0.9); c.closePath(); c.fill();
      c.save(); c.shadowColor = edge; c.shadowBlur = 5; c.strokeStyle = edge; c.lineWidth = 0.7; c.beginPath(); c.moveTo(1.4, -0.8); c.lineTo(8.5, 0); c.stroke(); c.restore(); c.restore(); }
    var front = h.hand ? sw : 0, back = h.hand ? 0 : sw;
    dagger(-3.8, -7.5 - bob, -0.4 - back * 2.2, "#f8fafc");
    dagger(4, -8 - bob, -0.6 + front * 2.4, "#ff9a3c");
    c.restore();
  }

  function drawSpot(s, t) {
    var x = s.x, y = s.y, sel = G.sel === s;
    c.save();
    groundShadow(x, y + 2, 22, 9);
    c.beginPath(); c.ellipse(x, y, 20, 8.5, 0, 0, TAU); outline("#24212f", "#3c3752", 1.2);
    c.beginPath(); c.ellipse(x, y - 1.5, 16, 6.5, 0, 0, TAU); c.fillStyle = "#2c2839"; c.fill();
    var pulse = 0.35 + Math.sin(t * 2.4 + s.i) * 0.2 + (sel ? 0.35 : 0);
    c.strokeStyle = "rgba(167,139,250," + pulse + ")"; c.lineWidth = 1.2; c.setLineDash([3, 4]); c.lineDashOffset = -t * 6;
    c.beginPath(); c.ellipse(x, y - 1.5, 12, 4.8, 0, 0, TAU); c.stroke(); c.setLineDash([]);
    c.fillStyle = "rgba(221,214,254," + (pulse * 0.9) + ")"; c.font = "700 9px Orbitron, sans-serif"; c.textAlign = "center"; c.fillText("+", x, y + 1.5);
    c.restore();
  }
  function plinth(x, y, lvl, t) {
    groundShadow(x, y + 2, 22, 9);
    c.beginPath(); c.ellipse(x, y, 20, 8.5, 0, 0, TAU); outline("#1d1a29", "#3c3752", 1.2);
    c.beginPath(); c.ellipse(x, y - 2, 18, 7, 0, 0, TAU); c.fillStyle = "#26223a"; c.fill();
    c.save(); c.strokeStyle = "rgba(167,139,250," + (0.25 + lvl * 0.2 + Math.sin(t * 2) * 0.08) + ")"; c.lineWidth = 1; c.shadowColor = "#a78bfa"; c.shadowBlur = 4 + lvl * 3;
    for (var i = 0; i < 6; i++) { var a = i / 6 * TAU + t * 0.3; c.beginPath(); c.ellipse(x, y - 2, 15, 5.8, 0, a, a + 0.5); c.stroke(); }
    c.restore();
  }
  function drawPost(p, t) {
    var x = p.x, y = p.y, L = p.lvl, grow = 0.6 + 0.4 * easeOut(p.built);
    plinth(x, y, L, t);
    c.save(); c.translate(x, y - 2); c.scale(grow, grow);
    if (p.type === "ranger") {
      var hgt = 28 + L * 6;
      var g = c.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, "#0b0916"); g.addColorStop(0.5, "#221d3a"); g.addColorStop(1, "#0b0916");
      c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.lineTo(6, -hgt); c.lineTo(-6, -hgt); c.closePath(); outline(g, "#3c3458", 1);
      c.save(); c.shadowColor = "#a78bfa"; c.shadowBlur = 6; c.strokeStyle = "rgba(196,181,253," + (0.5 + L * 0.2) + ")"; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(0, -4); c.lineTo(0, -hgt + 6); c.moveTo(-3, -hgt * 0.45); c.lineTo(3, -hgt * 0.45 - 3); c.stroke(); c.restore();
      c.beginPath(); c.ellipse(0, -hgt, 9, 3.6, 0, 0, TAU); outline("#2a2443", "#4a4170", 1);
      if (L >= 1) { c.fillStyle = "#4c1d95"; c.beginPath(); c.moveTo(-6, -hgt + 2); c.lineTo(-6, -hgt + 12); c.lineTo(-3.5, -hgt + 9); c.lineTo(-3.5, -hgt + 2); c.fill(); }
      c.restore();
      var aimF = Math.cos(p.aim) >= 0 ? 1 : -1;
      drawShadow("Archer", x, y - 2 - (hgt - 1) * grow, t, aimF, p.fireT > 0 ? p.fireT : 0, 0, L, 0, null, 0.92);
      if (L >= 2) for (var k = 0; k < 3; k++) { var a = t * 1.4 + k * TAU / 3, sx = x + Math.cos(a) * 12, sy = y - hgt - 12 + Math.sin(a) * 4;
        c.save(); c.shadowColor = "#c4b5fd"; c.shadowBlur = 8; c.fillStyle = "#ddd6fe"; c.beginPath(); c.moveTo(sx, sy - 3); c.lineTo(sx + 1.5, sy); c.lineTo(sx, sy + 3); c.lineTo(sx - 1.5, sy); c.fill(); c.restore(); }
      return;
    }
    if (p.type === "arcane") {
      var oh = 34 + L * 4;
      var g2 = c.createLinearGradient(-7, 0, 7, 0); g2.addColorStop(0, "#0a0814"); g2.addColorStop(0.5, "#2a1f45"); g2.addColorStop(1, "#0a0814");
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.lineTo(4, -oh); c.lineTo(0, -oh - 6); c.lineTo(-4, -oh); c.closePath(); outline(g2, "#463a6e", 1);
      c.save(); c.shadowColor = "#e879f9"; c.shadowBlur = 6; c.fillStyle = "rgba(240,171,252," + (0.55 + Math.sin(t * 3) * 0.2) + ")";
      for (var r = 0; r < 3 + L; r++) c.fillRect(-1, -6 - r * 7, 2, 3);
      c.restore();
      c.restore();
      var ox = x, oy = y - 2 - (oh + 16 + L * 4) * grow + Math.sin(t * 2.2) * 1.5, rad = 4 + L * 0.8 + (p.fireT > 0 ? 1.5 : 0);
      var og = c.createRadialGradient(ox, oy, 0, ox, oy, rad * 3.2); og.addColorStop(0, "rgba(250,232,255,1)"); og.addColorStop(0.3, "rgba(232,121,249,0.85)"); og.addColorStop(1, "rgba(139,92,246,0)");
      c.fillStyle = og; c.beginPath(); c.arc(ox, oy, rad * 3.2, 0, TAU); c.fill();
      if (L >= 1) { c.strokeStyle = "rgba(240,171,252,0.6)"; c.lineWidth = 0.8; c.beginPath(); c.ellipse(ox, oy, 10, 3.5, Math.sin(t) * 0.3, 0, TAU); c.stroke(); }
      if (L >= 2) for (var m = 0; m < 3; m++) { var b = t * 2 + m * TAU / 3; c.fillStyle = "#fae8ff"; c.beginPath(); c.arc(ox + Math.cos(b) * 13, oy + Math.sin(b) * 4.5, 1.2, 0, TAU); c.fill(); }
      return;
    }
    // vanguard rift
    var ah = 24 + L * 3;
    c.fillStyle = "#14111f";
    c.beginPath(); c.moveTo(-14, 0); c.lineTo(-14, -ah + 6); c.quadraticCurveTo(0, -ah - 10, 14, -ah + 6); c.lineTo(14, 0); c.lineTo(9, 0); c.lineTo(9, -ah + 7);
    c.quadraticCurveTo(0, -ah - 3, -9, -ah + 7); c.lineTo(-9, 0); c.closePath(); outline("#1d1930", "#463e66", 1);
    var pg = c.createRadialGradient(0, -ah * 0.45, 0, 0, -ah * 0.45, 10); pg.addColorStop(0, "#000"); pg.addColorStop(0.55, "#1e1240"); pg.addColorStop(1, "rgba(139,92,246," + (0.7 + Math.sin(t * 3) * 0.15) + ")");
    c.beginPath(); c.moveTo(-9, 0); c.lineTo(-9, -ah + 7); c.quadraticCurveTo(0, -ah - 3, 9, -ah + 7); c.lineTo(9, 0); c.closePath(); c.fillStyle = pg; c.fill();
    c.save(); c.strokeStyle = "rgba(196,181,253,0.55)"; c.lineWidth = 0.8;
    for (var q = 0; q < 2; q++) { c.beginPath(); c.ellipse(0, -ah * 0.42, 5 + q * 2.5, 8 + q * 2, 0, t * (2 + q) % TAU, t * (2 + q) % TAU + 2.2); c.stroke(); }
    c.restore();
    if (L >= 1) { c.fillStyle = "#4c1d95"; [-12, 12].forEach(function (bx) { c.beginPath(); c.moveTo(bx - 1.5, -ah + 8); c.lineTo(bx + 1.5, -ah + 8); c.lineTo(bx + 1.5, -ah + 18); c.lineTo(bx, -ah + 15); c.lineTo(bx - 1.5, -ah + 18); c.fill(); }); }
    if (L >= 2) { c.save(); c.shadowColor = "#ffd166"; c.shadowBlur = 6; c.fillStyle = "#ffd166"; c.beginPath(); c.moveTo(-4, -ah - 1); c.lineTo(-2, -ah - 6); c.lineTo(0, -ah - 2); c.lineTo(2, -ah - 6); c.lineTo(4, -ah - 1); c.closePath(); c.fill(); c.restore(); }
    c.restore();
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function drawGate(t) {
    var x = GATE.x, y = GATE.y, f = G.gateFlare;
    c.save();
    var g = c.createRadialGradient(x, y, 0, x, y, 46 + f * 20); g.addColorStop(0, "rgba(191,219,254," + (0.5 + f * 0.4) + ")"); g.addColorStop(0.35, "rgba(59,130,246,0.35)"); g.addColorStop(1, "rgba(30,64,175,0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 46 + f * 20, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(x, y, 30, 13, 0, 0, TAU);
    var g2 = c.createRadialGradient(x, y, 0, x, y, 30); g2.addColorStop(0, "#eff6ff"); g2.addColorStop(0.3, "#93c5fd"); g2.addColorStop(0.7, "#2563eb"); g2.addColorStop(1, "#1e3a8a");
    c.fillStyle = g2; c.fill();
    c.strokeStyle = "rgba(219,234,254,0.85)"; c.lineWidth = 1.2;
    for (var i = 0; i < 3; i++) { var a = t * (1.4 + i * 0.5) + i * 2; c.beginPath(); c.ellipse(x, y, 24 - i * 6, 10 - i * 2.4, 0, a, a + 2.4); c.stroke(); }
    c.restore();
  }
  function drawSeal(t) {
    var x = SEAL.x, y = SEAL.y, f = G.sealFlash;
    c.save();
    var col = f > 0 ? "255,77,94" : "143,94,248";
    var g = c.createRadialGradient(x, y - 6, 0, x, y - 6, 54); g.addColorStop(0, "rgba(" + col + "," + (0.35 + f * 0.4) + ")"); g.addColorStop(1, "rgba(" + col + ",0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y - 6, 54, 0, TAU); c.fill();
    c.fillStyle = "#16131f"; c.strokeStyle = "#3c3752"; c.lineWidth = 1.2;
    [[-34, 0], [34, 0]].forEach(function (q) { c.beginPath(); c.rect(x + q[0] - 6, y - 26, 12, 30); c.fill(); c.stroke(); });
    c.beginPath(); c.moveTo(x - 40, y - 24); c.quadraticCurveTo(x, y - 46, x + 40, y - 24); c.lineTo(x + 40, y - 18); c.quadraticCurveTo(x, y - 38, x - 40, y - 18); c.closePath(); c.fill(); c.stroke();
    c.save(); c.shadowColor = "rgb(" + col + ")"; c.shadowBlur = 10; c.strokeStyle = "rgba(" + col + ",0.9)"; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(x, y - 4, 22, 8, 0, 0, TAU); c.stroke();
    c.setLineDash([2, 3]); c.lineDashOffset = t * 8; c.beginPath(); c.ellipse(x, y - 4, 16, 5.6, 0, 0, TAU); c.stroke(); c.setLineDash([]);
    c.restore();
    c.restore();
  }

  function drawParts(layerAdd) {
    var ps = G.parts;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i]; if (p.delay > 0) continue;
      var k = p.life / p.life0;
      if (p.t === "smoke") {
        if (!layerAdd) continue;
        var a = Math.min(1, k * 1.6) * 0.32 * (p.g || 1);
        var g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, p.c + a + ")"); g.addColorStop(1, p.c + "0)"); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
      } else if (p.t === "spark") {
        if (!layerAdd) continue;
        c.strokeStyle = p.c; c.globalAlpha = k; c.lineWidth = p.w; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke(); c.globalAlpha = 1;
      } else if (p.t === "mote") {
        if (!layerAdd) continue;
        c.fillStyle = "rgba(" + p.c + "," + (Math.sin(k * Math.PI) * 0.7) + ")"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
      } else if (p.t === "ring") {
        if (!layerAdd) continue;
        var r = lerp(p.r1, p.r0, k); c.strokeStyle = p.c + (k * 0.9) + ")"; c.lineWidth = p.w * k + 0.3; c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.42, 0, 0, TAU); c.stroke();
      } else if (p.t === "slash") {
        if (!layerAdd) continue;
        c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.strokeStyle = p.c + k + ")"; c.lineWidth = 2 * k + 0.5; c.lineCap = "round";
        c.beginPath(); c.arc(-p.r * 0.4, 0, p.r, -1.1 + (1 - k) * 0.6, 1.1 - (1 - k) * 0.2); c.stroke(); c.restore();
      } else if (p.t === "ghost") {
        if (layerAdd) continue;
        c.save(); c.globalAlpha = k * 0.45; c.translate(p.x, p.y); c.scale(1.18 * p.face, 1.18);
        c.fillStyle = "#7dd3fc"; c.beginPath(); c.moveTo(-4, -2); c.lineTo(4.5, -3); c.lineTo(3.4, -12.5); c.lineTo(-3.4, -12.5); c.closePath(); c.fill();
        c.beginPath(); c.arc(0.6, -15.5, 3.1, 0, TAU); c.fill(); c.restore();
      } else if (p.t === "streak") {
        if (!layerAdd) continue;
        c.save(); c.lineCap = "round"; c.shadowColor = "#7dd3fc"; c.shadowBlur = 12;
        c.strokeStyle = "rgba(186,230,253," + k + ")"; c.lineWidth = 5 * k; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x2, p.y2); c.stroke();
        c.strokeStyle = "rgba(255,255,255," + k + ")"; c.lineWidth = 1.5 * k; c.stroke(); c.restore();
      } else if (p.t === "pillar") {
        if (!layerAdd) continue;
        var hh = 70 * Math.sin(Math.min(1, (1 - k) * 2.2) * Math.PI * 0.5), w = 7 * k + 2;
        var pg = c.createLinearGradient(p.x, p.y - hh, p.x, p.y);
        pg.addColorStop(0, "rgba(167,139,250,0)"); pg.addColorStop(0.5, "rgba(167,139,250," + 0.55 * k + ")"); pg.addColorStop(1, "rgba(237,233,254," + 0.9 * k + ")");
        c.fillStyle = pg; c.fillRect(p.x - w / 2, p.y - hh, w, hh);
        c.strokeStyle = "rgba(196,181,253," + k + ")"; c.lineWidth = 1.4; c.beginPath(); c.ellipse(p.x, p.y, 12 * (1.4 - k), 5 * (1.4 - k), 0, 0, TAU); c.stroke();
      }
    }
  }

  function bar(x, y, w, k, col) {
    c.fillStyle = "rgba(0,0,0,0.65)"; c.fillRect(x - w / 2 - 0.5, y - 0.5, w + 1, 3);
    c.fillStyle = col; c.fillRect(x - w / 2, y, w * clamp(k, 0, 1), 2);
  }

  function render() {
    var t = G.t, rt = performance.now() / 1000;
    c.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (G.shake > 0) c.translate(rnd(-1, 1) * G.shake * 0.5, rnd(-1, 1) * G.shake * 0.5);
    c.drawImage(terrain, 0, 0, W, H);

    // soft light pools under posts
    c.save(); c.globalCompositeOperation = "lighter";
    SPOTS.forEach(function (s) { if (!s.post) return; var g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 46 + s.post.lvl * 8); g.addColorStop(0, "rgba(124,58,237," + (0.12 + s.post.lvl * 0.04) + ")"); g.addColorStop(1, "rgba(124,58,237,0)"); c.fillStyle = g; c.beginPath(); c.arc(s.x, s.y, 54 + s.post.lvl * 8, 0, TAU); c.fill(); });
    c.restore();

    drawGate(rt);
    drawSeal(rt);

    // corpses (ARISE targets)
    G.corpses.forEach(function (cp) {
      var k = Math.min(1, cp.t / 2), pulse = 0.5 + Math.sin(rt * 4 + cp.ph) * 0.25;
      c.save(); c.globalAlpha = k;
      c.fillStyle = "rgba(10,8,20,0.75)"; c.beginPath(); c.ellipse(cp.x, cp.y, 8, 3.2, 0, 0, TAU); c.fill();
      c.strokeStyle = "rgba(167,139,250," + (pulse * (G.cdArise > 0 ? 0.35 : 0.9)) + ")"; c.lineWidth = 0.9; c.beginPath(); c.ellipse(cp.x, cp.y, 9, 3.6, 0, 0, TAU); c.stroke();
      c.restore();
    });

    // range ring for a selected post
    if (G.sel && G.sel.post && G.sel.post.type !== "vanguard") {
      var sp = G.sel.post, R = rangeOf(sp);
      c.save(); c.fillStyle = "rgba(143,94,248,0.08)"; c.strokeStyle = "rgba(196,181,253,0.55)"; c.lineWidth = 1; c.setLineDash([4, 4]);
      c.beginPath(); c.arc(sp.x, sp.y - 10, R, 0, TAU); c.fill(); c.stroke(); c.restore();
    } else if (G.sel && G.sel.post) {
      var vp = G.sel.post; c.save(); c.strokeStyle = "rgba(196,181,253,0.55)"; c.setLineDash([4, 4]); c.beginPath(); c.ellipse(vp.rx, vp.ry, rangeOf(vp), rangeOf(vp) * 0.6, 0, 0, TAU); c.stroke(); c.restore();
    }

    // y-sorted world
    var list = [];
    SPOTS.forEach(function (s) { list.push({ y: s.y + 4, f: function () { s.post ? drawPost(s.post, rt) : drawSpot(s, rt); } }); });
    G.enemies.forEach(function (e) { if (!e.fly) list.push({ y: e.y, f: function () { drawEnemy(e, rt); } }); });
    G.allies.forEach(function (a) { if (a.dead || a.fly) return; list.push({ y: a.y, f: function () { drawAlly(a, rt); } }); });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.f(); });

    c.save(); c.globalCompositeOperation = "lighter"; drawParts(true); c.restore();
    drawParts(false);

    // fliers above everything on the ground
    G.enemies.forEach(function (e) { if (e.fly) drawEnemy(e, rt); });
    G.allies.forEach(function (a) { if (!a.dead && a.fly) drawAlly(a, rt); });

    // projectiles
    G.shots.forEach(function (s) {
      if (s.k === "arrow" || s.k === "dagger") {
        c.save(); c.translate(s.x, s.y); c.rotate(s.ang || 0);
        c.strokeStyle = s.k === "dagger" ? "#fed7aa" : "#e0e7ff"; c.lineWidth = 1.2; c.shadowColor = s.k === "dagger" ? "#ff9a3c" : "#a78bfa"; c.shadowBlur = 6;
        c.beginPath(); c.moveTo(-7, 0); c.lineTo(2, 0); c.stroke(); c.fillStyle = c.strokeStyle; c.beginPath(); c.moveTo(3.5, 0); c.lineTo(0, -1.6); c.lineTo(0, 1.6); c.fill(); c.restore();
      } else {
        var og = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8); og.addColorStop(0, "#fff"); og.addColorStop(0.35, "rgba(232,121,249,0.9)"); og.addColorStop(1, "rgba(139,92,246,0)");
        c.fillStyle = og; c.beginPath(); c.arc(s.x, s.y, 8, 0, TAU); c.fill();
      }
    });

    // floating text
    c.save(); c.textAlign = "center";
    G.floats.forEach(function (f) { c.globalAlpha = Math.min(1, f.life / f.life0 * 2); c.font = "700 " + f.size + "px Orbitron, sans-serif"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.7)"; c.strokeText(f.txt, f.x, f.y); c.fillStyle = f.c; c.fillText(f.txt, f.x, f.y); });
    c.restore();

    // vignette + ARISE tint
    var vg = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.72); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(2,2,10,0.55)");
    c.fillStyle = vg; c.fillRect(-20, -20, W + 40, H + 40);
    if (G.ariseFx) { c.fillStyle = "rgba(76,29,149," + (G.ariseFx / 1.2 * 0.28) + ")"; c.fillRect(-20, -20, W + 40, H + 40); }
    if (G.sealFlash) { var rg = c.createLinearGradient(0, H, 0, H - 160); rg.addColorStop(0, "rgba(255,40,60," + G.sealFlash * 0.25 + ")"); rg.addColorStop(1, "rgba(255,40,60,0)"); c.fillStyle = rg; c.fillRect(0, H - 160, W, 160); }

    // next wave countdown at the gate
    if (G.nextIn !== null && G.state === "play") {
      c.save(); c.textAlign = "center"; c.font = "700 10px Orbitron, sans-serif"; c.fillStyle = "rgba(219,234,254,0.9)"; c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 3;
      var txt = "NEXT WAVE " + Math.ceil(G.nextIn); c.strokeText(txt, GATE.x, GATE.y + 36); c.fillText(txt, GATE.x, GATE.y + 36); c.restore();
    }

    // banners
    G.banners.forEach(function (b) {
      var k = b.life / b.life0, a = Math.min(1, (1 - k) * 6, k * 3), s = 1 + (1 - Math.min(1, (1 - k) * 5)) * 0.25;
      c.save(); c.globalAlpha = a; c.translate(W / 2, H * 0.4); c.scale(s, s); c.textAlign = "center";
      var big = b.txt === "ARISE";
      c.font = "900 " + (big ? 46 : 28) + "px Orbitron, sans-serif"; c.shadowColor = b.c; c.shadowBlur = big ? 24 : 14; c.fillStyle = "#fff";
      c.fillText(b.txt, 0, 0); c.shadowBlur = 0;
      if (b.sub) { c.font = "600 15px Rajdhani, sans-serif"; c.fillStyle = b.c; c.fillText(b.sub, 0, 22); }
      c.restore();
    });
  }
  function drawEnemy(e, t) {
    var fade = Math.min(1, e.born * 3);
    c.save(); c.globalAlpha = fade;
    var sc = e.d.boss ? 1 : 1.25;
    drawMonster(e.type, e.x, e.y, t, e.face, e.flash, null, e.swing, e.walk, sc);
    c.restore();
    if (e.hp < e.max) bar(e.x, e.y - (e.d.boss ? 72 : e.fly ? 34 : e.d.r * 2.3 + 6), e.d.boss ? 40 : 16, e.hp / e.max, e.d.boss ? "#ff6b6b" : "#ef4444");
    if (e.d.arm >= 0.5 && !e.d.boss) { c.fillStyle = "rgba(203,213,225,0.8)"; c.font = "700 7px sans-serif"; c.fillText("◆", e.x + 9, e.y - e.d.r * 2.3 - 4); }
  }
  function drawAlly(a, t) {
    if (a.kind === "hunter") {
      drawHunter(a, t);
      bar(a.x, a.y + 5, 18, a.hp / a.max, "#7dd3fc");
      return;
    }
    if (a.kind === "knight") {
      drawShadow(a.cls, a.x, a.y, t, a.face, a.swing, a.walk, a.post.lvl, a.flash, null, 1.1);
      if (a.hp < a.max) bar(a.x, a.y - 26, 12, a.hp / a.max, "#a78bfa");
      return;
    }
    // risen enemy: same body, shadow palette, rising out of the ground
    var k = a.rise ? 1 - a.rise / 0.6 : 1, fadeOut = Math.min(1, a.life / 2);
    c.save(); c.globalAlpha = fadeOut;
    if (k < 1) { c.beginPath(); c.rect(a.x - 40, a.y - 80, 80, 80); c.clip(); c.translate(0, (1 - k) * 26); }
    var auraG = c.createRadialGradient(a.x, a.y - 10, 0, a.x, a.y - 10, 18); auraG.addColorStop(0, "rgba(139,92,246,0.3)"); auraG.addColorStop(1, "rgba(139,92,246,0)");
    c.fillStyle = auraG; c.beginPath(); c.arc(a.x, a.y - 10, 18, 0, TAU); c.fill();
    drawMonster(a.etype, a.x, a.y + (a.fly ? 10 : 0), t, a.face, a.flash, RISEN, a.swing ? a.swing * 0.25 / 0.22 : 0, a.walk, 1.25);
    c.restore();
    bar(a.x, a.y - (a.fly ? 32 : 30), 14, a.life / a.life0, "#c4b5fd");
  }

  /* ------------------------------------------------------------------ input + build menu */
  function toWorld(ev) { var r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }; }
  cv.addEventListener("pointerdown", function (ev) {
    ev.preventDefault();
    if (!G || G.paused || (G.state !== "play" && G.state !== "ready")) return;
    var p = toWorld(ev);
    if (G.armed === "rush") { doRush(p.x, p.y); syncButtons(); return; }
    var spot = null;
    SPOTS.forEach(function (s) { if (dist(p.x, p.y, s.x, s.y - 8) < 26) spot = s; });
    if (spot) { if (G.sel === spot) closeMenu(); else openMenu(spot); return; }
    if (G.sel) { closeMenu(); return; }
    var h = G.hunter;
    if (h.dead) return;
    var tx = clamp(p.x, 8, W - 8), ty = clamp(p.y, 30, H - 30);
    releaseAlly(h); h.tx = tx; h.ty = ty; h.moving = true;
    ring(tx, ty, "rgba(125,211,252,", 3, 14, 0.4, 1.5);
  });

  var ICON = {
    vanguard: '<svg viewBox="0 0 24 24"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>',
    ranger: '<svg viewBox="0 0 24 24"><path d="M6 3c7 2 13 8 15 15M6 3l15 15M3 21l9-9M3 21h4M3 21v-4"/></svg>',
    arcane: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="5"/><path d="M8 21h8M10 14l-1 7M14 14l1 7M12 2v1"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6M6 20l6-6 6 6"/></svg>',
    sell: '<svg viewBox="0 0 24 24"><path d="M12 3 7 12l5 9 5-9z"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>',
    loop: '<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    mana: '<svg viewBox="0 0 24 24"><path d="M12 2 6 12l6 10 6-10z"/><path d="M6 12h12"/></svg>',
    dagger: '<svg viewBox="0 0 24 24"><path d="M4 20 15 9M15 9l2-5 3 3-5 2M9 20l2-2M4 15l2 2"/></svg>',
    arise: '<svg viewBox="0 0 24 24"><path d="M12 21V8M12 8l-4 4M12 8l4 4M5 21h14M7 4c1.5 1 3 1.5 5 1.5S15.5 5 17 4"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    bow: '<svg viewBox="0 0 24 24"><path d="M6 3c7 2 13 8 15 15M6 3l15 15M3 21l9-9"/></svg>',
    orb: '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="6"/><path d="M9 21h6"/></svg>'
  };
  function openMenu(spot) {
    G.sel = spot; var m = $("menu"); m.innerHTML = "";
    var sx = spot.x * scale, sy = (spot.y - 10) * scale, R = 58 * Math.max(0.85, scale), below = spot.y < 140;
    var opts = [];
    if (!spot.post) {
      ["vanguard", "ranger", "arcane"].forEach(function (k, i) {
        var a = (below ? [150, 90, 30] : [-150, -90, -30])[i] * Math.PI / 180, cost = PT[k].cost[0], used = builtOf(k), cap = capFor(k);
        var off = G.mana < cost || used >= cap;
        opts.push({ x: sx + Math.cos(a) * R, y: sy + Math.sin(a) * R, html: ICON[k] + '<span class="cost">' + cost + '</span><span class="cap">' + used + "/" + cap + "</span>", off: off,
          tip: { t: PT[k].name, d: PT[k].desc, x: used >= cap ? "Army cap: raise more " + (k === "vanguard" ? "Knights, Bulwarks, Lancers or Berserkers" : k === "ranger" ? "Archers or Assassins" : "Mages or Healers") : "" },
          go: function () { build(spot, k); closeMenu(); } });
      });
    } else {
      var p = spot.post;
      if (p.lvl < 2) {
        var uc = PT[p.type].cost[p.lvl + 1];
        opts.push({ x: sx, y: sy + (below ? 1 : -1) * R, html: ICON.up + '<span class="cost">' + uc + "</span>", off: G.mana < uc,
          tip: { t: PT[p.type].name + " · Lv " + (p.lvl + 2), d: upgradeText(p), x: "" }, go: function () { upgrade(p); openMenu(spot); } });
      }
      var back = Math.round(p.invest * 0.6);
      opts.push({ x: sx, y: sy + (below ? -1 : 1) * R * 0.72 + (below ? -6 : 18), html: ICON.sell + '<span class="cost">+' + back + "</span>", cls: "sell",
        tip: { t: "Release", d: "Dismiss this post and recover 60% of its mana.", x: "" }, go: function () { sell(p); closeMenu(); } });
    }
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.className = "opt" + (o.off ? " off" : "") + (o.cls ? " " + o.cls : "");
      b.style.left = clamp(o.x, 28, W * scale - 28) + "px"; b.style.top = clamp(o.y, 30, H * scale - 30) + "px"; b.innerHTML = o.html;
      b.addEventListener("pointerdown", function (ev) {
        ev.stopPropagation(); ev.preventDefault();
        if (b.classList.contains("sel")) { if (!o.off) o.go(); return; }
        m.querySelectorAll(".opt").forEach(function (x) { x.classList.remove("sel"); }); var old = m.querySelector(".tip"); if (old) old.remove();
        b.classList.add("sel");
        var tp = document.createElement("div"); tp.className = "tip";
        tp.innerHTML = "<b>" + o.tip.t + "</b><p>" + o.tip.d + "</p>" + (o.tip.x ? "<i>" + o.tip.x + "</i>" : o.off ? "<i>Not enough mana</i>" : "<i>Tap again to confirm</i>");
        var ty = below ? Math.min(o.y + 36, H * scale - 90) : Math.max(o.y - 100, 4);
        tp.style.left = clamp(o.x, 100, W * scale - 100) + "px"; tp.style.top = ty + "px"; m.appendChild(tp);
      });
      m.appendChild(b);
    });
  }
  function upgradeText(p) {
    var n = p.lvl + 1;
    if (p.type === "vanguard") return "Knights: " + PT.vanguard.n[n] + " · HP " + PT.vanguard.hp[n] + " · Dmg " + PT.vanguard.dmg[n] + (n === 2 ? " · gilded rift" : "");
    if (p.type === "ranger") return "Damage " + PT.ranger.dmg[n] + " · faster · longer range" + (n === 2 ? " · shard crown" : "");
    return "Damage " + PT.arcane.dmg[n] + " · longer range" + (n === 2 ? " · splash damage" : "");
  }
  function closeMenu() { if (G) G.sel = null; $("menu").innerHTML = ""; }
  function setHint(s) { var h = $("hint"); h.textContent = s; h.classList.toggle("on", !!s); }

  /* ------------------------------------------------------------------ HUD */
  var lastHud = {};
  function flash(id, cls) { var e = $(id); e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }
  function hud(force) {
    var v = { l: G.lives, m: Math.floor(G.mana), w: G.wave, f: G.floor };
    if (force || v.l !== lastHud.l) $("hLives").querySelector("b").textContent = v.l;
    if (force || v.m !== lastHud.m) $("hMana").querySelector("b").textContent = v.m;
    if (force || v.w !== lastHud.w) $("hWave").querySelector("b").textContent = v.w + "/" + WAVES.length;
    if (force || v.f !== lastHud.f) $("hFloor").querySelector("b").textContent = v.f;
    lastHud = v;
  }
  function cdFill(btn, k) { btn.querySelector(".cdf").style.height = (k * 100) + "%"; }
  function syncButtons() {
    var rush = $("bRush"), ar = $("bArise"), call = $("bCall"), sp = $("bSpeed");
    var h = G.hunter, rk = h.dead ? 1 : G.cdRush / rushCd();
    cdFill(rush, rk); rush.classList.toggle("arm", G.armed === "rush"); rush.classList.toggle("ready", rk === 0 && !G.armed);
    var ak = G.cdArise / ariseCd(); cdFill(ar, ak);
    $("corpseN").textContent = G.corpses.length;
    ar.classList.toggle("ready", ak === 0 && G.corpses.length > 0 && G.state === "play");
    var lbl = call.querySelector("span");
    if (G.state === "ready") { lbl.textContent = "Start"; call.classList.add("pulse"); call.classList.remove("dim"); }
    else if (G.state === "play" && G.nextIn !== null && G.wave < WAVES.length) { lbl.textContent = "+" + Math.ceil(G.nextIn * 1.5); call.classList.add("pulse"); call.classList.remove("dim"); }
    else { lbl.textContent = G.wave >= WAVES.length ? "Boss" : "Wave"; call.classList.remove("pulse"); call.classList.add("dim"); }
    sp.querySelector("span").textContent = G.speed + "×";
  }
  $("bRush").addEventListener("click", function () {
    if (G.state !== "play" && G.state !== "ready") return;
    if (G.armed === "rush") { G.armed = null; setHint(""); }
    else if (!G.hunter.dead && G.cdRush <= 0) { closeMenu(); G.armed = "rush"; setHint("Tap where the Hunter strikes"); }
    syncButtons();
  });
  $("bArise").addEventListener("click", function () { doArise(); syncButtons(); });
  $("bSpeed").addEventListener("click", function () { G.speed = G.speed === 1 ? 2 : 1; syncButtons(); });
  $("bCall").addEventListener("click", function () { closeMenu(); callWave(); syncButtons(); });
  $("bPause").addEventListener("click", function () { if (G.state === "play" || G.state === "ready") showPause(); });

  /* ------------------------------------------------------------------ overlays */
  var OV = $("overlay"), ovLoop = null;
  function overlay(html) { OV.innerHTML = html; OV.classList.remove("hide"); if (G) G.paused = true; }
  function hideOverlay() { OV.classList.add("hide"); OV.innerHTML = ""; if (ovLoop) { cancelAnimationFrame(ovLoop); ovLoop = null; } if (G) G.paused = false; }
  function armyHtml() {
    return '<div class="army"><div><b>' + capFor("vanguard") + '</b>Vanguard</div><div><b>' + capFor("ranger") + '</b>Ranger</div><div><b>' + capFor("arcane") + "</b>Arcane</div></div>" +
      '<p style="font-size:13px;margin-top:8px">' + (SAVE.ignoreCaps ? "Army caps are off for testing." : ARMY.real ? "Post caps come from your army: " + ARMY.total + " shadow" + (ARMY.total === 1 ? "" : "s") + " raised in the System." : "No army found on this device, so you're using a test army.") + "</p>";
  }
  function showIntro() {
    var resume = SAVE.run && SAVE.run.floor > 1;
    overlay('<div class="card"><div class="k">Shadow Gates · test build</div><h2>' + (resume ? "Floor " + SAVE.run.floor : "The Gate Opens") + "</h2>" +
      "<p>Build posts on the glowing runes. Tap the road to move your Hunter. When monsters fall, <b style=\"color:#c4b5fd\">ARISE</b> turns them into your shadows for a while.</p>" +
      armyHtml() +
      '<div class="row">' + (resume ? '<button class="btn ghost" id="oNew">New climb</button>' : "") + '<button class="btn" id="oGo">' + (resume ? "Resume climb" : "Enter the gate") + "</button></div>" +
      (SAVE.best ? '<p style="font-size:12px;margin-top:10px;color:#7673b8">Best: floor ' + SAVE.best + "</p>" : "") + "</div>");
    $("oGo").onclick = function () { hideOverlay(); startFloor(resume ? SAVE.run : newRun()); };
    if (resume) $("oNew").onclick = function () { hideOverlay(); startFloor(newRun()); };
  }
  function showPause() {
    closeMenu(); G.armed = null; setHint("");
    overlay('<div class="card"><div class="k">Paused</div><h2>Floor ' + G.floor + "</h2><p>Wave " + G.wave + " of " + WAVES.length + " · " + G.lives + " gate integrity</p>" + armyHtml() +
      '<div class="toggle"><span><b>Ignore army caps</b><br>Build anything while testing</span><button class="sw' + (SAVE.ignoreCaps ? " on" : "") + '" id="oCaps" aria-label="Ignore army caps"></button></div>' +
      '<div class="row"><button class="btn ghost" id="oRestart">Restart floor</button><button class="btn" id="oResume">Resume</button></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn ghost" id="oAbandon">Abandon climb</button></div></div>');
    $("oResume").onclick = hideOverlay;
    $("oCaps").onclick = function () { SAVE.ignoreCaps = !SAVE.ignoreCaps; persist(); showPause(); };
    $("oRestart").onclick = function () { hideOverlay(); startFloor({ floor: G.run.floor, lives: SAVE.run.lives, boons: G.run.boons, extracted: G.run.extracted }); };
    $("oAbandon").onclick = function () { SAVE.run = null; persist(); hideOverlay(); showIntro(); };
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
    G.run.extracted.push(sh); SAVE.log.unshift(sh); SAVE.log = SAVE.log.slice(0, 40);
    SAVE.best = Math.max(SAVE.best, f); persist();
    overlay('<div class="card"><div class="k">Floor ' + f + " cleared · extraction</div><h2>ARISE</h2>" +
      '<canvas id="oFig" width="320" height="300" style="width:160px;height:150px"></canvas>' +
      '<div class="tier" style="color:' + T.color + '">' + T.name.toUpperCase() + " · " + cls.toUpperCase() + "</div>" +
      "<p>" + G.bossName + "'s shadow kneels.</p>" +
      '<p style="font-size:12px;color:#7673b8">Test build: kept in the climb log, not added to your System army yet.</p>' +
      '<div class="row"><button class="btn" id="oNext">Choose a boon</button></div></div>');
    var oc = $("oFig").getContext("2d"), t0 = performance.now(); var wisps = [];
    (function loop() {
      var tt = (performance.now() - t0) / 1000, k = Math.min(1, tt / 1.1);
      var keep = c; c = oc;
      oc.setTransform(2, 0, 0, 2, 0, 0); oc.clearRect(0, 0, 160, 150);
      var g = oc.createRadialGradient(80, 110, 0, 80, 110, 70); g.addColorStop(0, "rgba(139,92,246," + 0.35 * k + ")"); g.addColorStop(1, "rgba(139,92,246,0)");
      oc.fillStyle = g; oc.fillRect(0, 0, 160, 150);
      if (Math.random() < 0.7) wisps.push({ x: 80 + rnd(-16, 16), y: 126 - rnd(0, 50) * k, vy: -rnd(14, 30), vx: rnd(-4, 4), r: rnd(4, 9), l: 1 });
      oc.save(); oc.globalCompositeOperation = "lighter";
      wisps.forEach(function (w) { w.l -= 0.016; w.y += w.vy * 0.016; w.x += w.vx * 0.016; w.r += 0.12; var gg = oc.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r); gg.addColorStop(0, "rgba(139,92,246," + 0.22 * w.l * k + ")"); gg.addColorStop(1, "rgba(139,92,246,0)"); oc.fillStyle = gg; oc.beginPath(); oc.arc(w.x, w.y, w.r, 0, TAU); oc.fill(); });
      wisps = wisps.filter(function (w) { return w.l > 0; });
      oc.restore();
      oc.save(); oc.beginPath(); oc.rect(0, 0, 160, 128); oc.clip();
      drawShadow(cls, 80, 128 + (1 - easeOut(k)) * 80, tt, 1, (tt % 2.4) > 2.1 ? 0.22 - ((tt % 2.4) - 2.1) * 0.7 : 0, 0, Math.min(2, tier), 0, T.color, 4.2);
      oc.restore();
      oc.strokeStyle = "rgba(196,181,253," + 0.6 * k + ")"; oc.lineWidth = 1; oc.beginPath(); oc.ellipse(80, 128, 34, 8, 0, 0, TAU); oc.stroke();
      c = keep;
      ovLoop = requestAnimationFrame(loop);
    })();
    $("oNext").onclick = showBoons;
  }
  function showBoons() {
    if (ovLoop) { cancelAnimationFrame(ovLoop); ovLoop = null; }
    var pool = BOONS.slice(), picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    overlay('<div class="card"><div class="k">Floor ' + (G.floor + 1) + " awaits</div><h2>Choose a Boon</h2><p>It lasts for the rest of this climb.</p>" +
      '<div class="boons">' + picks.map(function (b, i) {
        var have = G.boons[b.id] || 0;
        return '<button class="boon" data-i="' + i + '"><span class="gl">' + ICON[b.ic] + "</span><span><b>" + b.name + "</b><small>" + b.desc + "</small>" + (have ? "<em>Owned ×" + have + "</em>" : "") + "</span></button>";
      }).join("") + "</div></div>");
    OV.querySelectorAll(".boon").forEach(function (el) {
      el.onclick = function () {
        var b = picks[+el.getAttribute("data-i")], run = G.run;
        run.boons[b.id] = (run.boons[b.id] || 0) + 1;
        run.lives = Math.min(20 + 6 * (run.boons.wall || 0), G.lives + 4 + (b.id === "wall" ? 6 : 0));
        run.floor = G.floor + 1;
        hideOverlay(); startFloor(run);
      };
    });
  }
  function showDefeat() {
    SAVE.best = Math.max(SAVE.best, G.floor - 1); var got = G.run.extracted.length; SAVE.run = null; persist();
    overlay('<div class="card"><div class="k">The gate broke</div><h2>Floor ' + G.floor + "</h2><p>Fell on wave " + G.wave + " of " + WAVES.length + ".</p>" +
      "<p>" + (got ? got + " shadow" + (got > 1 ? "s" : "") + " extracted this climb." : "No extractions this climb.") + "</p>" +
      '<p style="font-size:13px;color:#7673b8">Best: floor ' + SAVE.best + "</p>" +
      '<div class="row"><button class="btn" id="oAgain">Climb again</button></div></div>');
    $("oAgain").onclick = function () { hideOverlay(); startFloor(newRun()); };
  }

  /* ------------------------------------------------------------------ loop */
  var last = performance.now(), hudT = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G && !G.paused) {
      for (var i = 0; i < G.speed; i++) update(dt);
      hudT -= dt; if (hudT <= 0) { hudT = 0.1; hud(); syncButtons(); }
    }
    if (G) render();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () { if (document.hidden && G && (G.state === "play") && !G.paused) showPause(); });
  buildTerrain();
  startFloor(SAVE.run || newRun());
  G.paused = true;
  resize();
  showIntro();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (G && G.sel) openMenu(G.sel); });

  /* test hooks for automated play */
  window.__td = { get G() { return G; }, SPOTS: SPOTS, build: build, upgrade: upgrade, callWave: callWave, doArise: doArise, doRush: doRush, update: update, hide: hideOverlay, startFloor: startFloor, newRun: newRun };
})();
