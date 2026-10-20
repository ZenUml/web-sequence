// Editor preview zoom. @zenuml/core 4.7.x exposes no public zoom API (its
// zoomIn/zoomOut live on an internal React ref), so zoom is applied app-side by
// scaling the preview iframe. Fit modes stay "sticky": they re-evaluate when the
// diagram or the preview card changes size.

export type PreviewZoom =
  | { kind: 'manual'; scale: number }
  | { kind: 'fit-width' }
  | { kind: 'fit-height' }
  | { kind: 'fit' };

export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ACTUAL_SIZE: PreviewZoom = { kind: 'manual', scale: 1 };

// Zoom steps used by the minus/plus buttons.
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

// Resolve a zoom mode to the scale applied to the iframe. Unknown or zero sizes
// (before the first render, or in jsdom) resolve fit modes to 1.
export function resolveZoom(zoom: PreviewZoom, content: Size | null, viewport: Size | null): number {
  if (zoom.kind === 'manual') return clampZoom(zoom.scale);
  if (!content || !viewport) return 1;
  if (content.width <= 0 || content.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return 1;
  const byWidth = viewport.width / content.width;
  const byHeight = viewport.height / content.height;
  if (zoom.kind === 'fit-width') return clampZoom(byWidth);
  if (zoom.kind === 'fit-height') return clampZoom(byHeight);
  return clampZoom(Math.min(byWidth, byHeight));
}

export function zoomIn(current: number): PreviewZoom {
  const next = STEPS.find((s) => s > current + 0.001) ?? MAX_ZOOM;
  return { kind: 'manual', scale: next };
}

export function zoomOut(current: number): PreviewZoom {
  const next = [...STEPS].reverse().find((s) => s < current - 0.001) ?? MIN_ZOOM;
  return { kind: 'manual', scale: next };
}

export function formatZoom(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
