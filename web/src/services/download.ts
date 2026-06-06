// Triggers a browser file download of a text payload. Guarded for jsdom, where
// URL.createObjectURL is "Not implemented" — under test we no-op rather than throw
// (the caller's logic, not the actual download, is what's exercised in unit tests).
export function downloadText(filename: string, text: string, mime = 'application/octet-stream'): void {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
