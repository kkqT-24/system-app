# Crew messages — how the home screen characters get their lines

The home screen (Core v3.0) has three characters with one shared conversation:

| Character | Who writes | File |
|---|---|---|
| Grok (gbot) | the Daily Briefing bot | `brief.json` (see `BRIEF_FORMAT.md`) — gbot speaks `gbot.say` and the trending items |
| Claude | Claude | `claude.json` |
| Noctis | Muse | `noctis.json` |

Each writer edits **only its own file**, so nobody overwrites anyone.

## Format (`claude.json`, `noctis.json`)

```json
{
  "messages": [
    { "id": "2026-10-16-1", "time": "2026-10-16T21:40:00-04:00", "text": "One or two short sentences." }
  ]
}
```

- Append new messages to the end; keep the last 20.
- `id` must be unique and never reused — a new `id` is what makes the app post it
  (and, for Noctis, wakes him up).
- `time`: Eastern time with the offset.
- `text`: one or two short sentences; it shows in a chat bubble.
- Claude's messages only post on the day they were written. Noctis's post whenever they're new.
- Optional `"attn": true` on a message puts a **!** on that character until Kent sees it
  (Noctis: until he taps Noctis; Claude: once the line has posted on home). Claude's lines go
  through `protocol.py say "..." [--attn]`. Use it only for
  something he actually needs to act on.
- The app checks both files on open, when it comes back to the foreground, and every 5 minutes.

## Claude's Morning Protocol (`protocol.json`)

Tapping Claude opens the Morning Protocol: a health check on everything running in the
background, plus Kent's to-do list. The item list lives in the app (crew.js `WEEKDAY`); this file
only carries results. Write it with `claude/tools/protocol.py`, never by hand.

| id | Checked by | When |
|---|---|---|
| brief, market, desk | the app itself (brief.json, market.json, desk.json timestamps) | live |
| mac, ibkr, noise, lev200 | Claude's Mac check | 9:50 weekdays |
| lines, paper | Claude's log check (Daily Chart Logs `mylines` / `trades` with `paper: true`) | 10:20 and 12:20 |
| bars | the Daily Chart Logs Update task | 4:30 |

```json
{ "version": 1, "date": "2026-10-19", "holiday": false,
  "checks": { "ibkr": { "s": "fail", "note": "gateway not logged in", "at": "09:51" } },
  "todo": [ { "id": "t20261017-1", "text": "Something Kent needs to do", "added": "2026-10-17", "by": "2026-10-20" } ] }
```

- `s`: ok, warn, fail, action (Kent has something to do), missing (his part isn't logged yet).
- No result by an item's deadline shows as "the check didn't report", so a task that silently
  stops running still gets a **!**.
- Weekends and holidays (`init --holiday`) show only the to-do list.
- To-dos persist until Kent ticks them (the tick is kept on his phone); `todo done <id>` removes one.
- Morning items all clear (checked or marked handled) = +5 EXP once a day.
- The repo is public: notes hold states, times and percentages only.

## The other "!" marks

- Claude: a protocol item is off (fail, action, missing, or a check that didn't report), or a flagged line.
- Grok: today's Daily Briefing is out, it's 10 AM or later, and it hasn't been opened today.
