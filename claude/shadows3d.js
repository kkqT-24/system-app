/* ==========================================================
   SHADOW ARMY — 3D (Claude build)
   Real-time 3D soldiers built from primitives in Three.js:
   pitch-black bodies with a glowing rim (fresnel) in their tier
   colour, burning eyes, rising aura particles, class weapons and
   idle motion. Monarchs get crowns, wings, a dragon and a wolf,
   with blazing gold-crimson auras.
   window.__mx3d.stage(el, shadows, onPick) → controller
   window.__mx3d.turntable(el, shadow) → controller
   ========================================================== */
(function () {
  "use strict";
  if (typeof THREE === "undefined") return;
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- materials ---------- */
  var rimCache = {};
  function rimMat(hex, strength, side) {
    var key = hex + "|" + (strength || 1) + "|" + (side || 0);
    if (rimCache[key]) return rimCache[key];
    var m = new THREE.ShaderMaterial({
      uniforms: { rim: { value: new THREE.Color(hex) }, k: { value: strength || 1 } },
      side: side || THREE.FrontSide,
      vertexShader:
        "varying vec3 vN; varying vec3 vV; varying float vY;" +
        "void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);" +
        " vY = (modelMatrix * vec4(position,1.0)).y; gl_Position = projectionMatrix * mv; }",
      fragmentShader:
        "uniform vec3 rim; uniform float k; varying vec3 vN; varying vec3 vV; varying float vY;" +
        "void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;" +
        " float f = pow(1.0 - clamp(abs(dot(n, normalize(vV))), 0.0, 1.0), 2.4);" +
        " float top = clamp(dot(n, normalize(vec3(0.2,1.0,0.4))), 0.0, 1.0) * 0.06;" +
        " vec3 base = vec3(0.012, 0.006, 0.024) + vec3(top * 0.6, top * 0.5, top);" +
        " vec3 c = base + rim * f * 1.35 * k + rim * 0.05 * k * smoothstep(0.0, 0.6, 1.0 - vY * 0.4);" +
        " gl_FragColor = vec4(c, 1.0); }"
    });
    rimCache[key] = m;
    return m;
  }
  function glowMat(hex) { return new THREE.MeshBasicMaterial({ color: hex }); }
  var dotTex = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c); return t;
  })();
  function glowSprite(hex, size) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1); return s;
  }
  var runeTex = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 512;
    var g = c.getContext("2d"); g.translate(256, 256);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, 256);
    gr.addColorStop(0, "rgba(168,85,247,0.55)"); gr.addColorStop(0.5, "rgba(88,28,135,0.25)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(-256, -256, 512, 512);
    g.strokeStyle = "rgba(196,181,253,0.55)"; g.lineWidth = 2;
    [230, 200, 120].forEach(function (r) { g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke(); });
    for (var i = 0; i < 72; i++) { var a = i / 72 * 6.283, r1 = 230, r2 = i % 6 ? 220 : 208; g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); g.stroke(); }
    g.font = "20px serif"; g.fillStyle = "rgba(196,181,253,0.6)"; g.textAlign = "center"; g.textBaseline = "middle";
    var runes = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
    for (var j = 0; j < 24; j++) { var b = j / 24 * 6.283; g.save(); g.rotate(b); g.fillText(runes[j], 0, -165); g.restore(); }
    g.beginPath(); for (var k = 0; k < 3; k++) { var a2 = -Math.PI / 2 + k * 2.094; g.lineTo(Math.cos(a2) * 120, Math.sin(a2) * 120); } g.closePath(); g.stroke();
    g.beginPath(); for (var k2 = 0; k2 < 3; k2++) { var a3 = Math.PI / 2 + k2 * 2.094; g.lineTo(Math.cos(a3) * 120, Math.sin(a3) * 120); } g.closePath(); g.stroke();
    return new THREE.CanvasTexture(c);
  })();

  /* ---------- geometry helpers ---------- */
  function mesh(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
  function cyl(rt, rb, h, seg) { return new THREE.CylinderGeometry(rt, rb, h, seg || 10); }
  function sph(r, w, h) { return new THREE.SphereGeometry(r, w || 14, h || 10); }
  function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  function cone(r, h, seg) { return new THREE.ConeGeometry(r, h, seg || 10); }
  function limb(mat, len, r0, r1) { var g = new THREE.Group(); var m = mesh(cyl(r0, r1, len), mat, 0, -len / 2, 0); g.add(m); return g; }
  function clothPlane(w, h, sx, sy) {
    var g = new THREE.PlaneGeometry(w, h, sx || 6, sy || 10);
    g.translate(0, -h / 2, 0);
    g.userData = { base: g.attributes.position.array.slice() };
    return g;
  }
  function wave(geo, t, amp, freq) {
    var p = geo.attributes.position.array, b = geo.userData.base;
    for (var i = 0; i < p.length; i += 3) {
      var y = b[i + 1], d = -y;
      p[i + 2] = b[i + 2] - d * d * 0.18 + Math.sin(t * freq + d * 4 + b[i] * 3) * amp * d;
      p[i] = b[i] + Math.sin(t * freq * 0.7 + d * 3) * amp * 0.4 * d;
    }
    geo.attributes.position.needsUpdate = true;
  }

  /* ---------- humanoid base ---------- */
  function lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 16); }
  /* a limb segment hanging down from its pivot, with a rounded joint */
  function segment(M, len, r0, r1) {
    var g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [r0 * 0.9, 0.01], [r0, len * 0.15], [(r0 + r1) / 2 * 1.04, len * 0.55], [r1, len * 0.95], [r1 * 0.6, len], [0, len]], 12), M, 0, -len, 0));
    g.children[0].rotation.x = Math.PI; g.children[0].position.y = 0;
    return g;
  }
  function humanoid(M, opt) {
    opt = opt || {};
    var root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    if (opt.robe) {
      body.add(mesh(lathe([[0, 0], [0.48, 0], [0.44, 0.15], [0.33, 0.6], [0.22, 1.0], [0.19, 1.12], [0, 1.12]], 18), M, 0, 0, 0));
    } else {
      /* legs: thigh, knee, shin, armoured boot */
      [-1, 1].forEach(function (sd) {
        var hip = new THREE.Group(); hip.position.set(0.11 * sd, 0.9, 0); body.add(hip);
        var th = segment(M, 0.44, 0.105, 0.08); hip.add(th);
        var knee = mesh(sph(0.075, 10, 8), M, 0, -0.44, 0.01); hip.add(knee);
        var sh = segment(M, 0.4, 0.08, 0.06); sh.position.y = -0.45; hip.add(sh);
        var boot = mesh(sph(0.08, 10, 8), M, 0, -0.86, 0.05); boot.scale.set(0.95, 0.65, 1.7); hip.add(boot);
        hip.rotation.z = -0.03 * sd;
      });
      var pelvis = mesh(sph(0.2, 14, 10), M, 0, 0.92, 0); pelvis.scale.set(1.05, 0.62, 0.72); body.add(pelvis);
      /* tasset plates over the hips */
      [-1, 1].forEach(function (sd) { var t = mesh(box(0.16, 0.2, 0.03), M, 0.13 * sd, 0.8, 0.13); t.rotation.z = 0.12 * sd; t.rotation.x = -0.12; body.add(t); });
    }
    /* torso: waist → chest → shoulders, one smooth lathe */
    var torso = mesh(lathe([[0, 0], [0.17, 0], [0.18, 0.08], [0.24, 0.26], [0.27, 0.42], [0.25, 0.52], [0.16, 0.6], [0.08, 0.64], [0, 0.64]], 18), M, 0, 0.94, 0);
    torso.scale.z = 0.7; body.add(torso);
    var trim = glowMat(opt.color);
    var belt = mesh(new THREE.TorusGeometry(0.175, 0.012, 6, 24), trim, 0, 0.97, 0); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.7; body.add(belt);
    var collar = mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 20), trim, 0, 1.53, 0); collar.rotation.x = Math.PI / 2; collar.scale.y = 0.7; body.add(collar);
    body.add(mesh(cyl(0.065, 0.075, 0.12), M, 0, 1.6, 0));
    var head = new THREE.Group(); head.position.set(0, 1.74, 0); body.add(head);
    var skull = mesh(sph(0.13, 16, 12), M); skull.scale.set(0.95, 1.08, 1); head.add(skull);
    var jaw = mesh(sph(0.1, 12, 8), M, 0, -0.07, 0.03); jaw.scale.set(0.9, 0.7, 0.95); head.add(jaw);
    /* pauldrons: layered half-domes */
    [-1, 1].forEach(function (sd) {
      var p = mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M, 0.3 * sd, 1.45, 0); p.scale.set(1.05, 0.75, 0.9); p.rotation.z = -0.35 * sd; body.add(p);
      var p2 = mesh(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M, 0.34 * sd, 1.38, 0); p2.scale.set(1.05, 0.6, 0.9); p2.rotation.z = -0.55 * sd; body.add(p2);
      var edge = mesh(new THREE.TorusGeometry(0.155, 0.007, 4, 20, Math.PI), trim, 0.3 * sd, 1.45, 0); edge.rotation.z = -0.35 * sd; edge.scale.set(1.05, 0.9, 0.9); body.add(edge);
    });
    /* arms: upper, elbow, forearm, gauntlet */
    function arm(sd) {
      var a = new THREE.Group(); a.position.set(0.33 * sd, 1.42, 0);
      a.add(segment(M, 0.32, 0.068, 0.055));
      a.add(mesh(sph(0.058, 10, 8), M, 0, -0.32, 0));
      var fa = segment(M, 0.28, 0.055, 0.048); fa.position.y = -0.33; a.add(fa);
      var g = mesh(sph(0.058, 10, 8), M, 0, -0.62, 0.01); g.scale.set(1, 1.1, 1.15); a.add(g);
      return a;
    }
    var armL = arm(-1); armL.rotation.z = -0.1; body.add(armL);
    var armR = arm(1); armR.rotation.z = 0.1; body.add(armR);
    var eyeM = glowMat(opt.eye || 0xffffff);
    var eL = mesh(box(0.055, 0.014, 0.02), eyeM, -0.048, 0.015, 0.122); eL.rotation.z = 0.12; head.add(eL);
    var eR = mesh(box(0.055, 0.014, 0.02), eyeM, 0.048, 0.015, 0.122); eR.rotation.z = -0.12; head.add(eR);
    var gl = glowSprite(opt.eyeGlow || opt.color, 0.32); gl.position.set(0, 0.015, 0.15); head.add(gl);
    /* a faint core light in the chest */
    var core = glowSprite(opt.color, 0.22); core.position.set(0, 1.28, 0.2); core.material.opacity = 0.8; body.add(core);
    return { root: root, body: body, head: head, armL: armL, armR: armR, eyes: [eL, eR], eyeGlow: gl, torso: torso, core: core };
  }

  /* ---------- class builders ---------- */
  var BUILD = {
    Knight: function (M, c, H) {
      H.head.add(mesh(lathe([[0, 0.17], [0.11, 0.15], [0.15, 0.06], [0.15, -0.12], [0.12, -0.14], [0, -0.14]], 14), M, 0, 0.02, 0));
      H.head.add(mesh(box(0.18, 0.012, 0.02), glowMat(c), 0, 0.015, 0.15));
      var plume = mesh(box(0.04, 0.24, 0.34), M, 0, 0.28, -0.06); plume.rotation.x = -0.5; H.head.add(plume); H.plume = plume;
      var cape = mesh(clothPlane(0.72, 1.25), M, 0, 1.52, -0.2); cape.material = rimMat(c, 0.45, THREE.DoubleSide); H.body.add(cape); H.cape = cape;
      var sword = new THREE.Group();
      sword.add(mesh(box(0.06, 1.05, 0.015), M, 0, -0.62, 0));
      sword.add(mesh(box(0.012, 0.95, 0.018), glowMat(c), 0, -0.6, 0.004));
      sword.add(mesh(box(0.26, 0.04, 0.05), M, 0, -0.08, 0));
      sword.add(mesh(cyl(0.025, 0.025, 0.16), M, 0, 0.02, 0));
      sword.position.set(0, -0.62, 0.05); H.armR.add(sword); H.weapon = sword;
      H.armR.rotation.x = -0.25;
    },
    Archer: function (M, c, H) {
      var hood = mesh(sph(0.19, 12, 10), M, 0, 0.03, -0.02); hood.scale.set(1, 1.15, 1.1); H.head.add(hood);
      var bow = new THREE.Group();
      var arc = mesh(new THREE.TorusGeometry(0.62, 0.022, 6, 28, Math.PI * 0.95), M); arc.rotation.z = Math.PI / 2 + 0.08; bow.add(arc);
      var str = mesh(cyl(0.004, 0.004, 1.2, 4), glowMat(c), -0.04, 0, 0); bow.add(str); H.string = str;
      bow.position.set(0, -0.62, 0.12); bow.rotation.y = Math.PI / 2; H.armL.add(bow); H.weapon = bow;
      H.armL.rotation.x = -0.9; H.armL.rotation.z = -0.25;
      var quiver = mesh(cyl(0.07, 0.06, 0.62), M, 0.12, 1.28, -0.22); quiver.rotation.z = -0.35; H.body.add(quiver);
      for (var i = 0; i < 3; i++) { var a = mesh(cyl(0.008, 0.008, 0.3, 4), glowMat(c), 0.22 + i * 0.03, 1.62, -0.24 + i * 0.02); a.rotation.z = -0.35; H.body.add(a); }
    },
    Mage: function (M, c, H) {
      var hat = mesh(cone(0.24, 0.62, 14), M, 0, 0.36, 0); hat.rotation.x = -0.12; H.head.add(hat);
      var brim = mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 18), M, 0, 0.08, 0); brim.rotation.x = Math.PI / 2; H.head.add(brim);
      var staff = new THREE.Group();
      staff.add(mesh(cyl(0.025, 0.03, 2.0), M, 0, 0.1, 0));
      var orb = mesh(sph(0.09), glowMat(c), 0, 1.16, 0); staff.add(orb);
      var og = glowSprite(c, 0.7); og.position.y = 1.16; staff.add(og); H.orb = og;
      staff.position.set(0.12, -0.64, 0.12); H.armR.add(staff); H.weapon = staff;
      H.armR.rotation.z = 0.35; H.armR.rotation.x = -0.2;
    },
    Assassin: function (M, c, H) {
      var hood = mesh(sph(0.18, 12, 10), M, 0, 0.02, -0.02); hood.scale.set(1, 1.1, 1.15); H.head.add(hood);
      H.head.add(mesh(box(0.26, 0.09, 0.05), M, 0, -0.05, 0.13));
      var s1 = mesh(clothPlane(0.1, 0.9, 2, 10), rimMat(c, 0.6, THREE.DoubleSide), 0.06, 1.6, -0.12); s1.rotation.y = 0.4; H.body.add(s1);
      var s2 = mesh(clothPlane(0.08, 0.7, 2, 10), rimMat(c, 0.6, THREE.DoubleSide), -0.04, 1.58, -0.12); s2.rotation.y = -0.3; H.body.add(s2);
      H.scarves = [s1, s2];
      [H.armL, H.armR].forEach(function (a, i) {
        var d = new THREE.Group(); d.add(mesh(box(0.035, 0.38, 0.012), M, 0, -0.2, 0)); d.add(mesh(box(0.008, 0.34, 0.016), glowMat(c), 0, -0.2, 0.002));
        d.position.set(0, -0.66, 0.04); d.rotation.x = 1.9; a.add(d); a.rotation.x = -0.5; a.rotation.z += i ? 0.25 : -0.25;
      });
      H.body.rotation.x = 0.12; H.body.position.y = -0.06;
    },
    Lancer: function (M, c, H) {
      H.head.add(mesh(cyl(0.16, 0.16, 0.22, 12), M, 0, 0.03, 0));
      var h1 = mesh(cone(0.04, 0.3, 6), M, -0.15, 0.24, 0); h1.rotation.z = 0.5; H.head.add(h1);
      var h2 = mesh(cone(0.04, 0.3, 6), M, 0.15, 0.24, 0); h2.rotation.z = -0.5; H.head.add(h2);
      var spear = new THREE.Group();
      spear.add(mesh(cyl(0.022, 0.022, 2.6), M, 0, 0.3, 0));
      spear.add(mesh(cone(0.06, 0.28, 8), M, 0, 1.72, 0));
      spear.add(mesh(cone(0.02, 0.22, 6), glowMat(c), 0, 1.72, 0.03));
      spear.position.set(0, -0.6, 0.06); spear.rotation.x = -0.15; H.armR.add(spear); H.weapon = spear;
      H.armR.rotation.x = -0.35;
    },
    Bulwark: function (M, c, H) {
      H.body.scale.set(1.25, 1, 1.2);
      H.head.add(mesh(cyl(0.17, 0.19, 0.3, 10), M, 0, 0.04, 0));
      var shield = new THREE.Group();
      shield.add(mesh(box(0.72, 1.0, 0.06), M));
      shield.add(mesh(box(0.04, 0.84, 0.02), glowMat(c), 0, 0, 0.04));
      shield.add(mesh(box(0.56, 0.04, 0.02), glowMat(c), 0, 0.12, 0.04));
      shield.add(mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20), glowMat(c), 0, 0.12, 0.045));
      shield.position.set(0.2, -0.45, 0.3); H.armL.add(shield); H.weapon = shield;
      H.armL.rotation.x = -0.9; H.armL.rotation.z = 0.5;
    },
    Healer: function (M, c, H) {
      var hood = mesh(sph(0.18, 12, 10), M, 0, 0.03, -0.02); hood.scale.set(1, 1.15, 1.1); H.head.add(hood);
      var staff = new THREE.Group();
      staff.add(mesh(cyl(0.025, 0.03, 2.0), M, 0, 0.1, 0));
      var ring = mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 24), glowMat(c), 0, 1.24, 0); staff.add(ring); H.ring = ring;
      var g = glowSprite(c, 0.6); g.position.y = 1.24; staff.add(g); H.orb = g;
      staff.position.set(0.1, -0.64, 0.1); H.armL.add(staff); H.weapon = staff;
      H.armL.rotation.z = -0.35; H.armL.rotation.x = -0.2;
    },
    Berserker: function (M, c, H) {
      H.root.scale.setScalar(1.12); H.body.scale.x = 1.15;
      H.head.add(mesh(cyl(0.165, 0.17, 0.24, 10), M, 0, 0.04, 0));
      var h1 = mesh(cone(0.05, 0.36, 6), M, -0.2, 0.2, 0); h1.rotation.z = 1.1; H.head.add(h1);
      var h2 = mesh(cone(0.05, 0.36, 6), M, 0.2, 0.2, 0); h2.rotation.z = -1.1; H.head.add(h2);
      var fur = mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 16), M, 0, 1.5, 0); fur.rotation.x = Math.PI / 2; H.body.add(fur);
      var axe = new THREE.Group();
      axe.add(mesh(cyl(0.03, 0.03, 1.5), M, 0, -0.2, 0));
      var blade = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16, 1, false, 0, Math.PI), M, 0.0, 0.42, 0); blade.rotation.z = Math.PI / 2; blade.rotation.y = Math.PI / 2; axe.add(blade);
      axe.add(mesh(box(0.012, 0.5, 0.05), glowMat(c), 0.32, 0.42, 0));
      axe.position.set(0, -0.62, 0.05); axe.rotation.x = -0.35; H.armR.add(axe); H.weapon = axe;
      H.armR.rotation.x = -0.6;
    }
  };

  /* ---------- monarchs ---------- */
  function wingGeo(span, drop, spread) {
    var s = new THREE.Shape();
    s.moveTo(0, 0); s.bezierCurveTo(span * 0.3, drop * 0.6 + 0.3, span * 0.7, drop + 0.25, span, drop + 0.15);
    var n = spread || 4;
    for (var i = 0; i < n; i++) {
      var k = 1 - (i + 1) / n;
      s.lineTo(span * (0.2 + 0.8 * k) + 0.05, (drop - 0.35) * (1 - k) - 0.4 * k + 0.05);
      s.lineTo(span * (0.15 + 0.8 * k), (drop - 0.1) * (1 - k) - 0.15);
    }
    s.lineTo(0, -0.3); s.lineTo(0, 0);
    return s;
  }
  /* a wing: translucent dark membrane, glowing rim, and veins running
     from the root out to every tip */
  function wing(span, drop, n, edgeHex) {
    var shape = wingGeo(span, drop, n), g = new THREE.Group();
    var mem = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), new THREE.MeshBasicMaterial({ color: 0x14052a, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false }));
    g.add(mem);
    var pts = shape.getPoints(8);
    var edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: edgeHex, transparent: true, opacity: 0.95 }));
    g.add(edge);
    var veins = [], tips = shape.curves.length;
    shape.curves.forEach(function (cv, i) { if (i % 2 === 1) { var e = cv.getPoint(1); veins.push(new THREE.Vector2(0, 0), e); } });
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(veins), new THREE.LineBasicMaterial({ color: edgeHex, transparent: true, opacity: 0.45 })));
    var glow = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), new THREE.MeshBasicMaterial({ color: edgeHex, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    glow.scale.setScalar(1.04); g.add(glow);
    return g;
  }
  var MON = {
    regent: function (M, c) {
      var H = humanoid(M, { color: c, eye: 0xffe2e8, eyeGlow: 0xff3b5c });
      H.root.scale.setScalar(1.3);
      H.head.add(mesh(cyl(0.165, 0.165, 0.24, 12), M, 0, 0.03, 0));
      for (var i = 0; i < 7; i++) { var a = i / 7 * 6.283, sp = mesh(cone(0.035, 0.16 + (i % 2) * 0.08, 6), glowMat(0xffd166), Math.cos(a) * 0.16, 0.24, Math.sin(a) * 0.16); H.head.add(sp); }
      var cape = mesh(clothPlane(1.05, 1.55, 8, 12), rimMat(0xffb84d, 0.4, THREE.DoubleSide), 0, 1.55, -0.24); H.body.add(cape); H.cape = cape;
      var sword = new THREE.Group();
      sword.add(mesh(box(0.08, 1.5, 0.02), M, 0, 0.9, 0)); sword.add(mesh(box(0.016, 1.4, 0.024), glowMat(0xff3b5c), 0, 0.9, 0.004));
      sword.add(mesh(box(0.34, 0.05, 0.06), M, 0, 0.12, 0));
      sword.position.set(0, -0.62, 0); H.armR.add(sword); H.weapon = sword;
      H.armR.rotation.z = 0.25; H.armR.rotation.x = -0.15; H.raise = true;
      return H;
    },
    archon: function (M, c) {
      var H = humanoid(M, { color: c, robe: true, eye: 0xffe2e8, eyeGlow: 0xff3b5c });
      H.root.scale.setScalar(1.2);
      var hood = mesh(sph(0.18, 12, 10), M, 0, 0.03, -0.02); hood.scale.set(1, 1.15, 1.1); H.head.add(hood);
      var halo = mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 32), glowMat(0xffd166), 0, 0.36, -0.05); halo.rotation.x = Math.PI / 2 - 0.3; H.head.add(halo); H.halo = halo;
      H.wings = [];
      [[1, 0.0, 0.9], [1, -0.35, 0.7]].forEach(function (cfg) {
        [-1, 1].forEach(function (sd) {
          var w = wing(cfg[2], 0.5 + cfg[1], 5, 0xffd166); w.position.set(0.12 * sd, 1.42 + cfg[1] * 0.6, -0.22); w.scale.x = sd;
          w.rotation.y = sd * 0.35; H.body.add(w); H.wings.push({ m: w, sd: sd, base: w.rotation.y });
        });
      });
      return H;
    },
    wyrm: function (M, c) {
      var root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      root.scale.setScalar(1.15); body.rotation.y = 0.85;
      var torso = mesh(sph(0.5, 16, 12), M, 0, 0.85, 0); torso.scale.set(0.75, 0.62, 1.15); body.add(torso);
      for (var i = 0; i < 4; i++) { var lg = mesh(cyl(0.07, 0.09, 0.62), M, (i % 2 ? 0.28 : -0.28), 0.32, (i < 2 ? 0.32 : -0.32)); body.add(lg); }
      var neckCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.0, 0.45), new THREE.Vector3(0, 1.45, 0.6), new THREE.Vector3(0, 1.8, 0.45), new THREE.Vector3(0, 2.0, 0.62)]);
      body.add(mesh(new THREE.TubeGeometry(neckCurve, 16, 0.12, 8, false), M));
      var head = new THREE.Group(); head.position.set(0, 2.02, 0.7); body.add(head);
      var skull = mesh(box(0.26, 0.2, 0.46), M, 0, 0, 0.08); head.add(skull);
      head.add(mesh(box(0.22, 0.08, 0.3), M, 0, -0.1, 0.25));
      [-1, 1].forEach(function (sd) { var h = mesh(cone(0.04, 0.34, 6), M, 0.1 * sd, 0.16, -0.12); h.rotation.x = -1.0; h.rotation.z = 0.3 * sd; head.add(h); });
      var eM = glowMat(0xffe2e8), e1 = mesh(box(0.05, 0.02, 0.06), eM, -0.1, 0.04, 0.24), e2 = mesh(box(0.05, 0.02, 0.06), eM, 0.1, 0.04, 0.24);
      head.add(e1); head.add(e2);
      var eg = glowSprite(0xff3b5c, 0.5); eg.position.set(0, 0.04, 0.3); head.add(eg);
      var tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.8, -0.5), new THREE.Vector3(0.2, 0.6, -1.0), new THREE.Vector3(-0.1, 0.4, -1.5), new THREE.Vector3(0.25, 0.3, -1.9)]);
      var tail = mesh(new THREE.TubeGeometry(tailCurve, 16, 0.08, 6, false), M); body.add(tail);
      var wings = [];
      [-1, 1].forEach(function (sd) {
        var w = wing(1.15, 0.75, 4, 0xff6b4a); w.position.set(0.18 * sd, 1.2, 0.05); w.scale.x = sd; w.rotation.y = sd * 0.2; body.add(w);
        wings.push({ m: w, sd: sd, base: w.rotation.y });
      });
      return { root: root, body: body, head: head, eyes: [e1, e2], eyeGlow: eg, wings: wings, tail: tail, dragon: true };
    },
    fenris: function (M, c) {
      var root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      root.scale.setScalar(1.25); body.rotation.y = 0.7;
      var torso = mesh(sph(0.42, 16, 12), M, 0, 0.78, 0); torso.scale.set(0.72, 0.75, 1.35); body.add(torso);
      var chest = mesh(sph(0.36, 14, 10), M, 0, 0.9, 0.38); chest.scale.set(0.95, 1, 0.9); body.add(chest);
      for (var i = 0; i < 4; i++) { var lg = mesh(cyl(0.06, 0.08, 0.6), M, (i % 2 ? 0.2 : -0.2), 0.3, (i < 2 ? 0.42 : -0.42)); body.add(lg); }
      var head = new THREE.Group(); head.position.set(0, 1.22, 0.62); body.add(head);
      head.add(mesh(sph(0.2, 14, 10), M));
      var snout = mesh(cone(0.11, 0.34, 8), M, 0, -0.04, 0.24); snout.rotation.x = Math.PI / 2; head.add(snout);
      [-1, 1].forEach(function (sd) { head.add(mesh(cone(0.06, 0.2, 5), M, 0.11 * sd, 0.22, -0.02)); });
      var eM = glowMat(0xffe2e8), e1 = mesh(box(0.05, 0.018, 0.02), eM, -0.08, 0.05, 0.17), e2 = mesh(box(0.05, 0.018, 0.02), eM, 0.08, 0.05, 0.17);
      head.add(e1); head.add(e2);
      var eg = glowSprite(0xff3b5c, 0.45); eg.position.set(0, 0.05, 0.2); head.add(eg);
      var tail = mesh(cone(0.1, 0.8, 8), M, 0, 0.98, -0.78); tail.rotation.x = -2.1; body.add(tail);
      for (var m2 = 0; m2 < 6; m2++) { var sp = mesh(cone(0.05, 0.2, 5), M, 0, 1.12 - m2 * 0.02, 0.3 - m2 * 0.15); sp.rotation.x = -0.5; body.add(sp); }
      return { root: root, body: body, head: head, eyes: [e1, e2], eyeGlow: eg, tail: tail, wolf: true };
    }
  };

  /* ---------- aura particles ---------- */
  function aura(count, colors, radius, height) {
    var g = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), col = new Float32Array(count * 3), seed = [];
    for (var i = 0; i < count; i++) {
      seed.push({ a: Math.random() * 6.283, r: radius * (0.3 + Math.random() * 0.7), y: Math.random() * height, v: 0.35 + Math.random() * 0.6, w: Math.random() * 6.283 });
      var c = new THREE.Color(colors[i % colors.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    var p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.11, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    p.userData.tick = function (t, dt) {
      for (var i = 0; i < count; i++) {
        var s = seed[i];
        s.y += s.v * dt; if (s.y > height) { s.y = 0; s.a = Math.random() * 6.283; }
        var k = s.y / height, rr = s.r * (1 - k * 0.55);
        pos[i * 3] = Math.cos(s.a + t * 0.4) * rr + Math.sin(t * 2 + s.w) * 0.04;
        pos[i * 3 + 1] = s.y;
        pos[i * 3 + 2] = Math.sin(s.a + t * 0.4) * rr;
      }
      g.attributes.position.needsUpdate = true;
    };
    return p;
  }
  /* licking flame tongues: additive cones that stretch and sway */
  function flames(n, colors, radius, h) {
    var grp = new THREE.Group(), list = [];
    for (var i = 0; i < n; i++) {
      var m = new THREE.Mesh(cone(0.12, 1, 6), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      var a = i / n * 6.283; m.position.set(Math.cos(a) * radius, 0.5 * h, Math.sin(a) * radius);
      m.userData = { a: a, ph: Math.random() * 6.283, h: h * (0.7 + Math.random() * 0.6) };
      grp.add(m); list.push(m);
    }
    grp.userData.tick = function (t) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i], u = m.userData, k = 0.75 + 0.35 * Math.sin(t * 4 + u.ph);
        m.scale.set(1, u.h * k, 1); m.position.y = u.h * k / 2;
        m.rotation.z = Math.sin(t * 3 + u.ph) * 0.15; m.material.opacity = 0.14 + 0.1 * Math.sin(t * 5 + u.ph);
      }
    };
    return grp;
  }

  /* ---------- build any shadow ---------- */
  var TIER_COLORS = ["#8f86c9", "#6f9bff", "#a855f7", "#e879f9", "#ffd166", "#ffd166"];
  function build(sh) {
    var c = sh.monarch ? 0xffd166 : new THREE.Color(TIER_COLORS[sh.tier] || TIER_COLORS[0]).getHex();
    var M = rimMat(sh.monarch ? 0xffb84d : c, sh.monarch ? 1.25 : 1);
    var H;
    if (sh.monarch && MON[sh.monarch]) H = MON[sh.monarch](M, c);
    else { H = humanoid(M, { color: c }); (BUILD[sh.cls] || BUILD.Knight)(M, c, H); }
    var bb = new THREE.Box3().setFromObject(H.root), ctr = bb.getCenter(new THREE.Vector3());
    H.root.position.x -= ctr.x; H.root.position.z -= ctr.z;
    var fig = new THREE.Group(); fig.add(H.root);
    var auraCols = sh.monarch ? [0xffd166, 0xff3b5c, 0xa855f7, 0xc026d3] : [c, c, 0x2a0a52, 0xffffff];
    var au = aura(sh.monarch ? 110 : 46, auraCols, sh.monarch ? 0.95 : 0.55, sh.monarch ? 3.4 : 2.3);
    fig.add(au);
    var fl = sh.monarch ? flames(14, [0xffb84d, 0xff3b5c, 0xa855f7], 0.62, 2.8) : (sh.tier >= 2 ? flames(8, [c, 0x6d28d9], 0.42, 1.6) : null);
    if (fl) fig.add(fl);
    var base = glowSprite(c, sh.monarch ? 3.2 : 1.8); base.position.y = 0.05; base.material.opacity = 0.45; fig.add(base);
    if (sh.monarch) {
      var ringM = new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      var quake = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), ringM); quake.rotation.x = -Math.PI / 2; quake.position.y = 0.02; fig.add(quake); H.quake = quake;
    }
    var phase = Math.random() * 6.283;
    fig.userData = { id: sh.id, tick: function (t, dt) {
      var tt = t + phase;
      au.userData.tick(tt, dt); if (fl) fl.userData.tick(tt);
      if (H.body && !H.dragon && !H.wolf) H.body.scale.y = (H.body.userData.sy || (H.body.userData.sy = H.body.scale.y)) * (1 + Math.sin(tt * 1.6) * 0.012);
      if (H.head) H.head.rotation.y = Math.sin(tt * 0.5) * 0.18;
      if (H.cape) wave(H.cape.geometry, tt, 0.12, 2.2);
      if (H.scarves) H.scarves.forEach(function (s, i) { wave(s.geometry, tt + i, 0.35, 5); });
      if (H.plume) H.plume.rotation.z = Math.sin(tt * 3) * 0.12;
      if (H.weapon && !H.raise) H.weapon.rotation.z = Math.sin(tt * 1.1) * 0.06;
      if (H.raise && H.armR) H.armR.rotation.z = 0.25 + Math.sin(tt * 0.9) * 0.08;
      if (H.string) H.string.position.x = -0.04 - Math.max(0, Math.sin(tt * 1.2)) * 0.18;
      if (H.orb) { var k = 0.6 + Math.sin(tt * 3) * 0.12; H.orb.scale.set(k, k, 1); }
      if (H.ring) H.ring.rotation.y = tt * 1.5;
      if (H.halo) H.halo.rotation.z = tt * 0.6;
      if (H.wings) H.wings.forEach(function (w, i) { w.m.rotation.y = w.base + w.sd * Math.sin(tt * (H.dragon ? 2.2 : 1.4) + i * 0.3) * (H.dragon ? 0.45 : 0.22); });
      if (H.tail) H.tail.rotation.y = Math.sin(tt * 1.3) * 0.25;
      if (H.eyeGlow) { var e = (Math.sin(tt * 0.9) > 0.97) ? 0.05 : 1; H.eyes.forEach(function (m) { m.scale.y = e; }); H.eyeGlow.material.opacity = 0.7 + Math.sin(tt * 2) * 0.3; }
      if (H.quake) { var q = (tt * 0.45) % 1; H.quake.scale.setScalar(0.4 + q * 1.4); H.quake.material.opacity = (1 - q) * 0.75; }
    } };
    return fig;
  }

  /* ---------- scenes ---------- */
  function makeRenderer(el) {
    var r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setClearColor(0x000000, 0);
    el.appendChild(r.domElement);
    return r;
  }
  function loopFor(el, renderer, scene, camera, onFrame) {
    var alive = true, last = performance.now(), t = 0;
    function size() {
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return false;
      if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px"; camera.aspect = w / h; camera.updateProjectionMatrix(); }
      return true;
    }
    (function frame(now) {
      if (!alive) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var vis = !document.hidden && el.isConnected && el.offsetParent !== null;
      if (vis && size()) { t += RM ? 0 : dt; onFrame(t, dt); renderer.render(scene, camera); }
      requestAnimationFrame(frame);
    })(last);
    return function () {
      alive = false;
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose && !(o.material instanceof THREE.ShaderMaterial)) o.material.dispose(); });
      renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }
  function baseScene() {
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07020f, 0.11);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    var mist = aura(160, [0x3b0764, 0x581c87, 0x1e1b4b], 4.2, 0.8); mist.material.size = 0.5; mist.material.opacity = 0.35; scene.add(mist);
    return { scene: scene, floor: floor, mist: mist };
  }

  var SLOTS = [[0, 0], [-1.15, -0.9], [1.15, -0.9], [-2.2, -1.75], [2.2, -1.75], [-3.1, -2.6], [3.1, -2.6], [-1.05, -2.6], [1.05, -2.6]];
  window.__mx3d = {
    stage: function (el, shadows, onPick) {
      var renderer = makeRenderer(el), B = baseScene(), scene = B.scene;
      var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
      var figs = [], n = Math.min(shadows.length, SLOTS.length), cxs = 0, czs = 0, spread = 0;
      for (var q = 0; q < n; q++) { cxs += SLOTS[q][0]; czs += SLOTS[q][1]; }
      var CX = n ? cxs / n : 0, CZ = n ? czs / n : 0;
      for (var q2 = 0; q2 < n; q2++) spread = Math.max(spread, Math.abs(SLOTS[q2][0] - CX), Math.abs(SLOTS[q2][1] - CZ));
      shadows.slice(0, SLOTS.length).forEach(function (sh, i) {
        var f = build(sh); f.position.set(SLOTS[i][0], 0, SLOTS[i][1]);
        f.rotation.y = -SLOTS[i][0] * 0.08; scene.add(f); figs.push(f);
      });
      var ray = new THREE.Raycaster(), v = new THREE.Vector2();
      function pick(e) {
        var r = renderer.domElement.getBoundingClientRect();
        v.x = ((e.clientX - r.left) / r.width) * 2 - 1; v.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(v, camera);
        var hits = ray.intersectObjects(figs, true);
        for (var i = 0; i < hits.length; i++) {
          var o = hits[i].object; if (o.type === "Points" || o.type === "Sprite") continue;
          while (o && !(o.userData && o.userData.id)) o = o.parent;
          if (o && onPick) { onPick(o.userData.id); return; }
        }
      }
      /* drag to swing the camera round the army */
      var drag = 0, dragV = 0, sx = null, moved = false;
      renderer.domElement.style.touchAction = "pan-y";
      renderer.domElement.addEventListener("pointerdown", function (e) { sx = e.clientX; moved = false; });
      renderer.domElement.addEventListener("pointermove", function (e) { if (sx === null) return; var d = e.clientX - sx; if (Math.abs(d) > 4) moved = true; dragV = d * 0.006; drag += dragV; sx = e.clientX; });
      renderer.domElement.addEventListener("pointerup", function (e) { if (!moved) pick(e); sx = null; });
      renderer.domElement.addEventListener("pointercancel", function () { sx = null; });
      var stop = loopFor(el, renderer, scene, camera, function (t, dt) {
        if (sx === null) { dragV *= 0.94; drag += dragV; drag *= 0.995; }
        var ang = Math.sin(t * 0.18) * 0.32 + drag, R = 5.2 + spread * 0.9;
        camera.position.set(CX + Math.sin(ang) * R, 1.9 + spread * 0.25, CZ + Math.cos(ang) * R);
        camera.lookAt(CX, 1.05, CZ);
        B.floor.position.set(CX, 0, CZ); B.floor.rotation.z = t * 0.05;
        B.mist.userData.tick(t, dt);
        for (var i = 0; i < figs.length; i++) figs[i].userData.tick(t, dt);
      });
      return { destroy: stop };
    },
    turntable: function (el, sh) {
      var renderer = makeRenderer(el), B = baseScene(), scene = B.scene;
      scene.fog.density = 0.05;
      var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
      var f = build(sh); scene.add(f);
      var big = !!sh.monarch, spin = 0, sx = null, vel = 0.5;
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.addEventListener("pointerdown", function (e) { sx = e.clientX; e.stopPropagation(); });
      renderer.domElement.addEventListener("pointermove", function (e) { if (sx === null) return; vel = (e.clientX - sx) * 0.5; spin += (e.clientX - sx) * 0.012; sx = e.clientX; });
      renderer.domElement.addEventListener("pointerup", function (e) { sx = null; e.stopPropagation(); });
      renderer.domElement.addEventListener("click", function (e) { e.stopPropagation(); });
      var stop = loopFor(el, renderer, scene, camera, function (t, dt) {
        if (sx === null) { vel += (0.5 - vel) * 0.03; spin += vel * dt; }
        f.rotation.y = spin;
        camera.position.set(0, big ? 2.2 : 1.6, big ? 7.4 : 5.4); camera.lookAt(0, big ? 1.5 : 1.05, 0);
        B.floor.rotation.z = t * 0.08; B.mist.userData.tick(t, dt);
        f.userData.tick(t, dt);
      });
      return { destroy: stop };
    }
  };
})();
