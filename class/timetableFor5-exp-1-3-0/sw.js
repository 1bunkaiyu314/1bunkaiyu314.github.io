const CACHE_NAME = "1.3.0";

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
        "./assets/html/detail.html",
        "./assets/html/source.html",
        "./assets/html/terms.html",
        "./assets/images/icons/icon-192.png",
        "./assets/images/icons/icon-512.png",
        "./assets/images/moon-dark.svg",
        "./assets/images/sun-light.svg",
        "./assets/json/timetable/timetable_class-1.json",
        "./assets/json/timetable/timetable_class-2.json",
        "./assets/json/timetable/timetable_class-3.json",
        "./assets/json/timetable/timetable_class-4.json",
        "./assets/json/timetable/timetable_class-5.json",
        "./assets/json/timetable/timetable_class-6.json",
        "./assets/json/timetable/timetable_class-7.json",
        "./assets/json/timetable/timetable_class-8.json",
        "./assets/json/timetable/timetable_class-9.json",
        "./assets/json/events.json",
        "./assets/json/class_expansion_map.json",
        "./assets/setting.html",
        "./assets/json/subjects_rooms_map.json",
        "./assets/json/holidays.json",
        "./index.html",
        "./manifest.json",
        "./assets/js/app.js",
        "./assets/js/modules/db.js",
        "./assets/js/modules/modal.js",
        "./assets/js/modules/net.js",
        "./assets/js/modules/settingMenu.js",
        "./assets/js/modules/theme.js",
        "./assets/js/modules/utils.js",
        "./assets/css/style.css",
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