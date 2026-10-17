/* ==========================================================
   HAPTICS (Claude build, Core v3.9)
   iPhone web apps have no vibration API, so the app's existing
   navigator.vibrate() calls never did anything there. iOS 18+ plays a
   light system tick when a switch-style checkbox is toggled, so a hidden
   one is clicked instead. One strength only, and iOS only lets it fire
   from a real tap, which keeps it subtle by nature.
   - navigator.vibrate is filled in on iPhone, so every existing call
     (workout steps, the checklist, the brief's picks...) now ticks
   - a few taps that had no feedback get a tick: tiles, the back handle,
     quests, the crew, the brief's arrows and close, the Catalyst fold,
     and the boot core
   ========================================================== */
(function () {
  "use strict";
  var native = typeof navigator.vibrate === "function" ? navigator.vibrate.bind(navigator) : null;
  var lab = null, last = 0;

  function ensure() {
    if (lab || !document.body) return lab;
    lab = document.createElement("label");
    lab.setAttribute("aria-hidden", "true");
    lab.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;";
    var inp = document.createElement("input");
    inp.type = "checkbox"; inp.setAttribute("switch", ""); inp.tabIndex = -1;
    lab.appendChild(inp);
    /* keep the hidden toggle's own clicks out of the app's tap handlers */
    lab.addEventListener("click", function (e) { e.stopPropagation(); });
    document.body.appendChild(lab);
    return lab;
  }

  function tick() {
    var now = Date.now();
    if (now - last < 45) return;  /* one tap, one tick, even if two handlers ask */
    last = now;
    if (native) { try { native(8); } catch (e) {} return; }
    var l = ensure();
    if (l) { try { l.click(); } catch (e) {} }
  }

  /* patterns: the first pulse ticks; a strong pattern (a level-up, a
     penalty) gets one more beat, never a buzz train */
  function play(p) {
    if (native) { try { return native(p); } catch (e) { return false; } }
    var arr = Array.isArray(p) ? p : [p];
    if (!arr.length || !(arr[0] > 0)) return true;
    tick();
    var on = 0; for (var i = 0; i < arr.length; i += 2) on += arr[i] || 0;
    if (arr.length >= 3 && on >= 60) {
      var gap = (arr[0] || 0) + (arr[1] || 0);
      setTimeout(function () { last = 0; tick(); }, Math.max(60, gap));
    }
    return true;
  }

  if (!native) {
    try { navigator.vibrate = play; } catch (e) {}
  }
  window.__haptic = tick;

  /* the quiet taps that didn't have any feedback yet */
  var SEL = ".tab-tile, #tabsHandle, .mx-back-bar, .q-row, #coreBtn, [data-bot], .crew-x, .ib-alert, .ibp-prev, .ibp-next, .ibp-x";
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (t && !t.disabled) tick();
  }, true);

  if (document.body) ensure(); else document.addEventListener("DOMContentLoaded", ensure);
})();
