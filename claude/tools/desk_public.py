"""Build claude/data/desk.json for the System app from the Trading Desk's
datasets. The repo is public, so this keeps percentages only: no dollar
amounts, share counts or account values ever leave the desk.

usage: python3 desk_public.py <noise_sessions.json> <noise_sleeve.json> <lev200_today.json> <risk_limits.json> <out desk.json>
"""
import json, sys
from datetime import datetime, timezone


def pct(x, nd=2):
    return None if x is None else round(float(x) * 100, nd)


def main(a):
    sessions = json.load(open(a[0]))
    sleeve = (json.load(open(a[1])) or [{}])[0]
    lev = (json.load(open(a[2])) or [{}])[0]
    limits = {r.get("strategy"): r for r in json.load(open(a[3]))}
    sessions = sorted([s for s in sessions if s.get("date")], key=lambda s: s["date"])
    start, eq = sleeve.get("sleeve_start"), sleeve.get("equity")
    traded = [s for s in sessions if s.get("traded") == "Y"]
    nl = limits.get("noise", {})
    ll = limits.get("lev200", {})
    last = sessions[-1] if sessions else {}
    out = {
        "version": 1,
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "noise": {
            "status": sleeve.get("status") or "",
            "first_session": sleeve.get("first_session") or (sessions[0]["date"] if sessions else None),
            "sessions": len(sessions),
            "traded_days": len(traded),
            "up_days": sum(1 for s in traded if (s.get("day_ret") or 0) > 0),
            "since_start_pct": pct(eq / start - 1) if start and eq else None,
            "dd_pct": pct(last.get("dd_from_peak")),
            "review_pct": pct(nl.get("review"), 0),
            "stop_pct": pct(nl.get("stop"), 0),
            "avg_gap_vs_backtest_pct": pct(sum(abs(s.get("gap") or 0) for s in traded) / len(traded), 3) if traded else None,
            "days": [{"date": s["date"], "traded": s.get("traded") == "Y", "ret_pct": pct(s.get("day_ret")),
                      "backtest_pct": pct(s.get("backtest_day_ret")), "sat_out": s.get("sit_reason") or ""} for s in sessions[-20:]],
        },
        "lev200": {
            "date": lev.get("date"), "state": lev.get("state"), "pct_vs_sma": pct(lev.get("pct_vs_sma")),
            "action": lev.get("action"), "review_pct": pct(ll.get("review"), 0), "stop_pct": pct(ll.get("stop"), 0),
        },
    }
    with open(a[4], "w") as f:
        json.dump(out, f, indent=1)
    print("desk.json: %d NOISE sessions through %s, LEV200 %s" % (len(sessions), last.get("date"), lev.get("state")))


if __name__ == "__main__":
    main(sys.argv[1:])
