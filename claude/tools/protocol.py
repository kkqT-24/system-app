"""Morning Protocol status writer for the System app (Claude's scheduled checks use this).

Writes claude/data/protocol.json (today's check results + Kent's to-do list) and appends
Claude's chat lines to claude/data/claude.json. The repo is PUBLIC: notes are short and
hold percentages, times and states only, never dollar amounts, balances or share counts.

usage (run from the repo root):
  python3 claude/tools/protocol.py init [--holiday]          start today's checks (keeps the to-do list)
  python3 claude/tools/protocol.py set <id> <status> "note"   status: ok | warn | fail | action | missing
  python3 claude/tools/protocol.py say "line" [--attn]        post a line from Claude (--attn puts a ! on him)
  python3 claude/tools/protocol.py todo add "text" [--by YYYY-MM-DD]
  python3 claude/tools/protocol.py todo done <id>
  python3 claude/tools/protocol.py show

check ids: mac, ibkr, noise, lev200, lines, paper, bars   (brief, market and desk are checked by the app itself)
"""
import json, os, sys
from datetime import datetime
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
PROTO = os.path.join(DATA, "protocol.json")
CLAUDE = os.path.join(DATA, "claude.json")
CHECKS = {"mac", "ibkr", "noise", "lev200", "lines", "paper", "bars"}
STATUS = {"ok", "warn", "fail", "action", "missing"}


def now():
    return datetime.now(ET)


def load(p, empty):
    try:
        with open(p) as f:
            return json.load(f)
    except (OSError, ValueError):
        return empty


def dump(p, obj):
    tmp = p + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, p)


def proto():
    d = load(PROTO, {})
    d.setdefault("version", 1)
    d.setdefault("todo", [])
    if d.get("date") != now().strftime("%Y-%m-%d"):
        d["date"] = now().strftime("%Y-%m-%d")
        d["holiday"] = False
        d["checks"] = {}
    d.setdefault("checks", {})
    return d


def clip(s, n=110):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


def main(a):
    if not a:
        print(__doc__)
        return 1
    cmd = a[0]
    if cmd == "init":
        d = proto()
        d["checks"] = {}
        d["holiday"] = "--holiday" in a
        d["updated"] = now().isoformat(timespec="seconds")
        dump(PROTO, d)
        print("protocol: %s started%s, %d to-do" % (d["date"], " (holiday)" if d["holiday"] else "", len(d["todo"])))
    elif cmd == "set":
        if len(a) < 4 or a[1] not in CHECKS or a[2] not in STATUS:
            print("set <%s> <%s> \"note\"" % ("|".join(sorted(CHECKS)), "|".join(sorted(STATUS))))
            return 1
        d = proto()
        d["checks"][a[1]] = {"s": a[2], "note": clip(a[3]), "at": now().strftime("%H:%M")}
        d["updated"] = now().isoformat(timespec="seconds")
        dump(PROTO, d)
        print("protocol: %s = %s (%s)" % (a[1], a[2], clip(a[3])))
    elif cmd == "say":
        if len(a) < 2:
            return 1
        c = load(CLAUDE, {"messages": []})
        msgs = c.setdefault("messages", [])
        day = now().strftime("%Y-%m-%d")
        n = 1 + sum(1 for m in msgs if str(m.get("id", "")).startswith(day + "-"))
        ids = {m.get("id") for m in msgs}
        while "%s-%d" % (day, n) in ids:
            n += 1
        m = {"id": "%s-%d" % (day, n), "time": now().isoformat(timespec="seconds"), "text": clip(a[1], 220)}
        if "--attn" in a:
            m["attn"] = True
        msgs.append(m)
        c["messages"] = msgs[-20:]
        dump(CLAUDE, c)
        print("claude.json: posted %s%s" % (m["id"], " (attn)" if m.get("attn") else ""))
    elif cmd == "todo" and len(a) >= 3 and a[1] == "add":
        d = proto()
        day = now().strftime("%Y-%m-%d")
        ids = {t["id"] for t in d["todo"]}
        n = 1
        while "t%s-%d" % (day.replace("-", ""), n) in ids:
            n += 1
        t = {"id": "t%s-%d" % (day.replace("-", ""), n), "text": clip(a[2]), "added": day}
        if "--by" in a and a.index("--by") + 1 < len(a):
            t["by"] = a[a.index("--by") + 1]
        d["todo"].append(t)
        d["todo"] = d["todo"][-15:]
        dump(PROTO, d)
        print("protocol: to-do %s added" % t["id"])
    elif cmd == "todo" and len(a) >= 3 and a[1] == "done":
        d = proto()
        d["todo"] = [t for t in d["todo"] if t["id"] != a[2]]
        dump(PROTO, d)
        print("protocol: to-do %s removed" % a[2])
    elif cmd == "show":
        print(json.dumps(proto(), indent=1))
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
