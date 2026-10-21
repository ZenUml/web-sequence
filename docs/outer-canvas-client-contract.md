# WebSequence outer-canvas contract

WebSequence paints its preview workspace with `--editor-canvas`. The preview iframe and its `srcdoc` document are transparent, so the same workspace color shows around the diagram. The iframe uses `color-scheme: normal`: Chromium otherwise paints a white iframe canvas under a dark host, even when the iframe backgrounds compute as transparent.

Core owns the diagram's frame and elements. WebSequence supplies the SoftDark frame and element roles when the document uses the dark theme. It does not supply `canvasBg` by default. An author can still paint the outer canvas explicitly with document CSS; the bundled Blue template intentionally paints it white. That paint stays within the diagram and does not change WebSequence's workspace.

The iframe receives the initial theme and palette in its `srcdoc` before core loads. Later theme and CSS changes use the existing render and `updateCss` messages. Core's informational surface value does not control the host workspace.

Image exports preserve transparency outside the diagram frame by default. A caller of `renderDiagramExport(snapshot, choice, format, signal?, backingColor?)` may pass an opaque `backingColor` to flatten behind the document once. HTML exports forward this option to core. Native SVG exports ask core to render with that option; native PNG rasterizes that SVG without another background fill. Custom HTML CSS remains supported in PNG and unavailable in SVG.

These are local candidate changes. npm publication, WebSequence merge, and deployment are paused pending review of the actual images and export samples.
