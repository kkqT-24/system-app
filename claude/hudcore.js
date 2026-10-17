/* ==========================================================
   BOOT CORE — tactical HUD (Claude build, Core v3.1).
   Replaces the boot core's old rings with a thin, precise HUD:
   a degree-tick scale with cardinal markers, a progress arc that
   fills with the load, rotating segmented arcs, a radar sweep over
   a faint hex grid, and small readouts in the corners.
   The percentage and its label stay as DOM text (the boot script
   drives and glitches them); this only draws around them. It reads
   the boot's own state classes (armed, spinup, holdspin*) so the
   hold-to-spin and the entry still work exactly as before.
   ========================================================== */
(function () {
  "use strict";
  var hud = document.getElementById("hud"), wrap = hud && hud.querySelector(".hud-breathe"), boot = document.getElementById("boot");
  if (!hud || !wrap) return;
  hud.classList.add("tac");
  var cv = document.createElement("canvas"); cv.className = "hud-tac"; cv.setAttribute("aria-hidden", "true");
  wrap.insertBefore(cv, wrap.firstChild);
  var g = cv.getContext("2d"), S = 300, dpr = 1, TAU = Math.PI * 2, spinA = 0, holdV = 0, last = 0, pct = 0, holdT0 = 0, ch = 0;
  var glow = boot ? boot.querySelector(".bg-glow") : null, gN = 0;
  var pctEl = document.getElementById("pctNum"), pctBox = hud.querySelector(".hud-pct"), verEl = document.getElementById("appVersion");
  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function size() { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = S * dpr; cv.height = S * dpr; }
  size(); addEventListener("resize", size);
  function rgba(h, a) { var n = parseInt(h.slice(1), 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }
  function arc(r, a0, a1, w, col, blur) { g.beginPath(); g.arc(150, 150, r, a0, a1); g.lineWidth = w; g.strokeStyle = col; if (blur) { g.shadowColor = col; g.shadowBlur = blur; } g.stroke(); g.shadowBlur = 0; }
  function txt(s, x, y, col, align) { g.font = "10px 'Share Tech Mono', monospace"; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y); }
  function draw(t) {
    var c = 150, armed = hud.classList.contains("armed"), br = 0.5 + 0.5 * Math.sin(t * 1.6);
    var n = parseInt(pctEl && pctEl.textContent, 10); if (!isNaN(n)) pct = Math.max(0, Math.min(100, n));
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
    /* near full charge the whole HUD hums with a fine shake */
    if (ch > 0.75) { var j = (ch - 0.75) * 6; g.translate((Math.random() - 0.5) * j, (Math.random() - 0.5) * j); }
    /* corner readouts */
    txt(((verEl && verEl.textContent) || "Core").toUpperCase(), 14, 24, rgba("#aca9e8", 0.7), "left");
    txt("SYNC " + String(Math.round(pct)).padStart(3, "0"), 286, 24, rgba("#aca9e8", 0.7), "right");
    txt("38.25N 85.76W", 14, 276, rgba("#7673b8", 0.8), "left");
    if (ch > 0.02) txt("CHARGE " + String(Math.round(ch * 100)).padStart(3, "0"), 286, 276, rgba("#e9e3ff", 0.7 + 0.3 * Math.random() * ch), "right");
    else txt(armed ? "STANDBY" : "LOADING", 286, 276, armed ? rgba("#c3b8fe", 0.6 + 0.4 * br) : rgba("#7673b8", 0.8), "right");
    /* degree scale */
    g.save(); g.translate(c, c); g.rotate(spinA * 0.08);
    for (var i = 0; i < 180; i++) {
      var a = i / 180 * TAU, maj = i % 15 === 0, lit = ch > 0.02 && i < ch * 180, len = maj ? 7 : lit ? 5 : 3;
      g.strokeStyle = lit ? rgba(maj ? "#ffffff" : "#e9e3ff", 0.75 + 0.25 * ch) : maj ? rgba("#c3b8fe", 0.75) : rgba("#8f5ef8", 0.35); g.lineWidth = maj ? 1.2 : lit ? 1.1 : 0.8;
      g.beginPath(); g.moveTo(Math.cos(a) * 134, Math.sin(a) * 134); g.lineTo(Math.cos(a) * (134 - len), Math.sin(a) * (134 - len)); g.stroke();
    }
    g.restore();
    for (var k = 0; k < 4; k++) {
      var ca = k * Math.PI / 2 - Math.PI / 2; g.save(); g.translate(c + Math.cos(ca) * 142, c + Math.sin(ca) * 142); g.rotate(ca + Math.PI / 2);
      g.fillStyle = rgba("#c3b8fe", 0.8); g.beginPath(); g.moveTo(0, 4); g.lineTo(-3.5, -2); g.lineTo(3.5, -2); g.closePath(); g.fill(); g.restore();
    }
    arc(120, 0, TAU, 0.8 + ch * 1.4, rgba(ch > 0.02 ? "#c3b8fe" : "#8f5ef8", 0.28 + ch * 0.6), ch * 18);
    /* progress arc */
    var pa = pct / 100 * TAU;
    arc(112, -Math.PI / 2, -Math.PI / 2 + pa, 3, rgba("#c3b8fe", armed ? 0.75 + 0.25 * br : 0.95), 10 + (armed ? br * 6 : 0) + holdV * 8 + ch * 22);
    if (!armed && pct > 0) { var ex = Math.cos(-Math.PI / 2 + pa) * 112 + c, ey = Math.sin(-Math.PI / 2 + pa) * 112 + c; g.fillStyle = "#fff"; g.shadowColor = "#c3b8fe"; g.shadowBlur = 10; g.beginPath(); g.arc(ex, ey, 2.4, 0, TAU); g.fill(); g.shadowBlur = 0; }
    /* segmented arcs, dashed ring, inner sweepers */
    for (var s = 0; s < 3; s++) { var a0 = spinA * 0.5 + s * TAU / 3; arc(100, a0, a0 + 0.7 + ch * 0.5, 2 + ch * 1.5, rgba(ch > 0.5 ? "#b48cff" : "#8f5ef8", 0.8 + ch * 0.2), 6 + ch * 14); arc(100, a0 + 0.78, a0 + 0.86, 2, rgba("#c3b8fe", 0.9)); }
    g.save(); g.setLineDash([2, 6]); arc(90, -spinA * 0.3, -spinA * 0.3 + TAU, 1, rgba("#c3b8fe", 0.4)); g.restore();
    for (var s2 = 0; s2 < 2; s2++) { var b0 = -spinA * 0.8 + s2 * Math.PI; arc(82, b0, b0 + 1.1, 1, rgba("#e9e3ff", 0.55)); }
    /* radar sweep */
    if (g.createConicGradient) {
      var cg = g.createConicGradient(spinA * 1.2, c, c);
      cg.addColorStop(0, rgba("#c3b8fe", 0.22 + holdV * 0.12 + ch * 0.45)); cg.addColorStop(0.12, rgba("#8f5ef8", 0)); cg.addColorStop(1, rgba("#8f5ef8", 0));
      g.fillStyle = cg; g.beginPath(); g.arc(c, c, 74, 0, TAU); g.fill();
    }
    arc(74, 0, TAU, 1 + ch, rgba("#c3b8fe", 0.35 + ch * 0.5), ch * 14);
    /* faint hex grid behind the readout */
    g.save(); g.beginPath(); g.arc(c, c, 72, 0, TAU); g.clip(); g.strokeStyle = rgba("#8f5ef8", 0.12 + ch * 0.3); g.lineWidth = 0.6;
    for (var hy = -4; hy <= 4; hy++) for (var hx = -4; hx <= 4; hx++) {
      var x = c + hx * 16 + (hy % 2 ? 8 : 0), y = c + hy * 14; g.beginPath();
      for (var v = 0; v < 6; v++) { var va = v / 6 * TAU + Math.PI / 6; g.lineTo(x + Math.cos(va) * 8, y + Math.sin(va) * 8); }
      g.closePath(); g.stroke();
    }
    g.restore();
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - last < 30) return;
    var k = last ? Math.min(4, (ts - last) / 16.667) : 1; last = ts;
    if (document.hidden || (boot && boot.classList.contains("is-hidden"))) return;
    /* keep the soft glow centered on the core (it moves during the boot's own animations) */
    if (glow && (++gN % 6 === 0)) { var hr = hud.getBoundingClientRect(), gr = glow.getBoundingClientRect(); if (gr.height) { glow.style.setProperty("--hud-x", (hr.left + hr.width / 2 - gr.left) + "px"); glow.style.setProperty("--hud-y", (hr.top + hr.height / 2 - gr.top) + "px"); } }
    var cl = hud.classList, target = cl.contains("holdspin3") ? 1 : cl.contains("holdspin2") ? 0.65 : cl.contains("holdspin") ? 0.35 : cl.contains("spinup") ? 0.5 : 0;
    holdV += (target - holdV) * (1 - Math.pow(0.9, k));
    /* hold charge: keeps building for ~2.6s (well past the last hold stage), eased in so it starts gentle and runs away at the end */
    var hc = 0;
    if (cl.contains("holdspin")) { if (!holdT0) holdT0 = ts; hc = Math.min(1, (ts - holdT0) / 2600); } else holdT0 = 0;
    ch += (hc - ch) * (1 - Math.pow(hc > ch ? 0.8 : 0.9, k));
    spinA += (0.02 + (cl.contains("armed") ? 0 : 0.01) + holdV * 0.08 + ch * ch * 0.42) * k;
    if (pctBox) pctBox.style.textShadow = ch > 0.02 ? "0 0 " + (12 + ch * 26).toFixed(1) + "px rgba(195,184,254," + (0.55 + ch * 0.4).toFixed(2) + ")" : "";
    draw(ts / 1000);
  }
  if (REDUCE) { draw(0); setInterval(function () { if (!(boot && boot.classList.contains("is-hidden"))) draw(0); }, 500); }
  else requestAnimationFrame(frame);
})();
