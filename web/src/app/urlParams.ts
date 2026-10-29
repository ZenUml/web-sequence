import { defaultParseSearch } from '@tanstack/react-router';

/**
 * The one schema for the app's URL query string (#901). The router's
 * validateSearch and detectRuntimeMode both read it, so a URL means the same
 * thing to boot, embed and the "Open in ZenUML" link.
 *
 * Input is TanStack's default parseSearch output, which JSON-decodes each
 * value: `?id=1729000000000` arrives as a number, `?code={...}` as an object,
 * a repeated key as an array. The app's own navigate() writes numeric-looking
 * ids as `?id=%22…%22`, which decodes back to the string. Every value is
 * coerced back to the string the URL carried.
 */
export interface AppSearch {
  id?: string;
  'share-token'?: string;
  view?: string;
  embed?: true;
  code?: string;
  title?: string;
  stickyOffset?: number;
}

function text(value: unknown): string | undefined {
  if (Array.isArray(value)) return text(value[0]);
  if (value === undefined || value === null) return undefined;
  const s = typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return s === '' ? undefined : s;
}

export function parseAppSearch(raw: Record<string, unknown>): AppSearch {
  const search: AppSearch = {};
  // `itemId` and `token` are legacy aliases; the canonical key wins.
  const id = text(raw.id) ?? text(raw.itemId);
  const shareToken = text(raw['share-token']) ?? text(raw.token);
  const view = text(raw.view);
  const code = text(raw.code);
  const title = text(raw.title);
  const stickyOffset = Number(text(raw.stickyOffset));
  if (id !== undefined) search.id = id;
  if (shareToken !== undefined) search['share-token'] = shareToken;
  if (view !== undefined) search.view = view;
  if (raw.embed !== undefined) search.embed = true;
  if (code !== undefined) search.code = code;
  if (title !== undefined) search.title = title;
  if (text(raw.stickyOffset) !== undefined && Number.isFinite(stickyOffset)) search.stickyOffset = stickyOffset;
  return search;
}

/** parseAppSearch over a raw query string, decoded the way the router decodes it. */
export function parseLocationSearch(search: string): AppSearch {
  return parseAppSearch(defaultParseSearch(search));
}
