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

  /* ================= HIDDEN QUEST: hold to break the seal ================= */
  var hq = $(".q-group.q-hidden");
  var veil = $("#hiddenVeil");
  if (hq && veil) {
    window.__mxHqHold = true;
    var cta = $(".mx-hq-cta", veil);
    if (cta) cta.textContent = "Hold to break the seal";
    var sigBox = $(".mx-hq-sigil", veil);
    var ringSvg = el("div", "mx-hq-charge", '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47"/></svg>');
    veil.appendChild(ringSvg);
    var HOLD = 650, t0 = 0, raf = 0, holding = false;
    function center() {
      var b = (sigBox || veil).getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: hq.getBoundingClientRect().width };
    }
    function stop() {
      holding = false; cancelAnimationFrame(raf);
      hq.classList.remove("mx-hq-charging"); hq.style.removeProperty("--hc");
    }
    function tick() {
      if (!holding) return;
      var k = Math.min(1, (performance.now() - t0) / HOLD);
      hq.style.setProperty("--hc", k.toFixed(3));
      if (k >= 1) {
        var c = center();
        stop();
        breakSeal(c);
        setTimeout(function () { if (window.__mxHqReveal) window.__mxHqReveal(); }, 330);
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    veil.addEventListener("pointerdown", function (e) {
      if (!hq.classList.contains("sealed")) return;
      holding = true; t0 = performance.now();
      try { veil.setPointerCapture(e.pointerId); } catch (err) {}
      hq.classList.add("mx-hq-charging");
      if (window.__mx) window.__mx.buzz(8);
      raf = requestAnimationFrame(tick);
    });
    veil.addEventListener("pointerup", stop);
    veil.addEventListener("pointercancel", stop);
    veil.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        var wasSealed = /\bsealed\b/.test(m.oldValue || ""), sealed = hq.classList.contains("sealed");
        if (wasSealed && !sealed) { hq.classList.remove("mx-hq-opening"); void hq.offsetWidth; hq.classList.add("mx-hq-opening"); setTimeout(function () { hq.classList.remove("mx-hq-opening"); }, 1400); }
        else if (!wasSealed && sealed) slamSeal();
      });
    }).observe(hq, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  }
  /* the break plays in a fixed layer centred exactly on the seal, so it
     stays put while the box resizes underneath it */
  function breakSeal(c) {
    var cracks = "";
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * Math.PI * 2 + rnd(-0.2, 0.2), x = 50, y = 50, d = "M50 50";
      for (var k = 0; k < 5; k++) { a += rnd(-0.4, 0.4); x += Math.cos(a) * rnd(6, 11); y += Math.sin(a) * rnd(6, 11); d += "L" + x.toFixed(1) + " " + y.toFixed(1); }
      cracks += '<path d="' + d + '"/>';
    }
    var ov = el("div", "mx-hq-break", '<div class="sig">' + (window.__mxSigil ? window.__mxSigil("mx-sigil") : "") + '</div>' +
      '<svg class="cr" viewBox="0 0 100 100" aria-hidden="true">' + cracks + '</svg><div class="flare"></div>');
    ov.style.left = c.x + "px"; ov.style.top = c.y + "px";
    document.body.appendChild(ov);
    setTimeout(function () { ov.remove(); }, 1400);
    var FX = window.__mx;
    if (FX) {
      FX.buzz([20, 30, 50]);
      setTimeout(function () {
        FX.ring(c.x, c.y, { r1: c.w * 0.9, life: 650, width: 3, color: "#ff2d55" });
        FX.spark(c.x, c.y, { n: 34, min: 2, max: 9, life: 800, gravity: 0.12, color: "#ff3b5c" });
        FX.spark(c.x, c.y, { n: 12, min: 1, max: 4, life: 900, gravity: -0.04, color: "#ffd0d8" });
      }, 300);
    }
  }
  function slamSeal() {
    hq.classList.remove("mx-hq-sealing"); void hq.offsetWidth; hq.classList.add("mx-hq-sealing");
    setTimeout(function () { hq.classList.remove("mx-hq-sealing"); }, 900);
    var FX = window.__mx;
    if (FX) setTimeout(function () {
      var b = (sigBox || veil).getBoundingClientRect();
      FX.ring(b.left + b.width / 2, b.top + b.height / 2, { r0: 110, r1: 20, life: 380, width: 2, color: "#ff2d55" }); FX.buzz(30);
    }, 260);
  }

  /* ================= WEATHER: a living sky ================= */
  var wx = $("#sec-weather");
  if (!wx) return;
  var cv = el("canvas", "mx-wx-sky");
  cv.setAttribute("aria-hidden", "true");
  /* the sky fills the whole screen behind the panel while Weather is open */
  var mainEl = document.getElementById("main");
  (mainEl || document.body).appendChild(cv);
  cv.style.display = "none";
  var ctx = cv.getContext("2d"), W = 0, H = 0, parts = [], kind = "", flashA = 0, running = false, last = 0;
  function sky() { var h = $("#wxHeroIcon"); return h ? h.getAttribute("data-icon") || "sun" : "sun"; }
  function size() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
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
    if (wx.classList.contains("is-hidden") || document.hidden) { running = false; cv.style.display = "none"; return; }
    var dt = Math.min(50, ts - last) / 16.67; last = ts;
    if (window.innerWidth !== W || window.innerHeight !== H) size();
    if (sky() !== kind) seed();
    ctx.clearRect(0, 0, W, H);
    var tsec = ts / 1000;
    /* sun: slow god-rays from the hero */
    if (kind === "sun" || kind === "partlyDay") {
      var hr = $("#wxHeroIcon") ? $("#wxHeroIcon").getBoundingClientRect() : null;
      var hx = hr && hr.width ? hr.left + hr.width / 2 : W / 2, hy = hr && hr.width ? hr.top + hr.height / 2 : 110;
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
        cv.style.display = "block";
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

/* Inside a module the bottom REBOOT becomes a back bar (same as the
   handle up top); REBOOT stays on the module screen. */
(function () {
  "use strict";
  var ctr = document.querySelector(".main-controls");
  var handle = document.getElementById("tabsHandle");
  if (!ctr || !handle) return;
  var b = document.createElement("button");
  b.type = "button";
  b.className = "top-handle mx-back-bar show";
  b.setAttribute("aria-label", "Back to modules");
  b.innerHTML = '<span class="th-bar" aria-hidden="true"></span>';
  b.addEventListener("click", function () { window.scrollTo(0, 0); handle.click(); });
  ctr.appendChild(b);
})();

/* Top back bar: pulling a panel down charges a ring around the bar;
   past the threshold it locks "ready", and letting go fires a pulse. */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var h = document.getElementById("tabsHandle");
  if (!h) return;
  var ring = document.createElement("span");
  ring.className = "mx-pull-ring";
  ring.setAttribute("aria-hidden", "true");
  ring.innerHTML = '<svg viewBox="0 0 64 64"><defs><linearGradient id="mxPullG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f5ef8"/><stop offset="1" stop-color="#7dd3fc"/></linearGradient></defs>' +
    '<circle class="tr" cx="32" cy="32" r="29"/><circle class="pr" cx="32" cy="32" r="29"/><circle class="sp" cx="32" cy="3" r="2.2"/><circle class="sp" cx="32" cy="61" r="1.6"/></svg>';
  h.appendChild(ring);
  var last = 0, ready = false, wasOpen = false, lastDisperse = 0;
  /* leaving a module: the back bar gently comes apart into motes that
     drift up and fade, instead of just switching off */
  var bar = h.querySelector(".th-bar");
  function disperse() {
    if (!bar || Date.now() - lastDisperse < 700) return;
    lastDisperse = Date.now();
    var r = bar.getBoundingClientRect();
    if (!r.width) r = h.getBoundingClientRect();
    var round = /50%/.test(bar.style.borderRadius || "");
    var cols = ["#8f5ef8", "#a78bfa", "#c3b8fe", "#6f63f6", "#e9e3ff"];
    for (var i = 0; i < 28; i++) {
      var x, y;
      if (round) { var a = i / 28 * Math.PI * 2; x = r.left + r.width / 2 + Math.cos(a) * r.width / 2; y = r.top + r.height / 2 + Math.sin(a) * r.height / 2; }
      else { x = r.left + (i + 0.5) / 28 * r.width; y = r.top + Math.random() * r.height; }
      var p = document.createElement("span");
      var sz = 1.6 + Math.random() * 2.4, c = cols[(Math.random() * cols.length) | 0];
      p.style.cssText = "position:fixed;z-index:97;pointer-events:none;border-radius:50%;left:" + x + "px;top:" + y + "px;width:" + sz + "px;height:" + sz + "px;background:" + c + ";box-shadow:0 0 6px " + c + ";";
      document.body.appendChild(p);
      var dx = (Math.random() - 0.5) * 40, dy = -(24 + Math.random() * 60), d = 900 + Math.random() * 700;
      try {
        p.animate([
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          { transform: "translate(calc(-50% + " + (dx * 0.4).toFixed(1) + "px), calc(-50% + " + (dy * 0.35).toFixed(1) + "px)) scale(1)", opacity: 0.9, offset: 0.3 },
          { transform: "translate(calc(-50% + " + dx.toFixed(1) + "px), calc(-50% + " + dy.toFixed(1) + "px)) scale(0.3)", opacity: 0 }
        ], { duration: d, delay: Math.abs(i - 14) * 12, easing: "cubic-bezier(0.25, 0.6, 0.35, 1)", fill: "backwards" }).onfinish = (function (el) { return function () { el.remove(); }; })(p);
      } catch (e) { setTimeout(function (el) { el.remove(); }, d + 400, p); }
    }
    bar.style.transition = "opacity 0.35s ease"; bar.style.opacity = "0";
    setTimeout(function () { bar.style.opacity = ""; bar.style.transition = ""; }, 900);
  }
  /* tapping the bar (or the bottom back bar) also disperses it */
  new MutationObserver(function (l) {
    l.forEach(function (m) {
      if (/\bshow\b/.test(m.oldValue || "") && !h.classList.contains("show")) disperse();
    });
  }).observe(h, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  function openSec() {
    var ss = document.querySelectorAll(".section");
    for (var i = 0; i < ss.length; i++) if (!ss[i].classList.contains("is-hidden")) return ss[i];
    return null;
  }
  (function loop() {
    /* only needed while a panel is open (it tracks the pull-down); with
       the tiles showing it just checks back a few times a second */
    if (!document.body.classList.contains("tab-open") && !wasOpen) { setTimeout(function () { requestAnimationFrame(loop); }, 250); if (last !== 0) { h.style.setProperty("--pp", "0"); last = 0; } return; }
    var p = 0, sec = document.body.classList.contains("tab-open") ? openSec() : null;
    if (sec) {
      var m = /translateY\((-?[\d.]+)px\)/.exec(sec.style.transform || "");
      if (m) p = Math.max(0, Math.min(1, parseFloat(m[1]) / 136));
    }
    if (Math.abs(p - last) > 0.002) { h.style.setProperty("--pp", p.toFixed(3)); last = p; }
    var r = p >= 1;
    if (r !== ready) {
      ready = r; h.classList.toggle("mx-ready", r);
      if (r && window.__mx) window.__mx.buzz(12);
    }
    /* released while ready and the panel is leaving: fire a pulse */
    if (wasOpen && sec && /110vh/.test(sec.style.transform || "")) {
      disperse();
      h.style.setProperty("--pp", "0"); last = 0; ready = false; h.classList.remove("mx-ready");
      wasOpen = false;
    } else wasOpen = !!sec && !/110vh/.test(sec.style.transform || "");
    requestAnimationFrame(loop);
  })();
})();

