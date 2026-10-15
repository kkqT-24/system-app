# system-app notes for Claude

- Claude's version lives in `claude/` (Muse's original is the root `index.html` — don't touch it unless asked).
- **Bump the version only for meaningful updates**: new features or fixes the user will notice. Tiny
  tweaks (a color, spacing, wording) ship without a bump. To bump, change the footer label in
  `claude/index.html` (`<span id="appVersion">Core vX.Y</span>`) and set the cache name in `claude/sw.js`
  to match (`var CACHE = "system-vX.Y";`) — the worker is network-first, so unbumped tweaks still load.
  Minor bump for normal updates (v2.1 → v2.2), major for big ones. Tell the user the new number.
- Saves live in the browser (`systemApp.v1`, `systemApp.v2`). Home-screen web app storage is separate
  from Safari's, and deleting the home-screen icon deletes its save.
