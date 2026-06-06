import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { Compartment, type Extension } from '@codemirror/state';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_THEME, resolveTheme } from './themes';
import { languageExtension, type EditorLanguage } from './modes';

export interface CodeEditorProps {
  value: string;
  language: EditorLanguage;       // 'dsl' | 'css' (+ mode variants resolved in modes.ts)
  onChange: (value: string) => void;
  readOnly?: boolean;
  testId?: string;
  themeId?: string;               // default 'monokai' (DEFAULT_SETTINGS.editorTheme)
  fontFamily?: string;            // default 'FiraCode' (DEFAULT_SETTINGS.editorFont)
  fontSize?: number;              // default 16 (DEFAULT_SETTINGS.fontSize)
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
  },
  ref,
) {
  const themeCompartment = useRef(new Compartment());
  const fontCompartment = useRef(new Compartment());
  const viewRef = useRef<EditorView | null>(null);

  // Built once; theme/font are swapped via compartment reconfigure (no remount).
  const extensions = useMemo(
    () => [
      EditorView.lineWrapping,
      themeCompartment.current.of(resolveTheme(themeId)),
      fontCompartment.current.of(fontTheme(fontFamily, fontSize)),
      ...languageExtension(language),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compartments swap theme/font; only `language` should rebuild extensions
    [language],
  );

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
