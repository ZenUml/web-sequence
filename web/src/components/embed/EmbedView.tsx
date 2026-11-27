import type { RefObject } from 'react';
import type { Item } from '../../domain/types';
import type { RenderOptions } from '../../preview/previewProtocol';
import { PreviewFrame, type PreviewHandle } from '../../preview/PreviewFrame';
import { EmbedHeader } from './EmbedHeader';

// M05 (RM-2 / REQ-EMB-1): the embed view. A minimal, read-mostly view: NO main
// header, NO sidebar, NO modals (AppRoot also turns shortcuts off). Only the embed
// header + the preview render. The caller computes `openUrl` (buildEmbedOpenUrl)
// and the resolved CSS.
export interface EmbedViewProps {
  item: Item | null;
  openUrl: string;
  previewRef: RefObject<PreviewHandle | null>;
  /** CSS for the preview, already transpiled when the item uses a preprocessor. */
  css: string;
  stickyOffset: number;
  autoPreview: boolean;
  theme: RenderOptions['theme'];
  /** Header title when the item is missing or untitled (the embed URL's title). */
  fallbackTitle?: string | null;
}

export function EmbedView({ item, openUrl, previewRef, css, stickyOffset, autoPreview, theme, fallbackTitle }: EmbedViewProps) {
  return (
    <div data-testid="embed-root" className="flex flex-col h-full w-full surface-paper">
      <EmbedHeader title={item?.title ?? fallbackTitle ?? undefined} openUrl={openUrl} />
      {/* Render the diagram on paper inside a hairline + shadow card so the embed
          reads as an intentional framed surface, not an unstyled white box on cream.
          PreviewFrame posts a 'contentSize' message after each render (embed-only)
          and sets an explicit pixel width + height on the iframe, so the card
          (width/height:auto, i.e. shrink-to-fit) hugs the diagram on both axes.
          The wrapper's items-center/justify-center centers the card in both axes.
          max-w/max-h cap + overflow-auto ensure a large diagram scrolls rather than
          bleeding beyond the viewport. */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        {item ? (
          <div className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] rounded-lg border border-paper-line shadow-pop overflow-auto" style={{ backgroundColor: 'var(--editor-canvas)' }}>
            <PreviewFrame
              ref={previewRef}
              code={item.js}
              css={css}
              stickyOffset={stickyOffset}
              autoPreview={autoPreview}
              theme={theme}
            />
          </div>
        ) : (
          // REQ-EMB: a bad ?code/?id leaves item null. Surface an on-paper empty
          // state (serif display face + onlight tokens, matching the modal empty
          // states) instead of returning null and stranding the user on blank cream.
          <div
            data-testid="embed-empty"
            className="mx-auto max-w-md rounded-lg border border-paper-line bg-paper-50 shadow-pop px-8 py-10 text-center"
          >
            <h2 className="font-serif text-[22px] leading-tight text-onlight-strong">
              Diagram unavailable
            </h2>
            <p className="mt-2 text-[13px] text-onlight-muted">
              This embedded diagram could not be loaded. The link may be broken or the
              diagram is no longer shared.
            </p>
            <a
              data-testid="embed-empty-link"
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center h-8 px-3 rounded text-[13px] font-medium bg-accent-press text-white hover:bg-accent ring-draft shadow-inset"
            >
              Open ZenUML
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
