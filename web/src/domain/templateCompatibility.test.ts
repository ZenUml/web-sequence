import { describe, expect, it } from 'vitest';
import { LEGACY_STYLE_TEMPLATE_CSS, TEMPLATE_LIGHT_BASE_MARKER, TEMPLATES } from './templates';
import { migrateToPages, switchPage } from './item';
import type { Item } from './types';

function saved(css: string, cssMode: Item['cssMode'] = 'less'): Item {
  return { id: 'saved-template', title: 'My existing diagram', js: 'A -> B: Edited DSL', css, html: '', htmlMode: 'html', cssMode, jsMode: 'js', pages: [], currentPageId: '' };
}

// Exact bundled Blue compatibility CSS shipped before the header-line repair.
const previousBlueCompatibility = `
${TEMPLATE_LIGHT_BASE_MARKER}
#diagram .bg-skin-canvas { background: #fff !important; }
#diagram .sequence-diagram { color: @labelTextColor; }
#diagram .sequence-diagram .message svg { color: @messageLineColor; }
#diagram .sequence-diagram .lifeline .line { --color-border-base: @participantLineColor; }
#diagram .sequence-diagram .participant-name { color: @participantTextColor; text-decoration: underline; }
#diagram .sequence-diagram .message .name { color: @messageLineColor; }
#diagram .sequence-diagram .fragment .header .name,
#diagram .sequence-diagram .fragment .header .condition { color: @labelTextColor; }
#diagram .sequence-diagram .divider .name { padding: 2px 6px !important; border-radius: 4px !important; margin: 0 !important; border-color: @dividerBorderColor !important; color: @dividerTextColor !important; }
#diagram .sequence-diagram .divider .left,
#diagram .sequence-diagram .divider .right { background: @dividerBackgroundColor !important; }
// The Blue occurrence has a 2px border; one less pixel of left padding keeps
// each nested occurrence centered instead of accumulating a 1px offset.
#diagram .sequence-diagram .occurrence { padding-left: 6px; }
// Keep creation arrows at the participant's 2px border, independent of name width.
// The core calculates the message width from that name, so only trim its line and arrow.
#diagram .sequence-diagram .creation:not(.right-to-left) > .message-container > .message { top: -4px; }
#diagram .sequence-diagram .creation:not(.right-to-left) > .message-container > .message > svg:first-of-type { width: calc(100% - 1px); }
#diagram .sequence-diagram .creation:not(.right-to-left) > .message-container > .message > svg:nth-of-type(2) { right: 1px; }
#diagram .sequence-diagram .creation:not(.right-to-left) > .occurrence { transform: translateY(-4px); }
`;
const initialBlueCompatibility = previousBlueCompatibility.slice(0, previousBlueCompatibility.indexOf('// The Blue occurrence has a 2px border;'));

describe('saved bundled template CSS compatibility', () => {
  it.each([previousBlueCompatibility, initialBlueCompatibility])('upgrades exact previously bundled Blue CSS while preserving author edits', previous => {
    const oldCss = LEGACY_STYLE_TEMPLATE_CSS.blue + previous;
    const migrated = migrateToPages(saved(oldCss));
    expect(migrated.css).toBe(TEMPLATES.find(t => t.id === 'blue')!.item.css);
    expect(migrateToPages(migrated)).toEqual(migrated);
    expect(migrateToPages(saved(oldCss + '\n/* user edit */')).css).toBe(oldCss + '\n/* user edit */');
  });
  it.each(Object.keys(LEGACY_STYLE_TEMPLATE_CSS))('upgrades only original %s CSS and is idempotent on reload', (id) => {
    const original = saved(LEGACY_STYLE_TEMPLATE_CSS[id]);
    const migrated = migrateToPages(original);
    expect(migrated.css).toBe(TEMPLATES.find(t => t.id === id)!.item.css);
    expect(migrated.pages[0].css).toBe(migrated.css);
    expect(migrated).toMatchObject({ id: original.id, title: original.title, js: original.js });
    expect(original.css).toBe(LEGACY_STYLE_TEMPLATE_CSS[id]);
    expect(migrateToPages(migrated)).toEqual(migrated);
  });
  it('preserves arbitrary, edited and non-Less CSS exactly', () => {
    for (const css of ['.participant { color: hotpink; }', LEGACY_STYLE_TEMPLATE_CSS.blue + '\n/* user edit */']) {
      expect(migrateToPages(saved(css)).css).toBe(css);
    }
    expect(migrateToPages(saved(LEGACY_STYLE_TEMPLATE_CSS.blue, 'css')).css).toBe(LEGACY_STYLE_TEMPLATE_CSS.blue);
  });
  it('upgrades page-owned source before switching and preserves its mirror on reload', () => {
    const original = { ...saved('stale mirror'), pages: [
      { id: 'blue', title: 'Blue', js: 'A -> B: Blue', css: LEGACY_STYLE_TEMPLATE_CSS.blue },
      { id: 'classic', title: 'Classic', js: 'A -> B: Classic', css: LEGACY_STYLE_TEMPLATE_CSS.starUMLTheme },
    ], currentPageId: 'classic' };
    const loaded = migrateToPages(original);
    expect(loaded.css).toBe(TEMPLATES.find(t => t.id === 'starUMLTheme')!.item.css);
    const switched = switchPage(loaded, 'blue');
    expect(switched.css).toBe(TEMPLATES.find(t => t.id === 'blue')!.item.css);
    expect(migrateToPages(switched)).toEqual(switched);
  });
});
