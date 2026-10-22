import { isFrameMessage, type FrameMessage, type HostMessage } from './previewProtocol';

/**
 * One request/response client for a preview iframe (#892). It owns what each
 * caller used to hand-roll: request ids, the source + protocol guard,
 * timeout, abort, and turning a frame `error` message into a rejection.
 * One window listener per client, shared by every pending wait.
 */

export type PreviewRpcFailure = 'timeout' | 'aborted' | 'frame';

export class PreviewRpcError extends Error {
  constructor(readonly reason: PreviewRpcFailure, message: string) {
    super(message);
    this.name = 'PreviewRpcError';
  }
}

export interface WaitOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

type IdMessage = Extract<HostMessage, { id: number }>;

interface Pending {
  match: (message: FrameMessage) => boolean;
  resolve: (message: FrameMessage) => void;
  reject: (error: PreviewRpcError) => void;
}

const DEFAULT_TIMEOUT_MS = 15000;

export function createPreviewRpc(getWindow: () => Window | null) {
  const pending = new Set<Pending>();
  let nextId = 1;

  function receive(event: MessageEvent) {
    const frame = getWindow();
    if (!frame || event.source !== frame || !isFrameMessage(event.data)) return;
    const message = event.data;
    for (const waiter of [...pending]) {
      if (message.type === 'error') waiter.reject(new PreviewRpcError('frame', message.message));
      else if (waiter.match(message)) waiter.resolve(message);
    }
  }
  window.addEventListener('message', receive);

  function wait(match: (message: FrameMessage) => boolean, { timeoutMs = DEFAULT_TIMEOUT_MS, signal }: WaitOptions = {}) {
    return new Promise<FrameMessage>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new PreviewRpcError('aborted', 'Preview request cancelled.'));
        return;
      }
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        pending.delete(waiter);
      };
      const waiter: Pending = {
        match,
        resolve: (message) => { finish(); resolve(message); },
        reject: (error) => { finish(); reject(error); },
      };
      const onAbort = () => waiter.reject(new PreviewRpcError('aborted', 'Preview request cancelled.'));
      const timer = setTimeout(() => waiter.reject(new PreviewRpcError('timeout', 'Preview request timed out.')), timeoutMs);
      signal?.addEventListener('abort', onAbort, { once: true });
      pending.add(waiter);
    });
  }

  /** Posts `build(id)` with a fresh id; resolves on the first reply `match(reply, id)` accepts. */
  function request(
    build: (id: number) => IdMessage,
    match: (message: FrameMessage, id: number) => boolean,
    options?: WaitOptions,
  ) {
    const id = nextId++;
    const reply = wait((message) => match(message, id), options);
    if (!options?.signal?.aborted) getWindow()?.postMessage(build(id), '*');
    return reply;
  }

  function post(message: HostMessage) {
    getWindow()?.postMessage(message, '*');
  }

  function dispose() {
    window.removeEventListener('message', receive);
    for (const waiter of [...pending]) waiter.reject(new PreviewRpcError('aborted', 'Preview request cancelled.'));
  }

  return { wait, request, post, dispose };
}

export type PreviewRpc = ReturnType<typeof createPreviewRpc>;
