/* DAVIMART shared navigation: same-site history with a safe Home fallback. */
(function () {
  "use strict";
  var HOME = new URL("index.html", window.location.href).href;
  var KEY = "davimart_navigation_trail_v1";
  var here = window.location.href;
  function readTrail() {
    try {
      var value = JSON.parse(sessionStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value.filter(function (url) {
        try { return new URL(url).origin === location.origin; } catch (_) { return false; }
      }) : [];
    } catch (_) { return []; }
  }
  function writeTrail(trail) {
    try { sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-40))); } catch (_) {}
  }
  var trail = readTrail();
  if (trail[trail.length - 1] !== here) {
    trail.push(here);
    writeTrail(trail);
  }
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
    var destination;
    try { destination = new URL(link.href, location.href); } catch (_) { return; }
    if (destination.origin !== location.origin || destination.href === here) return;
    var currentTrail = readTrail();
    if (currentTrail[currentTrail.length - 1] !== here) currentTrail.push(here);
    writeTrail(currentTrail);
  }, true);
  window.addEventListener("popstate", function () {
    var currentTrail = readTrail();
    while (currentTrail.length && currentTrail[currentTrail.length - 1] === here) currentTrail.pop();
    var previous = currentTrail.length ? currentTrail[currentTrail.length - 1] : HOME;
    writeTrail(currentTrail);
    if (previous === here) previous = HOME;
    window.location.replace(previous);
  });
  try { history.pushState({ davimartNavigationGuard: true }, "", location.href); } catch (_) {}
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      try { history.pushState({ davimartNavigationGuard: true }, "", location.href); } catch (_) {}
    }
  });
})();