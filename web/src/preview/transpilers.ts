import type { CssMode, JsMode } from '../domain/types';

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
        return { code: '', errors: [{ lineNumber: 0, message: String(e) }] };
      }
    }
    case 'less': {
      const less = (await import('less')).default;
      try { return { code: (await less.render(code)).css }; }
      catch (e) { return { code: '', errors: [{ lineNumber: 0, message: String(e) }] }; }
    }
    case 'stylus': {
      const stylus = (await import('stylus')).default;
      return await new Promise((resolve) =>
        stylus(code).render((err: Error | null, out: string) =>
          resolve(err ? { code: '', errors: [{ lineNumber: 0, message: String(err) }] } : { code: out })));
    }
    case 'acss': {
      const s = settings as { acssConfig?: string } | undefined;
      if (!s?.acssConfig) return { code: '' };
      const Atomizer = (await import('atomizer')).default;
      const instance = new Atomizer();
      const found = instance.findClassNames(code);
      const config = instance.getConfig(found, JSON.parse(s.acssConfig));
      return { code: instance.getCss(config) };
    }
    default:
      return { code };
  }
}

// JS/DSL: 'js' passes through (ZenUML DSL is sent as-is). ES6/TS/Coffee transpile.
export async function computeJs(code: string, mode: JsMode): Promise<TranspileResult> {
  switch (mode) {
    case 'js':
      return { code };
    case 'es6': {
      const Babel = await import('@babel/standalone');
      return { code: Babel.transform(code, { presets: ['env'] }).code ?? '' };
    }
    case 'typescript': {
      const ts = (await import('typescript')).default;
      return { code: ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ES2015 } }).outputText };
    }
    case 'coffeescript': {
      const coffee = (await import('coffeescript')).default;
      return { code: coffee.compile(code) };
    }
    default:
      return { code };
  }
}
