// Classic head script: runs before the app module and is allowed by MV3's script-src 'self'.
// Keep this small reader in sync with src/app/appearance.ts; the settings store
// remains authoritative once it loads.
(function () {
  var appearance = 'light';
  try {
    var raw = window.localStorage.getItem('appearance');
    var parsed = raw === null ? null : JSON.parse(raw);
    if (parsed === 'dark') appearance = 'dark';
  } catch (error) {
    // Storage can be unavailable in private or restricted contexts.
  }
  document.documentElement.dataset.appearance = appearance;
})();
