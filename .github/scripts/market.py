"""Fetch delayed quotes (and, with an optional Finnhub key, upcoming
earnings) for the Daily Intel module. Writes claude/data/market.json.
Standard library only. Each source is tried in turn; a ticker that no
source answers is left out rather than failing the whole run."""
import csv, io, json, os, sys, time, urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")


def ny_day(ts):
    return datetime.fromtimestamp(ts, timezone.utc).astimezone(NY).strftime("%Y-%m-%d")

# symbol shown in the app -> (yahoo symbol, stooq symbol, finnhub symbol)
WATCHLIST = [
    ("SPY", "SPY", "spy.us", "SPY"),
    ("QQQ", "QQQ", "qqq.us", "QQQ"),
    ("TSLA", "TSLA", "tsla.us", "TSLA"),
    ("QLD", "QLD", "qld.us", "QLD"),
    ("VIX", "^VIX", "^vix", None),
]
EARNINGS_SYMBOLS = ["TSLA", "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META"]
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "claude", "data", "market.json")
UA = {"User-Agent": "Mozilla/5.0 (system-app daily intel)"}
FINNHUB = os.environ.get("FINNHUB_KEY", "").strip()


def get(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def yahoo(sym):
    d = json.loads(get("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=5d&interval=1d" % urllib.request.quote(sym)))
    m = d["chart"]["result"][0]["meta"]
    price = float(m["regularMarketPrice"])
    t = m.get("regularMarketTime")
    res0 = d["chart"]["result"][0]
    ts0 = res0.get("timestamp") or []
    raw = res0["indicators"]["quote"][0].get("close") or []
    bars = [(ts0[i], raw[i]) for i in range(min(len(ts0), len(raw))) if raw[i] is not None]
    prev = None
    if len(bars) >= 2 and t:
        # during / after today's session the last daily bar is today, so the
        # bar before it is the prior close (its close lags the live price, so
        # match on the session date, not the price)
        if ny_day(bars[-1][0]) == ny_day(t) or abs(bars[-1][1] - price) < 1e-6:
            prev = bars[-2][1]
        else:
            prev = bars[-1][1]
    if prev is None:
        prev = m.get("previousClose") or m.get("chartPreviousClose")
    out = {"price": price, "prev": float(prev), "time": datetime.fromtimestamp(t, timezone.utc).isoformat() if t else None}
    # today's session bar (open / high / low) for the gap read
    try:
        res = d["chart"]["result"][0]; q = res["indicators"]["quote"][0]; ts = res["timestamp"]
        i = len(ts) - 1
        if t and ny_day(ts[i]) == ny_day(t) and None not in (q["open"][i], q["high"][i], q["low"][i]):
            out.update({"open": float(q["open"][i]), "high": float(q["high"][i]), "low": float(q["low"][i]), "session": ny_day(ts[i])})
    except Exception:  # noqa: BLE001
        pass
    return out


def stooq(sym):
    rows = list(csv.DictReader(io.StringIO(get("https://stooq.com/q/l/?s=%s&f=sd2t2ohlcvp&h&e=csv" % sym))))
    r = rows[0]
    price, prev = float(r["Close"]), float(r["Prev"]) if r.get("Prev") not in (None, "", "N/D") else None
    if prev is None:
        raise ValueError("no prev close")
    out = {"price": price, "prev": prev, "time": None}
    try:
        if r.get("Open") not in (None, "", "N/D"):
            out.update({"open": float(r["Open"]), "high": float(r["High"]), "low": float(r["Low"]), "session": r["Date"]})
    except Exception:  # noqa: BLE001
        pass
    return out


def finnhub(sym):
    if not FINNHUB or not sym:
        raise ValueError("no key")
    d = json.loads(get("https://finnhub.io/api/v1/quote?symbol=%s&token=%s" % (sym, FINNHUB)))
    if not d.get("c"):
        raise ValueError("empty")
    out = {"price": float(d["c"]), "prev": float(d["pc"]), "time": datetime.fromtimestamp(d["t"], timezone.utc).isoformat() if d.get("t") else None}
    if d.get("o") and d.get("t"):
        out.update({"open": float(d["o"]), "high": float(d["h"]), "low": float(d["l"]), "session": ny_day(d["t"])})
    return out


def quote(row):
    label, ysym, ssym, fsym = row
    for name, fn, s in (("yahoo", yahoo, ysym), ("finnhub", finnhub, fsym), ("stooq", stooq, ssym)):
        try:
            r = fn(s)
            price, prev = r["price"], r["prev"]
            if price <= 0 or prev <= 0:
                continue
            ch = price - prev
            out = {"symbol": label, "price": round(price, 2), "change": round(ch, 2),
                   "change_pct": round(ch / prev * 100, 2), "prev_close": round(prev, 2), "time": r["time"], "source": name}
            if r.get("open") and r.get("session"):
                out.update({"open": round(r["open"], 2), "high": round(r["high"], 2), "low": round(r["low"], 2), "session": r["session"]})
            return out
        except Exception as e:  # noqa: BLE001 - any failure falls through to the next source
            print("  %s via %s failed: %s" % (label, name, e), file=sys.stderr)
    return None


def earnings():
    if not FINNHUB:
        return []
    today = datetime.now(timezone.utc).date()
    out = []
    for s in EARNINGS_SYMBOLS:
        try:
            d = json.loads(get("https://finnhub.io/api/v1/calendar/earnings?from=%s&to=%s&symbol=%s&token=%s"
                               % (today, today + timedelta(days=45), s, FINNHUB)))
            for e in d.get("earningsCalendar") or []:
                when = {"bmo": "before open", "amc": "after close"}.get(e.get("hour"), "unknown")
                out.append({"symbol": s, "date": e["date"], "when": when})
            time.sleep(1.1)  # free tier: 60 calls / minute
        except Exception as e:  # noqa: BLE001
            print("  earnings %s failed: %s" % (s, e), file=sys.stderr)
    out.sort(key=lambda e: e["date"])
    return out


def main():
    quotes = [q for q in (quote(r) for r in WATCHLIST) if q]
    try:
        old = json.load(open(OUT))
    except Exception:  # noqa: BLE001
        old = {}
    if not quotes:
        print("no quotes from any source; keeping the old file", file=sys.stderr)
        return
    ern = earnings() if FINNHUB else old.get("earnings", [])
    data = {"version": 1, "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "quotes": quotes, "earnings": ern}
    # skip the write (and so the commit) when nothing but the timestamp moved
    if old and old.get("quotes") == quotes and old.get("earnings") == ern:
        print("unchanged")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, indent=1)
    print("wrote %d quotes, %d earnings" % (len(quotes), len(ern)))


if __name__ == "__main__":
    main()
