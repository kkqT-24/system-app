/* Hunter portrait for the Status window: the shadow knight (Muse's sprite,
   split into 9 parts) idles with a streaming shadow aura; tap him to strike.
   The sword rides his right arm (shoulder joint + wrist); the left arm rests. */
(function () {
  "use strict";
  var SRC = "data:image/png;base64,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";
  /* sheet order: 0 cape, 1 right arm, 2 back leg, 3 front leg, 4 torso,
     5 head, 6 left upper arm, 7 left forearm, 8 sword */
  var PIV = [[32, 18], [17, 25], [21, 44], [32, 44], [28, 48], [29, 19], [36, 29], [36, 29], [22, 47]];
  var SH = [17, 25], G = [22, 47], TIP = [42, 63];
  var UPPER = [1, 1, 0, 0, 1, 1, 1, 1, 1];
  var TAU = Math.PI * 2, U1 = 2.85, U2 = 0.4, D1 = 5.29, D2 = 0.68;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var sheet = new Image(), ready = false;
  sheet.onload = function () { ready = true; };
  sheet.src = SRC;
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function rot(v, a) { return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]; }

  /* start(canvas, {w, h, scale, x, y, visible()}) → controller {mode, strike()} */
  function start(cv, o) {
    var W = o.w, H = o.h, S = o.scale, MX = o.x, MY = o.y, OFF = 16;
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext("2d"); c.scale(dpr, dpr);
    var O = document.createElement("canvas"); O.width = 96; O.height = 96;
    var oc = O.getContext("2d", { willReadFrequently: true }); oc.imageSmoothingEnabled = false;
    var ctl = { mode: "idle", strike: function () { if (atk < 0) { atk = 0; trail = []; } } };
    var t = 0, atk = -1, parts = [], edges = [], lastEdges = [], trail = [];

    function pose() {
      var p = [], i; for (i = 0; i < 9; i++) p.push({ dx: 0, dy: 0, r: 0 });
      var ux = 0, uy = 0, a1 = 0, a2 = 0, lg = 0;
      if (atk >= 0) {
        var u = atk, k;
        if (u < 20) { k = ease(u / 20); a1 = U1 * k; a2 = U2 * k; ux = -1.5 * k; uy = -k; p[0].r = -0.06 * k; p[4].r = -0.05 * k; p[5].r = -0.05 * k; }
        else if (u < 26) { k = (u - 20) / 6; a1 = U1 + (D1 - U1) * k * k; a2 = U2 + (D2 - U2) * k; ux = -1.5 + 5.5 * k; uy = -1 + k; lg = k; p[4].r = -0.05 + 0.13 * k; p[5].r = -0.05 + 0.1 * k; }
        else if (u < 36) { a1 = D1 - TAU; a2 = D2; ux = 4; lg = 1; p[4].r = 0.08; p[5].r = 0.05; }
        else { k = ease(Math.min(1, (u - 36) / 24)); a1 = (D1 - TAU) * (1 - k); a2 = D2 * (1 - k); ux = 4 * (1 - k); lg = 1 - k; p[4].r = 0.08 * (1 - k); p[5].r = 0.05 * (1 - k); }
        p[3].r = -0.15 * lg; p[2].r = 0.22 * lg; p[0].r += 0.08 * lg;
      } else if (ctl.mode === "walk") {
        var ph = t * 0.16, s = Math.sin(ph);
        p[2].r = s * 0.38; p[3].r = -s * 0.38; uy = -Math.round(Math.abs(Math.cos(ph)) * 1.5);
        a1 = s * 0.1; a2 = s * 0.05; p[6].r = -s * 0.05; p[7].r = -s * 0.05; p[0].r = 0.06 + Math.sin(ph * 2) * 0.04;
      } else {
        uy = Math.sin(t * 0.05) > 0.2 ? -1 : 0; p[0].r = Math.sin(t * 0.04) * 0.03; a1 = Math.sin(t * 0.05) * 0.025;
      }
      for (i = 0; i < 9; i++) if (UPPER[i]) { p[i].dx += ux; p[i].dy += uy; }
      p[1].r = a1;
      var g = rot([G[0] - SH[0], G[1] - SH[1]], a1);
      p[8].dx += SH[0] + g[0] - G[0]; p[8].dy += SH[1] + g[1] - G[1]; p[8].r = a1 + a2;
      return p;
    }
    function tipPos(p) { var q = p[8], v = rot([TIP[0] - G[0], TIP[1] - G[1]], q.r); return [MX + (OFF + G[0] + q.dx + v[0]) * S, MY + (OFF + G[1] + q.dy + v[1]) * S]; }
    function draw(p, i) {
      var q = p[i], pv = PIV[i];
      oc.save(); oc.translate(OFF + pv[0] + q.dx, OFF + pv[1] + q.dy); oc.rotate(q.r);
      oc.drawImage(sheet, i * 64, 0, 64, 64, -pv[0], -pv[1], 64, 64); oc.restore();
    }
    function compose(p) {
      oc.clearRect(0, 0, 96, 96);
      /* the sword arm sits behind the body at rest and comes forward to strike */
      var order = atk >= 0 ? [0, 2, 3, 4, 5, 6, 7, 1, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
      order.forEach(function (i) { draw(p, i); });
      if (t % 3) return;
      var d = oc.getImageData(0, 0, 96, 96).data;
      function A(x, y) { return x < 0 || y < 0 || x > 95 || y > 95 ? 0 : d[(y * 96 + x) * 4 + 3] > 60; }
      edges = [];
      for (var y = 0; y < 96; y++) for (var x = 0; x < 96; x++) {
        if (!A(x, y)) continue;
        if (!A(x, y - 1) || !A(x - 1, y) || !A(x + 1, y)) edges.push([x, y, !A(x, y - 1) ? 3 : 1]);
      }
      if (edges.length) lastEdges = edges;
    }
    function spawn(n) {
      var e = edges.length ? edges : lastEdges; if (!e.length) return;
      var tot = 0, i, j, k = S / 3.6; for (i = 0; i < e.length; i++) tot += e[i][2];
      for (j = 0; j < n; j++) {
        var r = Math.random() * tot, q = e[0];
        for (i = 0; i < e.length; i++) { r -= e[i][2]; q = e[i]; if (r <= 0) break; }
        var ty = Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2;
        parts.push({ x: MX + (q[0] + 0.5) * S + (Math.random() - 0.5) * 3, y: MY + (q[1] + 0.5) * S, vx: (Math.random() - 0.5) * 0.3, vy: -(0.45 + Math.random()) * k * (ty === 2 ? 1.3 : 1),
          life: 1, decay: 0.013 + Math.random() * 0.02, r: (ty === 0 ? 6 + Math.random() * 5 : ty === 1 ? 3.5 + Math.random() * 3.5 : 1.8 + Math.random() * 1.8) * k, type: ty, ph: Math.random() * 6.28 });
      }
    }
    var col = ["6,3,14", "92,52,206", "170,140,255"], alpha = [0.8, 0.55, 0.75];
    function drawParts(front) {
      for (var i = 0; i < parts.length; i++) {
        var q = parts[i]; if ((q.type === 2) !== front) continue;
        var a = alpha[q.type] * Math.min(1, q.life * 1.6) * q.life, rr = q.r * (0.4 + q.life * 0.6);
        c.fillStyle = "rgba(" + col[q.type] + "," + a.toFixed(3) + ")";
        c.beginPath(); c.ellipse(q.x, q.y, rr * 0.55, rr * 1.5, Math.sin(q.ph) * 0.15, 0, 6.283); c.fill();
      }
    }
    function slash(p) {
      if (atk < 0) return;
      if (atk >= 20 && atk <= 27) trail.push(tipPos(p));
      if (atk < 20 || atk > 40 || trail.length < 2) return;
      var fade = atk < 27 ? 1 : 1 - (atk - 27) / 13;
      c.globalCompositeOperation = "lighter"; c.lineCap = "round"; c.lineJoin = "round";
      [[20 * S / 3.6, "130,90,240", 0.3], [10 * S / 3.6, "150,110,255", 0.45], [3, "225,210,255", 0.95]].forEach(function (L) {
        c.strokeStyle = "rgba(" + L[1] + "," + (L[2] * fade).toFixed(3) + ")"; c.lineWidth = L[0];
        c.beginPath(); c.moveTo(trail[0][0], trail[0][1]);
        for (var i = 1; i < trail.length; i++) { var a = trail[i - 1], b = trail[i]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        var l = trail[trail.length - 1]; c.lineTo(l[0], l[1]); c.stroke();
      });
      c.globalCompositeOperation = "source-over";
    }
    function frame() {
      requestAnimationFrame(frame);
      if (!ready || (o.visible && !o.visible())) return;
      t++; if (atk >= 0 && ++atk > 62) atk = -1;
      var p = pose(); compose(p);
      c.clearRect(0, 0, W, H);
      if (o.ground) o.ground(c, t, ctl.mode);
      c.fillStyle = "rgba(0,0,0,0.55)"; c.beginPath(); c.ellipse(MX + (OFF + 30) * S, MY + (OFF + 63) * S + 3, 20 * S, 2.2 * S, 0, 0, 6.283); c.fill();
      spawn(reduce ? 3 : 8);
      for (var i = 0; i < parts.length; i++) { var q = parts[i]; q.ph += 0.08; q.x += q.vx + Math.sin(q.ph) * 0.22; q.y += q.vy; q.life -= q.decay; }
      parts = parts.filter(function (q) { return q.life > 0; });
      drawParts(false);
      c.imageSmoothingEnabled = false; c.drawImage(O, MX, MY, 96 * S, 96 * S);
      slash(p);
      c.globalCompositeOperation = "lighter"; drawParts(true); c.globalCompositeOperation = "source-over";
    }
    requestAnimationFrame(frame);
    return ctl;
  }
  window.SystemHunter = { start: start };

  function mount() {
    var host = document.getElementById("mxHunter");
    if (!host || host.getAttribute("data-on")) return;
    host.setAttribute("data-on", "1");
    host.innerHTML = '<canvas class="mx-hunter-cv" aria-label="Your Hunter. Tap to strike." role="img"></canvas><div class="mx-hunter-hint mono">Tap to strike</div>';
    var cv = host.querySelector("canvas");
    var ctl = start(cv, { w: 300, h: 250, scale: 2.9, x: 5, y: -8, visible: function () {
      var sec = document.getElementById("sec-status");
      return !document.hidden && host.isConnected && (!sec || !sec.classList.contains("is-hidden"));
    } });
    cv.addEventListener("click", ctl.strike);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
