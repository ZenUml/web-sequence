// Minimal semver comparison, ported verbatim from legacy src/utils.js semverCompare
// (https://github.com/substack/semver-compare). Returns 1 if a>b, -1 if a<b, 0 equal.
// Used by the support-pledge one-time-prompt trigger (open when lastSeenVersion < APP_VERSION).
export function semverCompare(a: string, b: string): number {
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < 3; i++) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (na > nb) return 1;
    if (nb > na) return -1;
    if (!isNaN(na) && isNaN(nb)) return 1;
    if (isNaN(na) && !isNaN(nb)) return -1;
  }
  return 0;
}
