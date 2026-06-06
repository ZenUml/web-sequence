import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShare } from './useShare';

const createShareMock = vi.fn(async () => ({ url: 'http://x?id=1&share-token=t&v=md5', md5: 'md5' }));
const stopSharingMock = vi.fn(async () => {});
const getItemIdMock = () => 'item-1';
const onBeforeShareMock = vi.fn(async () => {});

function makeOpts(overrides?: Partial<Parameters<typeof useShare>[0]>) {
  return {
    itemId: 'item-1',
    getItemId: getItemIdMock,
    createShare: createShareMock,
    stopSharing: stopSharingMock,
    onBeforeShare: onBeforeShareMock,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useShare', () => {
  it('share() calls onBeforeShare, createShare with item id, and sets url', async () => {
    const { result } = renderHook(() => useShare(makeOpts()));
    expect(result.current.url).toBeNull();
    await act(async () => { await result.current.share(); });
    expect(onBeforeShareMock).toHaveBeenCalledTimes(1);
    expect(createShareMock).toHaveBeenCalledWith('item-1');
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');
    expect(result.current.sharing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('stop() calls stopSharing with item id and clears url', async () => {
    const { result } = renderHook(() => useShare(makeOpts()));
    // First share to set the url
    await act(async () => { await result.current.share(); });
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');

    await act(async () => { await result.current.stop(); });
    expect(stopSharingMock).toHaveBeenCalledWith('item-1');
    expect(result.current.url).toBeNull();
  });

  it('copy() calls navigator.clipboard.writeText with the url after share', async () => {
    const writeTextMock = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const { result } = renderHook(() => useShare(makeOpts()));
    await act(async () => { await result.current.share(); });
    await act(async () => { await result.current.copy(); });
    expect(writeTextMock).toHaveBeenCalledWith('http://x?id=1&share-token=t&v=md5');
  });

  it('share() sets error and clears sharing when createShare rejects', async () => {
    const failingCreate = vi.fn(async () => { throw new Error('server error'); });
    const { result } = renderHook(() => useShare(makeOpts({ createShare: failingCreate })));

    await act(async () => { await result.current.share(); });
    expect(result.current.error).toBe('server error');
    expect(result.current.sharing).toBe(false);
    expect(result.current.url).toBeNull();
  });

  it('share() does nothing when getItemId returns null', async () => {
    const { result } = renderHook(() => useShare(makeOpts({ getItemId: () => null })));
    await act(async () => { await result.current.share(); });
    expect(createShareMock).not.toHaveBeenCalled();
    expect(result.current.url).toBeNull();
  });

  it('stop() does nothing when getItemId returns null', async () => {
    const { result } = renderHook(() => useShare(makeOpts({ getItemId: () => null })));
    await act(async () => { await result.current.stop(); });
    expect(stopSharingMock).not.toHaveBeenCalled();
  });

  it('stop() surfaces an error and KEEPS the url when stopSharing rejects (advisor fix #7)', async () => {
    // A failed stop must not clear the link — clearing it would imply the diagram
    // is private when the public share may still be live.
    const failingStop = vi.fn(async () => { throw new Error('stop failed'); });
    const { result } = renderHook(() => useShare(makeOpts({ stopSharing: failingStop })));
    await act(async () => { await result.current.share(); });
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');

    await act(async () => { await result.current.stop(); });
    expect(result.current.error).toBe('stop failed');
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');
  });

  it('resets url + error when itemId changes (advisor fix #8)', async () => {
    // Share item A → url set. Switch to item B (itemId prop changes) → url must
    // reset, otherwise Copy copies A's link and Stop targets the wrong item.
    const { result, rerender } = renderHook(
      ({ itemId }) => useShare(makeOpts({ itemId })),
      { initialProps: { itemId: 'A' } },
    );
    await act(async () => { await result.current.share(); });
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');

    rerender({ itemId: 'B' });
    expect(result.current.url).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('captures the click-time id before awaits and ignores a stale createShare result if the item switched mid-flight (adversarial review)', async () => {
    // Race: user clicks Share on item A, then switches to B while onBeforeShare (save)
    // is in flight. createShare must target A (the bound item), NOT the now-current B,
    // and the late result must NOT repopulate the popover for A after the switch.
    let currentId = 'A';
    const getItemId = () => currentId;
    let releaseSave!: () => void;
    const onBeforeShare = vi.fn(
      () => new Promise<void>((resolve) => { releaseSave = resolve; }),
    );
    const createShare = vi.fn(async (id: string) => ({ url: `url-for-${id}`, md5: 'm' }));

    const { result, rerender } = renderHook(
      ({ itemId }) =>
        useShare({
          itemId,
          getItemId,
          createShare,
          stopSharing: stopSharingMock,
          onBeforeShare,
        }),
      { initialProps: { itemId: 'A' } },
    );

    // Click Share while bound to A; save is pending (not yet resolved).
    let sharePromise!: Promise<void>;
    act(() => { sharePromise = result.current.share(); });

    // User switches to B during the save await.
    currentId = 'B';
    rerender({ itemId: 'B' });

    // Save completes; createShare runs and resolves.
    await act(async () => { releaseSave(); await sharePromise; });

    // Targeted the click-time item A, not the switched-to B.
    expect(createShare).toHaveBeenCalledWith('A');
    expect(createShare).not.toHaveBeenCalledWith('B');
    // The stale result must not repopulate the popover (item is now B). Revert the
    // capture-before-await + stale guard → createShare('B') and/or url set → fails.
    expect(result.current.url).toBeNull();
  });

  it('a createShare FAILURE for the click-time item does not surface as an error after switching items (adversarial review)', async () => {
    // Symmetric to the success race: user shares A → switches to B → createShare(A)
    // rejects (e.g. A was never saved → 404). The catch must NOT set error for the
    // now-active B (the itemId reset effect clears error on switch). Revert the catch
    // guard (`if (getItemId() === id)`) → error repopulated for B → fails.
    let currentId = 'A';
    const getItemId = () => currentId;
    let releaseSave!: () => void;
    const onBeforeShare = vi.fn(
      () => new Promise<void>((resolve) => { releaseSave = resolve; }),
    );
    const createShare = vi.fn(async () => { throw new Error('A not saved'); });

    const { result, rerender } = renderHook(
      ({ itemId }) =>
        useShare({ itemId, getItemId, createShare, stopSharing: stopSharingMock, onBeforeShare }),
      { initialProps: { itemId: 'A' } },
    );

    let sharePromise!: Promise<void>;
    act(() => { sharePromise = result.current.share(); });
    currentId = 'B';
    rerender({ itemId: 'B' });
    await act(async () => { releaseSave(); await sharePromise; });

    expect(createShare).toHaveBeenCalledWith('A');
    expect(result.current.error).toBeNull();
  });

  it('does NOT reset url when itemId is unchanged across re-renders (advisor fix #8 — no over-reset)', async () => {
    const { result, rerender } = renderHook(
      ({ itemId }) => useShare(makeOpts({ itemId })),
      { initialProps: { itemId: 'A' } },
    );
    await act(async () => { await result.current.share(); });
    rerender({ itemId: 'A' });
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');
  });
});
