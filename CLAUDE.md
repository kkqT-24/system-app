# system-app notes for Claude

- Claude's version lives in `claude/` (Muse's original is the root `index.html` — don't touch it unless asked).
- **Bump the version on every update the user will see:** change the footer label in `claude/index.html`
  (`<span id="appVersion">Core vX.Y</span>`) and set the cache name in `claude/sw.js` to match
  (`var CACHE = "system-vX.Y";`). Small changes bump the minor number (v2.1 → v2.2); big features
  can bump the major. Tell the user the new number when you finish.
- Saves live in the browser (`systemApp.v1`, `systemApp.v2`). Home-screen web app storage is separate
  from Safari's, and deleting the home-screen icon deletes its save.
