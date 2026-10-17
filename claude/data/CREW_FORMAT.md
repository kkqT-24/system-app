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
- The app checks both files on open, when it comes back to the foreground, and every 5 minutes.
