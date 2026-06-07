import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { Compartment, type Extension } from '@codemirror/state';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { abbreviationTracker } from '@emmetio/codemirror6-plugin';
import { vim } from '@replit/codemirror-vim';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_THEME, resolveTheme } from './themes';
import { languageExtension, type EditorLanguage } from './modes';
import { editorKeymap, formatCss } from './keymap';

export interface CodeEditorProps {
  value: string;
  language: EditorLanguage;       // 'dsl' | 'css' (+ mode variants resolved in modes.ts)
  onChange: (value: string) => void;
  readOnly?: boolean;
  testId?: string;
  themeId?: string;               // default DEFAULT_THEME ('ink' — calm drafting theme)
  fontFamily?: string;            // default 'FiraCode' (DEFAULT_SETTINGS.editorFont)
  fontSize?: number;              // default 16 (DEFAULT_SETTINGS.fontSize)
  keymap?: 'sublime' | 'vim';     // default 'sublime' (CM6 default keymap, no vim)
  diagnostics?: { lineNumber: number; message: string }[]; // REQ-ED-7: inline error markers
}

// Resolve a stored editor-font setting to a real CSS font stack that ALWAYS ends in a
// monospace fallback. Without this, `font-family: FiraCode` (the camel-cased setting
// value, with no fallback and no bundled web font) falls back to the browser's
// PROPORTIONAL default — the code editor then renders in a serif-ish proportional font.
const FONT_FALLBACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const FONT_CSS_NAME: Record<string, string> = {
  FiraCode: '"Fira Code"',
  Inconsolata: '"Inconsolata"',
  Monoid: '"Monoid"',
  FixedSys: '"FixedSys"',
};
function fontStack(family: string): string {
  const name = FONT_CSS_NAME[family] ?? (family ? `"${family}"` : '');
  return name ? `${name}, ${FONT_FALLBACK}` : FONT_FALLBACK;
}

function fontTheme(family: string, size: number): Extension {
  return EditorView.theme({
    '&': { fontSize: size + 'px' },
    '.cm-content': { fontFamily: fontStack(family) },
  });
}

// Stable default so editors without diagnostics don't reconfigure the lint
// compartment on every render (a fresh [] would change identity each time).
const NO_DIAGNOSTICS: { lineNumber: number; message: string }[] = [];

// Builds a linter extension from caller-provided errors. `lineNumber` is 0-based;
// map it to a 1-based, clamped CM line and mark the whole line as an error.
function diagnosticsLinter(items: { lineNumber: number; message: string }[]): Extension {
  return linter((view) =>
    items.map((it) => {
      const lineNo = Math.min(Math.max(it.lineNumber + 1, 1), view.state.doc.lines); // 1-based, clamped
      const line = view.state.doc.line(lineNo);
      return { from: line.from, to: line.to, severity: 'error', message: it.message } as Diagnostic;
    }),
  );
}

export const CodeEditor = forwardRef<ReactCodeMirrorRef, CodeEditorProps>(function CodeEditor(
  {
    value,
    language,
    onChange,
    readOnly = false,
    testId,
    themeId = DEFAULT_THEME,
    fontFamily = 'FiraCode',
    fontSize = 16,
    keymap: keymapMode = 'sublime',
    diagnostics = NO_DIAGNOSTICS,
  },
  ref,
) {
  const themeCompartment = useRef(new Compartment());
  const fontCompartment = useRef(new Compartment());
  const keymapCompartment = useRef(new Compartment());
  const lintCompartment = useRef(new Compartment());
  const viewRef = useRef<EditorView | null>(null);
  // Keep latest onChange without rebuilding extensions (used by the CSS format command).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Built once; theme/font/keymap are swapped via compartment reconfigure (no remount).
  const extensions = useMemo(() => {
    const bindings: KeyBinding[] = [...editorKeymap];
    const languageExtensions: Extension[] = [...languageExtension(language)];

    // Emmet + Prettier are CSS-ONLY. The ZenUML DSL editor must never receive them
    // (DSL is not JS/CSS — Emmet expansion and Prettier formatting would corrupt it).
    if (language === 'css') {
      languageExtensions.push(abbreviationTracker());
      bindings.push({
        key: 'Mod-Shift-f',
        run: (view) => {
          // A read-only (ACSS) editor must not be formatted/mutated.
          if (view.state.readOnly) return false;
          const current = view.state.doc.toString();
          formatCss(current).then((formatted) => {
            if (formatted === current) return;
            // The dispatched doc change fires @uiw's updateListener → onChange,
            // so we must NOT call onChange again here (would double-fire).
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: formatted },
            });
          });
          return true;
        },
      });
    }

    return [
      EditorView.lineWrapping,
      lintGutter(),
      lintCompartment.current.of(diagnosticsLinter(diagnostics)),
      themeCompartment.current.of(resolveTheme(themeId)),
      fontCompartment.current.of(fontTheme(fontFamily, fontSize)),
      keymapCompartment.current.of(keymapMode === 'vim' ? vim() : []),
      // Our bindings come BEFORE defaultKeymap so they win on conflicts.
      keymap.of([...bindings, ...defaultKeymap]),
      ...languageExtensions,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compartments swap theme/font/keymap; only `language` should rebuild extensions
  }, [language]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: keymapCompartment.current.reconfigure(keymapMode === 'vim' ? vim() : []),
    });
  }, [keymapMode]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.current.reconfigure(resolveTheme(themeId)),
    });
  }, [themeId]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: fontCompartment.current.reconfigure(fontTheme(fontFamily, fontSize)),
    });
  }, [fontFamily, fontSize]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: lintCompartment.current.reconfigure(diagnosticsLinter(diagnostics)),
    });
  }, [diagnostics]);

  return (
    <div data-testid={testId} className="h-full overflow-hidden">
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        theme="none"
        readOnly={readOnly}
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
        basicSetup={{ lineNumbers: true, foldGutter: true, bracketMatching: true, closeBrackets: true, highlightActiveLine: true, autocompletion: language !== 'dsl' }}
      />
    </div>
  );
});
