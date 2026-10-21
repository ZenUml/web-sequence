import { describe, expect, it } from 'vitest';
import { LEGACY_STYLE_TEMPLATE_CSS, PREVIOUS_BUNDLED_BLUE_CSS, TEMPLATES } from './templates';
import { migrateToPages, switchPage } from './item';
import type { Item } from './types';

function saved(css: string, cssMode: Item['cssMode'] = 'less'): Item {
  return { id: 'saved-template', title: 'My existing diagram', js: 'A -> B: Edited DSL', css, html: '', htmlMode: 'html', cssMode, jsMode: 'js', pages: [], currentPageId: '' };
}

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
  it('migrates only the exact previously generated Blue CSS to a transparent outer canvas', () => {
    const original = saved(PREVIOUS_BUNDLED_BLUE_CSS);
    const migrated = migrateToPages(original);
    expect(migrated.css).toBe(TEMPLATES.find(t => t.id === 'blue')!.item.css);
    expect(migrated.css).toContain('background: transparent !important; --color-bg-frame: #fff;');
    expect(migrated.pages[0].css).toBe(migrated.css);
    expect(migrateToPages(migrated)).toEqual(migrated);
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
