// Placement of a rendered diagram inside a Diagrams card preview.
//
// Approved rules: draw the diagram at 70% of its native CSS-pixel size (no
// width-fit). Narrow diagrams are centred horizontally; wide diagrams start at the
// left inset and are cropped on the right. All diagrams are top-aligned so the
// participant headers sit 12px below the top of the preview.

export const THUMBNAIL_SCALE = 0.7;
export const THUMBNAIL_TOP_INSET = 12;
export const THUMBNAIL_SIDE_INSET = 12;

export interface DiagramBounds {
  /** Left edge of the diagram content, in iframe CSS px. */
  left: number;
  /** Right edge of the diagram content, in iframe CSS px. */
  right: number;
  /** Top edge of the first participant header, in iframe CSS px. */
  participantTop: number;
}

export interface ThumbnailPlacement {
  /** Translation applied to the iframe before scaling, in preview px. */
  x: number;
  y: number;
  scale: number;
  /** True when the scaled diagram is wider than the preview and is cropped. */
  cropped: boolean;
}

export function placeThumbnail(previewWidth: number, bounds: DiagramBounds, scale = THUMBNAIL_SCALE): ThumbnailPlacement {
  const width = Math.max(0, bounds.right - bounds.left) * scale;
  const y = THUMBNAIL_TOP_INSET - bounds.participantTop * scale;
  const available = previewWidth - THUMBNAIL_SIDE_INSET * 2;
  if (width <= available) {
    const x = (previewWidth - width) / 2 - bounds.left * scale;
    return { x, y, scale, cropped: false };
  }
  return { x: THUMBNAIL_SIDE_INSET - bounds.left * scale, y, scale, cropped: true };
}

// Thumbnail-only style for the renderer iframe. It hides the diagram's own outer
// frame chrome (title band, frame border, footer) so the card title is not repeated,
// and keeps everything inside the diagram: participant borders, messages, fragment
// (condition) regions and their headers (.bg-skin-fragment-header). Injected as a
// separate <style> so the user-CSS rail (#zenumlstyle) keeps its own semantics.
export const THUMBNAIL_CHROME_CSS = [
  'html,body{margin:0;padding:0;overflow:hidden;background:#fff}',
  '.footer{display:none !important}',
  '.header.bg-skin-title{display:none !important}',
  '.frame.bg-skin-frame{border-color:transparent !important;box-shadow:none !important}',
].join('');
