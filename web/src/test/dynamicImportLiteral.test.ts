/**
 * Every bundled dynamic import in web/src/ must name its module with a string
 * literal: `cond ? import("@/a") : import("@/b")`, never
 * `import(cond ? "@/a" : "@/b")`.
 *
* Why: Vite wraps a literal `import()` in its preload helper, which also
 * injects the target chunk's CSS. Under Vite 8 (Rolldown) a non-literal
 * specifier is still split into chunks, but the emitted `import("./x.js")`
 * has no preload wrapper, so the chunk's CSS never loads. Observed
 * 2026-11-22: the Graph viewer then rendered unstyled, its zoom-button SVGs
 * measured 0x0, and the staging E2E assertion "first SVG is visible" failed
 * for Graph, Embed, OpenAPI and AsyncAPI macros (the four ternary imports in
 * conf-app src/forgeIndex.ts). Vite 7 handled the same source correctly.
 *
 * A runtime URL import that Vite must not bundle stays allowed when it is
 * marked `/* @vite-ignore *\/` (for example a runtime CDN URL).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');
const EXTENSIONS = /\.(ts|tsx|js|mjs|vue)$/;
const SKIP = /\.(spec|test)\.[a-z]+$/;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...listSourceFiles(path));
    } else if (EXTENSIONS.test(name) && !SKIP.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Blanks comments and string contents (same length, newlines kept) so a prose
 * "import (" in a comment or string is not taken for a call. Approximate: it
 * does not track regex literals or `${}` inside templates.
 */
function maskCommentsAndStrings(source: string): string {
  let out = '';
  let i = 0;
  const blank = (t: string) => t.replace(/[^\n]/g, ' ');
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (two === '//') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (source[i] === '"' || source[i] === "'" || source[i] === '`') {
      const q = source[i];
      let j = i + 1;
      while (j < source.length && source[j] !== q) j += source[j] === '\\' ? 2 : 1;
      out += q + blank(source.slice(i + 1, j)) + (j < source.length ? q : '');
      i = j + 1;
    } else {
      out += source[i++];
    }
  }
  return out;
}

/** Returns `line: text` for each `import(` whose first argument is not a literal. */
function findNonLiteralDynamicImports(source: string): string[] {
  const hits: string[] = [];
  const masked = maskCommentsAndStrings(source);
  const re = /(^|[^\w$.])import\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) {
    let i = m.index + m[0].length;
    let ignored = false;
    // Skip whitespace and comments before the first argument.
    for (;;) {
      while (/\s/.test(source[i] ?? '')) i++;
      if (source.startsWith('/*', i)) {
        const end = source.indexOf('*/', i + 2);
        if (source.slice(i, end).includes('@vite-ignore')) ignored = true;
        i = end + 2;
      } else if (source.startsWith('//', i)) {
        i = source.indexOf('\n', i);
      } else {
        break;
      }
    }
    const ch = source[i];
    const literal =
      ch === '"' ||
      ch === "'" ||
      (ch === '`' && !source.slice(i + 1, source.indexOf('`', i + 1)).includes('${'));
    if (!literal && !ignored) {
      const line = source.slice(0, m.index).split('\n').length;
      hits.push(`${line}: ${source.split('\n')[line - 1].trim()}`);
    }
  }
  return hits;
}

describe('dynamic import specifiers', () => {
  it('flags a ternary inside import() and accepts a ternary of imports', () => {
    expect(findNonLiteralDynamicImports('await import(a ? "@/x" : "@/y");')).toHaveLength(1);
    expect(findNonLiteralDynamicImports('await import(\n  a\n    ? "@/x"\n    : "@/y");')).toHaveLength(1);
    expect(findNonLiteralDynamicImports('await (a ? import("@/x") : import("@/y"));')).toEqual([]);
    expect(findNonLiteralDynamicImports('import(/* @vite-ignore */ url)')).toEqual([]);
    expect(findNonLiteralDynamicImports('vi.importActual(x); import.meta.url;')).toEqual([]);
    expect(findNonLiteralDynamicImports('import(`./a/${name}.ts`)')).toHaveLength(1);
    // Prose and strings that merely contain "import (" are not calls.
    expect(findNonLiteralDynamicImports('// starts the import (e.g. a file)\nconst s = "import (x)";')).toEqual([]);
    expect(findNonLiteralDynamicImports('/* import (x) */ const y = 1;')).toEqual([]);
  });

  it('web/src uses only literal specifiers in bundled dynamic imports', () => {
    const offenders = listSourceFiles(SRC).flatMap((file) =>
      findNonLiteralDynamicImports(readFileSync(file, 'utf8')).map(
        (hit) => `${relative(SRC, file)}:${hit}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
