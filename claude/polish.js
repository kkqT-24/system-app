/* ==========================================================
   v2 POLISH (Claude build)
   • Hidden Quest: seal-break reveal / seal-slam close
   • Weather panel: living sky (rain, sun rays, stars, snow,
     mist, lightning) + an animated arrival
   ========================================================== */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function $(s, r) { return (r || document).querySelector(s); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ================= HIDDEN QUEST: break / restore the seal ================= */
  var hq = $(".q-group.q-hidden");
  if (hq) {
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        var wasSealed = /\bsealed\b/.test(m.oldValue || ""), sealed = hq.classList.contains("sealed");
        if (wasSealed && !sealed) breakSeal();
        else if (!wasSealed && sealed) slamSeal();
      });
    }).observe(hq, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  }
  function hqCenter() { var r = hq.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 120), w: r.width }; }
  function breakSeal() {
    var cracks = "";
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * Math.PI * 2 + rnd(-0.2, 0.2), x = 50, y = 50, d = "M50 50";
      for (var k = 0; k < 5; k++) { a += rnd(-0.4, 0.4); x += Math.cos(a) * rnd(6, 11); y += Math.sin(a) * rnd(6, 11); d += "L" + x.toFixed(1) + " " + y.toFixed(1); }
      cracks += '<path d="' + d + '"/>';
    }
    var ov = el("div", "mx-hq-break", '<div class="sig">' + (window.__mxSigil ? window.__mxSigil("mx-sigil") : "") + '</div>' +
      '<svg class="cr" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + cracks + '</svg><div class="flare"></div>');
    hq.appendChild(ov);
    hq.classList.remove("mx-hq-opening"); void hq.offsetWidth; hq.classList.add("mx-hq-opening");
    setTimeout(function () { ov.remove(); hq.classList.remove("mx-hq-opening"); }, 1500);
    var FX = window.__mx;
    if (FX) {
      setTimeout(function () {
        var c = hqCenter();
        FX.ring(c.x, c.y, { r1: c.w * 0.9, life: 650, width: 3, color: "#ff2d55" });
        FX.spark(c.x, c.y, { n: 34, min: 2, max: 9, life: 800, gravity: 0.12, color: "#ff3b5c" });
        FX.spark(c.x, c.y, { n: 12, min: 1, max: 4, life: 900, gravity: -0.04, color: "#ffd0d8" });
        FX.buzz([20, 30, 50]);
      }, 380);
    }
  }
  function slamSeal() {
    hq.classList.remove("mx-hq-sealing"); void hq.offsetWidth; hq.classList.add("mx-hq-sealing");
    setTimeout(function () { hq.classList.remove("mx-hq-sealing"); }, 900);
    var FX = window.__mx;
    if (FX) setTimeout(function () { var c = hqCenter(); FX.ring(c.x, c.y, { r0: c.w * 0.5, r1: 20, life: 380, width: 2, color: "#ff2d55" }); FX.buzz(30); }, 260);
  }

  /* ================= WEATHER: a living sky ================= */
  var wx = $("#sec-weather");
  if (!wx) return;
  var cv = el("canvas", "mx-wx-sky");
  cv.setAttribute("aria-hidden", "true");
  wx.appendChild(cv);
  var ctx = cv.getContext("2d"), W = 0, H = 0, parts = [], kind = "", flashA = 0, running = false, last = 0;
  function sky() { var h = $("#wxHeroIcon"); return h ? h.getAttribute("data-icon") || "sun" : "sun"; }
  function size() {
    var r = wx.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seed() {
    kind = sky(); parts = [];
    var n = { rain: 120, showerDay: 90, tstormsDay: 130, storm: 130, snow: 70, moon: 70, partlyNight: 50, fog: 6, cloud: 7, partlyDay: 6, sun: 26 }[kind] || 30;
    for (var i = 0; i < n; i++) parts.push(spawn(true));
  }
  function spawn(any) {
    var k = kind;
    if (k === "rain" || k === "showerDay" || k === "tstormsDay" || k === "storm") return { t: "drop", x: rnd(-20, W + 20), y: any ? rnd(-H, H) : rnd(-40, -5), v: rnd(9, 15), l: rnd(10, 22) };
    if (k === "snow") return { t: "flake", x: rnd(0, W), y: any ? rnd(0, H) : -6, v: rnd(0.4, 1.1), r: rnd(1, 2.6), ph: rnd(0, 6) };
    if (k === "moon" || k === "partlyNight") return { t: "star", x: rnd(0, W), y: rnd(0, H * 0.7), r: rnd(0.4, 1.5), ph: rnd(0, 6), sp: rnd(0.6, 2) };
    if (k === "fog" || k === "cloud" || k === "partlyDay") return { t: "cloud", x: rnd(-W * 0.3, W), y: rnd(10, H * 0.55), v: rnd(0.08, 0.25), w: rnd(120, 260), h: rnd(40, 80) };
    return { t: "mote", x: rnd(0, W), y: any ? rnd(0, H) : H + 5, v: rnd(0.15, 0.45), r: rnd(1, 2.4), ph: rnd(0, 6) };
  }
  function frame(ts) {
    if (wx.classList.contains("is-hidden") || document.hidden) { running = false; return; }
    var dt = Math.min(50, ts - last) / 16.67; last = ts;
    if (Math.abs(wx.getBoundingClientRect().height - H) > 4) size();
    if (sky() !== kind) seed();
    ctx.clearRect(0, 0, W, H);
    var tsec = ts / 1000;
    /* sun: slow god-rays from the hero */
    if (kind === "sun" || kind === "partlyDay") {
      var hx = W / 2, hy = 70;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (var r = 0; r < 12; r++) {
        var a = tsec * 0.12 + r / 12 * Math.PI * 2;
        var g = ctx.createLinearGradient(hx, hy, hx + Math.cos(a) * H, hy + Math.sin(a) * H);
        g.addColorStop(0, "rgba(255,210,110,0.10)"); g.addColorStop(1, "rgba(255,210,110,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(hx, hy);
        ctx.lineTo(hx + Math.cos(a - 0.06) * H * 1.2, hy + Math.sin(a - 0.06) * H * 1.2);
        ctx.lineTo(hx + Math.cos(a + 0.06) * H * 1.2, hy + Math.sin(a + 0.06) * H * 1.2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.t === "drop") {
        p.y += p.v * dt; p.x -= p.v * 0.18 * dt;
        if (p.y > H + 20) parts[i] = spawn(false);
        ctx.strokeStyle = "rgba(150,190,255,0.42)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.l * 0.18, p.y - p.l); ctx.stroke();
      } else if (p.t === "flake") {
        p.y += p.v * dt; p.x += Math.sin(tsec + p.ph) * 0.4 * dt;
        if (p.y > H + 6) parts[i] = spawn(false);
        ctx.fillStyle = "rgba(235,240,255,0.8)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      } else if (p.t === "star") {
        var tw = 0.35 + 0.65 * Math.abs(Math.sin(tsec * p.sp + p.ph));
        ctx.fillStyle = "rgba(230,225,255," + tw.toFixed(2) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      } else if (p.t === "cloud") {
        p.x += p.v * dt; if (p.x > W + p.w) { p.x = -p.w; p.y = rnd(10, H * 0.55); }
        var cg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.w / 2);
        var ca = kind === "fog" ? 0.10 : 0.07;
        cg.addColorStop(0, "rgba(200,205,235," + ca + ")"); cg.addColorStop(1, "rgba(200,205,235,0)");
        ctx.fillStyle = cg; ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, p.h / p.w); ctx.translate(-p.x, -p.y);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.w / 2, 0, 6.283); ctx.fill(); ctx.restore();
      } else {
        p.y -= p.v * dt; p.x += Math.sin(tsec * 0.8 + p.ph) * 0.2 * dt;
        if (p.y < -5) parts[i] = spawn(false);
        ctx.fillStyle = "rgba(255,214,120,0.55)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
    }
    /* storms: sheet lightning now and then */
    if ((kind === "storm" || kind === "tstormsDay") && Math.random() < 0.006 * dt) flashA = 0.5;
    if (flashA > 0) {
      ctx.fillStyle = "rgba(200,210,255," + flashA.toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
      flashA *= 0.82; if (flashA < 0.01) flashA = 0;
    }
    requestAnimationFrame(frame);
  }
  /* temperature counts up as the panel arrives */
  function countUp() {
    var t = $(".wx-temp", wx);
    if (!t) return;
    var target = parseInt(t.textContent, 10);
    if (!isFinite(target)) return;
    var t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3);
      t.textContent = Math.round(target * e) + "°";
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      var was = /\bis-hidden\b/.test(m.oldValue || ""), now = wx.classList.contains("is-hidden");
      if (was && !now) {
        wx.classList.remove("mx-wx-open"); void wx.offsetWidth; wx.classList.add("mx-wx-open");
        setTimeout(function () { wx.classList.remove("mx-wx-open"); }, 2200);
        setTimeout(countUp, 250);
        requestAnimationFrame(function () { size(); seed(); if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } });
      }
    });
  }).observe(wx, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
})();

