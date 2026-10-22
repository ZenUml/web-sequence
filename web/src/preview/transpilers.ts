import type { CssMode } from '../domain/types';

export interface TranspileResult {
  code: string;
  errors?: { lineNumber: number; message: string }[];
}

// CSS: plain passes through; SCSS/SASS/LESS/Stylus/ACSS lazy-load their compiler.
export async function computeCss(code: string, mode: CssMode, settings: unknown): Promise<TranspileResult> {
  switch (mode) {
    case 'css':
      return { code };
    case 'scss':
    case 'sass': {
      const sass = await import('sass');
      try {
        const out = sass.compileString(code, { syntax: mode === 'sass' ? 'indented' : 'scss' });
        return { code: out.css };
      } catch (e) {
        // sass exposes the error span; span.start.line is already 0-based.
        // sassMessage is the bare message: `message` appends a code frame that
        // the browser build colours with ANSI escapes, unreadable in a tooltip.
        const line = (e as any)?.span?.start?.line ?? 0;
        const message = (e as any)?.sassMessage ?? (e as any)?.message ?? String(e);
        return { code: '', errors: [{ lineNumber: line, message }] };
      }
    }
    case 'less': {
      const less = (await import('less')).default;
      try { return { code: (await less.render(code)).css }; }
      catch (e) {
        // less reports a 1-based line; normalize to 0-based.
        const line = ((e as any)?.line ?? 1) - 1;
        return { code: '', errors: [{ lineNumber: line, message: (e as any)?.message ?? String(e) }] };
      }
    }
    case 'stylus': {
      const stylus = (await import('stylus')).default;
      // stylus errors are unstructured; line extraction is best-effort/deferred.
      return await new Promise((resolve) =>
        stylus(code).render((err: Error | null, out: string) =>
          resolve(err ? { code: '', errors: [{ lineNumber: 0, message: (err as any)?.message ?? String(err) }] } : { code: out })));
    }
    case 'acss': {
      const s = settings as { acssConfig?: string } | undefined;
      if (!s?.acssConfig) return { code: '' };
      const Atomizer = (await import('atomizer')).default;
      const instance = new Atomizer();
      const found = instance.findClassNames(code);
      // Malformed acssConfig must degrade gracefully (legacy fell back to {}),
      // not throw and leave the preview unstyled with an unhandled rejection.
      let parsed: Parameters<typeof instance.getConfig>[1] = {};
      try { parsed = JSON.parse(s.acssConfig); } catch { parsed = {}; }
      const config = instance.getConfig(found, parsed);
      return { code: instance.getCss(config) };
    }
    default:
      return { code };
  }
}
