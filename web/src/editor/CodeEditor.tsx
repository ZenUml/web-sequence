import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { Compartment, Prec, type Extension } from '@codemirror/state';
import { linter, lintGutter, forceLinting, type Diagnostic } from '@codemirror/lint';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { abbreviationTracker } from '@emmetio/codemirror6-plugin';
import { vim } from '@replit/codemirror-vim';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_THEME, resolveTheme } from './themes';
import { languageExtension, type EditorLanguage } from './modes';
import { editorKeymap, formatCss } from './keymap';
import { resolveZone, zenumlCompletions, zenumlCompletionKeymap } from './zenumlAutocomplete';
import type { SlashZone } from './slashCommands';
import { createZenumlLspClient, type ZenumlLspClient, type LspDiagnostic } from './lsp/lspClient';
import {
  lspDocSync,
  lspHover,
  lspDiagnosticsLinter,
  lspDiagnosticsChanged,
} from './lsp/zenumlLspExtensions';

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
  // DSL only: fires when the cursor's parse zone (head vs block) changes. Feeds the
  // context-sensitive Hint Bar. Ignored for CSS.
  onZoneChange?: (zone: SlashZone) => void;
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

// STABLE basicSetup objects — one per `autocompletion` value. @uiw/react-codemirror
// includes the `basicSetup` prop in its `StateEffect.reconfigure` dependency array
// (useCodeMirror.js: `defaultBasicSetup`). A fresh object literal on every render
// therefore dispatches a full `reconfigure` after EVERY keystroke, which REPLACES the
// whole CM config and WIPES the lazily-appended snippet state (snippetState is added
// via StateEffect.appendConfig on first snippet apply). That is exactly why slash-command
// snippet tab stops never activated: insert → setDsl → AppRoot re-renders → new
// basicSetup identity → reconfigure → .cm-snippetField count drops to 0 before the user
// can press Tab. Hoisting to stable module-level constants stops the per-keystroke
// reconfigure so appended snippet state survives.
const BASIC_SETUP_BASE = {
  lineNumbers: true,
  foldGutter: true,
  bracketMatching: true,
  closeBrackets: true,
  highlightActiveLine: true,
} as const;
const BASIC_SETUP_WITH_AUTOCOMPLETE = { ...BASIC_SETUP_BASE, autocompletion: true } as const;
// DSL supplies its own completion source via autocompletion({ override: [...] }), so
// basicSetup's autocompletion stays off (avoids a second, default completion source).
const BASIC_SETUP_NO_AUTOCOMPLETE = { ...BASIC_SETUP_BASE, autocompletion: false } as const;

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
    onZoneChange,
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
  // Keep latest onZoneChange without rebuilding extensions — the updateListener
  // reads through this ref, so the `extensions` memo can stay keyed on `language`.
  const onZoneChangeRef = useRef(onZoneChange);
  onZoneChangeRef.current = onZoneChange;
  // Last zone emitted, so the listener only fires onZoneChange on an actual change.
  const lastZoneRef = useRef<SlashZone | null>(null);
  // ZenUML LSP worker (hover + doc-sync + diagnostics). Lazily created for the DSL
  // editor only and disposed on unmount. Powered by @zenuml/core's published lsp-worker.
  const lspClientRef = useRef<ZenumlLspClient | null>(null);
  // Latest diagnostics pushed by the LSP (server publishDiagnostics). The DSL linter
  // source reads this holder; the owning effect updates it and forces a re-lint.
  const lspDiagnosticsRef = useRef<LspDiagnostic[]>([]);

  // Built once; theme/font/keymap are swapped via compartment reconfigure (no remount).
  const extensions = useMemo(() => {
    const bindings: KeyBinding[] = [...editorKeymap];
    const languageExtensions: Extension[] = [...languageExtension(language)];

    // The DSL gets the purpose-built, context-aware completion source (slash
    // commands + participant-aware + zone-gated keywords). basicSetup keeps its
    // `autocompletion: false` for DSL (see below) so this is the sole source.
    // completionKeymap gives ArrowUp/Down popup navigation; zenumlCompletionKeymap
    // adds Tab-to-accept. The default snippet field keymap (Tab between ${1}/${2})
    // is installed by autocompletion()/snippet() automatically on first use.
    if (language === 'dsl') {
      languageExtensions.push(autocompletion({ override: [zenumlCompletions] }));
      // zenumlCompletionKeymap (Tab/Shift-Tab/Enter/Escape) MUST outrank @uiw's
      // indentWithTab, which @uiw/react-codemirror unshifts at HIGH precedence. Left
      // in the shared keymap.of([...bindings]) below it lives in props.extensions —
      // LOWER than @uiw's defaults — so Tab reached indentMore (inserting spaces in
      // front of `@`) instead of acceptCompletion. Prec.highest lifts accept +
      // snippet-field nav above indentWithTab; when neither applies the run returns
      // false and Tab falls through to indentWithTab, so plain Tab-indent still works.
      languageExtensions.push(Prec.highest(keymap.of(zenumlCompletionKeymap)));
      bindings.push(...completionKeymap);
      // Emit the cursor's parse zone (head | block) when the selection or doc
      // changes — lets the host react to cursor zone changes. Reads onZoneChange via a
      // ref so the memo can stay keyed on `language`.
      languageExtensions.push(
        EditorView.updateListener.of((update) => {
          if (!update.selectionSet && !update.docChanged) return;
          const cb = onZoneChangeRef.current;
          if (!cb) return;
          const zone = resolveZone(update.state, update.state.selection.main.head);
          if (zone === lastZoneRef.current) return;
          lastZoneRef.current = zone;
          cb(zone);
        }),
      );

      // ZenUML LSP (@zenuml/core/lsp-worker): adds hover (a capability the editor
      // lacks today) and keeps the document synced to the server so hover/position
      // requests resolve. The hand-rolled zenumlCompletions + linter are kept
      // intentionally — they are richer than the LSP's; LSP completion/diagnostics
      // are available in ./lsp/zenumlLspExtensions for a later migration if wanted.
      //
      // The worker is created/disposed by the effect below (NOT here in the render-phase
      // memo). These extensions read the live client lazily through `lspClientRef` so the
      // memoized array — which is not rebuilt on a StrictMode remount — can never hold a
      // disposed worker.
      const getLspClient = () => lspClientRef.current;
      languageExtensions.push(lspDocSync(getLspClient));
      languageExtensions.push(lspHover(getLspClient));
      // Server diagnostics (e.g. duplicate-participant warnings, syntax errors) as a
      // linter() SOURCE — CM merges it with the prop-based linter above rather than
      // clobbering it. The DSL editor passes no `diagnostics` prop today, so this is the
      // editor's only DSL diagnostics source.
      languageExtensions.push(lspDiagnosticsLinter(() => lspDiagnosticsRef.current));
    }

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

  // Own the ZenUML LSP worker lifecycle for the DSL editor. Created in an effect
  // (not in the render-phase `extensions` memo) so React StrictMode's
  // mount→unmount→remount cycle disposes AND recreates it cleanly: on the simulated
  // unmount the cleanup terminates the worker, then the effect re-runs on remount and
  // spins up a fresh one, re-opening the current document. The memoized hover/doc-sync
  // extensions read the live client lazily via `lspClientRef`, so they always talk to
  // the current worker and never to a disposed one. (CodeMirror child effects run
  // before this parent effect, so `viewRef` is populated by the time we open the doc.)
  useEffect(() => {
    if (language !== 'dsl') return;
    const client = createZenumlLspClient();
    lspClientRef.current = client;
    // No Web Worker available (jsdom unit tests, SSR): createZenumlLspClient returned
    // null. Render the editor WITHOUT a language server rather than crashing — the
    // lazily-read hover/doc-sync/diagnostic extensions already no-op on a null client.
    if (!client) return;
    // Subscribe BEFORE openDoc so the server's first publishDiagnostics isn't dropped.
    // On each push: store the set, then nudge CM to re-run the lint sources now (the
    // dispatched effect satisfies the linter's needsRefresh; forceLinting skips the
    // idle debounce) so diagnostics appear promptly instead of on the next keystroke.
    client.onDiagnostics = (diags) => {
      lspDiagnosticsRef.current = diags;
      const view = viewRef.current;
      if (view) {
        view.dispatch({ effects: lspDiagnosticsChanged.of(null) });
        forceLinting(view);
      }
    };
    const doc = viewRef.current?.state.doc.toString() ?? value;
    void client.openDoc(doc);
    return () => {
      client.dispose();
      if (lspClientRef.current === client) lspClientRef.current = null;
      lspDiagnosticsRef.current = [];
    };
    // `value` is intentionally excluded: openDoc seeds the server with the doc at
    // creation time; subsequent edits flow through lspDocSync's changeDoc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

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
        basicSetup={language === 'dsl' ? BASIC_SETUP_NO_AUTOCOMPLETE : BASIC_SETUP_WITH_AUTOCOMPLETE}
      />
    </div>
  );
});
