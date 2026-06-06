import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { forwardRef, useMemo } from 'react';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { languageExtension, type EditorLanguage } from './modes';

export interface CodeEditorProps {
  value: string;
  language: EditorLanguage;       // 'dsl' | 'css' (+ mode variants resolved in modes.ts)
  onChange: (value: string) => void;
  readOnly?: boolean;
  testId?: string;
}

export const CodeEditor = forwardRef<ReactCodeMirrorRef, CodeEditorProps>(function CodeEditor(
  { value, language, onChange, readOnly = false, testId },
  ref,
) {
  const extensions = useMemo(() => [EditorView.lineWrapping, ...languageExtension(language)], [language]);
  return (
    <div data-testid={testId} className="h-full overflow-hidden">
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        theme={monokai}
        readOnly={readOnly}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: true, bracketMatching: true, closeBrackets: true, highlightActiveLine: true, autocompletion: language !== 'dsl' }}
      />
    </div>
  );
});
