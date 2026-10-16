/* ==========================================================
   DAILY BRIEFING (Claude build)
   A double-width preview box at the top of the tiles opens a
   story-style card player:
     1 Market     portfolio %, watchlist, the bot's read + the
                  SPY "call it" game (scored at the close)
     2 Catalyst   today's releases (actual vs expected + what it
                  means), the outlook, and the week ahead
     3 Trending   stocks / tech / world
     4 Fact or Fiction + Word of the Day (+ recall quiz on a
                  word from last week)
     5 Grok Bot   what it can help with + Sports Desk
     6 Wrap-up    today's focus, +5 EXP once a day
   Sources:
   • data/brief.json  — the Grok bot, 7 AM / 4:15 PM / 7 PM ET
                        (format in data/BRIEF_FORMAT.md)
   • data/market.json — delayed quotes from the GitHub job
   • data/econ.json   — verified Fed / CPI / jobs dates
   Everything bot-written is rendered as text, never HTML. The
   last good copy of each source is kept for offline opens.
   Also: the Sky row in the Weather module (sun + moon).
   ========================================================== */
(function () {
  "use strict";
  var REPO_RAW = "https://raw.githubusercontent.com/kkqT-24/system-app/main/claude/data/";
  var LAT = 38.2527, LON = -85.7585;
  var STORE = "systemApp.intel";
  var WRAP_EXP = 5;
  var box = document.getElementById("intelBox");

  /* ---------------- helpers ---------------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function str(v, max) { return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""; }
  function num(v) { return v == null || v === "" || !isFinite(+v) ? null : +v; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseDay(k) { var p = String(k).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortDate(d) { return DOW[d.getDay()] + " · " + MON[d.getMonth()] + " " + d.getDate(); }
  function clock(d) { var h = d.getHours(), m = d.getMinutes(); return ((h + 11) % 12 + 1) + ":" + pad(m) + (h < 12 ? " AM" : " PM"); }
  function clock24(t) { var p = String(t).split(":"); var h = +p[0], m = +p[1] || 0; if (!isFinite(h)) return ""; return ((h + 11) % 12 + 1) + ":" + pad(m) + (h < 12 ? " AM" : " PM"); }
  function dur(ms) { var m = Math.max(0, Math.round(ms / 60000)); var h = Math.floor(m / 60); m %= 60; return h ? h + "h " + pad(m) + "m" : m + "m"; }
  function pctTxt(p, dp) { return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(dp == null ? 2 : dp) + "%"; }
  function safeUrl(u) { return typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u) && u.length < 400 ? u : null; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  var C = {};
  try { C = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { C = {}; }
  ["calls", "days", "seen", "wrap", "ff", "recall"].forEach(function (k) { if (!C[k] || typeof C[k] !== "object") C[k] = {}; });
  if (!Array.isArray(C.words)) C.words = [];
  function save() { try { localStorage.setItem(STORE, JSON.stringify(C)); } catch (e) {} }

  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  /* raw GitHub copy first (live minutes after a commit), the site's copy second */
  function repoJSON(name) { return getJSON(REPO_RAW + name + "?t=" + Date.now()).catch(function () { return getJSON("data/" + name); }); }

  /* ---------------- market clock (New York time) ---------------- */
  var HOLIDAYS = { "2026-11-26": 1, "2026-12-25": 1, "2027-01-01": 1, "2027-01-18": 1, "2027-02-15": 1, "2027-03-26": 1,
    "2027-05-31": 1, "2027-06-18": 1, "2027-07-05": 1, "2027-09-06": 1, "2027-11-25": 1, "2027-12-24": 1 };
  var EARLY = { "2026-11-27": 1, "2026-12-24": 1, "2027-11-26": 1 };
  var NYF = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  function ny(d) {
    var o = {}; NYF.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return { key: o.year + "-" + o.month + "-" + o.day, min: (+o.hour % 24) * 60 + (+o.minute), dow: DOW.indexOf(o.weekday) };
  }
  function isSession(key) { var d = parseDay(key).getDay(); return d > 0 && d < 6 && !HOLIDAYS[key]; }
  function closeMin(key) { return EARLY[key] ? 780 : 960; }
  function addDays(key, n) { var d = parseDay(key); d.setDate(d.getDate() + n); return dayKey(d); }
  function nextSession(key) { for (var i = 1; i < 12; i++) { var k = addDays(key, i); if (isSession(k)) return k; } return addDays(key, 1); }
  /* the session a call made right now is for: today until the open,
     otherwise the next one */
  function callTarget(now) { var p = ny(now); return isSession(p.key) && p.min < 570 ? p.key : nextSession(p.key); }
  function marketLine(now) {
    var p = ny(now);
    if (isSession(p.key)) {
      if (p.min >= 570 && p.min < closeMin(p.key)) return { s: "open", t: "Market open · closes in " + dur((closeMin(p.key) - p.min) * 60000) };
      if (p.min < 570 && p.min >= 240) return { s: "pre", t: "Pre-market · opens in " + dur((570 - p.min) * 60000) };
      if (p.min < 570) return { s: "closed", t: "Market closed · opens 9:30 AM" };
    }
    var nx = nextSession(p.key), dd = Math.round((parseDay(nx) - parseDay(p.key)) / 864e5);
    return { s: "closed", t: (HOLIDAYS[p.key] ? "Holiday · " : "Market closed · ") + "opens " + (dd === 1 ? "tomorrow" : DOW[parseDay(nx).getDay()]) + " 9:30 AM" };
  }

  /* ---------------- sun + moon (SunCalc formulas) ---------------- */
  var rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545, ob = rad * 23.4397;
  function toDays(d) { return d.valueOf() / dayMs - 0.5 + J1970 - J2000; }
  function fromJ(j) { return new Date((j + 0.5 - J1970) * dayMs); }
  function decl(l, b) { return Math.asin(Math.sin(b) * Math.cos(ob) + Math.cos(b) * Math.sin(ob) * Math.sin(l)); }
  function rasc(l, b) { return Math.atan2(Math.sin(l) * Math.cos(ob) - Math.tan(b) * Math.sin(ob), Math.cos(l)); }
  function sMA(d) { return rad * (357.5291 + 0.98560028 * d); }
  function eclL(M) { return M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI; }
  function sunTimes(date) {
    var lw = rad * -LON, phi = rad * LAT, d = toDays(date), J0 = 0.0009;
    var n = Math.round(d - J0 - lw / (2 * Math.PI));
    var ds = J0 + lw / (2 * Math.PI) + n, M = sMA(ds), L = eclL(M), dec = decl(L, 0);
    var noon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    var w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    var a = J0 + (w + lw) / (2 * Math.PI) + n;
    var set = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    return { rise: fromJ(noon - (set - noon)), set: fromJ(set) };
  }
  function moon(date) {
    var d = toDays(date), M = sMA(d), L = eclL(M), sdec = decl(L, 0), sra = rasc(L, 0);
    var mL = rad * (218.316 + 13.176396 * d), mM = rad * (134.963 + 13.064993 * d), mF = rad * (93.272 + 13.229350 * d);
    var l = mL + rad * 6.289 * Math.sin(mM), b = rad * 5.128 * Math.sin(mF), dist = 385001 - 20905 * Math.cos(mM);
    var mdec = decl(l, b), mra = rasc(l, b), sd = 149598000;
    var phi = Math.acos(Math.sin(sdec) * Math.sin(mdec) + Math.cos(sdec) * Math.cos(mdec) * Math.cos(sra - mra));
    var inc = Math.atan2(sd * Math.sin(phi), dist - sd * Math.cos(phi));
    var ang = Math.atan2(Math.cos(sdec) * Math.sin(sra - mra), Math.sin(sdec) * Math.cos(mdec) - Math.cos(sdec) * Math.sin(mdec) * Math.cos(sra - mra));
    var frac = (1 + Math.cos(inc)) / 2, phase = 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI;
    var names = [[0.03, "New moon"], [0.22, "Waxing crescent"], [0.28, "First quarter"], [0.47, "Waxing gibbous"], [0.53, "Full moon"], [0.72, "Waning gibbous"], [0.78, "Last quarter"], [0.97, "Waning crescent"], [1.01, "New moon"]];
    var name = "New moon"; for (var i = 0; i < names.length; i++) if (phase < names[i][0]) { name = names[i][1]; break; }
    return { frac: frac, phase: phase, name: name };
  }
  function moonSVG(m) {
    var r = 15, f = m.frac, rx = Math.abs(1 - 2 * f) * r, waxing = m.phase < 0.5;
    var limb = waxing ? 1 : 0, term = f < 0.5 ? (waxing ? 0 : 1) : (waxing ? 1 : 0);
    var path = "M18 3 A" + r + " " + r + " 0 0 " + limb + " 18 33 A" + rx.toFixed(2) + " " + r + " 0 0 " + term + " 18 3Z";
    return '<svg class="sky-moon" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="dark"/>' + (f > 0.01 ? '<path d="' + path + '" class="lit"/>' : "") + "</svg>";
  }

  /* ---------------- built-in fallbacks (no brief yet) ---------------- */
  var FF = [
    ["Octopuses have three hearts.", true, "Two pump blood through the gills, one through the rest of the body."],
    ["Goldfish only have a three-second memory.", false, "Studies show goldfish can remember things for months."],
    ["A day on Venus is longer than its year.", true, "Venus spins so slowly that one rotation (243 Earth days) outlasts its orbit (225)."],
    ["The Great Wall of China is visible from the Moon with the naked eye.", false, "It's far too narrow; even from low orbit it's very hard to spot."],
    ["Honey found in ancient Egyptian tombs was still edible.", true, "Honey's low moisture and acidity keep bacteria from growing."],
    ["Bananas are berries, but strawberries aren't.", true, "Botanically, a berry comes from one flower with one ovary — bananas qualify, strawberries don't."],
    ["Bulls get angry at the color red.", false, "Bulls are red-green colorblind; it's the cape's movement that provokes them."],
    ["Sharks existed before trees.", true, "Sharks go back about 400+ million years; the first trees appeared around 385 million years ago."],
    ["Humans only use 10% of their brains.", false, "Brain scans show activity across virtually all regions over a day."],
    ["Wombat droppings are cube-shaped.", true, "The varying elasticity of their intestines shapes it into cubes."],
    ["Lightning never strikes the same place twice.", false, "The Empire State Building is hit roughly 20–25 times a year."],
    ["A bolt of lightning is hotter than the surface of the Sun.", true, "Lightning reaches about 30,000 K; the Sun's surface is about 5,800 K."],
    ["Napoleon was unusually short.", false, "He was about 5'7\", average for a Frenchman of his time; the myth came from unit confusion and propaganda."],
    ["The Eiffel Tower gets taller in summer.", true, "Iron expands in the heat, adding up to about 15 cm."],
    ["Bats are blind.", false, "All bats can see, and many species see quite well; echolocation is an extra sense."],
    ["The first computer 'bug' was an actual insect.", true, "In 1947 a moth was found stuck in a relay of Harvard's Mark II computer."],
    ["Chameleons change color mainly to blend in.", false, "They mostly change color to signal mood and regulate temperature."],
    ["There are more possible chess games than atoms in the observable universe.", true, "Estimates of possible games (around 10^120) dwarf the ~10^80 atoms."]
  ];
  var WORDS = [
    ["Sanguine", "adjective", "Optimistic, especially in a bad or difficult situation.", "Despite the red open, he stayed sanguine about the week."],
    ["Laconic", "adjective", "Using very few words.", "His laconic reply was just 'Sold.'"],
    ["Ephemeral", "adjective", "Lasting a very short time.", "The pre-market spike was ephemeral."],
    ["Pragmatic", "adjective", "Dealing with things sensibly and realistically.", "A pragmatic trader cuts losers fast."],
    ["Obfuscate", "verb", "To make something unclear or hard to understand.", "The press release obfuscated the real numbers."],
    ["Prescient", "adjective", "Having knowledge of events before they happen.", "Her call on rates turned out to be prescient."],
    ["Equanimity", "noun", "Mental calmness, especially in a difficult situation.", "He watched the drawdown with equanimity."],
    ["Tenacious", "adjective", "Holding firmly to something; persistent.", "A tenacious habit is how streaks get built."],
    ["Juxtapose", "verb", "To place side by side for contrast.", "Juxtapose the backtest with the live results."],
    ["Ubiquitous", "adjective", "Present or found everywhere.", "AI tools are becoming ubiquitous."],
    ["Candor", "noun", "The quality of being open and honest.", "He appreciated the bot's candor about the bad trade."],
    ["Alacrity", "noun", "Brisk and cheerful readiness.", "He took on the workout with alacrity."],
    ["Myopic", "adjective", "Lacking foresight; short-sighted.", "Chasing one day's move is myopic."],
    ["Quixotic", "adjective", "Extremely idealistic; unrealistic and impractical.", "Trying to catch every tick is quixotic."],
    ["Resilient", "adjective", "Able to recover quickly from difficulties.", "A resilient strategy survives bad years."],
    ["Zenith", "noun", "The highest point reached.", "The stock hit its zenith right before earnings."],
    ["Nadir", "noun", "The lowest point.", "March was the nadir of the drawdown."],
    ["Fortitude", "noun", "Courage in pain or adversity.", "Holding through the crash took fortitude."],
    ["Diligent", "adjective", "Showing care and effort in work.", "Diligent logging makes patterns visible."],
    ["Contrarian", "noun", "A person who opposes popular opinion.", "The contrarian bought when everyone sold."],
    ["Volatile", "adjective", "Liable to change rapidly and unpredictably.", "Volatile markets punish big size."],
    ["Mercurial", "adjective", "Subject to sudden changes of mood.", "The sector has been mercurial all month."]
  ];

  /* ---------------- data ---------------- */
  var market = null, brief = null, econ = [];
  function cleanMarket(d) {
    if (!d || !Array.isArray(d.quotes)) return null;
    var q = d.quotes.filter(function (x) { return x && typeof x.symbol === "string" && num(x.price) != null && num(x.change_pct) != null; }).slice(0, 12)
      .map(function (x) { return { symbol: str(x.symbol, 8), price: +x.price, pct: +x.change_pct, time: str(x.time, 40) }; });
    return { updated: str(d.updated, 40), quotes: q };
  }
  function items(arr, max, tmax, dmax) {
    var out = [];
    (Array.isArray(arr) ? arr : []).slice(0, max).forEach(function (x) {
      if (typeof x === "string") { var t0 = str(x, tmax); if (t0) out.push({ title: t0, detail: "" }); return; }
      var t = str(x && x.title, tmax); if (t) out.push({ title: t, detail: str(x.detail, dmax), url: safeUrl(x.url) });
    });
    return out;
  }
  function cleanBrief(d) {
    if (!d || typeof d !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) return null;
    var ed = d.edition === "trending" ? "trending" : "update";
    var b = { date: d.date, edition: ed, written: str(d.written_at, 40) };
    var m = d.market || {};
    b.market = {
      headline: str(m.headline, 140), note: str(m.note, 600),
      portfolio: m.portfolio && num(m.portfolio.day_pct) != null ? { day: +m.portfolio.day_pct, week: num(m.portfolio.week_pct), note: str(m.portfolio.note, 200) } : null,
      watch: (Array.isArray(m.watchlist) ? m.watchlist : []).filter(function (w) { return w && str(w.symbol, 8) && num(w.pct) != null; }).slice(0, 12)
        .map(function (w) { return { symbol: str(w.symbol, 8).toUpperCase(), pct: +w.pct, note: str(w.note, 80) }; }),
      spy: num(m.spy_day_pct)
    };
    var c = d.catalyst || {};
    b.catalyst = {
      outlook: str(c.outlook, 700),
      today: (Array.isArray(c.today) ? c.today : []).slice(0, 5).filter(function (x) { return x && str(x.name, 80); }).map(function (x) {
        return { name: str(x.name, 80), time: /^\d{1,2}:\d{2}$/.test(x.time || "") ? x.time : "", actual: str(String(x.actual == null ? "" : x.actual), 20),
          expected: str(String(x.expected == null ? "" : x.expected), 20), previous: str(String(x.previous == null ? "" : x.previous), 20), read: str(x.read, 400) };
      }),
      week: (Array.isArray(c.week) ? c.week : []).slice(0, 10).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && str(x.name, 80); })
        .map(function (x) { return { date: x.date, time: /^\d{1,2}:\d{2}$/.test(x.time || "") ? x.time : "", name: str(x.name, 80), why: str(x.why, 200) }; })
    };
    var t = d.trending || {};
    b.trending = { stocks: items(t.stocks, 4, 120, 240), tech: items(t.tech, 4, 120, 240), world: items(t.world, 4, 120, 240) };
    if (d.fact && str(d.fact.claim, 280) && typeof d.fact.is_true === "boolean") b.fact = { claim: str(d.fact.claim, 280), truth: d.fact.is_true, explain: str(d.fact.explain, 400) };
    if (d.word && str(d.word.word, 40) && str(d.word.definition, 300)) b.word = { word: str(d.word.word, 40), pos: str(d.word.part_of_speech, 20), def: str(d.word.definition, 300), ex: str(d.word.example, 240) };
    var g = d.gbot || {};
    b.gbot = { items: items(g.items, 4, 120, 300), sports: items(g.sports, 4, 120, 300), say: str(g.say, 160), mood: str(g.mood, 12).toLowerCase(), name: str(g.name, 14).toUpperCase(), link: /^https:\/\/([a-z0-9-]+\.)*(grok\.com|x\.com)\//i.test(g.link || "") ? safeUrl(g.link) : null };
    return b;
  }

  /* fact + word: fixed for the day once first seen, so a later
     edition can't swap a question already answered. The day's word
     also goes into the log the recall quiz draws from. */
  function dayContent(today) {
    var dc = C.days[today];
    if (!dc) {
      var h = hashStr(today);
      var f = FF[h % FF.length], w = WORDS[(h >>> 8) % WORDS.length];
      dc = { fact: { claim: f[0], truth: f[1], explain: f[2] }, word: { word: w[0], pos: w[1], def: w[2], ex: w[3] }, fromBot: false };
    }
    if (brief && brief.date === today && !dc.fromBot && (brief.fact || brief.word)) {
      if (!C.ff[today]) { if (brief.fact) dc.fact = brief.fact; }
      if (brief.word) dc.word = brief.word;
      dc.fromBot = true;
    }
    C.days[today] = dc;
    var keys = Object.keys(C.days).sort(); while (keys.length > 21) delete C.days[keys.shift()];
    if (!C.words.some(function (x) { return x.date === today; })) {
      C.words.push({ date: today, word: dc.word.word, def: dc.word.def });
      if (C.words.length > 90) C.words.splice(0, C.words.length - 90);
    } else {
      C.words.forEach(function (x) { if (x.date === today) { x.word = dc.word.word; x.def = dc.word.def; } });
    }
    return dc;
  }
  /* recall: a word logged 5–9 days ago, against two other logged definitions */
  function recallQuiz(today) {
    if (C.words.length < 3) return null;
    var t = parseDay(today), pick = null;
    for (var i = C.words.length - 1; i >= 0; i--) {
      var age = Math.round((t - parseDay(C.words[i].date)) / 864e5);
      if (age >= 5 && age <= 9) { pick = C.words[i]; break; }
    }
    if (!pick) return null;
    var others = C.words.filter(function (x) { return x.word !== pick.word && x.def !== pick.def; });
    if (others.length < 2) return null;
    var h = hashStr("recall" + today), a = others[h % others.length], b = others[(h >>> 7) % others.length];
    if (a === b) b = others[(others.indexOf(a) + 1) % others.length];
    var opts = [{ d: pick.def, ok: true }, { d: a.def, ok: false }, { d: b.def, ok: false }];
    var r = h % 3; var tmp = opts[0]; opts[0] = opts[r]; opts[r] = tmp;
    return { word: pick.word, from: pick.date, opts: opts };
  }

  /* ---------------- the SPY call ---------------- */
  function spyPctFor(session) {
    /* the bot's close/evening edition, or the GitHub job's SPY quote
       once it's stamped after that session's close */
    if (brief && brief.date === session && brief.market.spy != null) {
      var bw = Date.parse(brief.fullWritten || brief.written);
      if (isFinite(bw)) { var bp = ny(new Date(bw)); if (bp.key > session || (bp.key === session && bp.min >= closeMin(session))) return brief.market.spy; }
    }
    if (market) {
      var q = market.quotes.filter(function (x) { return x.symbol === "SPY"; })[0];
      if (q && q.time) {
        var p = ny(new Date(q.time));
        if (p.key === session && p.min >= closeMin(session) - 1) return q.pct;
      }
    }
    return null;
  }
  function scoreCalls() {
    var nowP = ny(new Date());
    Object.keys(C.calls).forEach(function (k) {
      var c = C.calls[k];
      if (!c || c.result) return;
      var after = nowP.key > k || (nowP.key === k && nowP.min >= closeMin(k));
      if (!after) return;
      var p = spyPctFor(k);
      if (p == null) return;
      c.pct = p;
      c.result = p === 0 ? "push" : ((p > 0) === (c.call === "green") ? "win" : "loss");
    });
    var keys = Object.keys(C.calls).sort(); while (keys.length > 400) delete C.calls[keys.shift()];
  }
  function callStats() {
    var keys = Object.keys(C.calls).sort(), w = 0, n = 0, streak = 0, best = 0, run = 0;
    keys.forEach(function (k) {
      var r = C.calls[k] && C.calls[k].result;
      if (r === "win") { w++; n++; run++; best = Math.max(best, run); }
      else if (r === "loss") { n++; run = 0; }
    });
    for (var i = keys.length - 1; i >= 0; i--) { var r2 = C.calls[keys[i]].result; if (r2 === "win") streak++; else if (r2 === "loss") break; }
    return { wins: w, total: n, streak: streak, best: best };
  }

  /* ---------------- preview box ---------------- */
  var CARDS = ["market", "catalyst", "trending", "mind", "gbot"];
  var GROK_URL = "https://grok.com";
  /* fresh = written within the last 14 hours (a 12 AM trending update
     still counts for the day it belongs to) */
  function isFresh() {
    if (!brief) return false;
    if (brief.date === dayKey(new Date())) return true;
    var w = Date.parse(brief.written);
    return isFinite(w) && Date.now() - w < 14 * 3600000;
  }
  function editionKey() { var t = dayKey(new Date()); return isFresh() ? t + ":" + brief.written : t + ":base"; }
  function edLabel() {
    if (!brief) return "Waiting on the bot";
    if (!isFresh()) return "Last brief · " + shortDate(parseDay(brief.date));
    var w = Date.parse(brief.written);
    return (brief.edition === "trending" ? "Trending" : "Update") + (isFinite(w) ? " · " + clock(new Date(w)) : "");
  }
  function activeCards() {
    var fresh = isFresh();
    return CARDS.filter(function (c) {
      if (c === "trending") return fresh && (brief.trending.stocks.length + brief.trending.tech.length + brief.trending.world.length > 0);
      if (c === "gbot") return fresh && (brief.gbot.items.length + brief.gbot.sports.length > 0);
      return true;
    });
  }
  function nextEvent(today) {
    var list = econ.filter(function (e) { return e.date >= today; });
    if (brief) brief.catalyst.week.forEach(function (w) { if (w.date >= today) list.push({ date: w.date, time: w.time, name: w.name }); });
    list.sort(function (a, b) { return (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")); });
    return list[0] || null;
  }

  /* the core: an original energy core drawn on a canvas — a glowing
     sphere inside tilted particle shells, throwing sparks and arcs of
     energy outward; everything intensifies while it speaks. Colors come
     from the bot's mood (an inner and an outer hue). */
  /* dual tone: the mood hue paired with the app's violet */
  var MOODS = { chill: ["#67e8f9", "#8f5ef8"], hype: ["#fbbf24", "#a06bff"], alert: ["#ff7a8a", "#8f5ef8"], thinking: ["#c3b8fe", "#7c4dff"] };
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }
  var energy = (function () {
    var cv = null, cx2 = null, host = null, raf = null, S = 150, dpr = 1, t0 = performance.now();
    var shells = [], sparks = [], arcs = [], level = 0;
    function init(h) {
      host = h; cv = h.querySelector("canvas"); cx2 = cv.getContext("2d");
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = S * dpr; cv.height = S * dpr;
      shells = [];
      for (var k = 0; k < 3; k++) {
        var pts = [];
        for (var i = 0; i < 46; i++) pts.push({ a: i / 46 * Math.PI * 2 + Math.random() * 0.1, r: 0.9 + Math.random() * 0.2, s: 0.6 + Math.random() * 1.1, hot: Math.random() < 0.35 });
        shells.push({ tilt: [0.25, 1.15, 2.1][k], squash: [0.38, 0.5, 0.3][k], speed: [0.26, -0.19, 0.36][k], R: [30, 34, 26][k], pts: pts });
      }
    }
    function bolt(x0, y0, ang, len) {
      var pts = [[x0, y0]], x = x0, y = y0, segs = 5 + (Math.random() * 4 | 0);
      for (var i = 0; i < segs; i++) {
        ang += (Math.random() - 0.5) * 0.9;
        x += Math.cos(ang) * len / segs; y += Math.sin(ang) * len / segs;
        pts.push([x, y]);
      }
      return pts;
    }
    function frame(ts) {
      raf = null;
      if (!host || !host.isConnected || document.hidden || (player && player.classList.contains("show"))) return;
      var t = (ts - t0) / 1000, c = S / 2;
      var speaking = host.classList.contains("speaking");
      level += ((speaking ? 0.75 : 0.3) - level) * 0.025;
      var col = MOODS[host.getAttribute("data-mood")] || MOODS.chill, A = col[0], B = col[1];
      var g = cx2; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
      g.globalCompositeOperation = "lighter";
      /* outer haze */
      var pulse = 0.5 + 0.5 * Math.sin(t * (1.1 + level * 1.2));
      var hz = g.createRadialGradient(c, c, 4, c, c, 62);
      hz.addColorStop(0, rgba(A, 0.22 + level * 0.12)); hz.addColorStop(0.45, rgba(B, 0.10 + level * 0.08)); hz.addColorStop(1, rgba(B, 0));
      g.fillStyle = hz; g.beginPath(); g.arc(c, c, 62, 0, Math.PI * 2); g.fill();
      /* particle shells: points on tilted rings, the far side dimmer */
      shells.forEach(function (sh, k) {
        var rot = t * sh.speed * (1 + level * 0.8), ct = Math.cos(sh.tilt), st = Math.sin(sh.tilt);
        sh.pts.forEach(function (p) {
          var a = p.a + rot, x = Math.cos(a) * sh.R * p.r, y = Math.sin(a) * sh.R * p.r * sh.squash;
          var X = c + x * ct - y * st, Y = c + x * st + y * ct, depth = Math.sin(a);
          g.globalAlpha = Math.max(0.08, 0.35 + depth * 0.45) * (0.7 + level * 0.3);
          g.fillStyle = p.hot ? (k === 1 ? B : "#ffffff") : A;
          g.fillRect(X - p.s / 2, Y - p.s / 2, p.s, p.s);
        });
      });
      /* energy arcs: short-lived jagged bolts thrown off the sphere */
      if (Math.random() < 0.0025 + level * 0.012) {
        var ang = Math.random() * Math.PI * 2, r0 = 12 + Math.random() * 6;
        arcs.push({ pts: bolt(c + Math.cos(ang) * r0, c + Math.sin(ang) * r0, ang, 18 + Math.random() * (16 + level * 10)), life: 1, w: 0.7 + Math.random() * 0.9, hue: Math.random() < 0.5 ? A : B });
      }
      for (var i = arcs.length - 1; i >= 0; i--) {
        var ar = arcs[i]; ar.life -= 0.045;
        if (ar.life <= 0) { arcs.splice(i, 1); continue; }
        g.globalAlpha = ar.life;
        g.strokeStyle = ar.hue; g.lineWidth = ar.w * 2.6; g.shadowColor = ar.hue; g.shadowBlur = 8;
        g.beginPath(); ar.pts.forEach(function (p, j) { if (j) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
        g.strokeStyle = "#fff"; g.lineWidth = ar.w * 0.7; g.shadowBlur = 0; g.stroke();
      }
      /* sparks streaming outward */
      var n = Math.random() < 0.12 + level * 0.12 ? 1 : 0;
      for (var k2 = 0; k2 < n; k2++) { var sa = Math.random() * Math.PI * 2; sparks.push({ x: c + Math.cos(sa) * 14, y: c + Math.sin(sa) * 14, vx: Math.cos(sa) * (0.25 + Math.random() * 0.6), vy: Math.sin(sa) * (0.25 + Math.random() * 0.6), life: 1, hue: Math.random() < 0.6 ? A : "#ffffff" }); }
      for (var q = sparks.length - 1; q >= 0; q--) {
        var sp = sparks[q]; sp.x += sp.vx; sp.y += sp.vy; sp.vx *= 0.985; sp.vy *= 0.985; sp.life -= 0.012;
        if (sp.life <= 0) { sparks.splice(q, 1); continue; }
        g.globalAlpha = sp.life; g.fillStyle = sp.hue; g.fillRect(sp.x - 0.8, sp.y - 0.8, 1.6, 1.6);
      }
      /* the core itself */
      var cr = 11 + pulse * 2 + level * 3;
      var cg = g.createRadialGradient(c, c, 0, c, c, cr * 1.9);
      cg.addColorStop(0, "rgba(255,255,255,1)"); cg.addColorStop(0.28, rgba(A, 0.95)); cg.addColorStop(0.6, rgba(B, 0.45)); cg.addColorStop(1, rgba(B, 0));
      g.globalAlpha = 1; g.shadowBlur = 0; g.fillStyle = cg; g.beginPath(); g.arc(c, c, cr * 1.9, 0, Math.PI * 2); g.fill();
      /* a thin inner ring that flickers */
      g.globalAlpha = 0.35 + pulse * 0.3; g.strokeStyle = rgba(A, 0.9); g.lineWidth = 0.8;
      g.beginPath(); g.arc(c, c, 19 + level * 2, t * 0.6, t * 0.6 + Math.PI * 1.4); g.stroke();
      g.strokeStyle = rgba(B, 0.8); g.beginPath(); g.arc(c, c, 22, -t * 0.4, -t * 0.4 + Math.PI * 0.9); g.stroke();
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }
    return {
      mount: function (h) { init(h); this.wake(); },
      wake: function () { if (!raf && host && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) raf = requestAnimationFrame(frame); }
    };
  })();
  var QUIPS = {
    pre: ["Pre-market's warming up. Lock your call before the bell.", "Futures are moving. Got a read yet?"],
    open: ["Market's live. Stick to the plan.", "Session's running. No chasing."],
    after: ["Bell rang. How'd your call do?", "Session's done. Good time to log the day."],
    closed: ["Markets are closed. Good time to get ahead on tomorrow.", "Quiet tape. Next update at 8."]
  };
  function quip(now) {
    var today = dayKey(now), s = marketLine(now).s;
    var k = s === "pre" ? "pre" : s === "open" ? "open" : (isSession(today) && ny(now).min >= 960 && ny(now).min < 1260 ? "after" : "closed");
    return QUIPS[k][hashStr(today + k) % QUIPS[k].length];
  }
  /* the feed: Grok's own line leads (and comes back around), with
     whatever's trending shuffled in between */
  function feedItems(now) {
    var out = [], fresh = isFresh();
    var say = fresh && brief.gbot.say;
    var tr = [];
    if (fresh) [["stocks", "Stocks"], ["tech", "Tech"], ["world", "World"]].forEach(function (c) {
      brief.trending[c[0]].forEach(function (it) { tr.push({ tag: "Trending · " + c[1], text: it.title, kind: "trend" }); });
    });
    /* interleave the three buckets so it doesn't read all-stocks first */
    tr.sort(function (a, b) { return (hashStr(a.text) % 97) - (hashStr(b.text) % 97); });
    if (say) out.push({ tag: (brief.gbot.name || "Grok"), text: say, kind: "say" });
    tr.forEach(function (t, i) { out.push(t); if (say && i % 3 === 2 && i < tr.length - 1) out.push({ tag: (brief.gbot.name || "Grok"), text: say, kind: "say" }); });
    if (!out.length) out.push({ tag: "Grok", text: quip(now), kind: "say" });
    return out;
  }
  var feed = [], feedSig = "", feedIdx = 0, feedTimer = null, decodeTimer = null;
  var GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+<>/";
  function decodeTo(node, text) {
    if (decodeTimer) cancelAnimationFrame(decodeTimer);
    var core = box && box.querySelector(".jv");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = text; return; }
    if (core) core.classList.add("speaking");
    var t0 = performance.now(), D = Math.min(1100, 280 + text.length * 9);
    (function step(t) {
      var p = Math.min(1, (t - t0) / D), n = Math.floor(text.length * p), s = text.slice(0, n);
      for (var i = n; i < Math.min(text.length, n + 6); i++) s += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      node.textContent = s;
      if (p < 1) decodeTimer = requestAnimationFrame(step);
      else { node.textContent = text; decodeTimer = null; setTimeout(function () { if (core) core.classList.remove("speaking"); }, 900); }
    })(t0);
  }
  function showFeed(i) {
    if (!box || !feed.length) return;
    feedIdx = (i + feed.length) % feed.length;
    var it = feed[feedIdx];
    var fd = box.querySelector(".jv-feed");
    fd.classList.toggle("say", it.kind === "say");
    fd.classList.remove("swap"); void fd.offsetWidth; fd.classList.add("swap");
    box.querySelector(".jv-tag").textContent = it.tag;
    decodeTo(box.querySelector(".jv-msg"), it.text);
    var dots = box.querySelector(".jv-dots"); dots.textContent = "";
    if (feed.length > 1) for (var d = 0; d < feed.length; d++) dots.appendChild(el("i", d === feedIdx ? "on" : feed[d].kind === "say" ? "s" : ""));
  }
  function feedTick() {
    if (document.hidden || (player && player.classList.contains("show"))) return;
    if (feed.length > 1) showFeed(feedIdx + 1);
  }
  function renderBox() {
    if (!box) return;
    var now = new Date(), today = dayKey(now), ek = editionKey();
    var cards = activeCards(), seen = Math.min(C.seen[ek] || 0, cards.length);
    var done = !!C.wrap[today] && seen >= cards.length;
    box.classList.toggle("fresh", seen === 0);
    box.classList.toggle("done", done);
    box.querySelector(".ib-ed").textContent = done ? "Complete" : edLabel();
    var core = box.querySelector(".jv");
    if (!core.firstChild) { core.innerHTML = '<canvas class="jv-cv" aria-hidden="true"></canvas>'; energy.mount(core); }
    energy.wake();
    var mood = isFresh() ? brief.gbot.mood : "";
    core.setAttribute("data-mood", ["hype", "chill", "alert", "thinking"].indexOf(mood) >= 0 ? mood : "chill");
    var items2 = feedItems(now), sig = items2.map(function (x) { return x.text; }).join("|");
    if (sig !== feedSig) {
      feedSig = sig; feed = items2;
      showFeed(0);
      if (feedTimer) clearInterval(feedTimer);
      feedTimer = setInterval(feedTick, 10000);
    }
    var pips = box.querySelector(".ib-pips"); pips.textContent = "";
    for (var i = 0; i < cards.length; i++) pips.appendChild(el("i", i < seen ? "on" : i === seen ? "next" : ""));
    box.querySelector(".ib-hint").textContent = seen === 0 ? "Tap to open briefing" : seen >= cards.length ? (done ? "All caught up" : "Swipe the last card to finish") : "Pick up at card " + (seen + 1);
  }

  /* ---------------- card player ---------------- */
  var player = null, idx = 0, list = [], busy = false;
  function buildPlayer() {
    player = el("div", "ib-player");
    player.setAttribute("role", "dialog"); player.setAttribute("aria-label", "Daily Briefing");
    player.innerHTML = '<div class="ibp-glow"></div><div class="ibp-top"><div class="ibp-bars"></div><div class="ibp-head"><span class="ibp-ed"></span><button type="button" class="ibp-x" aria-label="Close">&times;</button></div></div><div class="ibp-stage"></div>' +
      '<div class="ibp-nav"><button type="button" class="ibp-prev" aria-label="Previous card">&#8249;</button><span class="ibp-count mono"></span><button type="button" class="ibp-next" aria-label="Next card">&#8250;</button></div><div class="ibp-fin"></div>';
    document.body.appendChild(player);
    player.querySelector(".ibp-x").addEventListener("click", function () { close(); });
    player.querySelector(".ibp-prev").addEventListener("click", function () { go(idx - 1); });
    player.querySelector(".ibp-next").addEventListener("click", function () { if (idx >= list.length - 1) finale(); else go(idx + 1); });
    /* gestures: left / right between cards, pull down (from the top
       of a card) to close. Native scrolling is blocked only while a
       pull is actually in progress, so long cards still scroll. */
    var stage = player.querySelector(".ibp-stage");
    var sx = 0, sy = 0, st = 0, tracking = false, dx = 0, dy = 0, axis = null, pulling = false, card = null;
    player.addEventListener("touchstart", function (e) {
      e.stopPropagation();
      tracking = false;
      if (busy || player.classList.contains("finale") || e.touches.length !== 1 || e.target.closest("input, textarea, button, a, .ib-tabs")) return;
      card = stage.querySelector(".ib-card.cur");
      tracking = true; axis = null; pulling = false; dx = dy = 0;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    player.addEventListener("touchmove", function (e) {
      e.stopPropagation();
      if (!tracking) return;
      dx = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
        if (axis === "y") pulling = dy > 0 && (!card || card.scrollTop <= 0);
        if (axis === "y" && !pulling) { tracking = false; return; }
        player.style.transition = "none";
        if (card) { card.style.transition = "none"; card.classList.remove("in-right", "in-left", "in-up"); }
      }
      if (e.cancelable) e.preventDefault();
      if (axis === "x" && card) { card.style.transform = "translateX(" + (dx * 0.55).toFixed(1) + "px)"; card.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 600)); }
      else if (pulling) {
        var py = Math.max(0, dy), k = Math.min(1, py / 260);
        player.style.transform = "translateY(" + (py * 0.6).toFixed(1) + "px) scale(" + (1 - k * 0.06).toFixed(4) + ")";
        player.style.borderRadius = (k * 26).toFixed(1) + "px";
        player.style.filter = "brightness(" + (1 - k * 0.18).toFixed(3) + ")";
        player.style.setProperty("--pull", k.toFixed(3));
        pullHint(k, py >= 120);
      }
    }, { passive: false });
    function end() {
      if (!tracking) return; tracking = false;
      var fast = Date.now() - st < 260;
      if (card) { card.style.transition = ""; card.style.transform = ""; card.style.opacity = ""; }
      if (pulling) {
        if (dy > 120 || (fast && dy > 50)) { dropAway(); return; }
        player.style.transition = ""; player.style.transform = ""; player.style.opacity = ""; player.style.borderRadius = ""; player.style.filter = ""; player.style.removeProperty("--pull");
        pullHint(0, false);
        return;
      }
      player.style.transition = "";
      if (axis === "x" && (Math.abs(dx) > 70 || (fast && Math.abs(dx) > 35))) {
        if (dx < 0) { if (idx < list.length - 1) go(idx + 1); else finale(); } else go(idx - 1);
      }
    }
    player.addEventListener("touchend", end); player.addEventListener("touchcancel", end);
  }
  /* pull hint: a pill above the sheet that stretches as you pull and
     flips to "Release to close" (with a tick) past the threshold */
  var hint = null, hintReady = false;
  function pullHint(k, ready) {
    if (!hint) {
      hint = el("div", "ib-pullhint"); hint.setAttribute("aria-hidden", "true");
      hint.innerHTML = '<i class="bar"></i><span class="lbl">Pull to close</span>';
      document.body.appendChild(hint);
    }
    hint.style.setProperty("--k", k.toFixed(3));
    hint.classList.toggle("on", k > 0.02);
    if (ready !== hintReady) { hintReady = ready; hint.classList.toggle("ready", ready); hint.querySelector(".lbl").textContent = ready ? "Release to close" : "Pull to close"; if (ready) buzz(8); }
  }
  /* release past the threshold: the sheet shrinks and flies back into
     the briefing box, which catches it with a flash */
  function dropAway() {
    busy = true;
    pullHint(0, false);
    player.classList.add("dismiss");
    var r = box ? box.getBoundingClientRect() : null;
    var W = innerWidth, H = innerHeight;
    var tf = "translateY(80px) scale(0.86)";
    if (r && r.width && r.bottom > 0 && r.top < H) {
      var sx = r.width / W, sy = r.height / H, tx = r.left + r.width / 2 - W / 2, ty = r.top + r.height / 2 - H / 2;
      tf = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + sx.toFixed(4) + "," + sy.toFixed(4) + ")";
    }
    player.style.transition = "transform 0.55s cubic-bezier(0.55, 0, 0.2, 1), opacity 0.5s ease-in 0.08s, border-radius 0.5s ease, filter 0.5s ease";
    player.style.transform = tf; player.style.opacity = "0"; player.style.borderRadius = "60px"; player.style.filter = "brightness(1.6)";
    setTimeout(function () {
      busy = false; player.classList.remove("dismiss"); close(true);
      if (box) {
        box.classList.remove("landed"); void box.offsetWidth; box.classList.add("landed");
        var bx = box.getBoundingClientRect(); burst(bx.left + bx.width / 2, bx.top + bx.height / 2, "#c3b8fe", 14);
      }
    }, 560);
  }
  function open(at) {
    if (!player) buildPlayer();
    if (busy) return;
    scoreCalls();
    list = activeCards();
    player.classList.remove("finale", "collapse");
    player.querySelector(".ibp-fin").textContent = "";
    player.style.transition = ""; player.style.transform = ""; player.style.opacity = ""; player.style.clipPath = "";
    player.querySelector(".ibp-stage").textContent = "";
    void player.offsetWidth;
    player.classList.add("show");
    document.body.classList.add("ib-open");
    var ek = editionKey(), seen = C.seen[ek] || 0;
    idx = 0;
    go(at != null ? at : (seen > 0 && seen < list.length ? seen : 0), true);
  }
  function close(instant) {
    if (!player) return;
    setTimeout(function () { energy.wake(); }, 80);
    if (instant) { player.style.transition = "none"; }
    player.classList.remove("show", "finale", "collapse");
    document.body.classList.remove("ib-open");
    setTimeout(function () { player.style.transition = ""; player.style.transform = ""; player.style.opacity = ""; player.style.clipPath = ""; player.style.borderRadius = ""; player.style.filter = ""; player.style.removeProperty("--pull"); }, 60);
    save(); renderBox();
  }
  function go(i, first) {
    if (busy || i < 0 || i >= list.length) return;
    var dir = i >= idx ? 1 : -1;
    idx = i;
    var ek = editionKey(); C.seen[ek] = Math.max(C.seen[ek] || 0, i + 1);
    var sk = Object.keys(C.seen).sort(); while (sk.length > 30) delete C.seen[sk.shift()];
    save();
    var bars = player.querySelector(".ibp-bars"); bars.textContent = "";
    for (var b = 0; b < list.length; b++) bars.appendChild(el("i", b < i ? "done" : b === i ? "cur" : ""));
    player.querySelector(".ibp-ed").textContent = edLabel();
    player.querySelector(".ibp-count").textContent = (i + 1) + " / " + list.length;
    player.querySelector(".ibp-prev").disabled = i === 0;
    var nx = player.querySelector(".ibp-next");
    nx.textContent = i === list.length - 1 ? "Finish" : "›";
    nx.classList.toggle("last", i === list.length - 1);
    var stage = player.querySelector(".ibp-stage");
    var olds = stage.querySelectorAll(".ib-card.cur");
    var card = renderCard(list[i]);
    card.classList.add("cur", first ? "in-up" : dir > 0 ? "in-right" : "in-left");
    card.addEventListener("animationend", function () { card.classList.remove("in-right", "in-left", "in-up"); }, { once: true });
    stage.appendChild(card);
    Array.prototype.forEach.call(olds, function (old) {
      old.classList.remove("cur"); old.classList.add(dir > 0 ? "out-left" : "out-right");
      setTimeout(function () { old.remove(); }, 320);
    });
    renderBox();
  }
  function refreshCard() {
    if (!player || !player.classList.contains("show") || player.classList.contains("finale")) return;
    var stage = player.querySelector(".ibp-stage"), old = stage.querySelector(".ib-card.cur");
    if (!old) return;
    var st = old.scrollTop, card = renderCard(list[idx]);
    card.classList.add("cur"); stage.replaceChild(card, old); card.scrollTop = st;
  }

  /* ---------------- finale ----------------
     Swiping past the last card (or tapping Finish) implodes the card
     into a point of light, a shockwave rings out, +5 EXP rises (once
     a day), then the briefing folds back into its box. */
  function finale() {
    if (busy) return;
    busy = true;
    var today = dayKey(new Date()), first = !C.wrap[today];
    if (first) {
      C.wrap[today] = { at: new Date().toISOString() };
      var ks = Object.keys(C.wrap).sort(); while (ks.length > 60) delete C.wrap[ks.shift()];
      save();
    }
    var stage = player.querySelector(".ibp-stage"), card = stage.querySelector(".ib-card.cur");
    if (card) { card.style.transition = ""; card.style.transform = ""; card.style.opacity = ""; card.classList.remove("in-right", "in-left", "in-up"); card.classList.add("implode"); }
    player.classList.add("finale");
    var fin = player.querySelector(".ibp-fin"); fin.textContent = "";
    var cx = innerWidth / 2, cy = innerHeight * 0.46;
    fin.style.setProperty("--fx", cx + "px"); fin.style.setProperty("--fy", cy + "px");
    buzz(first ? [10, 60, 10, 60, 40] : 20);
    setTimeout(function () {
      fin.appendChild(el("i", "fin-flash"));
      fin.appendChild(el("i", "fin-wave"));
      fin.appendChild(el("i", "fin-wave w2"));
      var t = el("div", "fin-pop" + (first ? "" : " quiet"));
      t.appendChild(el("b", null, first ? "+" + WRAP_EXP : "✓"));
      t.appendChild(el("span", null, first ? "EXP" : "Briefing complete"));
      fin.appendChild(t);
      burst(cx, cy, "#c3b8fe", first ? 42 : 18);
      if (first) {
        burst(cx, cy, "#67e8f9", 18);
        try { if (window.__ksGainExp) window.__ksGainExp(WRAP_EXP); } catch (err) {}
      }
    }, 420);
    setTimeout(function () { busy = false; collapseToBox(); }, first ? 1750 : 1250);
  }
  function collapseToBox() {
    if (!box || !player) { close(); return; }
    busy = true;
    var r = box.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    var inset = "inset(" + Math.max(0, r.top).toFixed(0) + "px " + Math.max(0, W - r.right).toFixed(0) + "px " + Math.max(0, H - r.bottom).toFixed(0) + "px " + Math.max(0, r.left).toFixed(0) + "px round 14px)";
    player.classList.add("collapse");
    var done = function () {
      busy = false; close(true);
      box.classList.remove("landed"); void box.offsetWidth; box.classList.add("landed");
      var bx = box.getBoundingClientRect();
      burst(bx.left + bx.width / 2, bx.top + bx.height / 2, "#cbd5e1", 18);
    };
    try {
      var an = player.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)", opacity: 1 }, { clipPath: inset, opacity: 0.15 }], { duration: 560, easing: "cubic-bezier(0.6, 0, 0.2, 1)", fill: "forwards" });
      an.onfinish = function () { an.cancel(); done(); };
    } catch (e) { done(); }
  }

  function cardShell(kind, title, kicker) {
    var c = el("div", "ib-card k-" + kind);
    var h = el("div", "ib-ch");
    h.appendChild(el("span", "ib-kick", kicker));
    h.appendChild(el("h2", "ib-title", title));
    c.appendChild(h);
    return c;
  }
  function sect(parent, label) { var s = el("div", "ib-sec"); if (label) s.appendChild(el("div", "ib-sl", label)); parent.appendChild(s); return s; }
  function itemList(parent, arr) {
    arr.forEach(function (it) {
      var r = el("div", "ib-it");
      var t = it.url ? el("a", "t", it.title) : el("span", "t", it.title);
      if (it.url) { t.href = it.url; t.target = "_blank"; t.rel = "noopener noreferrer"; }
      r.appendChild(t);
      if (it.detail) r.appendChild(el("span", "d", it.detail));
      parent.appendChild(r);
    });
  }

  function renderCard(kind) {
    var now = new Date(), today = dayKey(now), fresh = isFresh();
    var c;
    if (kind === "market") {
      c = cardShell("market", "Market", "01 · Your read");
      var ml = marketLine(now);
      c.appendChild(el("div", "ib-mstat " + ml.s, ml.t));
      var port = fresh && brief.market.portfolio;
      if (port) {
        var pr = el("div", "ib-port");
        var pb = el("span", "v " + (port.day >= 0 ? "up" : "dn"), pctTxt(port.day));
        pr.appendChild(pb);
        var pm = el("span", "m");
        pm.appendChild(el("span", "k", ny(new Date(Date.parse(brief.fullWritten || brief.written) || Date.now())).min < 570 ? "Portfolio · last session" : "Portfolio · today"));
        if (port.week != null) pm.appendChild(el("span", "w", "Week " + pctTxt(port.week)));
        pr.appendChild(pm);
        c.appendChild(pr);
        if (port.note) c.appendChild(el("p", "ib-p dim", port.note));
      }
      var watch = fresh && brief.market.watch.length ? brief.market.watch : (market ? market.quotes.map(function (q) { return { symbol: q.symbol, pct: q.pct, note: "" }; }) : []);
      if (watch.length) {
        var g = el("div", "ib-watch");
        watch.forEach(function (w) {
          var q = el("div", "ib-q " + (w.pct > 0 ? "up" : w.pct < 0 ? "dn" : "flat"));
          q.appendChild(el("span", "s", w.symbol)); q.appendChild(el("span", "c", pctTxt(w.pct)));
          if (w.note) q.appendChild(el("span", "n", w.note));
          g.appendChild(q);
        });
        c.appendChild(g);
      }
      if (fresh && (brief.market.headline || brief.market.note)) {
        var rd = sect(c, "The read");
        if (brief.market.headline) rd.appendChild(el("div", "ib-hl", brief.market.headline));
        if (brief.market.note) rd.appendChild(el("p", "ib-p", brief.market.note));
      }
      c.appendChild(callPanel(now, today));
    } else if (kind === "catalyst") {
      c = cardShell("catalyst", "Catalyst", "02 · What moves it");
      var cat = fresh ? brief.catalyst : null;
      if (cat && cat.outlook) { var ol = sect(c, "Outlook"); ol.appendChild(el("p", "ib-p", cat.outlook)); }
      var todays = cat && cat.today.length ? cat.today : econ.filter(function (e) { return e.date === today; }).map(function (e) { return { name: e.name, time: e.time, actual: "", expected: "", previous: "", read: "" }; });
      if (todays.length) {
        var ts = sect(c, "Today");
        todays.forEach(function (e) {
          var r = el("div", "ib-cat");
          var top = el("div", "top"); top.appendChild(el("span", "n", e.name)); if (e.time) top.appendChild(el("span", "tm", clock24(e.time)));
          r.appendChild(top);
          if (e.actual || e.expected || e.previous) {
            var nums = el("div", "nums");
            [["Actual", e.actual, "a"], ["Expected", e.expected, "e"], ["Prior", e.previous, "p"]].forEach(function (x) {
              if (!x[1]) return; var b = el("span", "nb " + x[2]); b.appendChild(el("i", null, x[0])); b.appendChild(el("b", null, x[1])); nums.appendChild(b);
            });
            r.appendChild(nums);
          }
          if (e.read) r.appendChild(el("p", "ib-p", e.read));
          ts.appendChild(r);
        });
      }
      var horizon = addDays(today, 7), wk = [];
      var botWeek = cat ? cat.week : [];
      botWeek.forEach(function (w) { if (w.date > today && w.date <= horizon) wk.push(w); });
      econ.forEach(function (e) {
        if (e.date > today && e.date <= horizon && !wk.some(function (w) { return w.date === e.date && w.name.toLowerCase().indexOf(e.name.split(" ")[0].toLowerCase()) >= 0; })) wk.push({ date: e.date, time: e.time, name: e.name, why: "" });
      });
      wk.sort(function (a, b) { return (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")); });
      var ws = sect(c, "Week ahead");
      if (wk.length) wk.forEach(function (w) {
        var r = el("div", "ib-wk");
        r.appendChild(el("span", "d", shortDate(parseDay(w.date))));
        var b = el("span", "b"); b.appendChild(el("span", "n", w.name + (w.time ? " · " + clock24(w.time) : ""))); if (w.why) b.appendChild(el("span", "w", w.why));
        r.appendChild(b); ws.appendChild(r);
      });
      else { var ne = nextEvent(addDays(today, 1)); ws.appendChild(el("p", "ib-p dim", "No major releases scheduled this week." + (ne ? " Next up: " + ne.name + ", " + shortDate(parseDay(ne.date)) + "." : ""))); }
    } else if (kind === "trending") {
      c = cardShell("trending", "Trending", "03 · On X");
      var tr = brief.trending, tabs = [["stocks", "Stocks"], ["tech", "Tech"], ["world", "World"]].filter(function (t) { return tr[t[0]].length; });
      var sel = C.trendTab && tabs.some(function (t) { return t[0] === C.trendTab; }) ? C.trendTab : tabs[0][0];
      var tb = el("div", "ib-tabs"), body = el("div", "ib-tbody");
      function paint(k) {
        sel = k; C.trendTab = k; save();
        Array.prototype.forEach.call(tb.children, function (b) { b.classList.toggle("on", b.getAttribute("data-k") === k); });
        body.textContent = ""; itemList(body, tr[k]);
      }
      tabs.forEach(function (t) { var b = el("button", "", t[1]); b.type = "button"; b.setAttribute("data-k", t[0]); b.addEventListener("click", function () { paint(t[0]); }); tb.appendChild(b); });
      c.appendChild(tb); c.appendChild(body); paint(sel);
    } else if (kind === "mind") {
      c = cardShell("mind", "Fact or Fiction", "04 · Sharpen up");
      var dc = dayContent(today); save();
      c.appendChild(factPanel(today, dc.fact));
      var wsx = sect(c, "Word of the day");
      var wd = el("div", "ib-word");
      wd.appendChild(el("span", "w", dc.word.word));
      if (dc.word.pos) wd.appendChild(el("span", "pos", dc.word.pos));
      wsx.appendChild(wd);
      wsx.appendChild(el("p", "ib-p", dc.word.def));
      if (dc.word.ex) wsx.appendChild(el("p", "ib-p dim it", "“" + dc.word.ex + "”"));
      var rq = recallQuiz(today);
      if (rq) c.appendChild(recallPanel(today, rq));
    } else if (kind === "gbot") {
      c = cardShell("gbot", "From the Bot", "05 · Grok bot");
      if (brief.gbot.items.length) { var gs = sect(c, "Can help with"); itemList(gs, brief.gbot.items); }
      if (brief.gbot.sports.length) { var ss = sect(c, "Sports Desk"); itemList(ss, brief.gbot.sports); }
    }
    return c;
  }

  function callPanel(now, today) {
    var p = el("div", "ib-call");
    scoreCalls();
    var st = callStats();
    p.appendChild(el("div", "ib-sl", "Call it"));
    /* today's result, if a call for today exists */
    var tc = C.calls[today];
    if (tc && tc.result) {
      var res = el("div", "ib-result " + tc.result);
      res.appendChild(el("span", "big", tc.result === "win" ? "Called it" : tc.result === "loss" ? "Missed" : "Push"));
      res.appendChild(el("span", "sub", "You said " + tc.call.toUpperCase() + " · SPY " + pctTxt(tc.pct)));
      p.appendChild(res);
    } else if (tc && isSession(today) && ny(now).min >= 570) {
      var spy = market && market.quotes.filter(function (q) { return q.symbol === "SPY"; })[0];
      var live = spy && spy.time && ny(new Date(spy.time)).key === today ? spy.pct : null;
      var tracking = live == null ? null : (live > 0) === (tc.call === "green");
      var tk = el("div", "ib-result live " + (tracking == null ? "" : tracking ? "win" : "loss"));
      tk.appendChild(el("span", "big", "Locked: " + tc.call.toUpperCase()));
      tk.appendChild(el("span", "sub", live == null ? "Scored after the close" : "SPY " + pctTxt(live) + " · " + (tracking ? "tracking your way" : "going against you")));
      p.appendChild(tk);
    }
    /* the open call */
    var tgt = callTarget(now), mine = C.calls[tgt];
    var lbl = tgt === today ? "Will SPY close green or red today?" : "Will SPY close green or red " + (tgt === addDays(today, 1) ? "tomorrow" : DOW[parseDay(tgt).getDay()]) + "?";
    var q = el("div", "ib-ask");
    q.appendChild(el("span", "q", lbl));
    var row = el("div", "ib-gr");
    [["green", "Green ▲"], ["red", "Red ▼"]].forEach(function (o) {
      var b = el("button", "ib-pick " + o[0] + (mine && mine.call === o[0] ? " on" : ""), o[1]); b.type = "button";
      b.addEventListener("click", function () {
        C.calls[tgt] = { call: o[0], at: new Date().toISOString(), result: null };
        save(); buzz(14);
        var r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, o[0] === "green" ? "#34d399" : "#ff5a6e", 14);
        refreshCard(); renderBox();
      });
      row.appendChild(b);
    });
    q.appendChild(row);
    q.appendChild(el("span", "lock", mine ? "Locked in — you can switch until the 9:30 open" : "Calls lock at the 9:30 open"));
    p.appendChild(q);
    var stl = el("div", "ib-stats");
    [["Record", st.wins + "–" + (st.total - st.wins)], ["Hit rate", st.total ? Math.round(st.wins / st.total * 100) + "%" : "—"], ["Streak", String(st.streak)], ["Best", String(st.best)]].forEach(function (x) {
      var s = el("span"); s.appendChild(el("b", null, x[1])); s.appendChild(el("i", null, x[0])); stl.appendChild(s);
    });
    p.appendChild(stl);
    return p;
  }

  function factPanel(today, fact) {
    var p = el("div", "ib-ff");
    var ans = C.ff[today];
    var cardEl = el("div", "ib-flip" + (ans ? " flipped" : ""));
    var front = el("div", "f front"); front.appendChild(el("span", "claim", fact.claim));
    var back = el("div", "f back");
    if (ans) {
      back.classList.add(ans.right ? "ok" : "no");
      back.appendChild(el("span", "verdict", (fact.truth ? "Fact" : "Fiction") + (ans.right ? " · you got it" : " · not this time")));
      back.appendChild(el("span", "was", fact.claim));
      if (fact.explain) back.appendChild(el("span", "why", fact.explain));
    }
    cardEl.appendChild(front); cardEl.appendChild(back);
    p.appendChild(cardEl);
    if (!ans) {
      var row = el("div", "ib-gr");
      [[true, "Fact"], [false, "Fiction"]].forEach(function (o) {
        var b = el("button", "ib-pick " + (o[0] ? "fact" : "fic"), o[1]); b.type = "button";
        b.addEventListener("click", function () {
          var right = o[0] === fact.truth;
          C.ff[today] = { pick: o[0], right: right };
          var ks = Object.keys(C.ff).sort(); while (ks.length > 120) delete C.ff[ks.shift()];
          save(); buzz(right ? [10, 40, 10] : 30);
          var r = b.getBoundingClientRect(); if (right) burst(r.left + r.width / 2, r.top + r.height / 2, "#fbbf24", 18);
          refreshCard();
        });
        row.appendChild(b);
      });
      p.appendChild(row);
    }
    var tot = 0, ok = 0; Object.keys(C.ff).forEach(function (k) { tot++; if (C.ff[k].right) ok++; });
    if (tot) p.appendChild(el("div", "ib-mini", "Fact or Fiction record: " + ok + " / " + tot));
    return p;
  }
  function recallPanel(today, rq) {
    var s = el("div", "ib-sec ib-recall");
    s.appendChild(el("div", "ib-sl", "Recall · from " + shortDate(parseDay(rq.from))));
    s.appendChild(el("div", "ib-word"));
    s.lastChild.appendChild(el("span", "w", rq.word));
    s.appendChild(el("span", "ib-mini", "What does it mean?"));
    var ans = C.recall[today];
    rq.opts.forEach(function (o, i) {
      var b = el("button", "ib-opt", o.d); b.type = "button";
      if (ans) { b.disabled = true; if (o.ok) b.classList.add("right"); else if (ans.i === i) b.classList.add("wrong"); }
      b.addEventListener("click", function () {
        C.recall[today] = { i: i, right: o.ok };
        var ks = Object.keys(C.recall).sort(); while (ks.length > 120) delete C.recall[ks.shift()];
        save(); buzz(o.ok ? [10, 40, 10] : 30); refreshCard();
      });
      s.appendChild(b);
    });
    return s;
  }

  /* particle burst (canvas-free: a few absolutely-placed sparks) */
  function burst(x, y, color, n) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (var i = 0; i < n; i++) {
      var s = el("i", "ib-spark"); s.style.left = x + "px"; s.style.top = y + "px"; s.style.background = color; s.style.boxShadow = "0 0 8px " + color;
      document.body.appendChild(s);
      var a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      try {
        var an = s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: "translate(calc(-50% + " + (Math.cos(a) * d).toFixed(1) + "px), calc(-50% + " + (Math.sin(a) * d).toFixed(1) + "px)) scale(0.2)", opacity: 0 }],
          { duration: 600 + Math.random() * 400, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" });
        an.onfinish = (function (z) { return function () { z.remove(); }; })(s);
      } catch (e) { s.remove(); }
    }
  }

  /* ---------------- sky row in the Weather module ---------------- */
  function renderSky() {
    var sky = document.getElementById("wxSky");
    if (!sky) return;
    var now = new Date(), st = sunTimes(now), mo = moon(now);
    var ord = (sky.querySelector(".sky-sun") || el("div", "sky-sun"));
    ord.textContent = "";
    [["Sunrise", clock(st.rise)], ["Sunset", clock(st.set)], ["Daylight", dur(st.set - st.rise)]].forEach(function (r) {
      var row = el("div", "sky-r"); row.appendChild(el("span", "k", r[0])); row.appendChild(el("span", "v", r[1])); ord.appendChild(row);
    });
    var mb = sky.querySelector(".sky-mbox") || el("div", "sky-mbox");
    mb.innerHTML = moonSVG(mo);
    mb.appendChild(el("span", "n", mo.name));
    mb.appendChild(el("span", "k", Math.round(mo.frac * 100) + "% lit"));
    if (!ord.parentNode) { sky.appendChild(ord); sky.appendChild(mb); }
  }

  /* ---------------- loading ---------------- */
  function hydrate() {
    market = cleanMarket(C.market);
    brief = cleanBrief(C.brief);
    /* a trending-only update (nights, and all weekend) carries just
       trending + Grok's line; everything else comes from the last full
       update, up to 72 hours back so Friday 6 PM carries the weekend */
    if (brief && brief.edition === "trending") {
      var full = cleanBrief(C.full), tw = Date.parse(brief.written), fw = full ? Date.parse(full.written) : NaN;
      if (full && isFinite(tw) && isFinite(fw) && tw - fw < 72 * 3600000 && tw >= fw) {
        full.trending = brief.trending;
        if (brief.gbot.say) { full.gbot.say = brief.gbot.say; full.gbot.mood = brief.gbot.mood || full.gbot.mood; }
        full.fullWritten = full.written; full.written = brief.written; full.edition = "trending";
        brief = full;
      }
    }
    if (brief && Math.round((parseDay(dayKey(new Date())) - parseDay(brief.date)) / 864e5) > 3) brief = null;
    econ = (C.econ && Array.isArray(C.econ.events) ? C.econ.events : []).filter(function (e) { return e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && str(e.name, 80); })
      .map(function (e) { return { date: e.date, time: /^\d{1,2}:\d{2}$/.test(e.time || "") ? e.time : "", name: str(e.name, 80) }; });
  }
  var loading = false, lastLoad = 0;
  function load(force) {
    if (loading || (!force && Date.now() - lastLoad < 90000)) return;
    loading = true; lastLoad = Date.now();
    var jobs = [
      repoJSON("market.json").then(function (d) { if (cleanMarket(d)) C.market = d; }),
      repoJSON("brief.json").then(function (d) { var cb = cleanBrief(d); if (cb) { C.brief = d; if (cb.edition !== "trending") C.full = d; } }),
      repoJSON("econ.json").then(function (d) { if (d && Array.isArray(d.events)) C.econ = d; })
    ];
    Promise.all(jobs.map(function (p) { return p.catch(function () {}); })).then(function () {
      loading = false; hydrate(); scoreCalls(); save(); renderBox(); refreshCard();
    });
  }
  window.__briefing = { open: open, load: load };

  hydrate(); scoreCalls(); renderBox(); renderSky();
  if (box) {
    /* swipe the box left / right to step through the feed; a swipe
       never opens the briefing */
    var bx0 = 0, by0 = 0, bAxis = null, bDx = 0, swiped = false;
    box.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      bx0 = e.touches[0].clientX; by0 = e.touches[0].clientY; bAxis = null; bDx = 0;
    }, { passive: true });
    box.addEventListener("touchmove", function (e) {
      var dx = e.touches[0].clientX - bx0, dy = e.touches[0].clientY - by0;
      if (!bAxis) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; bAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      if (bAxis !== "x") return;
      if (e.cancelable) e.preventDefault();
      bDx = dx;
      var fd = box.querySelector(".jv-feed");
      fd.style.transition = "none"; fd.style.transform = "translateX(" + (dx * 0.35).toFixed(1) + "px)"; fd.style.opacity = String(1 - Math.min(0.6, Math.abs(dx) / 300));
    }, { passive: false });
    function boxEnd() {
      if (bAxis !== "x") return;
      var fd = box.querySelector(".jv-feed");
      fd.style.transition = "transform 0.3s cubic-bezier(0.2, 0.9, 0.2, 1), opacity 0.3s ease"; fd.style.transform = ""; fd.style.opacity = "";
      if (Math.abs(bDx) > 40 && feed.length > 1) {
        swiped = true; setTimeout(function () { swiped = false; }, 400);
        showFeed(feedIdx + (bDx < 0 ? 1 : -1));
        if (feedTimer) clearInterval(feedTimer);
        feedTimer = setInterval(feedTick, 10000);
        buzz(6);
      }
      bAxis = null;
    }
    box.addEventListener("touchend", boxEnd); box.addEventListener("touchcancel", boxEnd);
    box.addEventListener("click", function (e) {
      if (swiped) { e.stopPropagation(); return; }
      /* the core is its own button: it opens the Grok bot */
      if (e.target.closest(".jv")) {
        e.stopPropagation();
        var u = (brief && brief.gbot.link) || GROK_URL;
        var w = null; try { w = window.open(u, "_blank", "noopener"); } catch (err) {}
        if (!w) window.location.href = u;
        return;
      }
      open(); load(false);
    });
    box.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  }
  setTimeout(function () { load(true); }, 1200);
  setInterval(function () { if (!document.hidden) { renderBox(); renderSky(); if (Date.now() - lastLoad > 600000) load(true); } }, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { load(false); renderBox(); renderSky(); } });
})();

