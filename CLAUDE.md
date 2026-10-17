# system-app notes for Claude

- Claude's version lives in `claude/` (Muse's original is the root `index.html` — don't touch it unless asked).
- **Bump the version only for meaningful updates**: new features or functional fixes. Small visual
  changes the user can see for himself (art tweaks, a color, spacing, wording) ship without a bump. To bump, change the version label in
  `claude/index.html` (`<span class="verse-ver" id="appVersion">Core vX.Y</span>`, under the verse) and set the cache name in `claude/sw.js`
  to match (`var CACHE = "system-vX.Y";`) — the worker is network-first, so unbumped tweaks still load.
  Also set the `?v=` on the css/js links in `claude/index.html` and `var V` in `claude/sw.js` to the new version — that
  busts the 10-minute GitHub Pages cache so the phone gets the new files at once.
  Minor bump for normal updates (v2.1 → v2.2), major for big ones. Tell the user the new number.
- Saves live in the browser (`systemApp.v1`, `systemApp.v2`). Home-screen web app storage is separate
  from Safari's, and deleting the home-screen icon deletes its save.
