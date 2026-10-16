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
    var ed = ["morning", "close", "evening"].indexOf(d.edition) >= 0 ? d.edition : "morning";
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
    b.gbot = { items: items(g.items, 4, 120, 300), sports: items(g.sports, 4, 120, 300) };
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
    if (brief && brief.date === session && brief.edition !== "morning" && brief.market.spy != null) return brief.market.spy;
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
  var CARDS = ["market", "catalyst", "trending", "mind", "gbot", "wrap"];
  function editionKey() { var t = dayKey(new Date()); return brief && brief.date === t ? t + ":" + brief.edition : t + ":base"; }
  function edLabel() {
    if (!brief || brief.date !== dayKey(new Date())) return brief ? "Last brief · " + shortDate(parseDay(brief.date)) : "Waiting on the bot";
    var w = Date.parse(brief.written);
    return ({ morning: "Morning brief", close: "Closing bell", evening: "Evening brief" })[brief.edition] + (isFinite(w) ? " · " + clock(new Date(w)) : "");
  }
  function activeCards() {
    var today = dayKey(new Date()), fresh = brief && brief.date === today;
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
  function renderBox() {
    if (!box) return;
    var now = new Date(), today = dayKey(now), ek = editionKey();
    var cards = activeCards(), seen = Math.min(C.seen[ek] || 0, cards.length);
    var done = !!C.wrap[today];
    box.classList.toggle("fresh", seen === 0);
    box.classList.toggle("done", done);
    var L = box.querySelector(".ib-left"), R = box.querySelector(".ib-right"), F = box.querySelector(".ib-foot");
    /* left: portfolio + the call */
    L.textContent = "";
    L.appendChild(el("span", "ib-k", "Market"));
    var port = brief && brief.date === today && brief.market.portfolio;
    var spy = market && market.quotes.filter(function (q) { return q.symbol === "SPY"; })[0];
    var big = el("span", "ib-big");
    if (port) { big.textContent = pctTxt(port.day); big.classList.add(port.day >= 0 ? "up" : "dn"); L.appendChild(big); L.appendChild(el("span", "ib-sub", "Your portfolio")); }
    else if (spy) { big.textContent = pctTxt(spy.pct); big.classList.add(spy.pct >= 0 ? "up" : "dn"); L.appendChild(big); L.appendChild(el("span", "ib-sub", "SPY")); }
    else { big.textContent = "—"; L.appendChild(big); L.appendChild(el("span", "ib-sub", marketLine(now).t)); }
    var tgt = callTarget(now), c = C.calls[tgt], last = null;
    Object.keys(C.calls).sort().forEach(function (k) { if (C.calls[k].result && k <= today) last = { k: k, c: C.calls[k] }; });
    var callTxt;
    if (last && last.k === today) callTxt = last.c.result === "win" ? "✓ Called it" : last.c.result === "loss" ? "✗ Missed the call" : "Call pushed";
    else if (c) callTxt = "Called " + c.call.toUpperCase() + (tgt === today ? " · locked" : " · " + DOW[parseDay(tgt).getDay()]);
    else callTxt = "Make your SPY call ›";
    L.appendChild(el("span", "ib-callln" + (c || (last && last.k === today) ? "" : " ask"), callTxt));
    /* right: next catalyst */
    R.textContent = "";
    R.appendChild(el("span", "ib-k", "Catalyst"));
    var ne = nextEvent(today);
    if (ne) {
      R.appendChild(el("span", "ib-ev", ne.name));
      R.appendChild(el("span", "ib-sub", (ne.date === today ? "Today" : shortDate(parseDay(ne.date))) + (ne.time ? " · " + clock24(ne.time) : "")));
    } else R.appendChild(el("span", "ib-ev", "Quiet week"));
    var bl = brief && brief.date === today && brief.market.headline;
    if (bl) R.appendChild(el("span", "ib-line", bl));
    /* foot: edition + progress pips */
    F.textContent = "";
    F.appendChild(el("span", "ib-ed", done && seen >= cards.length ? "Briefing complete" : edLabel()));
    var pips = el("span", "ib-pips");
    for (var i = 0; i < cards.length; i++) pips.appendChild(el("i", i < seen ? "on" : ""));
    F.appendChild(pips);
  }

  /* ---------------- card player ---------------- */
  var player = null, idx = 0, list = [];
  function buildPlayer() {
    player = el("div", "ib-player");
    player.setAttribute("role", "dialog"); player.setAttribute("aria-label", "Daily Briefing");
    player.innerHTML = '<div class="ibp-glow"></div><div class="ibp-top"><div class="ibp-bars"></div><div class="ibp-head"><span class="ibp-ed"></span><button type="button" class="ibp-x" aria-label="Close">&times;</button></div></div><div class="ibp-stage"></div>' +
      '<div class="ibp-nav"><button type="button" class="ibp-prev" aria-label="Previous card">&#8249;</button><span class="ibp-count mono"></span><button type="button" class="ibp-next" aria-label="Next card">&#8250;</button></div>';
    document.body.appendChild(player);
    player.querySelector(".ibp-x").addEventListener("click", close);
    player.querySelector(".ibp-prev").addEventListener("click", function () { go(idx - 1); });
    player.querySelector(".ibp-next").addEventListener("click", function () { if (idx >= list.length - 1) close(); else go(idx + 1); });
    /* swipe: left / right between cards, down to close */
    var sx = 0, sy = 0, st = 0, tracking = false, dx = 0, dy = 0, axis = null;
    var stage = player.querySelector(".ibp-stage");
    player.addEventListener("touchstart", function (e) {
      e.stopPropagation();
      if (e.touches.length !== 1 || e.target.closest("input, textarea, .ib-tabs")) { tracking = false; return; }
      tracking = true; axis = null; dx = dy = 0; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    player.addEventListener("touchmove", function (e) {
      e.stopPropagation();
      if (!tracking) return;
      dx = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy;
      if (!axis) { if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      var card = stage.querySelector(".ib-card.cur"); if (!card) return;
      if (axis === "x") { card.style.transition = "none"; card.style.transform = "translateX(" + dx * 0.6 + "px)"; }
      else if (dy > 0 && card.scrollTop <= 0) { player.style.transition = "none"; player.style.transform = "translateY(" + dy * 0.8 + "px)"; player.style.opacity = String(Math.max(0.3, 1 - dy / 500)); if (e.cancelable) e.preventDefault(); }
    }, { passive: false });
    function end() {
      if (!tracking) return; tracking = false;
      var card = stage.querySelector(".ib-card.cur");
      if (card) { card.style.transition = ""; card.style.transform = ""; }
      player.style.transition = "";
      var fast = Date.now() - st < 250;
      if (axis === "y" && (dy > 110 || (fast && dy > 50))) { close(); return; }
      player.style.transform = ""; player.style.opacity = "";
      if (axis === "x" && (Math.abs(dx) > 70 || (fast && Math.abs(dx) > 35))) { if (dx < 0) { if (idx < list.length - 1) go(idx + 1); } else go(idx - 1); }
    }
    player.addEventListener("touchend", end); player.addEventListener("touchcancel", end);
  }
  function open(at) {
    if (!player) buildPlayer();
    scoreCalls();
    list = activeCards();
    player.style.transform = ""; player.style.opacity = "";
    player.classList.add("show");
    document.body.classList.add("ib-open");
    var ek = editionKey(), seen = C.seen[ek] || 0;
    go(at != null ? at : (seen > 0 && seen < list.length ? seen : 0), true);
  }
  function close() {
    if (!player) return;
    player.classList.remove("show");
    document.body.classList.remove("ib-open");
    save(); renderBox();
  }
  function go(i, first) {
    if (i < 0 || i >= list.length) return;
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
    player.querySelector(".ibp-next").textContent = i === list.length - 1 ? "Done" : "›";
    player.querySelector(".ibp-next").classList.toggle("last", i === list.length - 1);
    var stage = player.querySelector(".ibp-stage");
    var old = stage.querySelector(".ib-card.cur");
    var card = renderCard(list[i]);
    card.classList.add("cur", first ? "in-up" : dir > 0 ? "in-right" : "in-left");
    stage.appendChild(card);
    if (old) { old.classList.remove("cur"); old.classList.add(dir > 0 ? "out-left" : "out-right"); setTimeout(function () { old.remove(); }, 380); }
    renderBox();
  }
  function refreshCard() {
    if (!player || !player.classList.contains("show")) return;
    var stage = player.querySelector(".ibp-stage"), old = stage.querySelector(".ib-card.cur");
    if (!old) return;
    var st = old.scrollTop, card = renderCard(list[idx]);
    card.classList.add("cur"); stage.replaceChild(card, old); card.scrollTop = st;
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
    var now = new Date(), today = dayKey(now), fresh = brief && brief.date === today;
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
        pm.appendChild(el("span", "k", brief.edition === "morning" ? "Portfolio · last session" : "Portfolio · today"));
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
    } else {
      c = wrapCard(today);
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

  function wrapCard(today) {
    var c = cardShell("wrap", "Wrap-up", "06 · Lock in");
    var w = C.wrap[today];
    var ring = el("div", "ib-ring" + (w ? " done" : ""));
    ring.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="tr"/><circle cx="60" cy="60" r="52" class="pg"/><g class="tk"></g></svg><span class="ib-exp">+' + WRAP_EXP + ' EXP</span>';
    c.appendChild(ring);
    if (w) {
      c.appendChild(el("div", "ib-sl center", "Today's focus"));
      c.appendChild(el("div", "ib-focus", w.focus || "—"));
      c.appendChild(el("p", "ib-p dim center", "Briefing complete. It refreshes at 4:15 PM and 7 PM."));
      return c;
    }
    c.appendChild(el("p", "ib-p center", "One thing that would make today a win?"));
    var f = el("form", "ib-wform");
    var inp = el("input", "t-input"); inp.type = "text"; inp.maxLength = 80; inp.placeholder = "Today's focus"; inp.setAttribute("aria-label", "Today's focus");
    var go2 = el("button", "t-confirm", "Lock it in"); go2.type = "submit";
    f.appendChild(inp); f.appendChild(go2); c.appendChild(f);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (C.wrap[today]) return;
      var focus = str(inp.value, 80);
      C.wrap[today] = { focus: focus, at: new Date().toISOString() };
      var ks = Object.keys(C.wrap).sort(); while (ks.length > 60) delete C.wrap[ks.shift()];
      save();
      inp.blur();
      try { if (window.__ksGainExp) window.__ksGainExp(WRAP_EXP); } catch (err) {}
      buzz([12, 50, 12, 50, 30]);
      ring.classList.add("charge");
      var r = ring.getBoundingClientRect();
      setTimeout(function () { burst(r.left + r.width / 2, r.top + r.height / 2, "#c3b8fe", 36); ring.classList.add("done"); }, 900);
      setTimeout(function () { refreshCard(); renderBox(); }, 1700);
    });
    return c;
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
    if (brief && Math.round((parseDay(dayKey(new Date())) - parseDay(brief.date)) / 864e5) > 2) brief = null;
    econ = (C.econ && Array.isArray(C.econ.events) ? C.econ.events : []).filter(function (e) { return e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && str(e.name, 80); })
      .map(function (e) { return { date: e.date, time: /^\d{1,2}:\d{2}$/.test(e.time || "") ? e.time : "", name: str(e.name, 80) }; });
  }
  var loading = false, lastLoad = 0;
  function load(force) {
    if (loading || (!force && Date.now() - lastLoad < 90000)) return;
    loading = true; lastLoad = Date.now();
    var jobs = [
      repoJSON("market.json").then(function (d) { if (cleanMarket(d)) C.market = d; }),
      repoJSON("brief.json").then(function (d) { if (cleanBrief(d)) C.brief = d; }),
      repoJSON("econ.json").then(function (d) { if (d && Array.isArray(d.events)) C.econ = d; })
    ];
    Promise.all(jobs.map(function (p) { return p.catch(function () {}); })).then(function () {
      loading = false; hydrate(); scoreCalls(); save(); renderBox(); refreshCard();
    });
  }
  window.__briefing = { open: open, load: load };

  hydrate(); scoreCalls(); renderBox(); renderSky();
  if (box) {
    box.addEventListener("click", function () { open(); load(false); });
    box.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  }
  setTimeout(function () { load(true); }, 1200);
  setInterval(function () { if (!document.hidden) { renderBox(); renderSky(); if (Date.now() - lastLoad > 600000) load(true); } }, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { load(false); renderBox(); renderSky(); } });
})();
