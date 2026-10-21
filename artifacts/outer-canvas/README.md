# Local transparent outer canvas verification

Open [report.html](report.html) for actual WS screenshots and downloadable exports with switchable display backgrounds.

- Core source: b2e5ed18 (local); Web source: ed28ea41 (local).
- WS uses an ignored local core build `4.8.1-local-outer-transparent`; tracked package manifests and locks remain official 4.8.1. Candidate bundle digest: manifest.json.
- Core: 2,072 unit tests passed, 3 existing skips; 94 Darwin visual tests and 8 export pixel tests passed; typecheck/build passed. Linux snapshot validation is pending a future Linux run.
- Web: 1,671 unit tests passed, 1 existing skip; typecheck/build passed; 5 native-dark browser tests and 2 root diagram-page browser tests passed against the local candidate.
- export-matrix.json: 19 actual samples covering light/dark, HTML/native SVG, PNG/SVG, transparent/explicit backing and custom alpha/colors.
- compositing-comparison.json: all 8 transparent-image-on-backing versus directly-backed export pairs have max channel delta 1/255; no pixel differs by more than 1.
- blue-template.png: actual compiled Blue template export, outer corners alpha 0, retaining white frame (alpha 255) and blue element colors.
- preview-paints.json plus ws-dark.png: CSS transparency and actual Chromium compositing checked separately. iframe color-scheme: normal avoids the browser's forced white fill on a mismatched child document.

Frame and element colors remain painted. Only the default outer canvas is transparent. Native SVG has less outer padding than HTML; this work validates background/alpha semantics, not identical HTML/SVG geometry. Backing colors are explicit opaque named/hex/RGB values supported by core; author gradients and alpha remain content paint. Custom HTML CSS still requires PNG in WS.

npm publication, WebSequence merge, push and deployments remain paused. No production release occurred during this local task.

Blue follow-up (`55530f3d`): new and exact previously generated bundled Blue CSS now keep the outer canvas transparent. Author-edited CSS is preserved. 20 focused unit tests, typecheck and both Blue browser cases passed; actual PNG corners alpha 0 and frame alpha 255.

Blue geometry follow-up (`fc1c7d53`): integrated arrow/activation alignment and lifeline starts below translucent headers. Updated Blue screenshot/export above; see ../blue-integrated/preview.html and geometry.json for same-candidate proof.
