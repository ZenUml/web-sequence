import { describe, it, expect, beforeEach } from 'vitest';
import * as localItems from './localItems';

beforeEach(() => window.localStorage.clear());

describe('localItems index', () => {
  it('starts empty', async () => {
    expect(await localItems.list()).toEqual([]);
  });
  it('add then list returns the id; add is idempotent', async () => {
    await localItems.add('a');
    await localItems.add('a');
    await localItems.add('b');
    expect((await localItems.list()).sort()).toEqual(['a', 'b']);
  });
  it('remove drops the id', async () => {
    await localItems.add('a');
    await localItems.add('b');
    await localItems.remove('a');
    expect(await localItems.list()).toEqual(['b']);
  });
});
