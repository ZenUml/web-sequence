import { describe, it, expect } from 'vitest';
import { editorKeymap, formatCss } from './keymap';

describe('editorKeymap', () => {
  it('binds the spec shortcuts with modern key identifiers', () => {
    const keys = editorKeymap.map((k) => k.key);
    expect(keys).toContain('Mod-f'); // find
    expect(keys).toContain('Mod-/'); // toggle comment
    expect(keys).toContain('Mod-]'); // indent more
    expect(keys).toContain('Mod-['); // indent less
    expect(keys).toContain('Mod-Alt-f'); // find & replace
  });
});

describe('formatCss', () => {
  it('formats CSS with prettier', async () => {
    expect((await formatCss('.a{color:red}')).trim()).toBe('.a {\n  color: red;\n}'.trim());
  });
});
