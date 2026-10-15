# Shadow knight (archived Oct 15, 2026)

Pixel-art knight made with Muse, kept for a possible future game. Not loaded by the app.

- `knight-parts-9.png`: 9 parts on one 576x64 sheet, each 64x64 in position. Order: cape, right arm, back leg,
  front leg, torso, head, left upper arm, left forearm, sword. Stacking all 9 recreates the still.
- `knight-idle-strip-256x64.png`: Muse's 4-frame breathing idle.
- `knight-rig.js`: canvas rig (`window.SystemHunter.start(canvas, opts)`): idle, walk, tap-to-strike, streaming shadow aura.
  The sword rides the right arm (shoulder pivot 17,25; grip 22,47).
- `rig-test.html`: standalone page with idle / walk / attack buttons.

Known rough spots: Muse's hidden-area fills are flat grey (visible on the hip mid-swing), and the left forearm hangs empty-handed during the strike.
