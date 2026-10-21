# Document surface integration evidence

The candidate uses `@zenuml/core` version `4.8.1-local-patched-document-surface`, built locally from the companion core PR. It is not a published npm version. The committed dependency remains official 4.8.1 and uses the documented legacy path until a release is available.

- `baseline-dark.png`: official 4.8.1 before this integration, dark document base #1f1f1f.
- `candidate-dark.png`: candidate with WebSequence's semantic SoftDark palette; document and host base #343f4b.
- `candidate-blue-template.png`: Advanced/Blue CustomCSS retains its white canvas and authored blue colors inside dark app chrome.
- `dark-html-png-raster.png` and `dark-native-svg-raster.png`: same explicit dark-blue and pale-yellow participants; white and black labels remain readable respectively.
- `export-matrix.json`: seven exports exercised through WebSequence's `renderDiagramExport` service in Chromium. SVGs were loaded into a browser image and rasterized before sampling. All four corners have alpha 255 and the intended base color. PNG uses device-pixel scaling; HTML and native SVG retain their own existing layout metrics.

The desktop Download dialog was also used to download a matching dark PNG; all corners were RGBA(52,63,75,255). Frame-by-frame computed-style observations after a dark reload first observed the canvas as #343f4b and found no white canvas in the captured samples. This is a DOM appearance observation, not a cold-network filmstrip measurement.

No production deployment, release publication, or npm publication was performed.

Final core source: [mermaid-js/zenuml-core#510](https://github.com/mermaid-js/zenuml-core/pull/510), commit `b8836c32`. Candidate runtime code matches this commit; final comments and test formatting differ from the build copy only. Final WebSequence validation: typecheck, production build, 131 unit-test files (1,668 passed; one existing skip), and five browser scenarios passed. The external candidate directory required a temporary Vite filesystem allow-list for unit tests; that configuration was removed and is not committed.