/* ==========================================================
   X RINGS SWIRL (Claude build) — while the rings are held for a
   reboot, motes spiral in from all around and get pulled into the
   core, faster and denser the longer the hold. Let go early and
   they scatter back out; on a full charge they collapse into a
   flash as the reboot starts.
   ========================================================== */
(function () {
  "use strict";
  var cvs = null, ctx = null, parts = [], raf = null, src = null, t0 = 0, dur = 1400, state = "off", cx = 0, cy = 0, dpr = 1;
  var COLS = ["#8f5ef8", "#a78bfa", "#c3b8fe", "#6f63f6", "#e9e3ff", "#da78f5"];
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = innerWidth * dpr; cvs.height = innerHeight * dpr;
    cvs.style.width = innerWidth + "px"; cvs.style.height = innerHeight + "px";
  }
  function spawn(p) {
    var a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 140;
    parts.push({ a: a, r: r, w: (0.9 + Math.random() * 1.3) * (Math.random() < 0.5 ? 1 : 1), s: 0.6 + Math.random() * 1.8, c: COLS[(Math.random() * COLS.length) | 0], life: 1, out: 0 });
  }
  function frame(ts) {
    var b = src.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2;
    var p = Math.min(1, (ts - t0) / dur);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    if (state === "in") { var n = 1 + Math.floor(p * 6); for (var k = 0; k < n; k++) spawn(p); }
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i];
      if (state === "in") { q.a += q.w * (0.03 + p * 0.09) * (1 + 60 / Math.max(20, q.r)); q.r -= (1.2 + p * 5.5) * (0.6 + q.s * 0.3); }
      else if (state === "out") { q.r += 6 + q.out; q.out += 0.6; q.a += q.w * 0.02; q.life -= 0.035; }
      else if (state === "flash") { q.r *= 0.82; q.life -= 0.05; }
      if (q.r < 14 && state === "in") { parts.splice(i, 1); continue; }
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      var x = cx + Math.cos(q.a) * q.r, y = cy + Math.sin(q.a) * q.r;
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life * (state === "in" ? Math.min(1, (260 - q.r) / 80 + 0.2) : 1)));
      ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(x, y, q.s, 0, Math.PI * 2); ctx.fill();
    }
    /* the core glow grows with the charge */
    if (state === "in" || state === "flash") {
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 + p * 50);
      g.addColorStop(0, "rgba(233,227,255," + (0.12 + p * 0.45) + ")"); g.addColorStop(1, "rgba(143,94,248,0)");
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 30 + p * 50, 0, Math.PI * 2); ctx.fill();
    }
    if (state !== "in" && !parts.length) { stopNow(); return; }
    raf = requestAnimationFrame(frame);
  }
  function stopNow() {
    if (raf) cancelAnimationFrame(raf); raf = null; parts = []; state = "off";
    if (cvs) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height); cvs.style.display = "none"; }
  }
  window.__mxSwirl = {
    start: function (el, ms) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!cvs) {
        cvs = document.createElement("canvas"); cvs.className = "mx-swirl"; cvs.setAttribute("aria-hidden", "true");
        document.body.appendChild(cvs); ctx = cvs.getContext("2d");
        addEventListener("resize", function () { if (state !== "off") size(); });
      }
      size(); cvs.style.display = "block";
      src = el; dur = ms || 1400; t0 = performance.now(); state = "in"; parts = [];
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop: function (fired) {
      if (state === "off") return;
      state = fired ? "flash" : "out";
      parts.forEach(function (q) { q.out = Math.random() * 4; });
    }
  };
})();
