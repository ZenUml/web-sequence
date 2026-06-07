import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getSharedItem, createShare, trackEvent } from './cloudFunctions';

vi.mock('./firebase', () => ({ getIdToken: vi.fn(async () => 'fresh-token') }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
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
