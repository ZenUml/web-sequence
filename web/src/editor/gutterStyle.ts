import { EditorView } from '@codemirror/view';
import { foldGutter } from '@codemirror/language';
import type { Extension } from '@codemirror/state';

// Gutter styles for the code editor (Figma F55, node 128:5164).
//
// - 'text':    CodeMirror's default fold gutter (text glyphs ⌄ and ›), always
//              visible, overlaid on the line-number lane. Today's look.
// - 'chevron': SVG chevron in its own 16px column; hidden until the pointer is
//              over the editor, full strength under the pointer, always shown
//              on folded rows. Line numbers use the code font with tabular
//              figures, cannot be selected, and the gutter shares the editor
//              background (no separate tinted band).
//
//   |<- numbers (32px, right-aligned) ->|<- fold 16px ->|4px| code
//   x0                                  x32             x48  x52
export type GutterStyle = 'text' | 'chevron';

const CHEVRON_SVG =
  '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">' +
  '<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

function chevronMarker(open: boolean): HTMLElement {
  const el = document.createElement('span');
  el.className = 'cm-fold-chevron';
  el.dataset.state = open ? 'open' : 'folded';
  el.title = open ? 'Fold line' : 'Unfold line'; // same titles as CodeMirror's default marker
  el.innerHTML = CHEVRON_SVG;
  return el;
}

const FOLD_PX = 16;

// `&.cm-editor` raises specificity above compactGutterTheme (same scope class),
// so these rules win regardless of extension order.
const chevronTheme = EditorView.theme({
  '&.cm-editor .cm-gutters': { backgroundColor: 'transparent' },
  '&.cm-editor .cm-lineNumbers .cm-gutterElement': {
    fontFamily: 'var(--cm-code-font, inherit)',
    fontVariantNumeric: 'tabular-nums',
    userSelect: 'none',
  },
  '&.cm-editor .cm-activeLineGutter': { color: 'var(--code-fg)' },
  '&.cm-editor .cm-line': { paddingLeft: '4px' },
  '&.cm-editor .cm-foldGutter': { width: `${FOLD_PX}px` },
  '&.cm-editor .cm-foldGutter .cm-gutterElement': { width: `${FOLD_PX}px` },
  '&.cm-editor .cm-foldGutter .cm-gutterElement > span': { left: '0', width: `${FOLD_PX}px` },
  '&.cm-editor .cm-fold-chevron': {
    position: 'relative',
    color: 'var(--code-muted)',
    opacity: '0',
    transition: 'opacity 120ms ease-out, color 120ms ease-out',
  },
  '&.cm-editor .cm-fold-chevron::before': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '18px',
    height: '18px',
    margin: '-9px 0 0 -9px',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    transition: 'background-color 120ms ease-out',
  },
  '&.cm-editor .cm-fold-chevron svg': {
    position: 'relative',
    transition: 'transform 120ms ease-out',
  },
  '&.cm-editor .cm-fold-chevron[data-state="folded"] svg': { transform: 'rotate(-90deg)' },
  // Order matters below: editor hover < chevron hover < folded.
  '&.cm-editor:hover .cm-fold-chevron': { opacity: '0.55' },
  '&.cm-editor .cm-fold-chevron:hover': { opacity: '1', color: 'var(--code-fg)' },
  '&.cm-editor .cm-fold-chevron:hover::before': {
    backgroundColor: 'color-mix(in srgb, currentColor 8%, transparent)',
  },
  '&.cm-editor .cm-fold-chevron[data-state="folded"]': { opacity: '1' },
  '&.cm-editor .cm-foldPlaceholder': {
    display: 'inline-block',
    verticalAlign: 'middle',
    margin: '0 2px',
    padding: '0 6px',
    lineHeight: '16px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'var(--code-line-highlight)',
    color: 'var(--code-muted)',
  },
});

export function gutterStyleExtension(style: GutterStyle): Extension {
  if (style === 'chevron') return [foldGutter({ markerDOM: chevronMarker }), chevronTheme];
  return foldGutter();
}
