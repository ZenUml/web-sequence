export class ImageClipboardUnsupportedError extends Error {
  constructor() {
    super('Image clipboard is not supported');
    this.name = 'ImageClipboardUnsupportedError';
  }
}

export class DiagramOutputError extends Error {
  constructor() {
    super('Diagram output is unavailable');
    this.name = 'DiagramOutputError';
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:')) throw new DiagramOutputError();
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new DiagramOutputError();
  const metadata = dataUrl.slice(5, comma).split(';');
  const mime = metadata[0] || 'application/octet-stream';
  const encoded = dataUrl.slice(comma + 1);
  let bytes: Uint8Array;
  if (metadata.includes('base64')) {
    const raw = atob(encoded);
    bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  } else {
    // Percent-decoded data is Unicode text, not a binary string. TextEncoder keeps
    // CJK, emoji, and every other non-ASCII diagram label intact in exported SVGs.
    bytes = new TextEncoder().encode(decodeURIComponent(encoded));
  }
  // TS 6 models Uint8Array buffers as ArrayBufferLike (which may include
  // SharedArrayBuffer), while BlobPart accepts ArrayBuffer. Copy into an owned
  // ArrayBuffer so the runtime and the type contract are both unambiguous.
  const owned = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  owned.set(bytes);
  return new Blob([owned.buffer], { type: mime });
}

/**
 * @zenuml/core's HTML renderer returns SVG as an encoded data URL, while the
 * native mobile renderer returns raw SVG markup. Normalise both into an actual
 * image/svg+xml file so a downloaded .svg never contains a data URL as text.
 */
export function svgOutputToBlob(value: string): Blob {
  if (value.startsWith('data:')) {
    const blob = dataUrlToBlob(value);
    if (blob.type.toLowerCase() !== 'image/svg+xml') throw new DiagramOutputError();
    return blob;
  }
  if (!/<svg(?:\s|>)/i.test(value)) throw new DiagramOutputError();
  return new Blob([value], { type: 'image/svg+xml' });
}

export function pngDataUrlToBlob(value: string): Blob {
  const blob = dataUrlToBlob(value);
  if (blob.type.toLowerCase() !== 'image/png' || blob.size === 0) {
    throw new DiagramOutputError();
  }
  return blob;
}

export function diagramFilename(title: string | null | undefined, extension: 'png' | 'svg'): string {
  const stem = (title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'diagram';
  return `${stem}.${extension}`;
}

/**
 * Starts the clipboard write before the preview promise resolves. WebKit ties
 * clipboard access to the click's transient user activation, so awaiting the
 * iframe round-trip before calling write() can make a valid click fail.
 */
export async function copyPngToClipboard(getDataUrl: () => Promise<string | null>): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new ImageClipboardUnsupportedError();
  }
  const blob = getDataUrl().then((value) => {
    if (!value) throw new DiagramOutputError();
    return pngDataUrlToBlob(value);
  });
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
