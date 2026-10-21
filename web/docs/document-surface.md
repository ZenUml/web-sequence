# Document surface integration

WebSequence uses published `@zenuml/core` 4.9.0. It sends the SoftDark frame and element palette when the document uses `theme-dark`; light documents use the core defaults. The theme and palette reach the preview before its first render and remain consistent through later HTML renders, native SVG renders, and exports. Explicit document CSS follows core styles in `#zenumlstyle`.

The diagram's outer canvas is transparent by default. The preview iframe and its document remain transparent, allowing WebSequence's `--editor-canvas` workspace color to show around the frame. Core's `getSurface().backgroundColor` and `renderToSvg(...).surface.backgroundColor` report document paint but do not set the host workspace. An author may paint the document canvas with CustomCSS or an explicit palette value.

Exports preserve outer transparency by default. An explicit opaque `backingColor` paints behind the document once. HTML PNG supports CustomCSS; native SVG cannot represent arbitrary HTML styles. Narrow editor viewports use native SVG mode, while diagrams with arbitrary CustomCSS stay on the HTML renderer. See [the outer-canvas contract](../../docs/outer-canvas-client-contract.md) for the preview and export boundary.
