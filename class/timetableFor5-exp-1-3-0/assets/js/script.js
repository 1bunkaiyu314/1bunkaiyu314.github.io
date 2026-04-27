(function () {
  // Legacy entrypoint: keep old pages working by loading the new module app.
  if (window.__timetable_app_legacy_loader_ran) return;
  window.__timetable_app_legacy_loader_ran = true;

  if (window.__timetable_app_loaded) return;

  var existing = document.querySelector('script[type="module"][src$="/assets/js/app.js"],script[type="module"][src$="./assets/js/app.js"]');
  if (existing) return;

  var s = document.createElement("script");
  s.type = "module";
  s.src = "./assets/js/app.js";
  document.head.appendChild(s);
})();
