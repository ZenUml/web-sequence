// Runs INSIDE the srcdoc iframe (plain ES5-ish string, no bundler). Speaks the
// typed protocol in previewProtocol.ts. `window.zenuml` is provided by the
// injected @zenuml/core bundle. stickyOffset comes from the render message
// (the srcdoc iframe has no useful window.location.search — trap #1).
export const PREVIEW_BOOTSTRAP = `
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
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'render' && app) {
      try {
        app.render(msg.code, {
          enableMultiTheme: false,
          theme: 'theme-default',
          onContentChange: function (code) { post({ type: 'codeChange', code: code }); },
          stickyOffset: Number((msg.options && msg.options.stickyOffset) || 0)
        });
        post({ type: 'rendered' });
      } catch (err) {
        post({ type: 'error', message: String((err && err.message) || err) });
      }
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
`;
