import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUnusedDeps, isReferenced, checkRepo } from './check-unused-deps.mjs';

describe('isReferenced', () => {
  it.each([
    [`import { x } from 'file-saver';`],
    [`import x from "file-saver"`],
    [`import 'file-saver';`],
    [`const m = await import('file-saver');`],
    [`const m = require("file-saver")`],
    [`export * from 'file-saver';`],
  ])('matches a bare specifier: %s', (src) => {
    expect(isReferenced('file-saver', src)).toBe(true);
  });

  it('matches a subpath import', () => {
    expect(isReferenced('@zenuml/core', `import '@zenuml/core/dist/style.css';`)).toBe(true);
  });

  it('does not match a package whose name only shares a prefix', () => {
    // '@codemirror/lang-css' must not count as a use of '@codemirror/lang'.
    expect(isReferenced('@codemirror/lang', `import { css } from '@codemirror/lang-css';`)).toBe(false);
  });

  it('does not match the name in prose or a comment without quotes', () => {
    expect(isReferenced('file-saver', '// replaced file-saver with download.ts')).toBe(false);
  });
});

describe('findUnusedDeps', () => {
  const pkg = {
    dependencies: { react: '^19', 'file-saver': '^2', '@headlessui/react': '^2' },
    devDependencies: { vitest: '^4', '@types/react': '^19', eslint: '^10' },
  };

  it('reports declared packages that no source references, minus the allowlist', () => {
    const sources = [`import React from 'react';`, `import { it } from 'vitest';`];
    expect(findUnusedDeps({ pkg, sources, allow: ['eslint'] })).toEqual(['@headlessui/react', 'file-saver']);
  });

  it('ignores @types/* packages (they are referenced by the compiler, not by imports)', () => {
    expect(findUnusedDeps({ pkg, sources: [], allow: [] })).not.toContain('@types/react');
  });

  it('returns an empty list when everything is used or allowed', () => {
    const sources = [`import 'react'; import 'file-saver'; import '@headlessui/react'; import 'vitest';`];
    expect(findUnusedDeps({ pkg, sources, allow: ['eslint'] })).toEqual([]);
  });
});

describe('checkRepo (the real web/ package)', () => {
  it('web/package.json declares no unused dependency', () => {
    expect(checkRepo()).toEqual([]);
  });

  it('catches a re-added package even though this test file quotes its name', () => {
    const pkg = JSON.parse(readFileSync(resolve(fileURLToPath(import.meta.url), '../../package.json'), 'utf8'));
    pkg.dependencies['file-saver'] = '^2.0.5';
    expect(checkRepo(undefined, pkg)).toEqual(['file-saver']);
  });
});
