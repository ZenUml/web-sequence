import { describe, expect, it } from 'vitest';
import { LEGACY_STYLE_TEMPLATE_CSS, PREVIOUS_BUNDLED_BLUE_CSS, TEMPLATES } from './templates';
import { migrateToPages, switchPage } from './item';
import type { Item } from './types';

function saved(css: string, cssMode: Item['cssMode'] = 'less'): Item {
  return { id: 'saved-template', title: 'My existing diagram', js: 'A -> B: Edited DSL', css, html: '', htmlMode: 'html', cssMode, jsMode: 'js', pages: [], currentPageId: '' };
}

const transparentBlueBeforeGeometry = PREVIOUS_BUNDLED_BLUE_CSS.replace(
  'background: #fff !important;',
  'background: transparent !important; --color-bg-frame: #fff;',
);
const blueGeometryRules = `// The Blue occurrence has a 2px border; one less pixel of left padding keeps
// each nested occurrence centered instead of accumulating a 1px offset.
#diagram .sequence-diagram .occurrence { padding-left: 6px; }
// Keep creation arrows at the participant's 2px border, independent of name width.
// The core calculates the message width from that name, so only trim its line and arrow.
#diagram .sequence-diagram .creation:not(.right-to-left) > .message-container > .message { top: -4px; }
#diagram .sequence-diagram .creation:not(.right-to-left) > .message-container > .message > svg:first-of-type { width: calc(100% - 1px); }
#diagram .sequence-diagram .creation:not(.right-to-left) > .message-container > .message > svg:nth-of-type(2) { right: 1px; }
#diagram .sequence-diagram .creation:not(.right-to-left) > .occurrence { transform: translateY(-4px); }
`;
const opaqueBlueWithGeometry = PREVIOUS_BUNDLED_BLUE_CSS + blueGeometryRules;
const transparentBlueWithGeometry = transparentBlueBeforeGeometry + blueGeometryRules;
const opaqueBlueWithHeaderFix = TEMPLATES.find(t => t.id === 'blue')!.item.css!.replace(
  'background: transparent !important; --color-bg-frame: #fff;',
  'background: #fff !important;',
);

describe('saved bundled template CSS compatibility', () => {
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
    for (const css of ['.participant { color: hotpink; }', LEGACY_STYLE_TEMPLATE_CSS.blue + '\n/* user edit */', PREVIOUS_BUNDLED_BLUE_CSS + '\n/* user edit */']) {
      expect(migrateToPages(saved(css)).css).toBe(css);
    }
    expect(migrateToPages(saved(LEGACY_STYLE_TEMPLATE_CSS.blue, 'css')).css).toBe(LEGACY_STYLE_TEMPLATE_CSS.blue);
  });
  it.each([
    ['opaque before geometry', PREVIOUS_BUNDLED_BLUE_CSS],
    ['transparent before geometry', transparentBlueBeforeGeometry],
    ['opaque with geometry', opaqueBlueWithGeometry],
    ['transparent with geometry', transparentBlueWithGeometry],
    ['opaque with header fix', opaqueBlueWithHeaderFix],
  ])('migrates exact previously bundled Blue CSS (%s) and leaves edits alone', (_, css) => {
    const original = saved(css);
    const migrated = migrateToPages(original);
    expect(migrated.css).toBe(TEMPLATES.find(t => t.id === 'blue')!.item.css);
    expect(migrated.css).toContain('background: transparent !important; --color-bg-frame: #fff;');
    expect(migrated.pages[0].css).toBe(migrated.css);
    expect(migrateToPages(migrated)).toEqual(migrated);
    expect(migrateToPages(saved(css + '\n/* user edit */')).css).toBe(css + '\n/* user edit */');
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
