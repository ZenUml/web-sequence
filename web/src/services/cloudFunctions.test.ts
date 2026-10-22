import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getSharedItem, createShare, trackEvent } from './cloudFunctions';
import { SharedItemError, classifySharedItemFailure } from './sharedItemError';

vi.mock('./firebase', () => ({ getIdToken: vi.fn(async () => 'fresh-token') }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // M05: a leaked IS_EXTENSION would flip the web-origin tests red on the next run.
  delete (window as { IS_EXTENSION?: boolean }).IS_EXTENSION;
});
afterAll(() => server.close());

// jsdom resolves relative URLs to http://localhost:3000 (Vite's dev port in the
// test environment). Use origin-relative matching via `*` wildcard on origin so
// this works regardless of the port jsdom picks.
const BASE = `${window.location.origin}`;

describe('getSharedItem', () => {
  it('GETs /get-shared-item with id + share-token and returns the item', async () => {
    server.use(http.get(`${BASE}/get-shared-item`, ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('id')).toBe('abc');
      expect(url.searchParams.get('share-token')).toBe('xyz');
      return HttpResponse.json({ id: 'abc', title: 'Shared', js: 'A.b', css: '', html: '', isReadOnly: true });
    }));
    const item = await getSharedItem('abc', 'xyz');
    expect(item.id).toBe('abc');
    expect(item.isReadOnly).toBe(true);
  });
  it('throws with the server error message on non-ok', async () => {
    server.use(http.get(`${BASE}/get-shared-item`, () =>
      HttpResponse.json({ error: 'Sharing disabled' }, { status: 403 })));
    await expect(getSharedItem('abc', 'xyz')).rejects.toThrow(/Sharing disabled/);
  });

  // Provenance: the visitor UI may only call a link unavailable when the backend
  // explicitly said so. Each case asserts the typed status + classification.
  it.each([
    [400, 'unavailable'],
    [403, 'unavailable'],
    [404, 'unavailable'],
    [500, 'retryable'],
    [503, 'retryable'],
    [429, 'retryable'],
  ] as const)('HTTP %i rejects with SharedItemError classified %s', async (status, failure) => {
    server.use(http.get(`${BASE}/get-shared-item`, () =>
      HttpResponse.json({ error: 'server said no' }, { status })));
    const err = await getSharedItem('abc', 'xyz').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedItemError);
    expect((err as SharedItemError).status).toBe(status);
    expect(classifySharedItemFailure(err)).toBe(failure);
  });

  it('a network failure (fetch rejects) is retryable, never unavailable', async () => {
    server.use(http.get(`${BASE}/get-shared-item`, () => HttpResponse.error()));
    const err = await getSharedItem('abc', 'xyz').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedItemError);
    expect((err as SharedItemError).status).toBeNull();
    expect(classifySharedItemFailure(err)).toBe('retryable');
  });

  it('a 200 with a non-JSON body (e.g. an HTML error page) is retryable', async () => {
    server.use(http.get(`${BASE}/get-shared-item`, () =>
      new HttpResponse('<html>gateway</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    const err = await getSharedItem('abc', 'xyz').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SharedItemError);
    expect(classifySharedItemFailure(err)).toBe('retryable');
  });

  it('an error without SharedItemError provenance is classified retryable', () => {
    expect(classifySharedItemFailure(new Error('not found'))).toBe('retryable');
    expect(classifySharedItemFailure(undefined)).toBe('retryable');
  });
});

describe('createShare', () => {
  it('POSTs id + fresh token, returns the share URL with the md5 cache-buster appended', async () => {
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      const body = (await request.json()) as { id: string; token: string; origin: string };
      expect(body.id).toBe('item-1');
      expect(body.token).toBe('fresh-token');
      // Contract §5.1: the frontend must send origin so the backend builds the share
      // URL on the real host instead of an env fallback (advisor fix #3).
      expect(body.origin).toBe(window.location.origin);
      return HttpResponse.json({ page_share: 'http://localhost?id=item-1&share-token=tok', md5: 'abc123' });
    }));
    const { url, md5 } = await createShare('item-1');
    expect(md5).toBe('abc123');
    expect(url).toBe('http://localhost?id=item-1&share-token=tok&v=abc123');
  });
  it('throws the server error on non-ok', async () => {
    server.use(http.post(`${window.location.origin}/create-share`, () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })));
    await expect(createShare('item-1')).rejects.toThrow(/Forbidden/);
  });
  // #615: a /create-share request that never answers left the Share spinner running
  // forever. The request must give up and reject so useShare can show Try again.
  it('rejects with a timeout error when the server never responds', async () => {
    server.use(http.post(`${window.location.origin}/create-share`, () => new Promise<never>(() => {})));
    await expect(createShare('item-1', { timeoutMs: 50 })).rejects.toThrow(/timed out/);
  });
});

