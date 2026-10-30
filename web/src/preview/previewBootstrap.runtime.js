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
  var currentRenderMode = 'html';
  var currentSvgResult = null;
  function post(msg) { parent.postMessage(msg, '*'); }

  // ---- Diagram natural-size measurement ----------------------------------------
  // WIDTH: .bg-skin-canvas.scrollWidth — the DiagramFrame's inline-block root, which
  // shrinks to its content (its block ancestors stretch to the iframe width, so their
  // scrollWidth is useless). HEIGHT: #diagram.scrollHeight. Buffers (+16/+24) keep the
  // right-edge chrome + foot lifeline dashes from clipping.
  function measureAndPostContentSize() {
    var diagramEl = document.getElementById('diagram') || document.getElementById('mounting-point');
    var contentH = (diagramEl ? diagramEl.scrollHeight : document.documentElement.scrollHeight) + 24;
    var frameRootEl = document.querySelector('.bg-skin-canvas');
    var contentW = (frameRootEl ? frameRootEl.scrollWidth : (diagramEl ? diagramEl.scrollWidth : document.documentElement.scrollWidth)) + 16;
    post({ type: 'contentSize', width: contentW, height: contentH });
  }
  // @zenuml/core lays out ASYNCHRONOUSLY after app.render() resolves (React commit +
  // SVG/arrow layout), so a single synchronous measure under-reports larger diagrams —
  // present-mode fit then sizes the iframe too small and CLIPS the diagram (small
  // diagrams settle within the frame, which is why it looked fine). So we measure
  // immediately AND re-measure once layout settles: a ResizeObserver on the inline-block
  // root re-fires when its content box finishes growing (and on any later reflow, keeping
  // contentSize fresh); an rAF chain is the fallback where ResizeObserver is absent.
  var __sizeRO = (typeof ResizeObserver !== 'undefined')
    ? new ResizeObserver(function () { measureAndPostContentSize(); })
    : null;
  function trackContentSettle() {
    if (__sizeRO) {
      __sizeRO.disconnect();
      var el = document.querySelector('.bg-skin-canvas');
      if (el) __sizeRO.observe(el);
    } else {
      var n = 4;
      (function tick() { measureAndPostContentSize(); if (n-- > 0) requestAnimationFrame(tick); })();
    }
  }

  // ---- SVG render mode (mobile) ------------------------------------------------
  // On mobile the HTML diagram (fixed-px React layout) overflows the narrow viewport.
  // renderMode:'svg' renders @zenuml/core's NATIVE vector SVG (window.zenuml.renderToSvg)
  // into a SEPARATE container (#svg-mount) — never the app's React root (#mounting-point),
  // which must stay React-owned so a later switch back to HTML mode re-renders cleanly.
  // The injected <svg> is sized fit-to-width (width:100% + height:auto on its viewBox) so
  // the full diagram width shows by default; tall diagrams scroll vertically, and vector
  // output stays crisp at any zoom.
  function showSvgMount(svgString) {
    var diagram = document.getElementById('diagram');
    var mount = document.getElementById('mounting-point');
    if (!diagram) return;
    var svgMount = document.getElementById('svg-mount');
    if (!svgMount) {
      svgMount = document.createElement('div');
      svgMount.id = 'svg-mount';
      diagram.appendChild(svgMount);
    }
    svgMount.innerHTML = svgString || '';
    var svgEl = svgMount.querySelector('svg');
    if (svgEl) {
      // Drop the intrinsic width/height attributes so the viewBox drives the aspect
      // ratio and the style fit-to-width takes effect.
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
      svgEl.style.width = '100%';
      svgEl.style.maxWidth = '100%';
      svgEl.style.height = 'auto';
      svgEl.style.display = 'block';
    }
    svgMount.style.display = 'block';
    if (mount) mount.style.display = 'none';
  }
  function showHtmlMount() {
    var mount = document.getElementById('mounting-point');
    var svgMount = document.getElementById('svg-mount');
    if (mount) mount.style.display = '';
    if (svgMount) svgMount.style.display = 'none';
  }

  function visibleSvgResult() {
    if (!currentSvgResult || !currentSvgResult.svg) return null;
    var svgMount = document.getElementById('svg-mount');
    var visibleSvg = svgMount && svgMount.querySelector('svg');
    if (!visibleSvg) return currentSvgResult;
    var clone = visibleSvg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(currentSvgResult.width));
    clone.setAttribute('height', String(currentSvgResult.height));
    clone.style.removeProperty('width');
    clone.style.removeProperty('max-width');
    clone.style.removeProperty('height');
    clone.style.removeProperty('display');
    if (!clone.getAttribute('style')) clone.removeAttribute('style');
    var customStyle = document.getElementById('zenumlstyle');
    if (customStyle && customStyle.textContent) {
      var embeddedStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      embeddedStyle.textContent = customStyle.textContent;
      clone.insertBefore(embeddedStyle, clone.firstChild);
    }
    return { svg: new XMLSerializer().serializeToString(clone), width: currentSvgResult.width, height: currentSvgResult.height };
  }

  function svgToPngDataUrl(result) {
    return new Promise(function (resolve, reject) {
      if (!result || !result.svg) { resolve(null); return; }
      var width = Math.max(1, Number(result.width) || 1);
      var height = Math.max(1, Number(result.height) || 1);
      var preferredScale = Math.max(1, Math.min(2, Number(window.devicePixelRatio) || 1));
      var scale = Math.min(preferredScale, Math.sqrt(16000000 / (width * height)));
      scale = Number.isFinite(scale) && scale > 0 ? scale : 1;
      var url = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' }));
      var image = new Image();
      image.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          var context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas is unavailable');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) { reject(err); }
        finally { URL.revokeObjectURL(url); }
      };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('SVG could not be rasterised')); };
      image.src = url;
    });
  }

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

  // User CSS must be able to override the core stylesheet at equal specificity.
  // @zenuml/core appends its own <style> to <head> at runtime, after the srcdoc's
  // #zenumlstyle rail, so move the rail back to the end of <head> whenever core may
  // have injected styles (engine created, each render) and on every CSS update.
  function keepUserCssLast() {
    var rail = document.getElementById('zenumlstyle');
    var head = document.head;
    if (rail && head && typeof head.appendChild === 'function' && head.lastElementChild !== rail) {
      head.appendChild(rail);
    }
  }

  window.addEventListener('load', function () {
    try {
      app = new window.zenuml.default('#mounting-point');
      keepUserCssLast();
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
          var renderMode = (msg.options && msg.options.renderMode) || 'html';
          if (renderMode === 'svg' && window.zenuml && typeof window.zenuml.renderToSvg === 'function') {
            // Native vector SVG (mobile). Pure render — no React commit, no
            // onContentChange (the editor pane stays the source of truth on mobile).
            // Clear any HTML-only skin correction left by a prior dark HTML render.
            var previousThemeStyle = document.getElementById('zenuml-theme-base');
            if (previousThemeStyle) previousThemeStyle.textContent = '';
            // renderToSvg is synchronous and measures text with canvas, so the
            // core's bundled font must be loaded first (app.render does this
            // itself). Loads once, never rejects; absent before @zenuml/core 4.4.
            if (typeof window.zenuml.ensureDiagramFontsLoaded === 'function') {
              await window.zenuml.ensureDiagramFontsLoaded();
            }
            var result = window.zenuml.renderToSvg(msg.code, { theme: 'theme-default' });
            showSvgMount(result && result.svg);
            currentSvgResult = result || null;
            currentRenderMode = 'svg';
          } else {
            // HTML diagram (desktop / default). Unhide the React mount in case we are
            // switching back from SVG mode, then render as before.
            showHtmlMount();
            currentSvgResult = null;
            currentRenderMode = 'html';
            var theme = (msg.options && msg.options.theme) || 'theme-default';
            // core 4.7.2's clean-dark skin leaves participant names blue on blue.
            // This small base correction colors the iframe around the diagram.
            // User CSS remains in #zenumlstyle and can override it.
            var themeStyle = document.getElementById('zenuml-theme-base');
            if (!themeStyle) {
              themeStyle = document.createElement('style');
              themeStyle.id = 'zenuml-theme-base';
              document.head.insertBefore(themeStyle, document.getElementById('zenumlstyle'));
            }
            // Darcula (the editor's dark appearance): core 4.7.2 leaves the page and
            // the outer .bg-skin-canvas wrapper white around the dark diagram.
            themeStyle.textContent = theme === 'theme-clean-dark'
              ? 'html,body{background:#111628}.theme-clean-dark .participant-name{color:#e8ecff}'
              : theme === 'theme-darcula'
                ? 'html,body{background:#2b2b2b}.zenuml .bg-skin-canvas{--color-bg-canvas:#2b2b2b}'
                : '';
            await app.render(msg.code, {
              enableMultiTheme: false,
              enableParticipantStyleEditing: !!(msg.options && msg.options.enableParticipantStyleEditing),
              theme: theme,
              onContentChange: function (code) { post({ type: 'codeChange', code: code }); },
              stickyOffset: Number((msg.options && msg.options.stickyOffset) || 0)
            });
          }
          keepUserCssLast();
          // Echo the token so the host can confirm THIS render landed (ack+retry for
          // WebKit's dropped-postMessage race). undefined when the host sent no token.
          post({ type: 'rendered', token: msg.token });
          // Report the diagram's natural content size (width × height) in ALL modes
          // (embed shrink-wraps the iframe card; present/fit scales+centers; editor
          // stores-but-ignores). Measure now AND re-measure once @zenuml's async layout
          // settles (see measureAndPostContentSize / trackContentSettle above) — the
          // synchronous-only measure under-reported larger diagrams and present mode
          // clipped them.
          measureAndPostContentSize();
          trackContentSettle();
        } catch (err) {
          post({ type: 'error', message: String((err && err.message) || err) });
        }
      })();
    } else if (msg.type === 'updateCss') {
      var styleEl = document.getElementById('zenumlstyle');
      if (styleEl) styleEl.textContent = msg.css || '';
      keepUserCssLast();
    } else if (msg.type === 'getPng') {
      (async function () {
        try {
          var dataUrl = currentRenderMode === 'svg'
            ? await svgToPngDataUrl(visibleSvgResult())
            : (app ? await app.getPng() : null);
          post({ type: 'png', id: msg.id, dataUrl: dataUrl });
        } catch (err) {
          post({ type: 'png', id: msg.id, dataUrl: null });
        }
      })();
    } else if (msg.type === 'getSvg') {
      (async function () {
        try {
          var visibleResult = currentRenderMode === 'svg' ? visibleSvgResult() : null;
          var svg = currentRenderMode === 'svg'
            ? (visibleResult && visibleResult.svg)
            : (app ? await app.getSvg() : null);
          post({ type: 'svg', id: msg.id, svg: svg });
        } catch (err) {
          post({ type: 'svg', id: msg.id, svg: null });
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
