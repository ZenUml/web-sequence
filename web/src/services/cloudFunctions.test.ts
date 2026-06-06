import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getSharedItem } from './cloudFunctions';

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