describe('createShare — origin source (M05)', () => {
  it('web app: sends window.location.origin', async () => {
    let captured: { origin: string } | undefined;
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      captured = (await request.json()) as { origin: string };
      return HttpResponse.json({ page_share: 'http://localhost?id=item-1&share-token=tok', md5: 'abc' });
    }));
    await createShare('item-1', { isExtension: false });
    expect(captured!.origin).toBe(window.location.origin);
  });

  it('extension: sends the canonical app origin, NOT chrome-extension://', async () => {
    let captured: { origin: string } | undefined;
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      captured = (await request.json()) as { origin: string };
      return HttpResponse.json({ page_share: 'https://app.zenuml.com?id=item-1&share-token=tok', md5: 'abc' });
    }));
    await createShare('item-1', { isExtension: true });
    expect(captured!.origin).toBe('https://app.zenuml.com');
  });

  // NO-OPTS DEFAULT (discriminating for the lazy default — the two tests above pass an
  // EXPLICIT opts; this one passes NONE, exercising `opts.isExtension ?? detectFromEnv()
  // .isExtension`). Stub the env via window.IS_EXTENSION (runtimeMode.detectFromEnv reads
  // it) WITHOUT touching window.location — so the MSW handler keyed on
  // window.location.origin keeps matching. Revert createShare's lazy default (hardcode
  // origin / resolve env at module load) → this FAILS.
  it('no-opts default: under the extension env, createShare(id) sends app.zenuml.com', async () => {
    (window as { IS_EXTENSION?: boolean }).IS_EXTENSION = true;
    let captured: { origin: string } | undefined;
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      captured = (await request.json()) as { origin: string };
      return HttpResponse.json({ page_share: 'https://app.zenuml.com?id=item-1&share-token=tok', md5: 'abc' });
    }));
    await createShare('item-1'); // NO opts — exercises the detectFromEnv() default
    expect(captured!.origin).toBe('https://app.zenuml.com');
  });

  it('body shape stays EXACTLY { id, token, origin } (no name/content/description added)', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ page_share: 'http://localhost?id=item-1&share-token=tok', md5: 'abc' });
    }));
    await createShare('item-1', { isExtension: false });
    expect(Object.keys(captured!).sort()).toEqual(['id', 'origin', 'token']);
  });
});

describe('trackEvent', () => {
  it('POSTs { event, userId, ...properties } to /track', async () => {
    let received: Record<string, unknown> | null = null;
    server.use(http.post(`${window.location.origin}/track`, async ({ request }) => {
      received = (await request.json()) as Record<string, unknown>;
      return HttpResponse.text('Event tracked successfully');
    }));
    await trackEvent({ event: 'saveBtnClick', userId: 'u1', category: 'ui', label: 'saved' });
    expect(received).toEqual({ event: 'saveBtnClick', userId: 'u1', category: 'ui', label: 'saved' });
  });
  it('carries userId:null for anonymous events', async () => {
    let received: Record<string, unknown> | null = null;
    server.use(http.post(`${window.location.origin}/track`, async ({ request }) => {
      received = (await request.json()) as Record<string, unknown>;
      return HttpResponse.text('ok');
    }));
    await trackEvent({ event: 'pageView', userId: null });
    expect(received!.userId).toBeNull();
  });
  it('never throws on a network/non-ok error (non-blocking)', async () => {
    server.use(http.post(`${window.location.origin}/track`, () => HttpResponse.error()));
    await expect(trackEvent({ event: 'x', userId: null })).resolves.toBeUndefined();
  });
});
