/* ==========================================================
   DAILY INTEL (Claude build)
   An informational module, fed by three kinds of source:
   • data/market.json — delayed quotes + earnings, written by the
     scheduled GitHub job (.github/workflows/daily-intel.yml)
   • data/brief.json — the Grok bot's daily brief (market note,
     headlines, X pulse, fact, trading term); format in
     data/BRIEF_FORMAT.md
   • data/econ.json — verified Fed / CPI / jobs report dates
   plus live free feeds read straight from the phone (Wikipedia's
   On This Day and In the News, a random-fact service) and things
   computed on the phone (market hours, sun, moon, year progress).
   Every bot-written string is rendered as text, never as HTML.
   The last good copy of each source is kept so the panel still
   fills offline, marked with how old it is.
   ========================================================== */
(function () {
  "use strict";
  var REPO_RAW = "https://raw.githubusercontent.com/kkqT-24/system-app/main/claude/data/";
  var LAT = 38.2527, LON = -85.7585; /* Louisville, same as the weather */
  var STORE = "systemApp.intel";
  var sec = document.getElementById("sec-intel");
  var body = document.getElementById("intelBody");
  var tileState = document.getElementById("intelTileState");
  if (!sec || !body) return;

  /* ---------------- small helpers ---------------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function str(v, max) { return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseDay(k) { var p = String(k).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortDate(d) { return DOW[d.getDay()] + " · " + MON[d.getMonth()] + " " + d.getDate(); }
  function clock(d) { var h = d.getHours(), m = d.getMinutes(); return ((h + 11) % 12 + 1) + ":" + pad(m) + (h < 12 ? " AM" : " PM"); }
  function clock24(t) { var p = String(t).split(":"); var h = +p[0], m = +p[1] || 0; return ((h + 11) % 12 + 1) + ":" + pad(m) + (h < 12 ? " AM" : " PM"); }
  function dur(ms) { var m = Math.max(0, Math.round(ms / 60000)); var h = Math.floor(m / 60); m %= 60; return h ? h + "h " + pad(m) + "m" : m + "m"; }
  function ago(iso) {
    var t = Date.parse(iso); if (!isFinite(t)) return "";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + "m ago";
    var h = Math.round(m / 60); if (h < 24) return h + "h ago";
    return Math.round(h / 24) + "d ago";
  }
  function safeUrl(u) { return typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u) && u.length < 400 ? u : null; }

  var cache = {};
  try { cache = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { cache = {}; }
  function saveCache() { try { localStorage.setItem(STORE, JSON.stringify(cache)); } catch (e) {} }

  /* repo data: the raw GitHub copy first (live within minutes of a
     commit, no site rebuild needed), the site's own copy second */
  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function repoJSON(name) {
    return getJSON(REPO_RAW + name + "?t=" + Date.now()).catch(function () { return getJSON("data/" + name); });
  }

  /* ---------------- market clock (Eastern time) ---------------- */
  var HOLIDAYS = { "2026-11-26": 1, "2026-12-25": 1, "2027-01-01": 1, "2027-01-18": 1, "2027-02-15": 1, "2027-03-26": 1,
    "2027-05-31": 1, "2027-06-18": 1, "2027-07-05": 1, "2027-09-06": 1, "2027-11-25": 1, "2027-12-24": 1 };
  var EARLY = { "2026-11-27": 1, "2026-12-24": 1, "2027-11-26": 1 };
  /* wall-clock parts in New York, whatever zone the phone is in */
  function nyParts(d) {
    var f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
    var o = {}; f.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return { key: o.year + "-" + o.month + "-" + o.day, min: (+o.hour) * 60 + (+o.minute), dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday) };
  }
  function tradingDay(key, dow) { return dow > 0 && dow < 6 && !HOLIDAYS[key]; }
  function marketStatus(now) {
    var p = nyParts(now), open = 570, close = EARLY[p.key] ? 780 : 960;
    if (tradingDay(p.key, p.dow)) {
      if (p.min >= open && p.min < close) return { state: "open", text: "Market open · closes in " + dur((close - p.min) * 60000) + (EARLY[p.key] ? " (early close)" : "") };
      if (p.min >= 240 && p.min < open) return { state: "pre", text: "Pre-market · opens in " + dur((open - p.min) * 60000) };
      if (p.min >= close && p.min < 1200) return { state: "after", text: "After hours · market closed" };
    }
    /* find the next session */
    for (var i = 0; i < 10; i++) {
      var t = new Date(now.getTime() + i * 86400000), q = nyParts(t);
      if (i === 0 && (!tradingDay(q.key, q.dow) || p.min >= open)) continue;
      if (tradingDay(q.key, q.dow)) {
        var holiday = HOLIDAYS[p.key] && p.dow > 0 && p.dow < 6;
        var when = i === 0 ? "today" : i === 1 ? "tomorrow" : DOW[q.dow];
        return { state: "closed", text: (holiday ? "Closed for a holiday" : "Market closed") + " · opens " + when + " 9:30 AM" };
      }
    }
    return { state: "closed", text: "Market closed" };
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
    /* lit limb on the right while waxing, left while waning */
    var limb = waxing ? 1 : 0, term = f < 0.5 ? (waxing ? 0 : 1) : (waxing ? 1 : 0);
    var path = "M18 3 A" + r + " " + r + " 0 0 " + limb + " 18 33 A" + rx.toFixed(2) + " " + r + " 0 0 " + term + " 18 3Z";
    return '<svg class="in-moon" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="dark"/>' + (f > 0.01 ? '<path d="' + path + '" class="lit"/>' : "") + "</svg>";
  }

  /* ---------------- built-in fallbacks ---------------- */
  /* used only when the bot's brief has no term today */
  var TERMS = [
    ["VWAP", "Volume-weighted average price: the average price paid today, weighted by volume. Price above VWAP means buyers have been in control on average; many day traders treat it as the fair-value line."],
    ["Opening range", "The high and low of the first minutes of the session (often 5, 15 or 30). A break above or below it is the trigger in an opening-range-breakout setup."],
    ["Theta decay", "The value an option loses each day just from time passing. It speeds up near expiration, which is why 0DTE options can bleed fast even if price barely moves."],
    ["Delta", "How much an option's price moves for a $1 move in the stock. A 0.50 delta call gains about $0.50 per $1 up. It also roughly approximates the odds of finishing in the money."],
    ["Implied volatility (IV)", "The market's expectation of future movement, baked into option prices. High IV makes options expensive; IV often drops sharply right after earnings (an 'IV crush')."],
    ["IV crush", "The drop in implied volatility after a known event like earnings. Options can lose value even when you guessed the direction right, because the uncertainty premium disappears."],
    ["Mean reversion", "The idea that a stretched price tends to drift back toward an average. It works best in range-bound markets and fails in strong trends."],
    ["Momentum", "The tendency for assets that have been rising to keep rising for a while (and fallers to keep falling). Trend-following strategies are built on it."],
    ["Drawdown", "The drop from an account's or strategy's peak to its lowest point before a new high. Max drawdown is the worst one — the pain you have to sit through."],
    ["Sharpe ratio", "Return per unit of risk: excess return divided by volatility. Above 1 is decent for a strategy; it penalizes upside swings too, unlike the Sortino ratio."],
    ["Sortino ratio", "Like Sharpe, but it only counts downside volatility as risk, so a strategy with big up-moves isn't punished for them."],
    ["Expectancy", "Average amount won or lost per trade: (win rate × average win) − (loss rate × average loss). A system needs positive expectancy after costs to make money."],
    ["R-multiple", "A trade's result measured in units of initial risk. Risk $100 and make $300 and that's +3R. It lets you compare trades of different sizes."],
    ["Slippage", "The gap between the price you expected and the price you got. Fast markets and thin options make it worse; backtests that ignore it overstate returns."],
    ["Bid-ask spread", "The gap between the highest buy offer and lowest sell offer. Crossing it is an instant cost, which is why wide-spread options are hard to trade profitably."],
    ["Gap", "When a stock opens well above or below the prior close. Gaps often partially 'fill' (trade back toward the prior close), but strong news gaps can run."],
    ["Support and resistance", "Price areas where buying (support) or selling (resistance) has repeatedly appeared. Once broken, old resistance often becomes new support."],
    ["200-day moving average", "The average closing price over the last 200 trading days. Many trend systems use 'above the 200-day = risk on, below = risk off'."],
    ["Leveraged ETF decay", "Daily-reset leveraged ETFs (like 2× or 3× funds) lose value in choppy sideways markets even if the index ends flat, because the daily compounding works against them."],
    ["Overfitting", "Tuning a strategy so closely to past data that it captures noise, not a real edge. It looks great in the backtest and falls apart live. Out-of-sample testing guards against it."],
    ["Out-of-sample test", "Checking a strategy on data it wasn't built on. If results hold up there, the edge is more likely real rather than curve-fit."],
    ["Walk-forward analysis", "Repeatedly optimizing on one window of data and testing on the next, rolling forward through time. It mimics how a strategy would really be run."],
    ["Position sizing", "How much you put into each trade. It often matters more than entries: the same signals can blow up or compound depending on size."],
    ["Kelly criterion", "A formula for the bet size that maximizes long-run growth given your edge. Full Kelly is very volatile; traders usually use a fraction of it."],
    ["Stop loss", "A pre-set exit if the trade goes against you. It caps the loss on any single trade, but stops set too tight get hit by normal noise."],
    ["Trailing stop", "A stop that moves up as price rises (for a long), locking in gains while letting winners run. It never moves back down."],
    ["Relative volume (RVOL)", "Today's volume compared with the normal volume for this time of day. High RVOL means unusual interest — a key filter for 'stocks in play'."],
    ["Float", "The shares actually available to trade. Low-float stocks can move violently on news because there's little supply."],
    ["Short interest", "The share of a stock's float sold short. High short interest can fuel a squeeze if price rises and shorts rush to buy back."],
    ["Gamma", "How fast an option's delta changes as the stock moves. Near expiration, gamma is huge — small moves swing short-dated options wildly."],
    ["Open interest", "The number of option contracts currently open. Big open interest at a strike can act like a magnet or a wall near expiration."],
    ["Credit spread", "Selling one option and buying a further-out one for protection, collecting a net premium. You profit if price stays away from the short strike; loss is capped."],
    ["Debit spread", "Buying one option and selling a further-out one to cut the cost. Cheaper than a single option, but the profit is capped."],
    ["Beta", "How much a stock tends to move relative to the market. A beta of 2 means it typically moves about twice as much as the S&P 500."],
    ["Correlation", "How closely two assets move together, from −1 to +1. Strategies that are uncorrelated smooth out a portfolio's swings when combined."],
    ["CAGR", "Compound annual growth rate: the steady yearly return that would turn the starting value into the ending value. It's how strategies are compared fairly over different lengths of time."],
    ["Risk-off / risk-on", "Market moods. Risk-on: money flows into stocks and growth. Risk-off: it flees to bonds, cash and safe havens."],
    ["Fed funds rate", "The interest rate the Federal Reserve targets for overnight bank lending. Changes ripple into every other rate and move growth stocks hard."],
    ["CPI", "The Consumer Price Index, the main US inflation report. A hotter-than-expected print can hit stocks because it raises the odds of higher rates."],
    ["Nonfarm payrolls", "The monthly count of US jobs added, released in the jobs report on the first Friday of most months. Big surprises move rates and stocks at 8:30 AM."],
    ["Pre-market", "Trading before the 9:30 AM open (from 4 AM ET). Volume is thin, so moves can be misleading, but it shows how news is being priced."],
    ["Market breadth", "How many stocks are participating in a move. An index rising on a handful of mega-caps while most stocks fall is a weak, narrow rally."],
    ["Volatility clustering", "Big moves tend to follow big moves, and calm follows calm. It's why VIX spikes come in bunches."],
    ["VIX", "The market's 'fear gauge': expected S&P 500 volatility over the next 30 days, from option prices. Above about 30 usually means stress; below 15 is calm."]
  ];
  var FACTS = [
    "Octopuses have three hearts and blue blood.",
    "A day on Venus is longer than its year.",
    "Honey found in ancient Egyptian tombs was still edible.",
    "Bananas are berries, but strawberries aren't.",
    "There are more possible chess games than atoms in the observable universe.",
    "Sharks existed before trees.",
    "Wombat droppings are cube-shaped.",
    "The Eiffel Tower can grow about 15 cm taller in summer as the metal expands.",
    "A bolt of lightning is about five times hotter than the surface of the Sun.",
    "Sloths can hold their breath longer than dolphins — up to about 40 minutes.",
    "The first computer 'bug' was a real moth found in a Harvard relay in 1947.",
    "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid."
  ];

  /* ---------------- live free feeds ---------------- */
  function wikiDay(kind) {
    var now = new Date(), key = dayKey(now);
    var c = cache[kind];
    if (c && c.date === key && c.items && c.items.length) return Promise.resolve(c.items);
    var url = kind === "otd"
      ? "https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/" + pad(now.getMonth() + 1) + "/" + pad(now.getDate())
      : "https://en.wikipedia.org/api/rest_v1/feed/featured/" + now.getFullYear() + "/" + pad(now.getMonth() + 1) + "/" + pad(now.getDate());
    return getJSON(url).then(function (d) {
      var items = [];
      if (kind === "otd") {
        var sel = (d.selected || []).filter(function (e) { return e && e.text && e.year; });
        var h = hashStr(key);
        for (var i = 0; i < Math.min(2, sel.length); i++) {
          var e = sel[(h + i * 7) % sel.length];
          var pg = e.pages && e.pages[0], link = pg && pg.content_urls && pg.content_urls.mobile && pg.content_urls.mobile.page;
          items.push({ year: e.year, text: str(e.text, 300), url: safeUrl(link) });
        }
      } else {
        var dv = document.createElement("div");
        (d.news || []).slice(0, 4).forEach(function (n) {
          dv.innerHTML = String(n.story || "").replace(/<script[\s\S]*?<\/script>/gi, "");
          var t = str(dv.textContent, 260);
          if (t) items.push({ text: t });
        });
      }
      cache[kind] = { date: key, items: items }; saveCache();
      return items;
    }).catch(function () { return c && c.items ? c.items : []; });
  }
  function freeFact() {
    var key = dayKey(new Date()), c = cache.fact;
    if (c && c.date === key && c.text) return Promise.resolve(c.text);
    return getJSON("https://uselessfacts.jsph.pl/api/v2/facts/today?language=en").then(function (d) {
      var t = str(d && d.text, 300);
      if (!t) throw new Error("empty");
      cache.fact = { date: key, text: t }; saveCache();
      return t;
    }).catch(function () { return FACTS[hashStr(key) % FACTS.length]; });
  }

  /* ---------------- repo data (validated) ---------------- */
  function cleanMarket(d) {
    if (!d || !Array.isArray(d.quotes)) return null;
    var q = d.quotes.filter(function (x) { return x && typeof x.symbol === "string" && isFinite(+x.price) && isFinite(+x.change_pct); }).slice(0, 12)
      .map(function (x) { return { symbol: str(x.symbol, 8), price: +x.price, change: +x.change || 0, pct: +x.change_pct }; });
    var e = (Array.isArray(d.earnings) ? d.earnings : []).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.date); }).slice(0, 20)
      .map(function (x) { return { symbol: str(x.symbol, 8), date: x.date, when: str(x.when, 20) }; });
    return { updated: str(d.updated, 40), quotes: q, earnings: e };
  }
  function cleanBrief(d) {
    if (!d || typeof d !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) return null;
    var b = { date: d.date, written: str(d.written_at, 40), note: str(d.market_note, 500), headlines: [], pulse: [], fact: null, term: null, earnings: [] };
    (Array.isArray(d.headlines) ? d.headlines : []).slice(0, 5).forEach(function (h) {
      var t = str(h && h.title, 140); if (t) b.headlines.push({ title: t, why: str(h.why, 200), url: safeUrl(h.url) });
    });
    (Array.isArray(d.x_pulse) ? d.x_pulse : []).slice(0, 3).forEach(function (p) { var t = str(p, 200); if (t) b.pulse.push(t); });
    if (d.fact && str(d.fact.text, 320)) b.fact = { text: str(d.fact.text, 320), source: str(d.fact.source, 80) };
    if (d.term && str(d.term.name, 50) && str(d.term.explain, 400)) b.term = { name: str(d.term.name, 50), explain: str(d.term.explain, 400), example: str(d.term.example, 240) };
    (Array.isArray(d.earnings) ? d.earnings : []).slice(0, 10).forEach(function (x) {
      if (x && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && str(x.symbol, 8)) b.earnings.push({ symbol: str(x.symbol, 8).toUpperCase(), date: x.date, when: str(x.when, 20) });
    });
    return b;
  }

  /* ---------------- render ---------------- */
  function block(title, cls) {
    var b = el("div", "in-block" + (cls ? " " + cls : ""));
    if (title) b.appendChild(el("div", "in-h", title));
    return b;
  }
  function render() {
    var now = new Date(), today = dayKey(now);
    var mk = cleanMarket(cache.market && cache.market.data);
    var br = cleanBrief(cache.brief && cache.brief.data);
    var briefAge = br ? Math.round((parseDay(today) - parseDay(br.date)) / dayMs) : null;
    if (br && briefAge > 2) br = null; /* older than 2 days: too stale to show */
    var econ = (cache.econ && cache.econ.data && Array.isArray(cache.econ.data.events)) ? cache.econ.data.events : [];

    var frag = document.createDocumentFragment();
    frag.appendChild(el("div", "s-name", "Daily Intel"));
    var stateTxt = shortDate(now) + (br ? (briefAge === 0 ? " · Brief " + (br.written ? ago(br.written) : "in") : " · Brief from " + shortDate(parseDay(br.date))) : " · Brief not in yet");
    frag.appendChild(el("div", "s-state", stateTxt));

    /* markets */
    var ms = marketStatus(now);
    var mb = block("Markets", "in-market");
    mb.appendChild(el("div", "in-mstat " + ms.state, ms.text));
    if (mk && mk.quotes.length) {
      var grid = el("div", "in-quotes");
      mk.quotes.forEach(function (q) {
        var c = el("div", "in-q " + (q.pct > 0 ? "up" : q.pct < 0 ? "dn" : "flat"));
        c.appendChild(el("span", "s", q.symbol));
        c.appendChild(el("span", "p", q.symbol === "VIX" ? q.price.toFixed(2) : "$" + q.price.toFixed(2)));
        c.appendChild(el("span", "c", (q.pct > 0 ? "+" : "") + q.pct.toFixed(2) + "%"));
        grid.appendChild(c);
      });
      mb.appendChild(grid);
      mb.appendChild(el("div", "in-meta", "Delayed quotes · updated " + (ago(mk.updated) || "—")));
    } else {
      mb.appendChild(el("div", "in-empty", "Quotes appear once the market job has run."));
    }
    if (br && br.note) { var nt = el("p", "in-note", br.note); mb.appendChild(nt); }
    frag.appendChild(mb);

    /* calendar: econ events + earnings over the next 7 days */
    var horizon = dayKey(new Date(now.getTime() + 7 * dayMs)), cal = [];
    econ.forEach(function (e) { if (e && e.date >= today && e.date <= horizon) cal.push({ date: e.date, time: e.time, text: str(e.name, 60), kind: "econ" }); });
    var seen = {};
    (mk ? mk.earnings : []).concat(br ? br.earnings : []).forEach(function (e) {
      var k = e.symbol + e.date; if (seen[k] || e.date < today || e.date > horizon) return; seen[k] = 1;
      cal.push({ date: e.date, time: null, text: e.symbol + " earnings" + (e.when && e.when !== "unknown" ? " · " + e.when : ""), kind: "earn" });
    });
    cal.sort(function (a, b) { return (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")); });
    var nextBig = null;
    if (!cal.length) econ.forEach(function (e) { if (!nextBig && e && e.date > today) nextBig = e; });
    var cb = block("This week");
    if (cal.length) {
      cal.forEach(function (c) {
        var r = el("div", "in-cal" + (c.date === today ? " today" : ""));
        r.appendChild(el("span", "d", c.date === today ? "Today" : shortDate(parseDay(c.date))));
        r.appendChild(el("span", "t", c.text + (c.time ? " · " + clock24(c.time) : "")));
        cb.appendChild(r);
      });
    } else {
      cb.appendChild(el("div", "in-empty", nextBig ? "No big releases this week. Next: " + str(nextBig.name, 60) + " · " + shortDate(parseDay(nextBig.date)) : "No big releases this week."));
    }
    frag.appendChild(cb);

    /* the bot's headlines + X pulse */
    if (br && br.headlines.length) {
      var hb = block("Headlines");
      br.headlines.forEach(function (h) {
        var r = el("div", "in-hl");
        var t = h.url ? el("a", "t", h.title) : el("span", "t", h.title);
        if (h.url) { t.href = h.url; t.target = "_blank"; t.rel = "noopener noreferrer"; }
        r.appendChild(t);
        if (h.why) r.appendChild(el("span", "w", h.why));
        hb.appendChild(r);
      });
      frag.appendChild(hb);
    }
    if (br && br.pulse.length) {
      var pb = block("X pulse");
      br.pulse.forEach(function (p) { pb.appendChild(el("div", "in-pulse", p)); });
      frag.appendChild(pb);
    }

    /* fact + trading term */
    var fb = block("Fact of the day", "in-fact");
    var factText = el("p", "in-big", br && br.fact ? br.fact.text : (cache._freeFact || "…"));
    fb.appendChild(factText);
    if (br && br.fact && br.fact.source) fb.appendChild(el("div", "in-meta", "Source: " + br.fact.source));
    frag.appendChild(fb);

    var term = br && br.term ? br.term : (function () { var t = TERMS[hashStr("term" + today) % TERMS.length]; return { name: t[0], explain: t[1], example: "" }; })();
    var tb = block("Trading term", "in-term");
    tb.appendChild(el("div", "in-tname", term.name));
    tb.appendChild(el("p", "in-txt", term.explain));
    if (term.example) tb.appendChild(el("p", "in-ex", "Example: " + term.example));
    frag.appendChild(tb);

    /* Wikipedia: on this day + world news */
    var otd = (cache.otd && cache.otd.date === today) ? cache.otd.items : null;
    if (otd && otd.length) {
      var ob2 = block("On this day");
      otd.forEach(function (o) {
        var r = el("div", "in-otd");
        r.appendChild(el("span", "y", String(o.year)));
        var t = o.url ? el("a", "t", o.text) : el("span", "t", o.text);
        if (o.url) { t.href = o.url; t.target = "_blank"; t.rel = "noopener noreferrer"; }
        r.appendChild(t);
        ob2.appendChild(r);
      });
      frag.appendChild(ob2);
    }
    var news = (cache.news && cache.news.items) || null;
    if (news && news.length) {
      var wb = block("World");
      news.slice(0, 3).forEach(function (n) { wb.appendChild(el("div", "in-pulse", n.text)); });
      frag.appendChild(wb);
    }

    /* sky + year */
    var st = sunTimes(now), mo = moon(now);
    var sky = block("Sky · Louisville", "in-sky");
    var row = el("div", "in-skyrow");
    var sun = el("div", "in-sun");
    sun.appendChild(el("span", "k", "Sunrise")); sun.appendChild(el("b", null, clock(st.rise)));
    sun.appendChild(el("span", "k", "Sunset")); sun.appendChild(el("b", null, clock(st.set)));
    sun.appendChild(el("span", "k", "Daylight")); sun.appendChild(el("b", null, dur(st.set - st.rise)));
    row.appendChild(sun);
    var mn = el("div", "in-moonbox");
    mn.innerHTML = moonSVG(mo);
    mn.appendChild(el("span", "n", mo.name));
    mn.appendChild(el("span", "k", Math.round(mo.frac * 100) + "% lit"));
    row.appendChild(mn);
    sky.appendChild(row);
    var y0 = new Date(now.getFullYear(), 0, 1), y1 = new Date(now.getFullYear() + 1, 0, 1);
    var yp = (now - y0) / (y1 - y0);
    var yr = el("div", "in-year");
    yr.appendChild(el("span", "k", now.getFullYear() + " · " + Math.floor(yp * 100) + "% done · " + Math.ceil((y1 - now) / dayMs) + " days left"));
    var bar = el("div", "w-bar-shell"), tr = el("div", "w-bar-track"), fi = el("div", "w-bar-fill");
    fi.style.width = (yp * 100).toFixed(1) + "%"; tr.appendChild(fi); bar.appendChild(tr); yr.appendChild(bar);
    sky.appendChild(yr);
    frag.appendChild(sky);

    frag.appendChild(el("div", "in-foot mono", "Quotes: Yahoo / Stooq via GitHub job · Brief: Grok bot · Events: Fed + BLS schedules · Wikipedia"));

    /* blocks cascade in only on the render that opens the panel;
       later refreshes swap content quietly */
    body.classList.toggle("in-quiet", !animateNext);
    animateNext = false;
    body.textContent = "";
    body.appendChild(frag);
    paintTile(mk);
  }
  function paintTile(mk) {
    if (!tileState) return;
    var mk2 = mk || cleanMarket(cache.market && cache.market.data);
    if (mk2 && mk2.quotes.length) {
      var parts = mk2.quotes.filter(function (q) { return q.symbol === "SPY" || q.symbol === "QQQ" || q.symbol === "TSLA"; }).slice(0, 3);
      tileState.textContent = parts.map(function (q) { return q.symbol + " " + (q.pct > 0 ? "+" : "") + q.pct.toFixed(1) + "%"; }).join(" · ");
    } else {
      tileState.textContent = "Markets · Brief · Facts";
    }
  }

  /* ---------------- loading ---------------- */
  var loading = false, lastLoad = 0, animateNext = true;
  function load(force) {
    if (loading || (!force && Date.now() - lastLoad < 120000)) { render(); return; }
    loading = true; lastLoad = Date.now();
    render();
    var jobs = [
      repoJSON("market.json").then(function (d) { if (cleanMarket(d)) cache.market = { at: Date.now(), data: d }; }).catch(function () {}),
      repoJSON("brief.json").then(function (d) { if (cleanBrief(d)) cache.brief = { at: Date.now(), data: d }; }).catch(function () {}),
      repoJSON("econ.json").then(function (d) { if (d && Array.isArray(d.events)) cache.econ = { at: Date.now(), data: d }; }).catch(function () {}),
      wikiDay("otd"), wikiDay("news"),
      freeFact().then(function (t) { cache._freeFact = t; })
    ];
    Promise.all(jobs.map(function (p) { return p.catch(function () {}); })).then(function () {
      saveCache(); loading = false; render();
    });
  }
  window.__intelLoad = load;

  /* open: refresh; while open, the market clock ticks every minute and
     data refreshes every 5 minutes; coming back to the app refreshes too */
  var tile = document.querySelector('.tab-tile[data-section="intel"]');
  if (tile) tile.addEventListener("click", function () { animateNext = true; load(false); });
  setInterval(function () {
    if (sec.classList.contains("is-hidden") || document.hidden) return;
    if (Date.now() - lastLoad > 300000) load(true); else render();
  }, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) load(false); });
  paintTile();
  setTimeout(function () { load(true); }, 1500);
})();
