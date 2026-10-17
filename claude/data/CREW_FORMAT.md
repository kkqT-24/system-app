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
  (Noctis: until he taps Noctis; Claude: once the line has posted on home). Use it only for
  something he actually needs to act on.
- The app checks both files on open, when it comes back to the foreground, and every 5 minutes.

## Claude's Morning Protocol (`claude.json` → `checklist`)

Tapping Claude opens the day's checklist. Ticking every item gives +5 EXP once a day.

```json
{
  "messages": [ ... ],
  "checklist": {
    "date": "2026-10-19",
    "title": "Morning Protocol",
    "items": [
      { "id": "noise", "text": "NOISE BOT session started", "by": "09:45" },
      { "id": "chart", "text": "Chart screenshot sent: lines and your read", "by": "10:00" }
    ]
  }
}
```

- Only used when `date` is today; otherwise the app shows its standing list
  (weekdays: NOISE start, chart screenshot, paper call, IBKR login for 4:30, LEV200; weekends: week review, next focus).
- `by` (24h, Eastern) is optional. Past it with the item unticked, Claude shows a **!**.
- Up to 10 items, text up to 120 characters. Ticks are kept on the phone per day, keyed by `id`.

## The other "!" marks

- Grok: today's Daily Briefing is out, it's 10 AM or later, and it hasn't been opened today.
