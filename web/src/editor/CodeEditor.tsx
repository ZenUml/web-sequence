import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { Compartment, type Extension } from '@codemirror/state';
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
  themeId?: string;               // default 'monokai' (DEFAULT_SETTINGS.editorTheme)
  fontFamily?: string;            // default 'FiraCode' (DEFAULT_SETTINGS.editorFont)
  fontSize?: number;              // default 16 (DEFAULT_SETTINGS.fontSize)
  keymap?: 'sublime' | 'vim';     // default 'sublime' (CM6 default keymap, no vim)
}

function fontTheme(family: string, size: number): Extension {
  return EditorView.theme({
    '&': { fontSize: size + 'px' },
    '.cm-content': { fontFamily: family },
  });
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
  },
  ref,
) {
  const themeCompartment = useRef(new Compartment());
  const fontCompartment = useRef(new Compartment());
  const keymapCompartment = useRef(new Compartment());
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
          const current = view.state.doc.toString();
          formatCss(current).then((formatted) => {
            if (formatted === current) return;
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: formatted },
            });
            onChangeRef.current(formatted);
          });
          return true;
        },
      });
    }

    return [
      EditorView.lineWrapping,
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
