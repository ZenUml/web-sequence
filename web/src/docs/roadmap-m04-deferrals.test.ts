import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Task 1 (M04 plan): the M04 scope-boundaries paragraph must be appended,
// VERBATIM, to roadmap §9 "Adversarial-review carry-forward". This test is
// discriminating: it fails if the paragraph is absent, if it lands outside
// §9, or if the two load-bearing invariants (the corrected count-only limit
// rule + the !loading race guard) are weakened/paraphrased.

const __dirname = dirname(fileURLToPath(import.meta.url));
// web/src/docs -> repo-root/docs/superpowers/plans
const ROADMAP = resolve(
  __dirname,
  '../../../docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md',
);

const SECTION_HEADING = '## 9. Adversarial-review carry-forward';

describe('roadmap §9 records M04 scope deferrals', () => {
  const doc = readFileSync(ROADMAP, 'utf8');

  it('the M04 paragraph lives inside §9 (not before it, not in another section)', () => {
    const sectionIdx = doc.indexOf(SECTION_HEADING);
    expect(sectionIdx).toBeGreaterThanOrEqual(0);

    const m04Idx = doc.indexOf('- **M04 scope boundaries (recorded).**');
    expect(m04Idx).toBeGreaterThan(sectionIdx);

    // No "## 10"/next top-level section may intervene between §9 and the bullet.
    const between = doc.slice(sectionIdx, m04Idx);
    expect(between).not.toMatch(/\n## \d/);
  });

  it('records the corrected count-only limit invariant (NO includes branch, over-cap re-save blocked)', () => {
    // Legacy-exact predicate.
    expect(doc).toContain('`ownedIds.length > limitFor(sub)`');
    // The corrected facts: blocks purely on count, no new-vs-resave branch.
    expect(doc).toContain('blocks purely on count with NO `includes`/new-vs-resave branch');
    expect(doc).toContain('an over-cap re-save is blocked exactly as a new save is');
    // Pre-insert sampling + admits the (limit+1)-th NEW item.
    expect(doc).toContain('PRE-INSERT ownership map');
    expect(doc).toContain('admits the (limit+1)-th NEW item');
  });

  it('records the !loading race guard for the save-seam enforcement', () => {
    expect(doc).toContain('gates enforcement on `!useSubscription().loading`');
    expect(doc).toContain('auth-resolved-before-read race guard');
    // The consequence: unresolved subscription => cloud write proceeds.
    expect(doc).toContain('an unresolved subscription is treated as not-yet-known and the cloud write proceeds');
  });

  it('records the remaining M04 deferrals (softening, Paddle Classic, login errors, dropped settings)', () => {
    expect(doc).toContain('cloud write SKIPPED for an over-cap save, local save kept');
    expect(doc).toContain('Paddle stays **Classic** (vendor 39343');
    expect(doc).toContain('LoginModal OAuth-error surfacing');
    expect(doc).toContain('Dropped from `Settings`: `layoutMode`, `infiniteLoopTimeout`, `isCodeBlastOn`, `isJs13kModeOn`');
  });
});
