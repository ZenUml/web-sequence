# Blue integration — local candidate

Source commit fc1c7d53 manually integrates e68ed90f and 6f64789b while preserving 55530f3d transparent outer canvas. No core geometry changes. Open preview.html for a storage-independent interactive preview link on port 4467 and actual screenshot/export.

Actual same-candidate evidence at 100% zoom in geometry.json:
- All six lifelines start exactly at participant bottom; their lower endpoints stay at 982px.
- Creation arrow edge and vertical-center deltas: 0px.
- SGW/svc/rep/MF/X activation center deltas: 0px; X activation shares 2px header border.
- All participant fills remain rgba(146,192,240,0.3).
- Outer canvas transparent; frame white; WS workspace dark.
- Actual PNG corners RGBA [0,0,0,0], frame sample [255,255,255,255].

10 browser regressions passed, including long creation names and 3rem shared header heights. 19 focused unit tests and typecheck passed. Independent code review found no issues and verified historical exact CSS matches. Edited CustomCSS is not rewritten. No push, merge, npm publish, or deployment.