/* Sports Desk: the bar above the embedded desk is its own drag handle.
   Touches inside the desk belong to the desk, so swipe-to-close lives
   on the bar: drag it down and let go to return to the modules. */
(function () {
  "use strict";
  var sec = document.getElementById("sec-sports");
  var bar = sec ? sec.querySelector(".mx-embed-bar") : null;
  var handle = document.getElementById("tabsHandle");
  if (!bar || !handle) return;
  var y0 = null, pid = null, dy = 0;
  bar.addEventListener("touchstart", function (e) { e.stopPropagation(); }, { passive: true });
  bar.addEventListener("pointerdown", function (e) {
    if (e.target.closest("a")) return;
    y0 = e.clientY; pid = e.pointerId; dy = 0;
    try { bar.setPointerCapture(pid); } catch (err) {}
    sec.style.transition = "none";
  });
  bar.addEventListener("pointermove", function (e) {
    if (y0 === null || e.pointerId !== pid) return;
    dy = Math.max(0, e.clientY - y0);
    sec.style.transform = dy ? "translateY(" + Math.round(dy * 0.85) + "px)" : "";
  });
  function end() {
    if (y0 === null) return;
    y0 = null; pid = null;
    if (dy > 110) {
      sec.style.transition = "transform 0.28s ease-in";
      sec.style.transform = "translateY(110vh)";
      setTimeout(function () { sec.style.transition = ""; sec.style.transform = ""; handle.click(); }, 260);
    } else {
      sec.style.transition = "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)";
      sec.style.transform = "";
      setTimeout(function () { sec.style.transition = ""; }, 340);
    }
    dy = 0;
  }
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
})();
