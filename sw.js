// Bump CACHE when any listed file changes, otherwise old files stay cached.
const CACHE = "handball-v25";
const FILES = [
  "./",
  "index.html",
  "css/app.css",
  "js/main.js",
  "js/schema.js",
  "js/storage.js",
  "js/idb.js",
  "js/settings.js",
  "js/views/settings.js",
  "js/views/start.js",
  "js/situation.js",
  "js/hold.js",
  "js/views/pitch.js",
  "js/goal.js",
  "js/views/goal.js",
  "js/views/numpad.js",
  "js/views/chips.js",
  "js/shotflow.js",
  "js/clock.js",
  "js/score.js",
  "js/eventlist.js",
  "js/views/sidebar.js",
  "js/views/live.js",
  "js/charts/line.js",
  "js/stats.js",
  "js/views/game.js",
  "js/charts/bars.js",
  "js/charts/heatmap.js",
  "js/views/compare.js",
  "js/views/season.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/logo.png",
  "icons/icon-maskable.svg",
];

self.addEventListener("install", (e) => {
  // cache: "reload" skips the browser's HTTP cache, which can hand the new worker stale copies of the files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