/* REBOOT: a clean system restart. The interface shuts like blinds —
   every row flips away top to bottom — then a single line of light
   draws across the dark with a terse restart log ticking under it,
   and the line opens like a shutter onto the boot. No flash. */
(function () {
  "use strict";
  var LOG = ["closing modules", "saving hunter state", "flushing cache", "core offline", "core online", "relinking modules", "handshake ok"];
  window.__mxReboot = function (done) {
    var main = document.getElementById("main");
    var parts = Array.prototype.slice.call(main.querySelectorAll(".main-top, .main-rings-wrap, #mainTitle, #mainGreet, .showcase-label, .tab-tile, .showcase-status, .verse-line, .main-controls"))
      .filter(function (e) { return e.getBoundingClientRect().height > 0; })
      .sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
    var top0 = parts.length ? parts[0].getBoundingClientRect().top : 0;
    parts.forEach(function (el) {
      var d = (el.getBoundingClientRect().top - top0) * 0.55;
      try {
        el.animate([
          { transform: "perspective(600px) rotateX(0deg)", opacity: 1 },
          { transform: "perspective(600px) rotateX(-88deg)", opacity: 0 }
        ], { duration: 420, delay: d, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" });
      } catch (e) {}
    });
    var shutT = Math.min(900, (parts.length ? (parts[parts.length - 1].getBoundingClientRect().top - top0) * 0.55 : 0) + 420);
    var ov = document.createElement("div");
    ov.className = "mx-rs";
    ov.innerHTML = '<div class="bg"></div><div class="hd"><span>System</span><b>Restart</b></div><div class="ln"><i></i></div><div class="lg"></div><div class="shA"></div><div class="shB"></div>';
    document.body.appendChild(ov);
    var lg = ov.querySelector(".lg");
    if (window.__mx) window.__mx.buzz(10);
    setTimeout(function () { ov.classList.add("dark"); }, Math.max(0, shutT - 250));
    setTimeout(function () {
      ov.classList.add("run");
      LOG.forEach(function (t, k) {
        setTimeout(function () {
          var row = document.createElement("div");
          row.innerHTML = "<em>" + String(k + 1).padStart(2, "0") + "</em>" + t + "<span>ok</span>";
          lg.appendChild(row);
          while (lg.children.length > 4) lg.removeChild(lg.firstChild);
        }, 120 + k * 150);
      });
    }, shutT);
    var openT = shutT + 1350;
    setTimeout(function () {
      parts.forEach(function (el) { try { el.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {} });
      done();
      ov.classList.add("open");
      if (window.__mx) window.__mx.buzz(15);
    }, openT);
    setTimeout(function () { ov.remove(); }, openT + 1000);
  };
})();

/* boot screen build label always matches the footer version (Core vX.Y) */
(function () {
  try {
    var v = document.getElementById("appVersion"), b = document.getElementById("bootBuild");
    var m = v && v.textContent.match(/v?(\d+(?:\.\d+)*)/);
    if (b && m) b.textContent = "Build " + m[1] + " — Boot Sequence";
  } catch (e) {}
})();

/* Sports Desk sheet: flag the body while it's open (the CSS pins the
   sheet and locks the page), and a plain tap on its bar closes it. */
(function () {
  "use strict";
  var sec = document.getElementById("sec-sports");
  var bar = sec ? sec.querySelector(".mx-embed-bar") : null;
  var handle = document.getElementById("tabsHandle");
  if (!sec) return;
  function sync() { document.body.classList.toggle("sports-open", !sec.classList.contains("is-hidden")); }
  new MutationObserver(sync).observe(sec, { attributes: true, attributeFilter: ["class"] });
  sync();
  if (!bar || !handle) return;
  var tx = 0, ty = 0, t0 = 0;
  bar.addEventListener("pointerdown", function (e) { tx = e.clientX; ty = e.clientY; t0 = Date.now(); });
  bar.addEventListener("click", function (e) {
    if (e.target.closest("a")) return;
    if (Date.now() - t0 > 500 || Math.abs(e.clientX - tx) > 8 || Math.abs(e.clientY - ty) > 8) return;
    handle.click();
  });
  /* nothing behind the sheet should scroll from a touch on the bar */
  bar.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
})();
