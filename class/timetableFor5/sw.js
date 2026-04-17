const CACHE_NAME = "1.0.2";

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request);
    })
  );
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "./assets/html/help.html",
        "./assets/html/history.html",
        "./assets/html/source_timetable.html",
        "./assets/html/source.html",
        "./assets/html/terms.html",
        "./assets/icons/icon-192.png",
        "./assets/icons/icon-512.png",
        "./assets/images/moon-dark.svg",
        "./assets/images/sun-light.svg",
        "./assets/timetable/timetable_class-1.json",
        "./assets/timetable/timetable_class-2.json",
        "./assets/timetable/timetable_class-3.json",
        "./assets/timetable/timetable_class-4.json",
        "./assets/timetable/timetable_class-5.json",
        "./assets/timetable/timetable_class-6.json",
        "./assets/timetable/timetable_class-7.json",
        "./assets/timetable/timetable_class-8.json",
        "./assets/timetable/timetable_class-9.json",
        "./assets/events.json",
        "./assets/expansion_map.json",
        "./assets/setting.html",
        "./assets/subjects_rooms_map.json",
        "./index.html",
        "./manifest.json",
        "./script.js",
        "./settings.js",
        "./style.css",
      ])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});