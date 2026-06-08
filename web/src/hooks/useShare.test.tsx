import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useShare } from './useShare';
import { useEditorStore } from '../state/editorStore';
import type { Item } from '../domain/types';
// REAL createShare (NOT a mock) — the through-useShare seam test drives the actual
// share path to prove the extension origin override fires end-to-end (M05 Task 4).
import { createShare } from '../services/cloudFunctions';

// createShare → getIdToken; stub firebase so jsdom doesn't initialise it.
vi.mock('../services/firebase', () => ({ getIdToken: vi.fn(async () => 'fresh-token') }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // A leaked IS_EXTENSION would flip the createShare web-origin tests red elsewhere.
  delete (window as { IS_EXTENSION?: boolean }).IS_EXTENSION;
  // The hydration effect reads the real zustand singleton on itemId change. A leaked
  // shared currentItem would hydrate a url in the OTHER tests that assume an empty
  // store (e.g. "resets url + error when itemId changes" expects url=null after switch).
  useEditorStore.getState().reset();
});

// Minimal already-shared item for the hydration tests. loadItem migrates it to pages
// and clears dirty/save counters; isShared/shareToken survive (they're item fields).
function sharedItem(overrides?: Partial<Item>): Item {
  return {
    id: 'item-1',
    title: 'Shared',
    js: 'A->B: hi',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'js',
    pages: [],
    currentPageId: '',
    isShared: true,
    shareToken: 'tok-xyz',
    ...overrides,
  };
}
afterAll(() => server.close());

