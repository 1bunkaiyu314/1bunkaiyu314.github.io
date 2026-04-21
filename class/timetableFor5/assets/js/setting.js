// Legacy entrypoint (kept for compatibility). The app is now initialized by assets/js/app.js.
(function () {
  if (window.__timetable_app_loaded) return;
  var s = document.createElement("script");
  s.src = "./assets/js/script.js";
  document.head.appendChild(s);
})();
