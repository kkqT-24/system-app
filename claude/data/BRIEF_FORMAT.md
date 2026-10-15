# Daily Intel brief — instructions for the Grok bot

Every weekday morning, **before 8:30 AM Eastern**, write the day's brief to:

```
claude/data/brief.json
```

in the repo `kkqT-24/system-app` (branch `main`). Replace the whole file each day.
Weekends are optional; if you skip a day the app shows the last brief, labeled with its date.

## Rules

- **Touch only `claude/data/brief.json`.** Never edit any other file in the repo.
- The file must be valid JSON matching the format below. If it doesn't parse, the app ignores it.
- Plain text only — no Markdown, no HTML, no emoji spam. The app does its own styling.
- **Accuracy over flair.** Don't state prices or index levels (the app gets real quotes elsewhere).
  Only include an earnings date you have confirmed from the company or a reliable calendar.
- Keep to the length limits; anything longer is cut off.
- Commit message: `Daily Intel brief YYYY-MM-DD`

## Format

```json
{
  "version": 1,
  "date": "2026-10-16",
  "written_at": "2026-10-16T07:05:00-04:00",
  "market_note": "2–3 sentences: what matters for today's session and why. Max 500 characters.",
  "headlines": [
    {
      "title": "Market-moving headline. Max 140 characters.",
      "why": "One line on why it matters for SPY / QQQ / TSLA. Max 200 characters.",
      "url": "https://link-to-the-source (optional, must start with https://)"
    }
  ],
  "x_pulse": [
    "What traders on X are focused on this morning. Max 200 characters each, up to 3."
  ],
  "fact": {
    "text": "A genuinely interesting, TRUE fact on any topic (science, history, space, cars, animals...). Max 320 characters.",
    "source": "Where it comes from (optional, max 80 characters)"
  },
  "term": {
    "name": "A trading/investing term, max 50 characters",
    "explain": "Plain-English explanation for someone still learning. Max 400 characters.",
    "example": "A short concrete example (optional, max 240 characters)"
  },
  "earnings": [
    { "symbol": "TSLA", "date": "2026-10-21", "when": "after close" }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `version` | yes | Always `1` |
| `date` | yes | Today, `YYYY-MM-DD`, Eastern time |
| `written_at` | yes | ISO time with offset |
| `market_note` | yes | 2–3 sentences |
| `headlines` | yes | 3–5 items, market-relevant |
| `x_pulse` | optional | Up to 3 items |
| `fact` | yes | Don't repeat a fact from the last 60 days |
| `term` | yes | Don't repeat a term from the last 60 days; vary basics and advanced |
| `earnings` | optional | Next 7 days only, for TSLA, NVDA, AAPL, MSFT, GOOGL, AMZN, META, or anything big the market is watching. `when` is `before open`, `after close` or `unknown` |

Before committing, check: valid JSON, today's date, nothing outside `claude/data/brief.json` changed.
