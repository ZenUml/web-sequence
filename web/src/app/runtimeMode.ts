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

export function detectFromEnv(): RuntimeMode {
  return detectRuntimeMode({
    search: window.location.search,
    isExtension: !!window.IS_EXTENSION || window.location.protocol === 'chrome-extension:',
    isDesktop: !!window.zenumlDesktop,
  });
}
