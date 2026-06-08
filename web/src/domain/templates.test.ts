import { describe, it, expect } from 'vitest';
import { TEMPLATES, blankTemplate } from './templates';

describe('TEMPLATES', () => {
  it('exposes the four curated templates with the expected ids in order', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([
      'basic',
      'black-white',
      'blue',
      'starUMLTheme',
    ]);
  });

  it('every template carries non-empty starter DSL (js)', () => {
    for (const t of TEMPLATES) {
      expect(typeof t.item.js).toBe('string');
      expect(t.item.js!.length).toBeGreaterThan(0);
    }
  });

  it('pins the basic template js verbatim from legacy template-basic.json', () => {
    const basic = TEMPLATES.find((t) => t.id === 'basic')!;
    expect(basic.item.js).toBe(
      '// This is a sample\nA.method() {\n  if(condition) {\n    B.method()\n  }\n}',
    );
  });

  it('drops the legacy layoutMode field from every template item', () => {
    for (const t of TEMPLATES) {
      expect(t.item).not.toHaveProperty('layoutMode');
    }
  });

  it('the two "Advanced"-titled templates are distinguished by id (black-white vs blue)', () => {
    // Faithful to legacy: black-white.json and blue.json both carry title
    // "Advanced"; their css differs (black vs blue palette).
    const bw = TEMPLATES.find((t) => t.id === 'black-white')!;
    const blue = TEMPLATES.find((t) => t.id === 'blue')!;
    expect(bw.item.title).toBe('Advanced');
    expect(blue.item.title).toBe('Advanced');
    expect(bw.item.css).toContain('@messageLineColor: #000;');
    expect(blue.item.css).toContain('@messageLineColor: #032C72;');
  });
});

describe('blankTemplate', () => {
  it('returns a genuinely empty starter with default modes', () => {
    const blank = blankTemplate();
    expect(blank.js).toBe('');
    expect(blank.css).toBe('');
    expect(blank.html).toBe('');
    expect(blank.htmlMode).toBe('html');
    expect(blank.cssMode).toBe('css');
    expect(blank.jsMode).toBe('js');
  });

  it('does not fabricate DSL', () => {
    expect(blankTemplate().js).toBe('');
  });
});
