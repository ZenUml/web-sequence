/**
 * Minimal LSP client over the ZenUML language-server Web Worker.
 *
 * The server ships in @zenuml/core (>=3.50.0) as `@zenuml/core/lsp-worker` — a
 * self-contained browser Web Worker (completion, hover, diagnostics; no
 * backend). It speaks JSON-RPC over `postMessage` (message OBJECTS, no
 * Content-Length framing). This client correlates requests/responses by `id`,
 * acks server→client requests so the handshake completes, and surfaces
 * `publishDiagnostics`.
 */
export type LspDiagnostic = {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number; // 1=error 2=warning 3=info 4=hint
  message: string;
  source?: string;
};

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };

export class ZenumlLspClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private version = 0;
  private disposed = false;
  onDiagnostics: ((diags: LspDiagnostic[]) => void) | null = null;
  private readonly ready: Promise<void>;

  constructor(
    private readonly worker: Worker,
    private readonly uri = 'file:///editor.zenuml',
  ) {
    worker.onmessage = (ev: MessageEvent) => this.receive(ev.data);
    this.ready = this.initialize();
  }

  private notify(method: string, params: unknown): void {
    if (this.disposed) return;
    this.worker.postMessage({ jsonrpc: '2.0', method, params });
  }

  private request<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ jsonrpc: '2.0', id, method, params });
    });
  }

  private receive(msg: any): void {
    if (!msg || msg.jsonrpc !== '2.0') return;
    if (msg.id !== undefined && msg.method === undefined) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(msg.error);
        else p.resolve(msg.result);
      }
      return;
    }
    if (msg.id !== undefined && msg.method !== undefined) {
      // server -> client request (e.g. client/registerCapability): ack null
      this.worker.postMessage({ jsonrpc: '2.0', id: msg.id, result: null });
      return;
    }
    if (msg.method === 'textDocument/publishDiagnostics') {
      this.onDiagnostics?.(msg.params?.diagnostics ?? []);
    }
  }

  private async initialize(): Promise<void> {
    await this.request('initialize', {
      processId: null,
      rootUri: null,
      capabilities: {
        textDocument: {
          synchronization: { dynamicRegistration: false },
          completion: { completionItem: { snippetSupport: false } },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          publishDiagnostics: {},
        },
      },
    });
    this.notify('initialized', {});
  }

  async openDoc(text: string): Promise<void> {
    await this.ready;
    this.version = 1;
    this.notify('textDocument/didOpen', {
      textDocument: { uri: this.uri, languageId: 'zenuml', version: this.version, text },
    });
  }

  async changeDoc(text: string): Promise<void> {
    await this.ready;
    this.version += 1;
    this.notify('textDocument/didChange', {
      textDocument: { uri: this.uri, version: this.version },
      contentChanges: [{ text }],
    });
  }

  async completion(line: number, character: number): Promise<any> {
    await this.ready;
    return this.request('textDocument/completion', {
      textDocument: { uri: this.uri },
      position: { line, character },
    });
  }

  async hover(line: number, character: number): Promise<any> {
    await this.ready;
    return this.request('textDocument/hover', {
      textDocument: { uri: this.uri },
      position: { line, character },
    });
  }

  dispose(): void {
    this.disposed = true;
    this.onDiagnostics = null;
    this.pending.clear();
    this.worker.terminate();
  }
}

// Vite resolves the package's pre-built worker bundle to a served URL. NOTE: do
// NOT use `new Worker(new URL('@zenuml/core/lsp-worker', import.meta.url))` —
// vite only transforms the `new URL(...)` worker form for RELATIVE paths, not
// bare package specifiers, so the worker silently never loads. The `?url` import
// is the robust form for an already-bundled worker.
import zenumlLspWorkerUrl from '@zenuml/core/lsp-worker?url';

/**
 * Spawn the worker from the published package and wrap it. Returns `null` in
 * environments without Web Workers — jsdom (the unit-test runtime) and any SSR
 * path — so the editor renders WITHOUT LSP instead of throwing
 * `ReferenceError: Worker is not defined` on mount. The doc-sync/hover/diagnostic
 * extensions already no-op on a null client (they read it lazily), so "no Worker"
 * degrades cleanly to "no language server".
 */
export function createZenumlLspClient(): ZenumlLspClient | null {
  if (typeof Worker === 'undefined') return null;
  const worker = new Worker(zenumlLspWorkerUrl, { type: 'module' });
  return new ZenumlLspClient(worker);
}
