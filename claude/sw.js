/* System v2 offline worker: the app shell is cached so it opens
   without a connection; the page itself is fetched fresh first
   (network-first) so updates show up on the next open. */
var CACHE = "system-v2.24";
var V = "?v=2.24"; /* keep in step with the ?v= on the links in index.html */
var SHELL = ["./", "index.html", "motion.css" + V, "quests.css" + V, "v2.css" + V, "polish.css" + V, "intel.css" + V, "motion.js" + V, "bolts.js" + V, "aura.js" + V, "quests.js" + V, "v2.js" + V, "polish.js" + V, "intel.js" + V, "data/econ.json", "shadows3d.js" + V,
  "manifest.webmanifest", "icon-512.png", "apple-touch-icon.png", "../x-logo.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  /* live weather: always the network */
  if (url.hostname === "api.open-meteo.com") return;
  var sameOrigin = url.origin === self.location.origin;
  /* pages and our own scripts/styles: network first, cache as fallback */
  if (sameOrigin && !/\.glb$/.test(url.pathname)) {
    /* no-cache = always ask the server (a cheap 304 when unchanged), so
       GitHub Pages' 10-minute browser cache can't serve a stale build */
    e.respondWith(fetch(req, { cache: "no-cache" }).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match("index.html"); }); }));
    return;
  }
  /* fonts, three.js, the car model: cache first */
  if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname) || /\.glb$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  }
});
