import { CANONICAL_APP_ORIGIN } from '../../config/shareOrigin';

export interface EmbedOpenUrlInput {
  embedByValue: boolean;
  embedCode?: string | null;
  embedTitle?: string | null;
  itemId?: string | null;
  shareToken?: string | null;
}

// The embed's "Open in ZenUML" link reproduces the diagram in the full editor at
// the canonical app origin:
//  - by-value embed (?code/?title)     → ${origin}/?code=<dsl>&title=<title>
//  - shared embed   (?id/?share-token) → ${origin}/?id=<id>&share-token=<token>
//  - id only                           → ${origin}/?id=<id>
export function buildEmbedOpenUrl({ embedByValue, embedCode, embedTitle, itemId, shareToken }: EmbedOpenUrlInput): string {
  const q = new URLSearchParams();
  if (embedByValue) {
    q.set('code', embedCode ?? '');
    if (embedTitle) q.set('title', embedTitle);
  } else if (itemId && shareToken) {
    q.set('id', itemId);
    q.set('share-token', shareToken);
  } else if (itemId) {
    q.set('id', itemId);
  }
  const query = q.toString();
  return query ? `${CANONICAL_APP_ORIGIN}/?${query}` : `${CANONICAL_APP_ORIGIN}/`;
}