const createShareMock = vi.fn(async () => ({
  url: 'http://x?id=1&share-token=t&v=md5',
  md5: 'md5',
}));
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
    await act(async () => {
      await result.current.share();
    });
    expect(onBeforeShareMock).toHaveBeenCalledTimes(1);
    expect(createShareMock).toHaveBeenCalledWith('item-1');
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');
    expect(result.current.sharing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('stop() calls stopSharing with item id and clears url', async () => {
    const { result } = renderHook(() => useShare(makeOpts()));
    // First share to set the url
    await act(async () => {
      await result.current.share();
    });
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');

    await act(async () => {
      await result.current.stop();
    });
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
    await act(async () => {
      await result.current.share();
    });
    await act(async () => {
      await result.current.copy();
    });
    expect(writeTextMock).toHaveBeenCalledWith(
      'http://x?id=1&share-token=t&v=md5',
    );
  });

  it('copy() sets copied=true on success then reverts after 1.5s', async () => {
    // Discriminating: revert useShare's copy() to drop setCopied/timer → copied
    // stays false → the first assertion fails. Keep setCopied but drop the timer
    // → copied never reverts → the post-advance assertion fails.
    const writeTextMock = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useShare(makeOpts()));
      await act(async () => {
        await result.current.share();
      });
      expect(result.current.copied).toBe(false);

      // Drive the real clipboard await to completion BEFORE touching fake timers.
      await act(async () => {
        await result.current.copy();
      });
      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(result.current.copied).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('copy() does NOT set copied when there is no url to copy', async () => {
    // No share() first → url is null → writeText never runs → copied must stay false.
    const writeTextMock = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    const { result } = renderHook(() => useShare(makeOpts()));
    await act(async () => {
      await result.current.copy();
    });
    expect(writeTextMock).not.toHaveBeenCalled();
    expect(result.current.copied).toBe(false);
  });

  it('share() sets error and clears sharing when createShare rejects', async () => {
    const failingCreate = vi.fn(async () => {
      throw new Error('server error');
    });
    const { result } = renderHook(() =>
      useShare(makeOpts({ createShare: failingCreate })),
    );

    await act(async () => {
      await result.current.share();
    });
    expect(result.current.error).toBe('server error');
    expect(result.current.sharing).toBe(false);
    expect(result.current.url).toBeNull();
  });

  it('share() does nothing when getItemId returns null', async () => {
    const { result } = renderHook(() =>
      useShare(makeOpts({ getItemId: () => null })),
    );
    await act(async () => {
      await result.current.share();
    });
    expect(createShareMock).not.toHaveBeenCalled();
    expect(result.current.url).toBeNull();
  });

  it('stop() does nothing when getItemId returns null', async () => {
    const { result } = renderHook(() =>
      useShare(makeOpts({ getItemId: () => null })),
    );
    await act(async () => {
      await result.current.stop();
    });
    expect(stopSharingMock).not.toHaveBeenCalled();
  });

  it('stop() surfaces an error and KEEPS the url when stopSharing rejects (advisor fix #7)', async () => {
    // A failed stop must not clear the link — clearing it would imply the diagram
    // is private when the public share may still be live.
    const failingStop = vi.fn(async () => {
      throw new Error('stop failed');
    });
    const { result } = renderHook(() =>
      useShare(makeOpts({ stopSharing: failingStop })),
    );
    await act(async () => {
      await result.current.share();
    });
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');

    await act(async () => {
      await result.current.stop();
    });
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
    await act(async () => {
      await result.current.share();
    });
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
      () =>
        new Promise<void>((resolve) => {
          releaseSave = resolve;
        }),
    );
    const createShare = vi.fn(async (id: string) => ({
      url: `url-for-${id}`,
      md5: 'm',
    }));

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
    act(() => {
      sharePromise = result.current.share();
    });

    // User switches to B during the save await.
    currentId = 'B';
    rerender({ itemId: 'B' });

    // Save completes; createShare runs and resolves.
    await act(async () => {
      releaseSave();
      await sharePromise;
    });

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
      () =>
        new Promise<void>((resolve) => {
          releaseSave = resolve;
        }),
    );
    const createShare = vi.fn(async () => {
      throw new Error('A not saved');
    });

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

    let sharePromise!: Promise<void>;
    act(() => {
      sharePromise = result.current.share();
    });
    currentId = 'B';
    rerender({ itemId: 'B' });
    await act(async () => {
      releaseSave();
      await sharePromise;
    });

    expect(createShare).toHaveBeenCalledWith('A');
    expect(result.current.error).toBeNull();
  });

  it('a stopSharing FAILURE for the click-time item does not surface as an error after switching items (adversarial review)', async () => {
    // Symmetric to share()'s catch guard: user clicks Stop on A → switches to B while
    // stopSharing(A) is in flight → stopSharing(A) rejects. The catch must NOT set error
    // for the now-active B (the itemId reset effect already cleared B's error on switch).
    // Revert stop()'s catch guard (`if (getItemId() === id)`) → A's failure repopulates
    // B's popover → fails.
    let currentId = 'A';
    const getItemId = () => currentId;
    let rejectStop!: (e: Error) => void;
    const stopSharing = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectStop = reject;
        }),
    );

    const { result, rerender } = renderHook(
      ({ itemId }) =>
        useShare({
          itemId,
          getItemId,
          createShare: createShareMock,
          stopSharing,
          onBeforeShare: onBeforeShareMock,
        }),
      { initialProps: { itemId: 'A' } },
    );

    // Click Stop while bound to A; stopSharing is pending (not yet settled).
    let stopPromise!: Promise<void>;
    act(() => {
      stopPromise = result.current.stop();
    });

    // User switches to B during the in-flight stop.
    currentId = 'B';
    rerender({ itemId: 'B' });

    // stopSharing(A) now rejects.
    await act(async () => {
      rejectStop(new Error('stop A failed'));
      await stopPromise;
    });

    expect(stopSharing).toHaveBeenCalledWith('A');
    // A's failure must not be attributed to the now-active B.
    expect(result.current.error).toBeNull();
  });

  it('does NOT reset url when itemId is unchanged across re-renders (advisor fix #8 — no over-reset)', async () => {
    const { result, rerender } = renderHook(
      ({ itemId }) => useShare(makeOpts({ itemId })),
      { initialProps: { itemId: 'A' } },
    );
    await act(async () => {
      await result.current.share();
    });
    rerender({ itemId: 'A' });
    expect(result.current.url).toBe('http://x?id=1&share-token=t&v=md5');
  });

  it('hydrates the url from an already-shared item on mount so the popover opens in the shared state (not Create link)', async () => {
    // A diagram shared in a PRIOR session carries isShared+shareToken when re-loaded.
    // The hook must reconstruct its page_share URL at mount so SharePopover shows the
    // Copy / Stop-sharing state — NOT the "Create share link" state (which would wrongly
    // imply the diagram is private). Discriminating: revert the hydration branch in the
    // itemId effect (back to setUrl(null)) → url stays null → this fails.
    useEditorStore.getState().loadItem(sharedItem());
    const { result } = renderHook(() =>
      useShare(makeOpts({ itemId: 'item-1' })),
    );
    expect(result.current.url).toBe(
      `${window.location.origin}?id=item-1&share-token=tok-xyz`,
    );
  });

  it('re-hydrates when switching FROM an unshared item TO an already-shared one', async () => {
    // Start on an unshared item → Create-link state (url null). Switch to a shared item
    // (store currentItem swapped, itemId prop changes) → the effect must hydrate the
    // shared url. Guards the reload/item-switch path the task calls out.
    useEditorStore.getState().loadItem(sharedItem({ id: 'plain', isShared: false, shareToken: undefined }));
    const { result, rerender } = renderHook(
      ({ itemId }) => useShare(makeOpts({ itemId })),
      { initialProps: { itemId: 'plain' } },
    );
    expect(result.current.url).toBeNull();

    useEditorStore.getState().loadItem(sharedItem({ id: 'item-1' }));
    rerender({ itemId: 'item-1' });
    expect(result.current.url).toBe(
      `${window.location.origin}?id=item-1&share-token=tok-xyz`,
    );
  });

  it('does NOT hydrate a url for an item that is isShared but missing its shareToken', async () => {
    // Defensive: a half-written item (isShared true, no token) cannot form a valid
    // share link, so the popover must fall back to the Create-link state, not emit a
    // tokenless URL. Discriminating: drop the `!item.shareToken` guard in
    // reconstructShareUrl → url becomes `...&share-token=undefined` → this fails.
    useEditorStore.getState().loadItem(sharedItem({ shareToken: undefined }));
    const { result } = renderHook(() =>
      useShare(makeOpts({ itemId: 'item-1' })),
    );
    expect(result.current.url).toBeNull();
  });

  it('extension env: hydrated share url uses the canonical app origin, not chrome-extension://', async () => {
    // Under the extension window.location.origin is chrome-extension://… (unreachable as
    // a share host). Hydration must route through shareOrigin() just like create_share.
    // Discriminating: replace shareOrigin(...) with window.location.origin in
    // reconstructShareUrl → url starts chrome-extension:// → this fails.
    (window as { IS_EXTENSION?: boolean }).IS_EXTENSION = true;
    useEditorStore.getState().loadItem(sharedItem());
    const { result } = renderHook(() =>
      useShare(makeOpts({ itemId: 'item-1' })),
    );
    expect(result.current.url).toBe(
      'https://app.zenuml.com?id=item-1&share-token=tok-xyz',
    );
  });

  // THROUGH-useShare SEAM (M05 Task 4): the REAL createShare passed by its BARE
  // reference (exactly AppRoot.tsx:612) under the extension env must send the canonical
  // app.zenuml.com origin — NOT chrome-extension://. UseShareOpts.createShare is typed
  // `(id) => …` (no isExtension threaded), so the override depends ENTIRELY on
  // createShare's lazy detectFromEnv() default resolving env at CALL time. A
  // createShare-unit test can't catch a wiring regression; this drives share() end-to-end.
  // Discriminating: revert createShare's lazy default (or resolve env at module load),
  // or rewire useShare to drop the bare-ref pass-through → captured.origin becomes
  // chrome-extension://… → FAILS.
  it('extension env: share() through useShare with the REAL createShare sends app.zenuml.com (end-to-end seam)', async () => {
    (window as { IS_EXTENSION?: boolean }).IS_EXTENSION = true; // detectFromEnv().isExtension === true
    let captured: { origin: string } | undefined;
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      captured = (await request.json()) as { origin: string };
      return HttpResponse.json({ page_share: 'https://app.zenuml.com?id=item-1&share-token=tok', md5: 'abc' });
    }));
    const { result } = renderHook(() =>
      useShare(makeOpts({ createShare /* REAL, bare ref — exactly AppRoot.tsx:612 */ })),
    );
    await act(async () => { await result.current.share(); });
    expect(captured!.origin).toBe('https://app.zenuml.com');
  });
});
