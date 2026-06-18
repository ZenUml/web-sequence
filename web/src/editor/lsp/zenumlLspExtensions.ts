/**
 * CodeMirror 6 extensions backed by the ZenUML LSP worker (@zenuml/core).
 *
 * Granular by design so each can be adopted independently:
 *   - lspDocSync(getClient)              → keeps the doc synced to the server on
 *                                          every edit (REQUIRED for hover/completion/
 *                                          diagnostics to resolve positions).
 *   - lspHover(getClient)                → hover tooltips (new capability)
 *   - lspDiagnosticsLinter(getDiags)     → surfaces the server's diagnostics (e.g.
 *                                          duplicate-participant warnings) as a CM
 *                                          linter() SOURCE — it MERGES with any other
 *                                          linter() rather than clobbering it.
 *   - lspCompletionSource(client)        → a CompletionSource (opt-in; the editor's
 *                                          hand-rolled zenumlCompletions is richer)
 *
 * NOTE on the `getClient`/`getDiags` accessors: these extensions take a `() => …`
 * accessor rather than a value. The CodeMirror extensions array is memoized by the
 * host (CodeEditor.tsx) and is NOT rebuilt on a React StrictMode mount→unmount→remount
 * cycle, but the worker IS disposed and recreated across that cycle. Reading through an
 * accessor means these extensions always talk to the LIVE worker / latest diagnostics
 * and never to a terminated one. (The initial `didOpen` and the diagnostics subscription
 * are owned by the host effect that owns the worker lifecycle.)
 */
import { StateEffect, type Extension } from '@codemirror/state';
import { EditorView, hoverTooltip, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { linter, type Diagnostic } from '@codemirror/lint';
import {
  CompletionContext,
  type Completion,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { ZenumlLspClient, type LspDiagnostic } from './lspClient';

type Doc = EditorView['state']['doc'];

function offsetToPos(doc: Doc, offset: number) {
  const line = doc.lineAt(offset);
  return { line: line.number - 1, character: offset - line.from };
}
function posToOffset(doc: Doc, pos: { line: number; character: number }) {
  const lineNo = Math.min(pos.line + 1, doc.lines);
  const line = doc.line(lineNo);
  return Math.min(line.from + pos.character, line.to);
}

/**
 * Keep the document synced on the server on every edit. No diagnostics emitted.
 * The INITIAL didOpen is performed by the host effect that owns the worker (so a
 * StrictMode-recreated worker is re-opened with the current doc); this plugin only
 * pushes incremental changes. Reads the live client lazily — see file header.
 */
export function lspDocSync(getClient: () => ZenumlLspClient | null): Extension {
  return ViewPlugin.fromClass(
    class {
      update(u: ViewUpdate) {
        if (u.docChanged) void getClient()?.changeDoc(u.state.doc.toString());
      }
    },
  );
}

// Tooltip styling. CodeMirror's default `.cm-tooltip` supplies the box (border +
// background); this only styles the inner markdown so **bold** and `code` read right.
const lspHoverTheme = EditorView.baseTheme({
  '.cm-zenuml-lsp-hover': {
    padding: '4px 8px',
    maxWidth: '460px',
    lineHeight: '1.45',
  },
  '.cm-zenuml-lsp-hover strong': { fontWeight: '600' },
  '.cm-zenuml-lsp-hover code': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '90%',
    padding: '0 3px',
    borderRadius: '3px',
    backgroundColor: 'rgba(127, 127, 127, 0.18)',
  },
});

// Render the tiny markdown subset the ZenUML LSP hover emits — **bold** and `code`,
// everything else (incl. the → and — symbols) as plain text — into DOM nodes. Built
// from text nodes / <strong> / <code> rather than innerHTML, so there is no HTML
// injection surface even though the content originates from our own server.
function appendInlineMarkdown(parent: Node, line: string): void {
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parent.appendChild(document.createTextNode(line.slice(last, m.index)));
    if (m[1] !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = m[1];
      parent.appendChild(strong);
    } else {
      const code = document.createElement('code');
      code.textContent = m[2];
      parent.appendChild(code);
    }
    last = re.lastIndex;
  }
  if (last < line.length) parent.appendChild(document.createTextNode(line.slice(last)));
}

/** LSP hover tooltips. The current editor has none — this is purely additive. */
export function lspHover(getClient: () => ZenumlLspClient | null): Extension {
  return [
    lspHoverTheme,
    hoverTooltip(async (view, pos) => {
      const client = getClient();
      if (!client) return null;
      const p = offsetToPos(view.state.doc, pos);
      const res = await client.hover(p.line, p.character);
      const contents = res?.contents;
      const md =
        typeof contents === 'string'
          ? contents
          : Array.isArray(contents)
            ? contents.map((c: any) => (typeof c === 'string' ? c : c.value)).join('\n')
            : contents?.value;
      if (!md) return null;
      return {
        pos,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-zenuml-lsp-hover';
          // One <div> per markdown line so multi-line hovers wrap as blocks.
          for (const line of String(md).split('\n')) {
            const lineEl = document.createElement('div');
            appendInlineMarkdown(lineEl, line);
            dom.appendChild(lineEl);
          }
          return { dom };
        },
      };
    }),
  ];
}

/** LSP-backed completion source (opt-in). */
export function lspCompletionSource(client: ZenumlLspClient) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const p = offsetToPos(ctx.state.doc, ctx.pos);
    const res = await client.completion(p.line, p.character);
    const items: any[] = Array.isArray(res) ? res : (res?.items ?? []);
    if (!items.length) return null;
    const word = ctx.matchBefore(/[\w@.]+/);
    return {
      from: word ? word.from : ctx.pos,
      options: items.map(
        (it): Completion => ({
          label: it.label,
          type: it.kind === 6 ? 'variable' : 'keyword',
          detail: it.detail,
        }),
      ),
      validFor: /^[\w@.]*$/,
    };
  };
}

/**
 * Dispatched by the host when fresh LSP diagnostics have arrived (server push). The
 * linter below lists it in `needsRefresh` so CodeMirror re-runs the lint sources; the
 * host pairs the dispatch with `forceLinting(view)` to make them appear immediately
 * instead of after the 750ms idle debounce.
 */
export const lspDiagnosticsChanged = StateEffect.define<null>();

/**
 * Surface the server's diagnostics as a CodeMirror linter() SOURCE. Because CM merges
 * every linter() source (lintConfig is a Facet), this composes with the host's existing
 * prop-based linter instead of clobbering it. Diagnostics arrive by PUSH
 * (textDocument/publishDiagnostics); the host stores the latest set and this source —
 * pulled on doc change / `lspDiagnosticsChanged` / forceLinting — maps them to CM, so
 * the push→pull bridge stays inside the documented lint lifecycle.
 */
export function lspDiagnosticsLinter(getDiagnostics: () => LspDiagnostic[]): Extension {
  return linter(
    (view): Diagnostic[] => {
      const doc = view.state.doc;
      return getDiagnostics().map((d) => {
        const from = posToOffset(doc, d.range.start);
        const to = Math.max(from + 1, posToOffset(doc, d.range.end));
        return {
          from,
          to,
          severity: d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info',
          message: d.message,
          source: d.source || 'zenuml',
        };
      });
    },
    {
      needsRefresh: (update) =>
        update.transactions.some((tr) => tr.effects.some((e) => e.is(lspDiagnosticsChanged))),
    },
  );
}
