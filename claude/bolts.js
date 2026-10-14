/* ==========================================================
   RANK S LIGHTNING (Claude build)
   Procedural dark lightning — Sung Jinwoo style: near-black
   bolts with a violet electric rim, freshly generated every
   strike (midpoint displacement + forked branches), striking
   in stuttering bursts with low crawling static in between.
   Drawn on small canvases around:
     • the EXP bar in the Quests panel  (.q-bar-shell.rank-s)
     • the S letter on the Quests tile  (.t-letter[data-rank="s"])
   ========================================================== */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* jagged path between two points: recursive midpoint displacement */
  function boltPath(x1, y1, x2, y2, disp, minSeg) {
    var pts = [[x1, y1], [x2, y2]];
    var d = disp;
    while (true) {
      var next = [pts[0]], longest = 0;
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len > longest) longest = len;
        var off = rnd(-d, d);
        next.push([(a[0] + b[0]) / 2 - dy / (len || 1) * off, (a[1] + b[1]) / 2 + dx / (len || 1) * off]);
        next.push(b);
      }
      pts = next;
      d *= 0.55;
      if (longest / 2 < minSeg) break;
    }
    return pts;
  }
  /* a bolt plus forks that peel off away from the body */
  function boltWithForks(x1, y1, x2, y2, disp, minSeg, forks, outward) {
    var main = boltPath(x1, y1, x2, y2, disp, minSeg);
    var all = [{ pts: main, w: 1 }];
    for (var f = 0; f < forks; f++) {
      var idx = 1 + ((Math.random() * (main.length - 2)) | 0);
      var p = main[idx];
      var ang = outward(p[0], p[1]) + rnd(-0.6, 0.6);
      var L = rnd(5, 15);
      var fk = boltPath(p[0], p[1], p[0] + Math.cos(ang) * L, p[1] + Math.sin(ang) * L, L * 0.35, 1.6);
      all.push({ pts: fk, w: 0.55 });
      if (Math.random() < 0.35) {
        var q = fk[(fk.length / 2) | 0], a2 = ang + rnd(-0.9, 0.9), L2 = L * 0.5;
        all.push({ pts: boltPath(q[0], q[1], q[0] + Math.cos(a2) * L2, q[1] + Math.sin(a2) * L2, L2 * 0.4, 1.4), w: 0.35 });
      }
    }
    return all;
  }
  function strokePts(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  /* layered dark-lightning stroke: violet bloom, deep violet body,
     near-black core; the first frame of a strike burns hot */
  function drawBolt(ctx, segs, alpha, hot, scale) {
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (var s = 0; s < segs.length; s++) {
      var g = segs[s], w = g.w * scale;
      ctx.globalAlpha = alpha * 0.9;
      ctx.shadowColor = hot ? "rgba(216, 180, 254, 1)" : "rgba(139, 92, 246, 1)"; ctx.shadowBlur = 16 * scale;
      ctx.strokeStyle = "rgba(124, 58, 237, 0.95)"; ctx.lineWidth = 5 * w;
      strokePts(ctx, g.pts);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = hot ? "#e9d5ff" : "#a78bfa"; ctx.lineWidth = 2.6 * w;
      strokePts(ctx, g.pts);
      ctx.strokeStyle = hot ? "#ffffff" : "#0b0118"; ctx.lineWidth = 1.2 * w;
      strokePts(ctx, g.pts);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- a lightning field bound to one element ---------- */
  function Field(host, opts) {
    this.host = host; this.o = opts;
    this.cv = document.createElement("canvas");
    this.cv.className = "mx-bolt-cv";
    this.cv.setAttribute("aria-hidden", "true");
    this.ctx = this.cv.getContext("2d");
    this.bolts = []; this.nextBurst = 0; this.burstLeft = 0; this.nextFlick = 0; this.nextCrawl = 0;
    (opts.mount || host).appendChild(this.cv);
  }
  Field.prototype.layout = function () {
    var o = this.o, r = this.host.getBoundingClientRect();
    if (!r.width) return false;
    var pad = o.pad;
    var w = r.width + pad[1] * 2, h = r.height + pad[0] * 2;
    if (o.mount && o.mount !== this.host) {
      var mr = o.mount.getBoundingClientRect();
      this.cv.style.left = (r.left - mr.left - pad[1]) + "px";
      this.cv.style.top = (r.top - mr.top - pad[0]) + "px";
    } else {
      this.cv.style.left = -pad[1] + "px";
      this.cv.style.top = -pad[0] + "px";
    }
    this.cv.style.width = w + "px"; this.cv.style.height = h + "px";
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.W !== w || this.H !== h) {
      this.W = w; this.H = h;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.bw = r.width; this.bh = r.height;
    return true;
  };
  Field.prototype.spawn = function (hot) {
    var list = this.o.make(this, hot);
    for (var i = 0; i < list.length; i++) this.bolts.push({ segs: list[i], life: 0, max: hot ? 170 : 130, hot: hot });
  };
  Field.prototype.tick = function (now, dt) {
    if (now >= this.nextBurst && !this.burstLeft) {
      this.burstLeft = 2 + ((Math.random() * 3) | 0);
      this.nextFlick = now;
    }
    if (this.burstLeft && now >= this.nextFlick) {
      var first = !this.bolts.some(function (b) { return b.hot; }) && this.burstLeft >= 2;
      this.spawn(first);
      if (this.o.onZap) this.o.onZap(this);
      this.burstLeft--;
      this.nextFlick = now + rnd(45, 95);
      if (!this.burstLeft) this.nextBurst = now + rnd(this.o.quiet[0], this.o.quiet[1]);
    }
    if (now >= this.nextCrawl) {
      var c = this.o.crawl(this);
      if (c) this.bolts.push({ segs: c, life: 0, max: rnd(90, 160), hot: false, faint: true });
      this.nextCrawl = now + rnd(this.o.crawlEvery[0], this.o.crawlEvery[1]);
    }
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    for (var i = this.bolts.length - 1; i >= 0; i--) {
      var b = this.bolts[i];
      b.life += dt;
      if (b.life >= b.max) { this.bolts.splice(i, 1); continue; }
      var k = b.life / b.max;
      var a = (b.faint ? 0.45 : 1) * (1 - k * k) * (k < 0.08 ? k / 0.08 : 1);
      drawBolt(ctx, b.segs, a, b.hot && k < 0.45, this.o.scale || 1);
    }
  };

  /* ---------- EXP bar: bolts run along the outside of the edges ---------- */
  function barMake(F, hot) {
    var out = [], px = F.o.pad[1], py = F.o.pad[0], w = F.bw, h = F.bh;
    var n = hot ? 2 : 1 + (Math.random() < 0.5 ? 1 : 0);
    for (var i = 0; i < n; i++) {
      var r = Math.random();
      if (r < 0.78) {
        /* run along the top or bottom edge, forks spitting outward */
        var top = Math.random() < 0.5;
        var y = top ? py - rnd(1, 4) : py + h + rnd(1, 4);
        var len = w * rnd(0.22, 0.5), x0 = px + rnd(-6, w - len + 6);
        var dir = top ? -Math.PI / 2 : Math.PI / 2;
        out.push(boltWithForks(x0, y + rnd(-3, 3), x0 + len, y + rnd(-3, 3), 10, 1.8, 3 + ((Math.random() * 4) | 0),
          function () { return dir; }));
      } else {
        /* arc that wraps around an end of the bar, top to bottom */
        var left = Math.random() < 0.5;
        var ex = left ? px - rnd(3, 7) : px + w + rnd(3, 7);
        var ix = left ? px + rnd(6, 26) : px + w - rnd(6, 26);
        var mid = boltPath(ix, py - 3, ex, py + h / 2, 4, 1.8).concat(boltPath(ex, py + h / 2, ix, py + h + 3, 4, 1.8).slice(1));
        out.push([{ pts: mid, w: 1 }]);
      }
    }
    return out;
  }
  function barCrawl(F) {
    var px = F.o.pad[1], py = F.o.pad[0];
    var top = Math.random() < 0.5;
    var x = px + rnd(0, F.bw), y = top ? py - 1 : py + F.bh + 1;
    var L = rnd(8, 22);
    return [{ pts: boltPath(x, y, x + L, y + rnd(-2, 2), 3, 1.6), w: 0.6 }];
  }

  /* ---------- tile S: arcs crackle around and off the letter ---------- */
  function letterMake(F, hot) {
    var out = [], cx = F.o.pad[1] + F.bw / 2, cy = F.o.pad[0] + F.bh / 2;
    var R = Math.max(F.bw, F.bh) * 0.62;
    var n = hot ? 3 : 2;
    for (var i = 0; i < n; i++) {
      if (Math.random() < 0.55) {
        /* an arc hugging the letter */
        var a0 = rnd(0, Math.PI * 2), sweep = rnd(1.2, 2.6) * (Math.random() < 0.5 ? -1 : 1), pts = [];
        var steps = 7;
        for (var s = 0; s <= steps; s++) {
          var a = a0 + sweep * s / steps, rr = R + rnd(-2.5, 2.5);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
        }
        var seg = [];
        for (var j = 0; j < pts.length - 1; j++) {
          var piece = boltPath(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], 2, 1.4);
          seg = seg.concat(j ? piece.slice(1) : piece);
        }
        var list = [{ pts: seg, w: 0.8 }];
        var fp = seg[(seg.length * rnd(0.2, 0.8)) | 0], fa = Math.atan2(fp[1] - cy, fp[0] - cx) + rnd(-0.5, 0.5), fl = rnd(5, 11);
        list.push({ pts: boltPath(fp[0], fp[1], fp[0] + Math.cos(fa) * fl, fp[1] + Math.sin(fa) * fl, fl * 0.35, 1.3), w: 0.45 });
        out.push(list);
      } else {
        /* a bolt cracking off the letter's edge outward */
        var ang = rnd(0, Math.PI * 2), r0 = R * 0.75, L = rnd(9, 18);
        var sx = cx + Math.cos(ang) * r0, sy = cy + Math.sin(ang) * r0;
        out.push(boltWithForks(sx, sy, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L, L * 0.3, 1.4, 1 + ((Math.random() * 2) | 0),
          function (x, y) { return Math.atan2(y - cy, x - cx); }));
      }
    }
    return out;
  }
  function letterCrawl(F) {
    var cx = F.o.pad[1] + F.bw / 2, cy = F.o.pad[0] + F.bh / 2, R = Math.max(F.bw, F.bh) * 0.6;
    var a = rnd(0, Math.PI * 2), b = a + rnd(0.4, 0.9);
    return [{ pts: boltPath(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(b) * R, cy + Math.sin(b) * R, 2.2, 1.3), w: 0.5 }];
  }

  function zap(el) {
    el.classList.add("mx-zap");
    clearTimeout(el.__mxZapT);
    el.__mxZapT = setTimeout(function () { el.classList.remove("mx-zap"); }, 110);
  }

  /* ---------- bind to the app ---------- */
  var fields = [];
  var shell = document.querySelector("#sec-quests .q-bar-shell");
  if (shell) fields.push({
    host: shell,
    active: function () { return shell.classList.contains("rank-s"); },
    opts: { pad: [18, 12], make: barMake, crawl: barCrawl, crawlEvery: [70, 160], quiet: [500, 1500], scale: 1,
            onZap: function () { zap(shell); } }
  });
  var tileLetter = document.querySelector(".tab-tile .t-letter");
  if (tileLetter) fields.push({
    host: tileLetter,
    active: function () { return (tileLetter.getAttribute("data-rank") || "").toLowerCase() === "s"; },
    opts: { pad: [16, 16], make: letterMake, crawl: letterCrawl, crawlEvery: [90, 200], quiet: [700, 1900], scale: 0.8,
            onZap: function () { zap(tileLetter); } }
  });

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(50, now - last); last = now;
    var any = false;
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var on = f.active() && !document.hidden;
      if (on) {
        if (!f.F) { f.F = new Field(f.host, f.opts); f.host.classList.add("mx-bolts"); }
        if (f.F.layout()) { f.F.tick(now, dt); any = true; }
      } else if (f.F) {
        f.F.cv.remove(); f.F = null; f.host.classList.remove("mx-bolts", "mx-zap");
      }
    }
    if (any) requestAnimationFrame(frame);
    else setTimeout(function () { last = performance.now(); requestAnimationFrame(frame); }, 400);
  }
  requestAnimationFrame(frame);
})();
