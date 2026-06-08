export interface RuntimeMode {
  isEmbed: boolean;
  isShared: boolean;
  isExtension: boolean;
  isDesktop: boolean;
  itemId: string | null;
  shareToken: string | null;
  embedCode: string | null;
  embedTitle: string | null;
}

export interface RuntimeInput {
  search: string;
  isExtension: boolean;
  isDesktop: boolean;
}

export function detectRuntimeMode(input: RuntimeInput): RuntimeMode {
  const p = new URLSearchParams(input.search);
  const itemId = p.get('id') ?? p.get('itemId');
  const shareToken = p.get('share-token') ?? p.get('token');
  return {
    isEmbed: p.has('embed'),
    isShared: !!(itemId && shareToken),
    isExtension: input.isExtension,
    isDesktop: input.isDesktop,
    itemId,
    shareToken,
    embedCode: p.get('code'),
    embedTitle: p.get('title'),
  };
}

/** The diagram payload an embed `?code=` param resolves to. */
export interface EmbedPayload {
  js: string;
  css: string;
  html: string;
  title: string | null;
  /**
   * Pre-processor modes carried from the legacy JSON item (adversarial review
   * finding 1). Legacy minted embed links as `?code=${JSON.stringify(currentItem)}`
   * and the item carries `cssMode`/`htmlMode`/`jsMode` (e.g. `'scss'`/`'less'`).
   * The render path transpiles via these modes (AppRoot `transpiledCss`); dropping
   * them rendered raw pre-processor source verbatim. `cssSettings` backs the `acss`
   * (Atomic CSS) mode. Defaults match a plain-`css` item when absent.
   */
  cssMode: CssMode;
  htmlMode: HtmlMode;
  jsMode: JsMode;
  cssSettings?: unknown;
}

// Allowed mode unions (mirror `web/src/domain/types.ts`). A legacy JSON item's
// mode is only trusted if it is one of these; anything else falls back to the
// plain default so a malformed/hostile `?code=` can't smuggle an unknown mode
// into the transpiler.
const CSS_MODES = ['css', 'scss', 'sass', 'less', 'stylus', 'acss'] as const;
const HTML_MODES = ['html', 'markdown', 'jade'] as const;
const JS_MODES = ['js', 'es6', 'coffeescript', 'typescript'] as const;
type CssMode = (typeof CSS_MODES)[number];
type HtmlMode = (typeof HTML_MODES)[number];
type JsMode = (typeof JS_MODES)[number];

function coerceMode<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Resolve an embed `?code=` value into a diagram payload.
 *
 * Per the new URL contract (§8) `code` is the inline diagram source (raw DSL).
 * BUT legacy ZenUML minted embed links as `?code=${JSON.stringify(currentItem)}`
 * — a JSON-encoded *item object* carrying `.js`/`.css`/`.html`/`.title`. Such
 * links already exist in the wild (docs, Confluence embeds, saved URLs), so we
 * accept BOTH shapes for backward compatibility:
 *
 *  - JSON object with a string `.js`  → extract js/css/html/title from it.
 *  - anything else (incl. raw DSL that happens to look like JSON, e.g. a quoted
 *    string or an array) → treat the verbatim string as the DSL source.
 *
 * `fallbackTitle` (from `?title=`) is used only when the JSON item has no title.
 */
export function parseEmbedCode(code: string, fallbackTitle: string | null = null): EmbedPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(code);
  } catch {
    parsed = undefined;
  }
  if (
    parsed != null &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    typeof (parsed as { js?: unknown }).js === 'string'
  ) {
    const item = parsed as {
      js: string;
      css?: unknown;
      html?: unknown;
      title?: unknown;
      cssMode?: unknown;
      htmlMode?: unknown;
      jsMode?: unknown;
      cssSettings?: unknown;
    };
    return {
      js: item.js,
      css: typeof item.css === 'string' ? item.css : '',
      html: typeof item.html === 'string' ? item.html : '',
      title: typeof item.title === 'string' ? item.title : fallbackTitle,
      cssMode: coerceMode(item.cssMode, CSS_MODES, 'css'),
      htmlMode: coerceMode(item.htmlMode, HTML_MODES, 'html'),
      jsMode: coerceMode(item.jsMode, JS_MODES, 'js'),
      cssSettings: item.cssSettings,
    };
  }
  // Raw DSL (contract §8 form).
  return { js: code, css: '', html: '', title: fallbackTitle, cssMode: 'css', htmlMode: 'html', jsMode: 'js' };
}

export function detectFromEnv(): RuntimeMode {
  return detectRuntimeMode({
    search: window.location.search,
    isExtension: !!window.IS_EXTENSION || window.location.protocol === 'chrome-extension:',
    isDesktop: !!window.zenumlDesktop,
  });
}
