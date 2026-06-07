// Source of truth for the preview-iframe bootstrap.
//
// CSP-CRITICAL: this is a REAL `.js` file (not a TS template string) so Vite emits
// it as a hashed asset and previewHtml.ts can reference it via `<script src=...>`.
// An INLINE `<script>${...}</script>` block is blocked under the packaged MV3
// extension's default `script-src 'self'` CSP (which MV3 forbids relaxing with
// 'unsafe-inline'), leaving the preview blank — see roadmap §9 M05 finding #1.
// Loading the bootstrap as a same-origin asset (the SAME rail as the @zenuml/core
// `?url` script next to it) keeps it `'self'`-compliant in both web and extension.
//
// Runs INSIDE the srcdoc iframe. Speaks the typed protocol in previewProtocol.ts.
// `window.zenuml` is provided by the @zenuml/core bundle (loaded by the prior
// classic <script src>; classic scripts run in document order, so this executes
// after the lib). stickyOffset comes from the render message (the srcdoc iframe
// has no useful location query string — trap #1). MUST stay a classic script
// (no type=module / no defer) so it sees the window.zenuml global and runs in order.
(function () {
  var app = null;
  function post(msg) { parent.postMessage(msg, '*'); }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      try {
        post({ type: 'console', level: level, args: [].slice.call(arguments).map(function (a) {
          try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return String(a); }
        }) });
      } catch (e) {}
      return orig.apply(console, arguments);
    };
  });

  window.addEventListener('error', function (e) {
    post({ type: 'error', message: String((e && e.message) || e) });
  });

  window.addEventListener('load', function () {
    try {
      app = new window.zenuml.default('#mounting-point');
      post({ type: 'ready' });
    } catch (e) {
      post({ type: 'error', message: String((e && e.message) || e) });
    }
  });

  window.addEventListener('message', function (e) {
    if (e.source !== parent) return;
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'render' && app) {
      (async function () {
        try {
          await app.render(msg.code, {
            enableMultiTheme: false,
            theme: 'theme-default',
            onContentChange: function (code) { post({ type: 'codeChange', code: code }); },
            stickyOffset: Number((msg.options && msg.options.stickyOffset) || 0)
          });
          post({ type: 'rendered' });
        } catch (err) {
          post({ type: 'error', message: String((err && err.message) || err) });
        }
      })();
    } else if (msg.type === 'updateCss') {
      var styleEl = document.getElementById('zenumlstyle');
      if (styleEl) styleEl.textContent = msg.css || '';
    } else if (msg.type === 'getPng') {
      (async function () {
        try {
          var dataUrl = app ? await app.getPng() : null;
          post({ type: 'png', id: msg.id, dataUrl: dataUrl });
        } catch (err) {
          post({ type: 'png', id: msg.id, dataUrl: null });
        }
      })();
    } else if (msg.type === 'evalConsole') {
      try {
        /* eslint-disable no-eval */
        var result = eval(msg.expr);
        /* eslint-enable no-eval */
        post({ type: 'evalResult', id: msg.id, ok: true, value: String(result) });
      } catch (err) {
        post({ type: 'evalResult', id: msg.id, ok: false, value: String(err) });
      }
    }
  }, false);
})();
