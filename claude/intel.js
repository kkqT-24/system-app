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
    ["Octopuses have three hearts.", true, "Two pump blood through the gills, one through the rest of the body.", "animals"],
    ["Goldfish only have a three-second memory.", false, "Studies show goldfish can remember things for months.", "animals"],
    ["A day on Venus is longer than its year.", true, "Venus spins so slowly that one rotation (243 Earth days) outlasts its orbit (225).", "space"],
    ["The Great Wall of China is visible from the Moon with the naked eye.", false, "It's far too narrow; even from low orbit it's very hard to spot.", "history"],
    ["Honey found in ancient Egyptian tombs was still edible.", true, "Honey's low moisture and acidity keep bacteria from growing.", "food"],
    ["Bananas are berries, but strawberries aren't.", true, "Botanically, a berry comes from one flower with one ovary — bananas qualify, strawberries don't.", "food"],
    ["Bulls get angry at the color red.", false, "Bulls are red-green colorblind; it's the cape's movement that provokes them.", "animals"],
    ["Sharks existed before trees.", true, "Sharks go back about 400+ million years; the first trees appeared around 385 million years ago.", "animals"],
    ["Humans only use 10% of their brains.", false, "Brain scans show activity across virtually all regions over a day.", "body"],
    ["Wombat droppings are cube-shaped.", true, "The varying elasticity of their intestines shapes it into cubes.", "animals"],
    ["Lightning never strikes the same place twice.", false, "The Empire State Building is hit roughly 20–25 times a year.", "science"],
    ["A bolt of lightning is hotter than the surface of the Sun.", true, "Lightning reaches about 30,000 K; the Sun's surface is about 5,800 K.", "science"],
    ["Napoleon was unusually short.", false, "He was about 5'7\", average for a Frenchman of his time; the myth came from unit confusion and propaganda.", "history"],
    ["The Eiffel Tower gets taller in summer.", true, "Iron expands in the heat, adding up to about 15 cm.", "science"],
    ["Bats are blind.", false, "All bats can see, and many species see quite well; echolocation is an extra sense.", "animals"],
    ["The first computer 'bug' was an actual insect.", true, "In 1947 a moth was found stuck in a relay of Harvard's Mark II computer.", "tech"],
    ["Chameleons change color mainly to blend in.", false, "They mostly change color to signal mood and regulate temperature.", "animals"],
    ["There are more possible chess games than atoms in the observable universe.", true, "Estimates of possible games (around 10^120) dwarf the ~10^80 atoms.", "science"],
    ["Mars is home to the tallest volcano in the solar system.", true, "Olympus Mons rises about 22 km — roughly two and a half times the height of Everest.", "space"],
    ["The Moon gives off its own light.", false, "Moonlight is sunlight reflected off the lunar surface.", "space"],
    ["A teaspoon of neutron star would weigh billions of tons.", true, "Neutron stars pack more than the Sun's mass into a city-sized ball.", "space"],
    ["Ostriches bury their heads in the sand when scared.", false, "They lower their heads to tend eggs in ground nests or to hide by lying flat.", "animals"],
    ["A group of flamingos is called a flamboyance.", true, "Yes, really — it's the accepted collective noun.", "animals"],
    ["Sea otters hold hands while they sleep.", true, "They link up so they don't drift apart on the water.", "animals"],
    ["Vikings wore horned helmets into battle.", false, "No horned Viking battle helmet has ever been found; the look came from 1800s opera costumes.", "history"],
    ["Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.", true, "The Great Pyramid is about 2,500 years older than her; she lived about 2,000 years before Apollo 11.", "history"],
    ["Oxford University is older than the Aztec Empire.", true, "Teaching at Oxford began around 1096; Tenochtitlan was founded in 1325.", "history"],
    ["Cracking your knuckles causes arthritis.", false, "Studies have found no link; the pop is gas bubbles in the joint fluid.", "body"],
    ["Your stomach lining replaces itself every few days.", true, "The cells lining the stomach renew roughly every 3–5 days to survive the acid.", "body"],
    ["Blood is blue inside your body.", false, "It's always red — darker when low on oxygen. Veins only look blue through skin.", "body"],
    ["Mount Everest is the tallest mountain on Earth from base to peak.", false, "Mauna Kea in Hawaii is taller base to peak, but most of it is underwater.", "earth"],
    ["Antarctica is the largest desert in the world.", true, "Deserts are defined by low precipitation, and Antarctica gets very little.", "earth"],
    ["Peanuts aren't actually nuts.", true, "They're legumes, in the same family as beans and lentils.", "food"],
    ["Eating carrots gives you night vision.", false, "Vitamin A helps eyesight if you're deficient; the super-vision myth was WWII cover for radar.", "food"],
    ["The US once printed a $100,000 bill.", true, "The 1934 gold certificate was only used between Federal Reserve banks.", "money"],
    ["The New York Stock Exchange traces back to an agreement signed under a tree.", true, "The 1792 Buttonwood Agreement was reportedly signed under a buttonwood tree on Wall Street.", "money"],
    ["Someone has played golf on the Moon.", true, "Alan Shepard hit two golf balls on Apollo 14 in 1971.", "sports"],
    ["The first iPhone came out in 2007.", true, "Apple released it in June 2007.", "tech"]
  ];
  var CATS = {
    space: ["Space", "#8ab4ff", "planet"], animals: ["Animals", "#34d399", "paw"], history: ["History", "#f5b971", "column"],
    body: ["Body", "#ff7a9a", "heart"], science: ["Science", "#67e8f9", "flask"], earth: ["Earth", "#7bd88f", "leaf"],
    tech: ["Tech", "#a78bfa", "tech"], food: ["Food", "#fbbf24", "fork"], money: ["Money", "#4ade80", "coin"], sports: ["Sports", "#fb923c", "ball"],
    misc: ["Trivia", "#c3b8fe", "spark"]
  };
  function catOf(c) { return CATS[c] ? c : "misc"; }

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
      .map(function (x) { return { symbol: str(x.symbol, 8), price: +x.price, pct: +x.change_pct, time: str(x.time, 40), prev: num(x.prev_close),
        open: num(x.open), high: num(x.high), low: num(x.low), session: /^\d{4}-\d{2}-\d{2}$/.test(x.session || "") ? x.session : "" }; });
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
        .map(function (w) { return { symbol: str(w.symbol, 8).toUpperCase(), pct: +w.pct, price: num(w.price), prev: num(w.prev_close), note: str(w.note, 80) }; }),
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
    if (d.fact && str(d.fact.claim, 280) && typeof d.fact.is_true === "boolean") b.fact = { claim: str(d.fact.claim, 280), truth: d.fact.is_true, explain: str(d.fact.explain, 400), cat: catOf(str(d.fact.category, 12).toLowerCase()), hard: str(d.fact.difficulty, 8).toLowerCase() === "hard" };
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
      dc = { fact: { claim: f[0], truth: f[1], explain: f[2], cat: f[3] }, word: { word: w[0], pos: w[1], def: w[2], ex: w[3] }, fromBot: false };
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
  var CARDS = ["week", "market", "trending", "gbot", "mind"];
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
      if (c === "week") return new Date().getDay() === 0;
      if (c === "trending") return fresh && (brief.trending.stocks.length + brief.trending.tech.length + brief.trending.world.length > 0);
      if (c === "gbot") return fresh && (brief.gbot.items.length + brief.gbot.sports.length > 0);
      return true;
    });
  }
  /* Catalyst lives on the Market card: today's releases as a highlighted
     block up top, the week ahead under "On deck". */
  function todaysReleases(today) {
    var cat = isFresh() ? brief.catalyst : null;
    if (cat && cat.today.length) return cat.today;
    return econ.filter(function (e) { return e.date === today; }).map(function (e) { return { name: e.name, time: e.time, actual: "", expected: "", previous: "", read: "" }; });
  }
  function weekAhead(today) {
    var cat = isFresh() ? brief.catalyst : null, horizon = addDays(today, 7), wk = [];
    (cat ? cat.week : []).forEach(function (w) { if (w.date > today && w.date <= horizon) wk.push(w); });
    econ.forEach(function (e) {
      if (e.date > today && e.date <= horizon && !wk.some(function (w) { return w.date === e.date && w.name.toLowerCase().indexOf(e.name.split(" ")[0].toLowerCase()) >= 0; })) wk.push({ date: e.date, time: e.time, name: e.name, why: "" });
    });
    wk.sort(function (a, b) { return (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")); });
    return wk;
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
    /* eyes: blink every few seconds, glance around now and then */
    var REST = [2.6, -1.6];
    var eye = { nextBlink: 0, blinkT: -1, lx: REST[0], ly: REST[1], tx: REST[0], ty: REST[1], nextLook: 0 };
    function init(h) {
      host = h; if (typeof watch === "function") watch(); cv = h.querySelector("canvas"); cx2 = cv.getContext("2d");
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
    var lastF = 0, coreSeen = true;
    if ("IntersectionObserver" in window) {
      var io = null;
      var watch = function () {
        if (io || !host) return;
        io = new IntersectionObserver(function (es) { coreSeen = es[es.length - 1].isIntersecting; if (coreSeen) api.wake(); });
        io.observe(host);
      };
    }
    function frame(ts) {
      raf = null;
      if (!host || !host.isConnected || document.hidden || (player && player.classList.contains("show"))) return;
      /* covered by an open panel or scrolled away: stop drawing; check back cheaply */
      if (!coreSeen) return;
      if (document.body.classList.contains("tab-open")) { setTimeout(function () { api.wake(); }, 400); return; }
      /* ~30 fps; everything below that moves per frame is scaled by k */
      if (ts - lastF < 30) { raf = requestAnimationFrame(frame); return; }
      var k = lastF ? Math.min(4, (ts - lastF) / 16.667) : 1; lastF = ts;
      var t = (ts - t0) / 1000, c = S / 2;
      var speaking = host.classList.contains("speaking");
      level += ((speaking ? 0.75 : 0.3) - level) * (1 - Math.pow(0.975, k));
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
      if (Math.random() < (0.0025 + level * 0.012) * k) {
        var ang = Math.random() * Math.PI * 2, r0 = 12 + Math.random() * 6;
        arcs.push({ pts: bolt(c + Math.cos(ang) * r0, c + Math.sin(ang) * r0, ang, 18 + Math.random() * (16 + level * 10)), life: 1, w: 0.7 + Math.random() * 0.9, hue: Math.random() < 0.5 ? A : B });
      }
      for (var i = arcs.length - 1; i >= 0; i--) {
        var ar = arcs[i]; ar.life -= 0.045 * k;
        if (ar.life <= 0) { arcs.splice(i, 1); continue; }
        g.globalAlpha = ar.life;
        g.strokeStyle = ar.hue; g.lineWidth = ar.w * 2.6; g.shadowColor = ar.hue; g.shadowBlur = 8;
        g.beginPath(); ar.pts.forEach(function (p, j) { if (j) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
        g.strokeStyle = "#fff"; g.lineWidth = ar.w * 0.7; g.shadowBlur = 0; g.stroke();
      }
      /* sparks streaming outward */
      var n = Math.random() < (0.12 + level * 0.12) * k ? 1 : 0;
      for (var k2 = 0; k2 < n; k2++) { var sa = Math.random() * Math.PI * 2; sparks.push({ x: c + Math.cos(sa) * 14, y: c + Math.sin(sa) * 14, vx: Math.cos(sa) * (0.25 + Math.random() * 0.6), vy: Math.sin(sa) * (0.25 + Math.random() * 0.6), life: 1, hue: Math.random() < 0.6 ? A : "#ffffff" }); }
      for (var q = sparks.length - 1; q >= 0; q--) {
        var sp = sparks[q], dmp = Math.pow(0.985, k); sp.x += sp.vx * k; sp.y += sp.vy * k; sp.vx *= dmp; sp.vy *= dmp; sp.life -= 0.012 * k;
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
      /* eyes */
      if (!eye.nextBlink) { eye.nextBlink = t + 2 + Math.random() * 3; eye.nextLook = t + 1.5; }
      if (t >= eye.nextBlink && eye.blinkT < 0) { eye.blinkT = t; eye.nextBlink = t + 2.5 + Math.random() * 3.5 + (Math.random() < 0.2 ? -2.2 : 0); }
      var open = 1;
      if (eye.blinkT >= 0) { var bp = (t - eye.blinkT) / 0.16; if (bp >= 1) eye.blinkT = -1; else open = Math.max(0.08, Math.abs(1 - bp * 2)); }
      if (t >= eye.nextLook) {
        var r = Math.random();
        var away = !(eye.tx === REST[0] && eye.ty === REST[1]);
        if (away || r < 0.55) { eye.tx = REST[0]; eye.ty = REST[1]; eye.nextLook = t + 2.5 + Math.random() * 3.5; }
        else { eye.tx = [-3, -2.6, 1, -0.5][(Math.random() * 4) | 0]; eye.ty = [-1, 1.2, 1.4, -2][(Math.random() * 4) | 0]; eye.nextLook = t + 0.9 + Math.random() * 1.2; }
      }
      var ee = 1 - Math.pow(0.88, k); eye.lx += (eye.tx - eye.lx) * ee; eye.ly += (eye.ty - eye.ly) * ee;
      /* rounded pill eyes */
      var ew = 2.1 + level * 0.25, eh = (5.4 + level * 0.8) * open, ex = c + eye.lx, ey = c - 1 + eye.ly;
      if (speaking) eh *= 1 + 0.08 * Math.sin(t * 9);
      g.fillStyle = "#14103a"; g.globalAlpha = 0.92;
      [ex - 4.4, ex + 4.4].forEach(function (x) {
        var rr = ew, hh = Math.max(rr, eh);
        g.beginPath();
        g.arc(x, ey - hh + rr, rr, Math.PI, 0);
        g.lineTo(x + rr, ey + hh - rr);
        g.arc(x, ey + hh - rr, rr, 0, Math.PI);
        g.closePath(); g.fill();
      });
      g.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    var api = {
      mount: function (h) { init(h); this.wake(); },
      wake: function () { if (!raf && host && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) raf = requestAnimationFrame(frame); }
    };
    return api;
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
      if (busy || player.classList.contains("finale") || e.touches.length !== 1 || e.target.closest("input, textarea, button, a, .ib-tabs, .ib-swipe")) return;
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
    var pos = list.indexOf(kind);
    if (pos >= 0) kicker = kicker.replace(/^\d+/, pad(pos + 1));
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


  /* ---------------- story + chat helpers (Trending, From the Bot) ---------------- */
  var NAME_TICKERS = [
    [/\btesla\b/i, "TSLA"], [/\bnvidia\b/i, "NVDA"], [/\bamd\b/i, "AMD"], [/\bmarvell\b/i, "MRVL"], [/\bmicron\b/i, "MU"],
    [/\bapple\b/i, "AAPL"], [/\bmicrosoft\b/i, "MSFT"], [/\b(alphabet|google)\b/i, "GOOGL"], [/\bamazon\b/i, "AMZN"],
    [/\bmeta\b/i, "META"], [/\bnetflix\b/i, "NFLX"], [/\bpalantir\b/i, "PLTR"], [/\bbroadcom\b/i, "AVGO"], [/\bintel\b/i, "INTC"],
    [/\btsmc\b/i, "TSM"], [/\bzeta\b/i, "ZETA"], [/\bcoinbase\b/i, "COIN"], [/\bbitcoin\b/i, "BTC"], [/\buber\b/i, "UBER"],
    [/\bsalesforce\b/i, "CRM"], [/\boracle\b/i, "ORCL"], [/\bsuper ?micro\b/i, "SMCI"], [/\bjpmorgan\b/i, "JPM"]
  ];
  var KNOWN = { SPY: 1, QQQ: 1, IWM: 1, DIA: 1, VIX: 1, TSLA: 1, NVDA: 1, AMD: 1, AAPL: 1, MSFT: 1, GOOGL: 1, AMZN: 1, META: 1, NFLX: 1, PLTR: 1, AVGO: 1, MU: 1, SMCI: 1, COIN: 1, MSTR: 1, HOOD: 1, ARM: 1, TSM: 1, QLD: 1, TQQQ: 1, SOXL: 1, SMH: 1 };
  /* only today's move: a live quote stamped today, or the bot's watchlist
     once it was written after the open. Before the open chips show just
     the ticker, so last session's % never sits next to a premarket story. */
  function pctFor(sym) {
    var nowP = ny(new Date());
    if (market) { var q = market.quotes.filter(function (x) { return x.symbol === sym; })[0]; if (q && q.time && ny(new Date(q.time)).key === nowP.key && ny(new Date(q.time)).min >= 570) return q.pct; }
    if (isFresh()) {
      var wt = ny(new Date(Date.parse(brief.fullWritten || brief.written) || 0));
      if (wt.key === nowP.key && wt.min >= 570) { var w = brief.market.watch.filter(function (x) { return x.symbol === sym; })[0]; if (w) return w.pct; }
    }
    return null;
  }
  function tickersIn(text) {
    var out = [], seen = {};
    function add(t) { if (!seen[t] && out.length < 3) { seen[t] = 1; out.push(t); } }
    (text.match(/\$[A-Z]{1,5}\b/g) || []).forEach(function (t) { add(t.slice(1)); });
    var watch = isFresh() ? brief.market.watch.map(function (w) { return w.symbol; }) : [];
    (text.match(/\b[A-Z]{2,5}\b/g) || []).forEach(function (t) { if (KNOWN[t] || watch.indexOf(t) >= 0) add(t); });
    NAME_TICKERS.forEach(function (n) { if (n[0].test(text)) add(n[1]); });
    return out;
  }
  function tickerChips(text) {
    var ts = tickersIn(text);
    if (!ts.length) return null;
    var row = el("div", "ib-chips");
    ts.forEach(function (t) {
      var p = pctFor(t), ch = el("span", "ib-chip" + (p == null ? "" : p > 0 ? " up" : p < 0 ? " dn" : ""));
      ch.appendChild(el("b", null, "$" + t));
      if (p != null) ch.appendChild(el("i", null, (p > 0 ? "▲ " : p < 0 ? "▼ " : "") + pctTxt(p, 1).replace(/^[+−]/, "")));
      row.appendChild(ch);
    });
    return row;
  }
  function glyph(name) {
    var P = {
      stocks: '<path d="M5 17V9M5 9V6M12 19v-9M12 10V5M19 15V8M19 8V4"/><rect x="3.5" y="9" width="3" height="6" rx=".5"/><rect x="10.5" y="10" width="3" height="6" rx=".5"/><rect x="17.5" y="8" width="3" height="5" rx=".5"/>',
      tech: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".5"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
      world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
      chart: '<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>',
      ball: '<ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-35 12 12)"/><path d="M9.5 14.5l5-5M10.5 11l2.5 2.5M12 9.5l2.5 2.5"/>',
      hoop: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.5 5.5c3 2.5 3 10.5 0 13M18.5 5.5c-3 2.5-3 10.5 0 13"/>',
      spark: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
      bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
      fire: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 .8 1.5 1.5 2 2.5 2C11 7.5 11 5 12 3z"/>',
      x: '<path d="M4 4l16 16M20 4L4 20"/>',
      planet: '<circle cx="12" cy="12" r="5.5"/><ellipse cx="12" cy="12" rx="10" ry="3.2" transform="rotate(-20 12 12)"/>',
      paw: '<circle cx="7" cy="9" r="1.8"/><circle cx="11" cy="6" r="1.8"/><circle cx="15.5" cy="6.5" r="1.8"/><circle cx="18.5" cy="10.5" r="1.8"/><path d="M8 17c0-3 2.5-5.5 5-5.5s4.5 2.5 4.5 5c0 2-1.8 3-3.5 2.5-1.2-.3-1.8-.3-3 0C9.5 19.5 8 19 8 17z"/>',
      column: '<path d="M4 7l8-4 8 4M5 7h14M6 10v8M10 10v8M14 10v8M18 10v8M4 21h16M5 18h14"/>',
      heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M5.5 12h3l1.5-2.5 2 5 1.5-2.5h5"/>',
      flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
      leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
      fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M16 3c-2 1-3 4-3 7h3v11"/>',
      coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9c-.4-1-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.9 2.5 2.2-1.1 2-2.5 2c-1.2 0-2.2-.6-2.6-1.6M12 6v1.5M12 16.5V18"/>',
      share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
      book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
      skull: '<path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3z"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><path d="M10 20v-2M14 20v-2"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || P.spark) + "</svg>";
  }
  function iconEl(name, cls) { var i = el("span", "ib-ico " + (cls || "")); i.innerHTML = glyph(name); return i; }
  var NFL = /\b(nfl|afc|nfc|chiefs|chargers|broncos|raiders|bills|eagles|cowboys|49ers|ravens|bengals|packers|lions|bears|vikings|steelers|patriots|jets|giants|commanders|dolphins|texans|colts|jaguars|titans|browns|seahawks|rams|cardinals|saints|falcons|panthers|buccaneers|quarterback|touchdown|super bowl)\b/i;
  var NBA = /\b(nba|lakers|celtics|warriors|knicks|bucks|nuggets|suns|heat|mavericks|76ers|sixers|clippers|thunder|timberwolves|cavaliers|pacers|magic|kings|hawks|grizzlies|pelicans|spurs|rockets|raptors|hornets|wizards|pistons|blazers|jazz|bulls|nets|preseason)\b/i;
  function league(text) { return NFL.test(text) ? "NFL" : NBA.test(text) ? "NBA" : /\b(mlb|world series|yankees|dodgers)\b/i.test(text) ? "MLB" : /\b(nhl|stanley cup)\b/i.test(text) ? "NHL" : /\b(ncaa|college)\b/i.test(text) ? "NCAA" : "DESK"; }
  function botTopic(text) {
    if (NFL.test(text)) return "ball";
    if (NBA.test(text)) return "hoop";
    if (/\b(earnings|spy|qqq|opex|strike|put|call|premarket|levels?|chart|rally|sell-?off|stock|shares)\b/i.test(text) || tickersIn(text).length) return "chart";
    if (/\b(ai|model|openai|anthropic|grok|tech|chip)\b/i.test(text)) return "spark";
    if (/\b(remind|don't forget|deadline|today|tomorrow|watch)\b/i.test(text)) return "bell";
    return "spark";
  }
  function clampable(node, text) {
    var d = el("span", "d clamp", text);
    node.appendChild(d);
    node.addEventListener("click", function (e) { if (e.target.closest("a")) return; node.classList.toggle("open"); });
    return d;
  }
  function xLink(url) {
    if (!url) return null;
    var a = el("a", "ib-xlink"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.appendChild(document.createTextNode("On X ↗"));
    return a;
  }


  /* ---------------- the gap (SPY / QQQ / TSLA) ----------------
     After the open: today's open vs the prior close from the market job,
     with how much of it has filled (the day's low/high reaching the prior
     close). Before the open: the indicated gap from the bot's premarket
     watchlist numbers. */
  var GAP_SYMS = ["SPY", "QQQ", "TSLA"];
  function gapRows(now) {
    var p = ny(now), out = [];
    var afterOpen = isSession(p.key) && p.min >= 570;
    GAP_SYMS.forEach(function (sym) {
      var q = market && market.quotes.filter(function (x) { return x.symbol === sym; })[0];
      if (afterOpen && q && q.session === p.key && q.open != null && q.prev) {
        var g = q.open - q.prev, gp = g / q.prev * 100, fill = 0;
        if (g > 0 && q.low != null) fill = Math.min(1, Math.max(0, (q.open - q.low) / g));
        else if (g < 0 && q.high != null) fill = Math.min(1, Math.max(0, (q.high - q.open) / -g));
        out.push({ sym: sym, live: true, gp: gp, prev: q.prev, open: q.open, fill: g === 0 ? 1 : fill, price: q.price });
        return;
      }
      if (!afterOpen && isFresh() && isSession(p.key)) {
        var wt = ny(new Date(Date.parse(brief.fullWritten || brief.written) || 0));
        var w = brief.market.watch.filter(function (x) { return x.symbol === sym; })[0];
        if (w && wt.key === p.key && wt.min < 570 && w.price) {
          var prev = w.prev || w.price / (1 + w.pct / 100);
          out.push({ sym: sym, live: false, gp: w.pct, prev: prev, open: w.price, fill: null });
        }
      }
    });
    return out;
  }
  function money(v) { return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function gapPanel(now) {
    var rows = gapRows(now);
    if (!rows.length) return null;
    var live = rows[0].live;
    var s = el("div", "ib-gap");
    var hd = el("div", "gh"); hd.appendChild(el("span", "lbl", "The gap")); hd.appendChild(el("span", "tag" + (live ? "" : " ind"), live ? "At the open" : "Indicated · premarket"));
    s.appendChild(hd);
    rows.forEach(function (r) {
      var up = r.gp > 0.005, dn = r.gp < -0.005, dir = up ? "up" : dn ? "dn" : "flat";
      var row = el("div", "gr " + dir);
      var a = el("div", "ga");
      a.appendChild(el("b", null, r.sym));
      a.appendChild(el("span", "gp", (up ? "▲ " : dn ? "▼ " : "") + pctTxt(r.gp)));
      a.appendChild(el("span", "gl", up ? "Gap up" : dn ? "Gap down" : "Flat open"));
      row.appendChild(a);
      var b = el("div", "gb");
      b.appendChild(el("span", "lv", money(r.prev) + "  →  " + money(r.open)));
      if (r.fill != null) {
        var bar = el("span", "fb"), fi = el("i"); fi.style.width = Math.round(r.fill * 100) + "%"; bar.appendChild(fi); b.appendChild(bar);
        var left = Math.abs(r.open - r.prev) * (1 - r.fill);
        b.appendChild(el("span", "fs" + (r.fill >= 1 ? " done" : ""), r.fill >= 1 ? "✓ Gap filled" : Math.round(r.fill * 100) + "% filled · $" + money(left) + " to go"));
      } else b.appendChild(el("span", "fs", "Fill target " + money(r.prev) + " · opens 9:30"));
      row.appendChild(b);
      s.appendChild(row);
    });
    return s;
  }


  /* ---------------- Sunday: Week in Review ----------------
     Monday through today from the app's own logs (quests, EXP, workouts,
     level/rank-ups, shadows), the briefing games, and the two systems. */
  function weekStats(today) {
    var t = parseDay(today), back = (t.getDay() + 6) % 7, start = dayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - back));
    var inWk = function (k) { return k >= start && k <= today; };
    var v2 = {}; try { v2 = JSON.parse(localStorage.getItem("systemApp.v2") || "{}") || {}; } catch (e) {}
    var hist = Array.isArray(v2.history) ? v2.history : [];
    var w = { start: start, end: today, exp: 0, quests: 0, levels: 0, ranks: [], shadows: 0, workouts: 0, days: {} };
    hist.forEach(function (h) {
      if (!h || !h.t) return;
      var k = dayKey(new Date(h.t)); if (!inWk(k)) return;
      if (h.type === "quest" && !h.undone) { w.quests++; w.exp += +h.exp || 0; w.days[k] = (w.days[k] || 0) + 1; }
      else if (h.type === "level") w.levels++;
      else if (h.type === "rank") w.ranks.push(h.rank);
      else if (h.type === "shadow") w.shadows++;
    });
    Object.keys(v2.workoutDays || {}).forEach(function (k) { if (inWk(k)) w.workouts++; });
    var cw = 0, cl = 0; Object.keys(C.calls).forEach(function (k) { var c = C.calls[k]; if (inWk(k) && c && c.result === "win") cw++; else if (inWk(k) && c && c.result === "loss") cl++; });
    w.calls = [cw, cl];
    var ft = 0, fo = 0; Object.keys(C.ff).forEach(function (k) { if (inWk(k) && C.ff[k]) { ft++; if (C.ff[k].right) fo++; } });
    w.ff = [fo, ft];
    w.words = C.words.filter(function (x) { return inWk(x.date); }).map(function (x) { return x.word; });
    var nz = C.desk && C.desk.noise, nd = nz ? (nz.days || []).filter(function (d) { return inWk(d.date); }) : [];
    w.noise = nd.length ? { ret: (nd.reduce(function (m, d) { return m * (1 + (d.ret_pct || 0) / 100); }, 1) - 1) * 100, traded: nd.filter(function (d) { return d.traded; }).length, n: nd.length } : null;
    return w;
  }
  function countUp(node, to, fmt) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !to) { node.textContent = fmt(to); return; }
    var t0 = performance.now(), D = 900;
    (function f(t) { var p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3); node.textContent = fmt(to * e); if (p < 1 && node.isConnected) requestAnimationFrame(f); else node.textContent = fmt(to); })(t0);
  }
  function weekCard(today) {
    var w = weekStats(today), c = cardShell("week", "Week in Review", "01 · Sunday report");
    var s0 = parseDay(w.start), s1 = parseDay(w.end);
    c.appendChild(el("div", "ib-wkrange", MON[s0.getMonth()] + " " + s0.getDate() + " – " + MON[s1.getMonth()] + " " + s1.getDate()));
    /* hero: EXP */
    var hero = el("div", "ib-wkhero"); var ev = el("b"); hero.appendChild(ev); hero.appendChild(el("span", null, "EXP gained this week"));
    c.appendChild(hero); countUp(ev, w.exp, function (v) { return "+" + Math.round(v); });
    /* activity strip, Mon..Sun */
    var strip = el("div", "ib-wkstrip"), mx = 1;
    for (var i = 0; i < 7; i++) { var k = dayKey(new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + i)); mx = Math.max(mx, w.days[k] || 0); }
    for (var j = 0; j < 7; j++) {
      var d = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + j), k2 = dayKey(d), n = w.days[k2] || 0;
      var col = el("span", "col" + (k2 > today ? " future" : ""));
      var bar = el("i"); bar.style.height = (n ? Math.max(12, n / mx * 100) : 4) + "%"; bar.style.animationDelay = (j * 60) + "ms";
      col.appendChild(bar); col.appendChild(el("em", null, "MTWTFSS"[j])); strip.appendChild(col);
    }
    c.appendChild(strip);
    function grid(label, cells) {
      var sx = sect(c, label), g = el("div", "ib-wkgrid");
      cells.forEach(function (x) { var cell = el("div", "cell" + (x[2] ? " " + x[2] : "")); var b = el("b"); cell.appendChild(b); cell.appendChild(el("span", null, x[0])); g.appendChild(cell); if (typeof x[1] === "number") countUp(b, x[1], function (v) { return String(Math.round(v)); }); else b.textContent = x[1]; });
      sx.appendChild(g); return sx;
    }
    grid("Hunter", [["Quests", w.quests], ["Workout days", w.workouts], ["Level-ups", w.levels], ["Shadows", w.shadows]]);
    if (w.ranks.length) c.lastChild.appendChild(el("p", "ib-p dim", "Ranked up to " + w.ranks[w.ranks.length - 1] + " this week."));
    var rk = rankFor(mindPoints()).r;
    grid("Briefing", [["SPY calls", w.calls[0] + "–" + w.calls[1], w.calls[0] > w.calls[1] ? "up" : w.calls[1] > w.calls[0] ? "dn" : ""], ["Fact or Fiction", w.ff[0] + "/" + w.ff[1]], ["New words", w.words.length], ["Fact Hunter", rk[0] + "-Rank"]]);
    if (w.words.length) c.lastChild.appendChild(el("p", "ib-p dim", w.words.join(" · ")));
    var mk = C.market && C.market.lev200;
    var cells = [];
    if (mk) cells.push(["LEV200", mk.state === "ON" ? "ON · QLD" : "OFF", mk.state === "ON" ? "up" : ""], ["QQQ vs 200-day", sgn(mk.pct_vs_sma, 1), mk.pct_vs_sma >= 0 ? "up" : "dn"]);
    if (w.noise) cells.push(["NOISE week", sgn(w.noise.ret), w.noise.ret >= 0 ? "up" : "dn"], ["NOISE traded", w.noise.traded + " of " + w.noise.n]);
    if (cells.length) grid("Systems", cells);
    return c;
  }

  function renderCard(kind) {
    var now = new Date(), today = dayKey(now), fresh = isFresh();
    var c;
    if (kind === "week") {
      c = weekCard(today);
    } else if (kind === "market") {
      c = cardShell("market", "Market", "01 · Your read");
      var ml = marketLine(now);
      c.appendChild(el("div", "ib-mstat " + ml.s, ml.t));
      var todays = todaysReleases(today), olk = fresh ? brief.catalyst.outlook : "";
      if (todays.length) {
        var cb = el("div", "ib-alert");
        var ch = el("div", "ib-alert-h"); ch.appendChild(el("span", "lbl", "Catalyst")); ch.appendChild(el("span", "tag", "Important"));
        cb.appendChild(ch);
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
          cb.appendChild(r);
        });
        if (olk) cb.appendChild(el("p", "ib-p dim", olk));
        c.appendChild(cb);
      }
      var gpn = gapPanel(now); if (gpn) c.appendChild(gpn);
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
      var watch = fresh && brief.market.watch.length ? brief.market.watch : (market ? market.quotes.map(function (q) { return { symbol: q.symbol, pct: q.pct, price: q.price, note: "" }; }) : []);
      if (watch.length) {
        var g = el("div", "ib-watch");
        watch.forEach(function (w) {
          var q = el("div", "ib-q " + (w.pct > 0 ? "up" : w.pct < 0 ? "dn" : "flat"));
          q.appendChild(el("span", "s", w.symbol));
          if (w.price != null && w.price > 0) q.appendChild(el("span", "px", "$" + w.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
          q.appendChild(el("span", "c", pctTxt(w.pct)));
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
      {
        var up = weekAhead(today).slice(0, parseDay(today).getDay() === 0 ? 8 : 3), olk2 = todays.length ? "" : olk;
        if (olk2 || up.length) {
          var us = sect(c, "On deck");
          if (olk2) us.appendChild(el("p", "ib-p", olk2));
          up.forEach(function (w) {
            var r = el("div", "ib-wk");
            r.appendChild(el("span", "d", shortDate(parseDay(w.date))));
            var b = el("span", "b"); b.appendChild(el("span", "n", w.name + (w.time ? " · " + clock24(w.time) : ""))); if (w.why) b.appendChild(el("span", "w", w.why));
            r.appendChild(b); us.appendChild(r);
          });
          if (!up.length) { var nx = nextEvent(addDays(today, 1)); if (nx) us.appendChild(el("p", "ib-p dim", "Next up: " + nx.name + ", " + shortDate(parseDay(nx.date)) + ".")); }
        }
      }
      c.appendChild(callPanel(now, today));
    } else if (kind === "trending") {
      c = cardShell("trending", "Trending", "03 · On X");
      var tr = brief.trending, tabs = [["stocks", "Stocks"], ["tech", "Tech"], ["world", "World"]].filter(function (t) { return tr[t[0]].length; });
      var sel = C.trendTab && tabs.some(function (t) { return t[0] === C.trendTab; }) ? C.trendTab : tabs[0][0];
      var live = el("div", "ib-live"); live.appendChild(el("i")); live.appendChild(el("span", null, "Live on X"));
      var wt = Date.parse(brief.written); if (isFinite(wt)) live.appendChild(el("span", "ago", "· " + clock(new Date(wt))));
      c.appendChild(live);
      var tb = el("div", "ib-tabs fancy"), ink = el("span", "ink"), body = el("div", "ib-tbody");
      tb.appendChild(ink);
      function paint(k, anim) {
        sel = k; C.trendTab = k; save();
        var ix = 0;
        Array.prototype.forEach.call(tb.querySelectorAll("button"), function (b, i) { var on = b.getAttribute("data-k") === k; b.classList.toggle("on", on); if (on) ix = i; });
        ink.style.width = (100 / tabs.length) + "%"; ink.style.transform = "translateX(" + (ix * 100) + "%)";
        body.textContent = ""; body.className = "ib-tbody k-" + k + (anim ? " anim" : "");
        tr[k].forEach(function (it, i) {
          var row = el("div", i === 0 ? "ib-story hero" : "ib-story");
          row.style.setProperty("--d", (i * 70) + "ms");
          var rank = el("span", "rk", pad(i + 1)); row.appendChild(rank);
          var main = el("div", "mn");
          if (i === 0) { var tag = el("span", "top"); tag.appendChild(iconEl("fire")); tag.appendChild(document.createTextNode("Top story")); main.appendChild(tag); }
          main.appendChild(el("span", "t", it.title));
          if (it.detail) clampable(main, it.detail);
          var foot = el("div", "ft");
          var heat = el("span", "heat"); for (var h = 0; h < 4; h++) heat.appendChild(el("i", h < 4 - i ? "on" : ""));
          foot.appendChild(heat);
          var chips = tickerChips(it.title + " " + it.detail); if (chips) foot.appendChild(chips);
          var xl = xLink(it.url); if (xl) foot.appendChild(xl);
          main.appendChild(foot);
          row.appendChild(main);
          body.appendChild(row);
        });
      }
      tabs.forEach(function (t) {
        var b = el("button"); b.type = "button"; b.setAttribute("data-k", t[0]);
        b.appendChild(iconEl(t[0])); b.appendChild(el("span", "lb", t[1])); b.appendChild(el("span", "ct", String(tr[t[0]].length)));
        b.addEventListener("click", function () { if (sel !== t[0]) { buzz(8); paint(t[0], true); } });
        tb.appendChild(b);
      });
      c.appendChild(tb); c.appendChild(body); paint(sel, true);
      c.appendChild(el("div", "ib-hint", "Tap a story to read more"));
    } else if (kind === "mind") {
      c = cardShell("mind", "Fact or Fiction", "04 · Sharpen up");
      var dc = dayContent(today); save();
      c.appendChild(rankStrip());
      c.appendChild(factPanel(today, dc.fact));
      c.appendChild(wordPanel(today, dc.word));
      var rq = recallQuiz(today);
      if (rq) c.appendChild(recallPanel(today, rq));
    } else if (kind === "gbot") {
      c = cardShell("gbot", "From the Bot", "05 · Grok bot");
      var g = brief.gbot, mood = ["hype", "chill", "alert", "thinking"].indexOf(g.mood) >= 0 ? g.mood : "chill", mc = MOODS[mood];
      c.style.setProperty("--m1", mc[0]); c.style.setProperty("--m2", mc[1]);
      var hd = el("div", "ib-bothead");
      var av = el("span", "ib-av"); av.appendChild(el("i", "r1")); av.appendChild(el("i", "r2"));
      var avc = el("i", "core"), eyes = el("i", "eyes"); eyes.appendChild(el("i")); eyes.appendChild(el("i")); avc.appendChild(eyes); av.appendChild(avc);
      hd.appendChild(av);
      var nm = el("div", "who"); nm.appendChild(el("b", null, g.name || "GROK"));
      var st = el("span", "st"); st.appendChild(el("i")); st.appendChild(document.createTextNode("Online · " + mood)); nm.appendChild(st);
      hd.appendChild(nm);
      c.appendChild(hd);
      var thread = el("div", "ib-thread");
      c.appendChild(thread);
      var msgs = [];
      if (g.say) msgs.push({ say: g.say });
      g.items.forEach(function (it) { msgs.push(it); });
      var ck = "chat:" + editionKey(), played = !!(C.seen && C.seen[ck]);
      function bubble(m) {
        var b = el("div", m.say ? "ib-bub say" : "ib-bub");
        if (m.say) { b.appendChild(el("span", "t", m.say)); return b; }
        var top = el("div", "bh"); top.appendChild(iconEl(botTopic(m.title + " " + m.detail), "tp")); top.appendChild(el("span", "t", m.title)); b.appendChild(top);
        if (m.detail) clampable(b, m.detail);
        var chips = tickerChips(m.title + " " + m.detail); if (chips) b.appendChild(chips);
        return b;
      }
      if (played || window.matchMedia("(prefers-reduced-motion: reduce)").matches) msgs.forEach(function (m) { thread.appendChild(bubble(m)); });
      else {
        C.seen[ck] = 1; save();
        var n = 0;
        (function next() {
          if (n >= msgs.length || !thread.isConnected && n > 0) return;
          var ty = el("div", "ib-typing"); ty.appendChild(el("i")); ty.appendChild(el("i")); ty.appendChild(el("i"));
          thread.appendChild(ty);
          setTimeout(function () {
            ty.remove();
            var b = bubble(msgs[n++]); b.classList.add("pop"); thread.appendChild(b); buzz(6);
            setTimeout(next, 260);
          }, n === 0 ? 650 : 520);
        })();
      }
      if (g.sports.length) {
        var sd = el("div", "ib-desk");
        var dh = el("div", "dh"); dh.appendChild(el("span", "lbl", "Sports Desk")); dh.appendChild(el("span", "led", g.sports.length + " update" + (g.sports.length > 1 ? "s" : "")));
        sd.appendChild(dh);
        g.sports.forEach(function (it, i) {
          var txt = it.title + " " + it.detail, lg = league(txt);
          var tile = el("div", "ib-tile"); tile.style.setProperty("--d", (i * 80) + "ms");
          var side = el("div", "lg " + lg.toLowerCase()); side.appendChild(iconEl(lg === "NBA" ? "hoop" : lg === "NFL" ? "ball" : "spark")); side.appendChild(el("span", null, lg));
          tile.appendChild(side);
          var mm = el("div", "mm");
          var sc = (it.title.match(/\b(\d{1,3})\s*[-–]\s*(\d{1,3})\b/) || []);
          if (sc[0]) { var big = el("span", "score"); big.appendChild(el("b", null, sc[1])); big.appendChild(el("i", null, "–")); big.appendChild(el("b", null, sc[2])); mm.appendChild(big); }
          mm.appendChild(el("span", "t", it.title));
          if (it.detail) clampable(mm, it.detail);
          tile.appendChild(mm);
          sd.appendChild(tile);
        });
        c.appendChild(sd);
      }
      var rp = el("a", "ib-reply"); rp.href = g.link || GROK_URL; rp.target = "_blank"; rp.rel = "noopener noreferrer";
      rp.appendChild(el("span", null, "Reply to " + (g.name ? g.name.charAt(0) + g.name.slice(1).toLowerCase() : "Grok"))); rp.appendChild(el("b", null, "›"));
      c.appendChild(rp);
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

  /* ---------------- Fact or Fiction: rank, swipe, stamp, themes ---------------- */
  var RANKS = [["E", 0, "#9ca3af"], ["D", 50, "#7dd3fc"], ["C", 150, "#34d399"], ["B", 300, "#fbbf24"], ["A", 500, "#fb923c"], ["S", 800, "#f472b6"]];
  var QUICK_S = 10;
  function mindPoints() {
    var pts = 0;
    Object.keys(C.ff).forEach(function (k) { var a = C.ff[k]; if (a && a.right) pts += 10 + (a.quick ? 5 : 0); });
    Object.keys(C.recall).forEach(function (k) { if (C.recall[k] && C.recall[k].right) pts += 5; });
    return pts;
  }
  function rankFor(pts) { var r = RANKS[0], nx = null; for (var i = 0; i < RANKS.length; i++) { if (pts >= RANKS[i][1]) { r = RANKS[i]; nx = RANKS[i + 1] || null; } } return { r: r, next: nx }; }
  function ffStats() {
    var ks = Object.keys(C.ff).sort(), tot = 0, ok = 0, streak = 0, best = 0, run = 0;
    ks.forEach(function (k) { var a = C.ff[k]; if (!a) return; tot++; if (a.right) { ok++; run++; best = Math.max(best, run); } else run = 0; });
    for (var i = ks.length - 1; i >= 0; i--) { if (C.ff[ks[i]] && C.ff[ks[i]].right) streak++; else break; }
    return { tot: tot, ok: ok, streak: streak, best: best };
  }
  function rankStrip() {
    var pts = mindPoints(), rk = rankFor(pts), st = ffStats();
    var w = el("div", "ib-rank");
    w.style.setProperty("--rk", rk.r[2]);
    var badge = el("span", "badge"); badge.appendChild(el("b", null, rk.r[0])); w.appendChild(badge);
    var mid = el("div", "mid");
    mid.appendChild(el("span", "k", "Fact Hunter · " + rk.r[0] + "-Rank"));
    var bar = el("span", "bar"), fill = el("i");
    var pct = rk.next ? Math.min(100, (pts - rk.r[1]) / (rk.next[1] - rk.r[1]) * 100) : 100;
    fill.style.width = pct.toFixed(1) + "%"; bar.appendChild(fill); mid.appendChild(bar);
    mid.appendChild(el("span", "sub", rk.next ? pts + " / " + rk.next[1] + " to " + rk.next[0] : pts + " pts · max rank"));
    w.appendChild(mid);
    var fl = el("span", "flame" + (st.streak >= 3 ? " hot" : st.streak ? "" : " cold"));
    fl.appendChild(iconEl("fire")); fl.appendChild(el("b", null, String(st.streak)));
    w.appendChild(fl);
    return w;
  }
  var ffStart = {}, justAnswered = null;
  function rankUp(letter, color) {
    var o = el("div", "ib-rankup"); o.style.setProperty("--rk", color);
    o.appendChild(el("span", "k", "Rank up"));
    o.appendChild(el("b", null, letter));
    o.appendChild(el("span", "s", "Fact Hunter"));
    (player || document.body).appendChild(o);
    buzz([20, 60, 20, 60, 40]);
    setTimeout(function () { burst(window.innerWidth / 2, window.innerHeight / 2, color, 40); }, 250);
    setTimeout(function () { o.classList.add("out"); }, 1900);
    setTimeout(function () { o.remove(); }, 2400);
  }
  function shareFact(fact, btn) {
    var txt = "Fact or fiction? " + fact.claim;
    function done(msg) { var t = el("span", "ib-toast", msg); btn.appendChild(t); setTimeout(function () { t.remove(); }, 1400); }
    try {
      if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
      navigator.clipboard.writeText(txt).then(function () { done("Copied"); }, function () { done("Couldn't copy"); });
    } catch (e) { done("Couldn't copy"); }
  }
  function factPanel(today, fact) {
    var cat = catOf(fact.cat), cd = CATS[cat];
    var p = el("div", "ib-ff cat-" + cat);
    p.style.setProperty("--cat", cd[1]);
    var ans = C.ff[today];
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var head = el("div", "ib-ffhead");
    var tag = el("span", "ib-cattag"); tag.appendChild(iconEl(cd[2])); tag.appendChild(el("span", null, cd[0])); head.appendChild(tag);
    if (fact.hard) head.appendChild(el("span", "ib-hard", "Hard"));
    var timer = el("span", "ib-timer");
    timer.innerHTML = '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="tr"/><circle cx="18" cy="18" r="15" class="pg"/></svg>';
    var tn = el("b"); timer.appendChild(tn);
    head.appendChild(timer);
    p.appendChild(head);

    var flip = el("div", "ib-flip" + (ans && justAnswered !== today ? " flipped" : "") + (ans ? "" : " ib-swipe"));
    var front = el("div", "f front");
    var fx = el("div", "fx"); for (var i = 0; i < 7; i++) { var g = iconEl(cd[2], "fl"); g.style.setProperty("--i", i); fx.appendChild(g); } front.appendChild(fx);
    front.appendChild(el("span", "claim", fact.claim));
    var sL = el("span", "stamp fic", "Fiction"), sR = el("span", "stamp fact", "Fact");
    front.appendChild(sL); front.appendChild(sR);
    if (!ans) front.appendChild(el("span", "swipehint", "‹ Fiction · swipe · Fact ›"));
    var back = el("div", "f back");
    if (ans) {
      back.classList.add(ans.right ? "ok" : "no");
      var vd = el("span", "verdict"); vd.appendChild(el("b", null, fact.truth ? "Fact" : "Fiction")); vd.appendChild(el("span", null, ans.right ? (ans.quick ? "Quick draw · +15" : "You got it · +10") : "Not this time")); back.appendChild(vd);
      back.appendChild(el("span", "was", fact.claim));
      if (fact.explain) back.appendChild(el("span", "why", fact.explain));
      var picked = ans.pick ? sR : sL; picked.classList.add("show");
    }
    flip.appendChild(front); flip.appendChild(back);
    p.appendChild(flip);
    if (ans && justAnswered === today) { justAnswered = null; requestAnimationFrame(function () { requestAnimationFrame(function () { flip.classList.add("flipped"); }); }); }

    /* timer */
    if (ans) { timer.classList.add("off"); tn.textContent = ans.quick ? "⚡" : "✓"; }
    else {
      if (!ffStart[today]) ffStart[today] = Date.now();
      var el0 = (Date.now() - ffStart[today]) / 1000;
      var pg = timer.querySelector(".pg");
      pg.style.animationDelay = (-el0).toFixed(2) + "s";
      if (el0 >= QUICK_S) timer.classList.add("off");
      (function tick() {
        if (!timer.isConnected && el0 > 0.5) return;
        var left = QUICK_S - (Date.now() - ffStart[today]) / 1000;
        if (C.ff[today]) return;
        if (left <= 0) { tn.textContent = "0"; timer.classList.add("off"); return; }
        tn.textContent = String(Math.ceil(left)); timer.classList.toggle("low", left <= 3);
        setTimeout(tick, 200);
      })();
    }

    function answer(pick) {
      if (C.ff[today]) return;
      var before = rankFor(mindPoints()).r;
      var right = pick === fact.truth, quick = right && (Date.now() - (ffStart[today] || Date.now())) / 1000 <= QUICK_S;
      C.ff[today] = { pick: pick, right: right, quick: quick, cat: cat };
      var ks = Object.keys(C.ff).sort(); while (ks.length > 365) delete C.ff[ks.shift()];
      save();
      flip.classList.remove("ib-swipe");
      front.style.transition = "transform 0.25s ease"; front.style.transform = "";
      (pick ? sR : sL).classList.add("slam");
      buzz(right ? [10, 40, 10] : 40);
      var r = flip.getBoundingClientRect();
      setTimeout(function () { burst(r.left + r.width / 2, r.top + r.height / 2, right ? "#34d399" : "#ff5a6e", right ? (quick ? 30 : 20) : 10); }, 220);
      justAnswered = today;
      setTimeout(function () {
        refreshCard();
        var after = rankFor(mindPoints()).r;
        if (after[0] !== before[0]) setTimeout(function () { rankUp(after[0], after[2]); }, 700);
      }, 650);
    }
    if (!ans) {
      /* drag to answer */
      var sx = 0, dx = 0, drag = false;
      flip.addEventListener("pointerdown", function (e) { if (C.ff[today]) return; drag = true; sx = e.clientX; dx = 0; front.style.transition = "none"; try { flip.setPointerCapture(e.pointerId); } catch (x) {} });
      flip.addEventListener("pointermove", function (e) {
        if (!drag) return;
        dx = e.clientX - sx;
        front.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 18) + "deg)";
        sR.style.opacity = Math.max(0, Math.min(1, dx / 90)); sL.style.opacity = Math.max(0, Math.min(1, -dx / 90));
      });
      function up() {
        if (!drag) return; drag = false;
        sR.style.opacity = ""; sL.style.opacity = "";
        if (Math.abs(dx) > 90) answer(dx > 0);
        else { front.style.transition = "transform 0.35s cubic-bezier(0.3, 1.4, 0.5, 1)"; front.style.transform = ""; }
      }
      flip.addEventListener("pointerup", up); flip.addEventListener("pointercancel", up);
      var row = el("div", "ib-gr");
      [[false, "‹ Fiction", "fic"], [true, "Fact ›", "fact"]].forEach(function (o) {
        var b = el("button", "ib-pick " + o[2], o[1]); b.type = "button";
        b.addEventListener("click", function () { front.style.transition = "transform 0.3s ease"; front.style.transform = "translateX(" + (o[0] ? 40 : -40) + "px) rotate(" + (o[0] ? 3 : -3) + "deg)"; answer(o[0]); });
        row.appendChild(b);
      });
      p.appendChild(row);
    }
    /* footer: category record + share */
    var ft = el("div", "ib-fffoot");
    var ct = 0, co = 0; Object.keys(C.ff).forEach(function (k) { var a = C.ff[k]; if (a && a.cat === cat) { ct++; if (a.right) co++; } });
    var st = ffStats();
    ft.appendChild(el("span", "rec", (ct ? cd[0] + " " + co + "/" + ct + " · " : "") + "All-time " + st.ok + "/" + st.tot + (st.best ? " · best streak " + st.best : "")));
    var sh = el("button", "ib-share"); sh.type = "button"; sh.appendChild(iconEl("share")); sh.appendChild(el("span", null, "Share"));
    sh.addEventListener("click", function () { shareFact(fact, sh); });
    ft.appendChild(sh);
    p.appendChild(ft);
    return p;
  }

  /* ---------------- Word of the Day: decode + Lexicon ---------------- */
  var lastDecode = 0, lexOpen = false;
  var WGLYPHS = "ΔΣΛΞΨΩ#%&*<>/\\|▓▒░01";
  function decode(node, word) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Date.now() - lastDecode < 8000) { node.textContent = word; return; }
    lastDecode = Date.now();
    var t0 = performance.now(), n = word.length;
    node.classList.add("decoding");
    (function f() {
      if (!node.isConnected && performance.now() - t0 > 100) return;
      var e = performance.now() - t0, out = "";
      for (var i = 0; i < n; i++) {
        if (e > 250 + i * 70 || word[i] === " ") out += word[i];
        else out += WGLYPHS[Math.floor(Math.random() * WGLYPHS.length)];
      }
      node.textContent = out;
      if (e < 250 + n * 70 + 40) requestAnimationFrame(f); else { node.textContent = word; node.classList.remove("decoding"); node.classList.add("decoded"); }
    })();
  }
  function wordPanel(today, word) {
    var s = el("div", "ib-sec ib-wordsec");
    var hd = el("div", "ib-wordhead");
    hd.appendChild(el("span", "ib-sl", "Word of the day"));
    var lx = el("button", "ib-lexbtn"); lx.type = "button"; lx.appendChild(iconEl("book")); lx.appendChild(el("span", null, "Lexicon")); lx.appendChild(el("b", null, String(C.words.length)));
    hd.appendChild(lx);
    s.appendChild(hd);
    var wd = el("div", "ib-word");
    var w = el("span", "w"); wd.appendChild(w);
    if (word.pos) wd.appendChild(el("span", "pos", word.pos));
    s.appendChild(wd);
    decode(w, word.word);
    if (!C.lex) C.lex = {};
    if (!C.lex[today]) {
      C.lex[today] = 1; var lk = Object.keys(C.lex).sort(); while (lk.length > 60) delete C.lex[lk.shift()]; save();
      var fl = el("span", "ib-extract", "+1 word extracted"); wd.appendChild(fl);
    }
    s.appendChild(el("p", "ib-p", word.def));
    if (word.ex) s.appendChild(el("p", "ib-p dim it", "“" + word.ex + "”"));
    var list = el("div", "ib-lex" + (lexOpen ? " open" : ""));
    C.words.slice().reverse().forEach(function (x) {
      var r = el("div", "lx" + (x.date === today ? " today" : ""));
      var top = el("div", "lt"); top.appendChild(el("b", null, x.word)); top.appendChild(el("i", null, shortDate(parseDay(x.date)))); r.appendChild(top);
      r.appendChild(el("span", "ld", x.def));
      list.appendChild(r);
    });
    s.appendChild(list);
    lx.classList.toggle("on", lexOpen);
    lx.addEventListener("click", function () { lexOpen = !lexOpen; list.classList.toggle("open", lexOpen); lx.classList.toggle("on", lexOpen); buzz(6); });
    return s;
  }

  /* ---------------- Recall: boss question ---------------- */
  function recallPanel(today, rq) {
    var ans = C.recall[today];
    var s = el("div", "ib-boss" + (ans ? (ans.right ? " won" : " lost") : ""));
    var hd = el("div", "bh"); hd.appendChild(iconEl("skull")); hd.appendChild(el("span", "lbl", "Boss question")); hd.appendChild(el("span", "from", "from " + shortDate(parseDay(rq.from))));
    s.appendChild(hd);
    var hp = el("div", "hp"), hpf = el("i"); hp.appendChild(hpf); s.appendChild(hp);
    hpf.style.width = ans && ans.right ? "0%" : "100%";
    var wd = el("div", "ib-word"); wd.appendChild(el("span", "w", rq.word)); s.appendChild(wd);
    s.appendChild(el("span", "ib-mini", ans ? (ans.right ? "Defeated · +5 pts" : "It got away — this one comes back around") : "Land the right meaning to defeat it"));
    rq.opts.forEach(function (o, i) {
      var b = el("button", "ib-opt", o.d); b.type = "button";
      if (ans) { b.disabled = true; if (o.ok) b.classList.add("right"); else if (ans.i === i) b.classList.add("wrong"); }
      b.addEventListener("click", function () {
        if (C.recall[today]) return;
        var before = rankFor(mindPoints()).r;
        C.recall[today] = { i: i, right: o.ok };
        var ks = Object.keys(C.recall).sort(); while (ks.length > 365) delete C.recall[ks.shift()];
        save(); buzz(o.ok ? [10, 40, 10, 40, 30] : 40);
        if (o.ok) { hpf.style.width = "0%"; s.classList.add("hit"); var r = s.getBoundingClientRect(); setTimeout(function () { burst(r.left + r.width / 2, r.top + 40, "#f472b6", 26); }, 450); }
        else s.classList.add("miss");
        setTimeout(function () {
          refreshCard();
          var after = rankFor(mindPoints()).r;
          if (after[0] !== before[0]) setTimeout(function () { rankUp(after[0], after[2]); }, 500);
        }, 900);
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
      repoJSON("econ.json").then(function (d) { if (d && Array.isArray(d.events)) C.econ = d; }),
      repoJSON("desk.json").then(function (d) { if (d && d.noise) C.desk = d; })
    ];
    Promise.all(jobs.map(function (p) { return p.catch(function () {}); })).then(function () {
      loading = false; hydrate(); scoreCalls(); save(); renderBox(); refreshCard(); renderSystems();
    });
  }
  window.__briefing = { open: open, load: load };


  /* ---------------- Trading Desk module: LEV200 + NOISE BOT ----------------
     LEV200 comes from the market job (QQQ vs its 200-day line, live
     through the session, with ~90 sessions of history and the ON/OFF
     runs) and is cross-checked against the Mac's signal script via the
     desk feed. NOISE comes from the Trading Desk's 4:45 refresh through
     the 4:55 desk feed — percentages only. */
  var DESK_URL = "https://claude.ai/artifact/X2M1Z3DAPcH5gBRC8dX4hM";
  var deskRoot = document.getElementById("deskRoot"), deskTile = document.getElementById("deskTileState"), deskSec = document.getElementById("sec-desk");
  function dayDiff(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 864e5); }
  function sgn(v, dp) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(dp == null ? 2 : dp) + "%"; }
  function svgEl(tag, attrs) { var e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function levNow() {
    var mk = C.market && C.market.lev200, dk = C.desk && C.desk.lev200 && C.desk.lev200.state ? C.desk.lev200 : null, p = ny(new Date());
    if (!mk && !dk) return null;
    var live = !!(mk && mk.live && mk.live.in_session && isSession(p.key) && p.min >= 570 && p.min < 960);
    var state = mk ? mk.state : dk.state;
    if (dk && mk && dk.date >= mk.date) state = dk.state;
    var pv = live ? mk.live.pct_vs_sma : mk ? mk.pct_vs_sma : dk.pct_vs_sma;
    var r = { state: state, pv: pv, live: live, mk: mk, dk: dk };
    if (mk) {
      r.px = live ? mk.live.price : mk.qqq_close; r.sma = live ? mk.live.sma200 : mk.sma200;
      r.flipAt = state === "ON" ? r.sma * 0.99 : r.sma * 1.01; r.away = (r.px / r.flipAt - 1) * 100;
      r.days = mk.since ? dayDiff(mk.since, p.key) : null;
      r.wouldFlip = live && mk.live.state_if_closed !== state ? mk.live.state_if_closed : null;
    }
    r.disagree = !!(dk && mk && dk.date === mk.date && dk.state !== mk.state);
    return r;
  }
  function renderDeskTile() {
    if (!deskTile) return;
    var L = levNow(), nz = C.desk && C.desk.noise, parts = [];
    if (L) parts.push("LEV " + L.state);
    if (nz && nz.since_start_pct != null) parts.push("NOISE " + sgn(nz.since_start_pct, 1));
    deskTile.textContent = parts.length ? parts.join(" · ") : "LEV200 · NOISE";
    var tile = deskTile.closest(".tab-tile");
    if (tile) tile.classList.toggle("dk-alert", !!(L && (L.disagree || L.wouldFlip || (L.away != null && Math.abs(L.away) < 2))));
  }

  /* LEV200 hero: a half-dial from −15% to +15% vs the 200-day line */
  function levHero(L) {
    var w = el("div", "dk-hero " + (L.state === "ON" ? "on" : "off"));
    var dial = el("div", "dk-dial"), svg = svgEl("svg", { viewBox: "0 0 220 128", "aria-hidden": "true" });
    var R = 92, cx = 110, cy = 112, lo = -15, hi = 15;
    function ang(v) { v = Math.max(lo, Math.min(hi, v)); return Math.PI * (1 - (v - lo) / (hi - lo)); }
    function pt(v, r) { var a = ang(v); return [cx + Math.cos(a) * r, cy - Math.sin(a) * r]; }
    function arc(v0, v1, r) { var p0 = pt(v0, r), p1 = pt(v1, r); return "M" + p0[0].toFixed(1) + " " + p0[1].toFixed(1) + " A" + r + " " + r + " 0 0 1 " + p1[0].toFixed(1) + " " + p1[1].toFixed(1); }
    svg.appendChild(svgEl("path", { d: arc(lo, -1, R), class: "seg off" }));
    svg.appendChild(svgEl("path", { d: arc(-1, 1, R), class: "seg band" }));
    svg.appendChild(svgEl("path", { d: arc(1, hi, R), class: "seg on" }));
    [-10, -5, 0, 5, 10].forEach(function (v) { var a = pt(v, R - 12), b = pt(v, R - 4); svg.appendChild(svgEl("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "tick" })); });
    var needle = svgEl("g", { class: "needle" });
    needle.appendChild(svgEl("line", { x1: cx, y1: cy, x2: cx, y2: cy - R + 14 }));
    needle.appendChild(svgEl("circle", { cx: cx, cy: cy, r: 6 }));
    svg.appendChild(needle);
    dial.appendChild(svg);
    var deg = (90 - ang(L.pv) * 180 / Math.PI);
    needle.style.transform = "rotate(-90deg)";
    requestAnimationFrame(function () { requestAnimationFrame(function () { needle.style.transform = "rotate(" + deg.toFixed(1) + "deg)"; }); });
    var mid = el("div", "dk-dmid");
    mid.appendChild(el("span", "dk-badge " + (L.state === "ON" ? "on" : "off"), L.state === "ON" ? "ON · QLD" : "OFF · T-bills"));
    mid.appendChild(el("b", "dk-pv " + (L.pv >= 0 ? "up" : "dn"), sgn(L.pv, 1)));
    mid.appendChild(el("span", "dk-k", "QQQ vs 200-day" + (L.live ? " · live" : "")));
    dial.appendChild(mid);
    w.appendChild(el("div", "dk-hk", "LEV200"));
    w.appendChild(dial);
    var facts = el("div", "dk-facts");
    function fact(k, v, cls) { var f = el("div", "f" + (cls ? " " + cls : "")); f.appendChild(el("b", null, v)); f.appendChild(el("span", null, k)); facts.appendChild(f); }
    if (L.flipAt) fact((L.state === "ON" ? "OFF" : "ON") + (L.state === "ON" ? " below" : " above"), money(L.flipAt), Math.abs(L.away) < 2 ? "warn" : "");
    if (L.away != null) fact("Cushion", Math.abs(L.away).toFixed(1) + "%", Math.abs(L.away) < 2 ? "warn" : "");
    if (L.days != null) { fact(L.state + " streak", L.days + "d", "streak"); }
    w.appendChild(facts);
    if (L.wouldFlip) w.appendChild(el("div", "dk-warn", "⚠ Would flip " + L.wouldFlip + " if the market closed now"));
    if (L.disagree) w.appendChild(el("div", "dk-warn", "⚠ Mac signal says " + L.dk.state + " — check the full desk"));
    return w;
  }
  /* QQQ vs its 200-day line, last ~90 sessions, band shaded */
  function levChart(L) {
    var ser = L.mk && L.mk.series; if (!ser || ser.length < 10) return null;
    var pts = ser.slice();
    if (L.live) pts.push([ny(new Date()).key, L.mk.live.price, L.mk.live.sma200]);
    var W = 340, H = 140, P = 6;
    var ys = []; pts.forEach(function (r) { ys.push(r[1], r[2] * 1.01, r[2] * 0.99); });
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
    function X(i) { return P + i / (pts.length - 1) * (W - 2 * P); }
    function Y(v) { return P + (1 - (v - y0) / (y1 - y0)) * (H - 2 * P); }
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "dk-chart", preserveAspectRatio: "none", "aria-label": "QQQ vs its 200-day average" });
    var defs = svgEl("defs", {}), gr = svgEl("linearGradient", { id: "dkFill", x1: 0, y1: 0, x2: 0, y2: 1 });
    gr.appendChild(svgEl("stop", { offset: "0%", "stop-color": L.state === "ON" ? "#34d399" : "#fbbf24", "stop-opacity": 0.28 }));
    gr.appendChild(svgEl("stop", { offset: "100%", "stop-color": L.state === "ON" ? "#34d399" : "#fbbf24", "stop-opacity": 0 }));
    defs.appendChild(gr); svg.appendChild(defs);
    var band = "M" + pts.map(function (r, i) { return X(i).toFixed(1) + " " + Y(r[2] * 1.01).toFixed(1); }).join(" L") + " L" + pts.slice().reverse().map(function (r, j) { return X(pts.length - 1 - j).toFixed(1) + " " + Y(r[2] * 0.99).toFixed(1); }).join(" L") + " Z";
    svg.appendChild(svgEl("path", { d: band, class: "band" }));
    svg.appendChild(svgEl("path", { d: "M" + pts.map(function (r, i) { return X(i).toFixed(1) + " " + Y(r[2]).toFixed(1); }).join(" L"), class: "sma" }));
    var line = "M" + pts.map(function (r, i) { return X(i).toFixed(1) + " " + Y(r[1]).toFixed(1); }).join(" L");
    svg.appendChild(svgEl("path", { d: line + " L" + X(pts.length - 1).toFixed(1) + " " + H + " L" + X(0) + " " + H + " Z", class: "area", fill: "url(#dkFill)" }));
    var pl = svgEl("path", { d: line, class: "px " + (L.state === "ON" ? "on" : "off") }); svg.appendChild(pl);
    var last = pts[pts.length - 1], lx = X(pts.length - 1), ly = Y(last[1]);
    svg.appendChild(svgEl("circle", { cx: lx, cy: ly, r: 7, class: "ping" }));
    svg.appendChild(svgEl("circle", { cx: lx, cy: ly, r: 3.2, class: "dot" }));
    var box = el("div", "dk-chartbox");
    var hd = el("div", "dk-sh"); hd.appendChild(el("span", null, "QQQ vs 200-day · " + pts.length + " sessions")); var lg = el("span", "lg"); lg.innerHTML = '<i class="l-px"></i>QQQ <i class="l-sma"></i>200-day <i class="l-band"></i>±1% band'; hd.appendChild(lg);
    box.appendChild(hd); box.appendChild(svg);
    var ax = el("div", "dk-ax"); ax.appendChild(el("span", null, shortDate(parseDay(pts[0][0])).replace(/^\w+ · /, ""))); ax.appendChild(el("span", null, money(last[1]))); box.appendChild(ax);
    return box;
  }
  /* ON/OFF history as runs */
  function levRuns(L) {
    var runs = L.mk && L.mk.runs; if (!runs || !runs.length) return null;
    var today = ny(new Date()).key, start = L.mk.first_date || runs[0].from, span = Math.max(1, dayDiff(start, today));
    var box = el("div", "dk-runs"), bar = el("div", "bar");
    box.appendChild(el("div", "dk-sh", "ON / OFF history"));
    runs.forEach(function (r, i) {
      var from = r.from < start ? start : r.from, to = runs[i + 1] ? runs[i + 1].from : today;
      var seg = el("i", r.state === "ON" ? "on" : "off"); seg.style.width = (Math.max(0.8, dayDiff(from, to) / span * 100)).toFixed(2) + "%";
      seg.title = r.state + " from " + from; bar.appendChild(seg);
    });
    box.appendChild(bar);
    var lab = el("div", "dk-ax"); lab.appendChild(el("span", null, shortDate(parseDay(start)).replace(/^\w+ · /, "") + " '" + start.slice(2, 4))); lab.appendChild(el("span", null, "Today")); box.appendChild(lab);
    var fl = (L.mk.flips || []).slice(-3).reverse();
    if (fl.length) box.appendChild(el("div", "dk-mini", "Last flips: " + fl.map(function (f) { return f.to + " " + shortDate(parseDay(f.date)).replace(/^\w+ · /, "") + " '" + f.date.slice(2, 4); }).join(" · ")));
    return box;
  }
  /* NOISE: live vs backtest, sessions, drawdown */
  function noiseCard(nz, p) {
    var w = el("div", "dk-noise");
    var top = el("div", "dk-ntop");
    var l = el("div", "l"); l.appendChild(el("div", "dk-hk", "NOISE BOT")); l.appendChild(el("span", "dk-badge paper", (nz.status || "Paper").replace(/ trading$/i, "") + " · QQQ"));
    top.appendChild(l);
    var r = el("div", "r"); if (nz.since_start_pct != null) { var bb = el("b", "dk-pv " + (nz.since_start_pct >= 0 ? "up" : "dn")); countUp(bb, nz.since_start_pct, function (v) { return sgn(v); }); r.appendChild(bb); } r.appendChild(el("span", "dk-k", "Since " + shortDate(parseDay(nz.first_session || p.key)).replace(/^\w+ · /, "")));
    top.appendChild(r); w.appendChild(top);
    var days = nz.days || [];
    var last = days[days.length - 1];
    var inSess = isSession(p.key) && p.min >= 570 && p.min < 1005 && (!last || last.date < p.key);
    if (inSess) { var live = el("div", "dk-live"); live.appendChild(el("i")); live.appendChild(el("span", null, p.min < 960 ? "In session now · checking every 30 min · results at 4:50" : "Session done · results at 4:50")); w.appendChild(live); }
    /* cumulative live vs backtest */
    if (days.length >= 2) {
      var a = [0], bt = [0], ca = 1, cb = 1;
      days.forEach(function (d) { ca *= 1 + (d.ret_pct || 0) / 100; cb *= 1 + (d.backtest_pct || 0) / 100; a.push((ca - 1) * 100); bt.push((cb - 1) * 100); });
      var W = 340, H = 96, P = 6, all = a.concat(bt, [0]), y0 = Math.min.apply(null, all), y1 = Math.max.apply(null, all), pad = Math.max(0.2, (y1 - y0) * 0.12); y0 -= pad; y1 += pad;
      function X(i) { return P + i / (a.length - 1) * (W - 2 * P); }
      function Y(v) { return P + (1 - (v - y0) / (y1 - y0)) * (H - 2 * P); }
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "dk-chart small", preserveAspectRatio: "none" });
      svg.appendChild(svgEl("line", { x1: 0, x2: W, y1: Y(0), y2: Y(0), class: "zero" }));
      svg.appendChild(svgEl("path", { d: "M" + bt.map(function (v, i) { return X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join(" L"), class: "bt" }));
      svg.appendChild(svgEl("path", { d: "M" + a.map(function (v, i) { return X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join(" L"), class: "px noise" }));
      svg.appendChild(svgEl("circle", { cx: X(a.length - 1), cy: Y(a[a.length - 1]), r: 3.2, class: "dot noise" }));
      var cb2 = el("div", "dk-chartbox");
      var hd = el("div", "dk-sh"); hd.appendChild(el("span", null, "Paper vs backtest")); var lg = el("span", "lg"); lg.innerHTML = '<i class="l-noise"></i>Paper <i class="l-bt"></i>Backtest'; hd.appendChild(lg);
      cb2.appendChild(hd); cb2.appendChild(svg); w.appendChild(cb2);
    }
    /* session squares */
    var sq = el("div", "dk-sq");
    days.forEach(function (d, i) {
      var c = el("span", !d.traded ? "sit" : d.ret_pct >= 0 ? "up" : "dn");
      c.style.animationDelay = (i * 40) + "ms";
      c.appendChild(el("b", null, String(parseDay(d.date).getDate())));
      c.appendChild(el("i", null, d.traded ? sgn(d.ret_pct, 1) : "sat"));
      sq.appendChild(c);
    });
    if (inSess) { var nw = el("span", "now"); nw.appendChild(el("b", null, String(parseDay(p.key).getDate()))); nw.appendChild(el("i", null, "live")); sq.appendChild(nw); }
    w.appendChild(sq);
    var stats = el("div", "dk-facts");
    function fact(k, v, cls) { var f = el("div", "f" + (cls ? " " + cls : "")); f.appendChild(el("b", null, v)); f.appendChild(el("span", null, k)); stats.appendChild(f); }
    fact("Sessions", String(nz.sessions));
    fact("Traded / green", nz.traded_days + " / " + nz.up_days);
    if (nz.avg_gap_vs_backtest_pct != null) fact("Off backtest", "±" + nz.avg_gap_vs_backtest_pct.toFixed(2) + "%", nz.avg_gap_vs_backtest_pct < 0.2 ? "good" : "");
    w.appendChild(stats);
    if (nz.dd_pct != null) {
      var dd = el("div", "dk-dd"), stop = nz.stop_pct || 30;
      dd.appendChild(el("div", "dk-sh", "Drawdown " + nz.dd_pct.toFixed(1) + "% · review " + (nz.review_pct || 20) + "% · stop " + stop + "%"));
      var bar = el("div", "bar"), fill = el("i"); fill.style.width = Math.min(100, nz.dd_pct / stop * 100).toFixed(1) + "%"; bar.appendChild(fill);
      var rv = el("b", "rv"); rv.style.left = ((nz.review_pct || 20) / stop * 100).toFixed(1) + "%"; bar.appendChild(rv);
      dd.appendChild(bar); w.appendChild(dd);
    }
    return w;
  }
  /* milestones — unlocked ones glow; new unlocks flash when the desk opens */
  function milestones(L, nz) {
    var ms = [];
    var sess = nz ? nz.sessions : 0, green = nz ? nz.up_days : 0, since = nz && nz.since_start_pct != null ? nz.since_start_pct : null;
    var wkGreen = false;
    if (nz && nz.days) { var wd = nz.days.slice(-5), wr = wd.reduce(function (m, d) { return m * (1 + (d.ret_pct || 0) / 100); }, 1); wkGreen = wd.length >= 5 && wr > 1; }
    ms.push(["first", "First Session", "NOISE ran its first paper day", sess >= 1, sess + "/1"]);
    ms.push(["green", "First Green Day", "A NOISE session closed up", green >= 1, green + "/1"]);
    ms.push(["s10", "10 Sessions", "Ten paper days logged", sess >= 10, sess + "/10"]);
    ms.push(["s25", "25 Sessions", "A month of data", sess >= 25, sess + "/25"]);
    ms.push(["wk", "Green Week", "Last five sessions net positive", wkGreen, wkGreen ? "" : "—"]);
    ms.push(["track", "Tracks the Backtest", "Average daily gap under 0.2%", !!(nz && nz.avg_gap_vs_backtest_pct != null && nz.traded_days >= 3 && nz.avg_gap_vs_backtest_pct < 0.2), nz && nz.traded_days < 3 ? (nz ? nz.traded_days : 0) + "/3 traded" : ""]);
    ms.push(["plus5", "+5% NOISE", "Paper sleeve up 5% from start", since != null && since >= 5, since != null ? sgn(since, 1) : "—"]);
    var dOn = L && L.state === "ON" && L.days != null ? L.days : 0;
    ms.push(["on100", "100 Days ON", "LEV200 ON streak hits 100", dOn >= 100, dOn + "/100"]);
    ms.push(["on250", "250 Days ON", "A long trend ride", dOn >= 250, dOn + "/250"]);
    return ms;
  }
  function badgePanel(ms) {
    var box = el("div", "dk-badges");
    var got = ms.filter(function (m) { return m[3]; }).length;
    box.appendChild(el("div", "dk-sh", "Milestones · " + got + " / " + ms.length));
    var g = el("div", "grid");
    if (!C.deskBadges || typeof C.deskBadges !== "object") C.deskBadges = {};
    var fresh = [];
    ms.forEach(function (m) {
      var b = el("div", "bd " + (m[3] ? "got" : "lock"));
      b.appendChild(el("span", "ic", m[3] ? "★" : "☆"));
      b.appendChild(el("b", null, m[1]));
      b.appendChild(el("span", "d", m[3] ? m[2] : (m[4] || m[2])));
      if (m[3] && !C.deskBadges[m[0]]) { C.deskBadges[m[0]] = dayKey(new Date()); fresh.push(m[1]); b.classList.add("new"); }
      g.appendChild(b);
    });
    box.appendChild(g);
    if (fresh.length) { save(); setTimeout(function () { var r = box.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + 40, "#fbbf24", 26); buzz([10, 40, 10]); }, 700); }
    return box;
  }
  function renderDesk() {
    renderDeskTile();
    if (!deskRoot) return;
    var p = ny(new Date()), L = levNow(), nz = C.desk && C.desk.noise;
    deskRoot.textContent = "";
    var ml = marketLine(new Date());
    var clk = el("div", "dk-clock " + ml.s); clk.appendChild(el("i")); clk.appendChild(el("span", null, ml.t)); deskRoot.appendChild(clk);
    if (L) {
      deskRoot.appendChild(levHero(L));
      var ch = levChart(L); if (ch) deskRoot.appendChild(ch);
      var rn = levRuns(L); if (rn) deskRoot.appendChild(rn);
    } else deskRoot.appendChild(el("p", "ib-p dim", "LEV200 data loads with the market job."));
    if (nz) deskRoot.appendChild(noiseCard(nz, p)); else deskRoot.appendChild(el("p", "ib-p dim", "NOISE results arrive after the 4:55 desk feed."));
    deskRoot.appendChild(badgePanel(milestones(L, nz)));
    var mt = C.market && Date.parse(C.market.updated), dt = C.desk && Date.parse(C.desk.updated);
    deskRoot.appendChild(el("div", "dk-mini center", (mt ? "Market data " + clock(new Date(mt)) : "") + (dt ? " · Desk feed " + shortDate(new Date(dt)).replace(/ · /, " ") + " " + clock(new Date(dt)) : "")));
    var go = el("a", "dk-open"); go.href = DESK_URL; go.appendChild(el("span", null, "Open the full Trading Desk")); go.appendChild(el("b", null, "↗"));
    deskRoot.appendChild(go);
    var ds = document.getElementById("deskState");
    if (ds) ds.textContent = L ? (L.state === "ON" ? "LEV200 holding QLD" : "LEV200 in T-bills") + (nz ? " · NOISE " + (nz.status || "paper").toLowerCase() : "") : "LEV200 + NOISE BOT";
  }
  var renderSystems = function () { renderDeskTile(); if (deskSec && !deskSec.classList.contains("is-hidden")) renderDesk(); };
  if (deskSec) new MutationObserver(function (list) {
    list.forEach(function (m) { var was = /\bis-hidden\b/.test(m.oldValue || ""), nowHidden = deskSec.classList.contains("is-hidden"); if (was && !nowHidden) { load(false); renderDesk(); } });
  }).observe(deskSec, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  setInterval(function () { if (!document.hidden) renderSystems(); }, 60000);

  hydrate(); scoreCalls(); renderBox(); renderSky(); renderSystems();
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
