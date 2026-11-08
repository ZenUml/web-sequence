import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { useAuthStore } from '../state/authStore';
import { ensureUser, setItemForUser, getUserItemIds } from '../services/userService';
import { localStore } from '../services/storage';
import { LS_KEYS } from '../config/constants';
import { isOverFileLimit } from '../domain/planLimit';
import type { ItemService } from '../services/itemService';
import type { Item, Subscription } from '../domain/types';

export interface SaveFeedback {
  error: boolean;
  queued: boolean;
  withheld?: boolean;
}

type Track = (event: string, props?: Record<string, unknown>) => void;

export interface UseSaveItemOpts {
  itemService: ItemService;
  subscription: Subscription | null | undefined;
  subLoading: boolean;
  track: Track;
  /** First over-cap save of an item in this episode: open the limit notice. */
  onLimitReached(): void;
  /** First successful signed-out save: open the "saved locally, sign in to sync" notice. */
  onFirstLocalSave(): void;
  /** A foreign-owned id was re-saved under `newId`: point the URL at it. */
  onForkedToNewId(newId: string): void;
}

export interface UseSaveItemResult {
  /**
   * Stable across renders. Resolves true when the save reached a confirmed (non-queued) state.
   * `silent`: not a user-visible "I saved" moment (the first-content persist of a New
   * diagram, #951), so it must not open the one-time signed-out notice.
   */
  save(opts?: { silent?: boolean }): Promise<boolean>;
  /**
   * #952: header New saves first. Resolves true when it is safe to create the new
   * diagram (the edit reached storage, or is retained locally with a cloud sync queued);
   * false only when the save really failed. Stable across renders.
   */
  saveBeforeNew(): Promise<boolean>;
  saveFeedback: SaveFeedback;
  cloudConfirmed: boolean;
}

// The save pipeline: plan-limit check, ensureUser, itemService.setItem, membership
// write, feedback state, the signed-out notice and the one-shot fork when another
// account owns the id. Moved out of AppRoot (#848); behaviour is unchanged.
export function useSaveItem(opts: UseSaveItemOpts): UseSaveItemResult {
  const { itemService, subscription, subLoading, track, onLimitReached, onFirstLocalSave, onForkedToNewId } = opts;

  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>({error:false, queued:false});
  const [cloudConfirmed, setCloudConfirmed] = useState(false);
  const saveGeneration = useRef(0);
  const saveAttempt = useRef<object | null>(null);
  // True while save() re-runs under a fresh id after a foreign-owner denial, so a
  // second denial surfaces the error instead of forking again.
  const forkRetrying = useRef(false);
  // Which item id has already triggered the over-cap notice + 'Free Limit' analytics.
  // With auto-save ON, save() runs every 15s; without this guard the over-limit branch
  // (which intentionally never markSaved()s, so dirty stays true) would re-pop the
  // dismissed LimitReachedNotice and re-fire the analytics envelope on every tick.
  // We notify once per cap-hit episode; it resets when a save actually succeeds.
  const limitNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    const invalidate = () => {
      saveGeneration.current += 1;
      saveAttempt.current = null;
      setSaveFeedback({error:false, queued:false});
      setCloudConfirmed(false);
      useEditorStore.getState().setSaving(false);
    };
    const offAuth = useAuthStore.subscribe((next, prev) => {
      if (next.user?.uid !== prev.user?.uid) invalidate();
    });
    const offItem = useEditorStore.subscribe((next, prev) => {
      if (next.currentItem?.id !== prev.currentItem?.id ||
          (next.currentItem !== prev.currentItem && !next.dirty)) invalidate();
    });
    return () => { offAuth(); offItem(); saveGeneration.current += 1; saveAttempt.current = null; };
  }, []);

  async function save(saveOpts: { silent?: boolean } = {}): Promise<boolean> {
    const it = useEditorStore.getState().currentItem;
    if (!it || it.isReadOnly || saveAttempt.current) return false;
    const attempt = {};
    saveAttempt.current = attempt;
    const generation = saveGeneration.current;
    const uid = useAuthStore.getState().user?.uid ?? null;
    const online = useAuthStore.getState().online;
    const contextCurrent = () => saveGeneration.current === generation &&
      (useAuthStore.getState().user?.uid ?? null) === uid && useEditorStore.getState().currentItem?.id === it.id;
    const current = () => saveAttempt.current === attempt && contextCurrent();
    const guard = {expectedUid:uid, isCurrent:current};
    const itemToSave: Item = {...it, updatedOn:Date.now()};
    let forkOnForeignOwner = false;
    useEditorStore.getState().setSaving(true);
    setSaveFeedback({error:false, queued:false});
    track('diagram_save_clicked', {category:'ui', label:!uid ? 'not-logged-in' : itemToSave.id ? 'saved' : 'new'});
    try {
      // Preserve the legacy fail-open cap check, sampled before membership insertion.
      let overLimit = false;
      if (uid && online && !subLoading) {
        try {
          const ownedIds = await getUserItemIds(uid);
          overLimit = isOverFileLimit({subscription, ownedIds, itemId:itemToSave.id});
        } catch { /* count read failure must not withhold an otherwise valid save */ }
      }
      if (!current()) return false;
      if (uid && online && !overLimit) await ensureUser(uid);
      if (!current()) return false;
      const outcome = await itemService.setItem(itemToSave.id, itemToSave, {skipCloud:overLimit, guard});
      if (!current()) return false;
      if (overLimit) {
        // A local-only retry must never inherit a previous clean cloud-success label.
        useEditorStore.setState({dirty:true});
        setCloudConfirmed(false);
        setSaveFeedback({error:false, queued:false, withheld:true});
        if (limitNotifiedRef.current !== itemToSave.id) {
          limitNotifiedRef.current = itemToSave.id;
          onLimitReached();
          track('free_limit_reached', {category:'3 diagrams limit', label:'Save'});
        }
        return false; // locally retained, deliberately not cloud-synced or clean
      }
      if (uid) {
        if (outcome?.status === 'queued') {
          // Preserve queued cloud persistence without blocking local feedback on an offline user read.
          void (async () => {
            await ensureUser(uid);
            if (contextCurrent()) await setItemForUser(uid, itemToSave.id);
          })().catch(() => {});
        } else {
          try { await setItemForUser(uid, itemToSave.id); } catch { /* membership best-effort */ }
        }
      }
      if (!current()) return false;
      limitNotifiedRef.current = null;
      setSaveFeedback({error:false, queued:outcome?.status === 'queued'});
      setCloudConfirmed(outcome?.status === 'cloud');
      track('diagram_save_succeeded', {feature_area:'editor', destination:outcome?.status ?? 'local'});
      // The saved snapshot owns this completion. Edits made while it waited stay dirty.
      if (useEditorStore.getState().currentItem === it) useEditorStore.getState().markSaved();
      // #941: a diagram with no content has nothing worth the sign-in nudge; New saves
      // an empty item right away, so without this gate the one-time notice would be
      // spent on a blank page (and its focus trap would steal the editor focus).
      // #951: the first-content persist is silent, or the modal opens on the first
      // keystroke and steals focus; the next ordinary save (Ctrl+S / auto-save) shows it.
      if (!uid && !saveOpts.silent && itemToSave.js.trim() !== '') {
        // Informational notice preferences are separate from document persistence.
        // If acknowledgement storage fails, defer the notice to a later successful save.
        try {
          const seen = await localStore.get<boolean>(LS_KEYS.loginAndSaveMessageSeen, false);
          if (!current()) return false;
          if (!seen) {
            await localStore.set(LS_KEYS.loginAndSaveMessageSeen, true);
            if (current()) onFirstLocalSave();
          }
        } catch { /* the document remains successfully saved */ }
      }
      return outcome?.status !== 'queued';
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (current()) {
        track('diagram_save_failed', {category:'error', label:code ?? 'unknown'});
        // Firestore only denies an update to a doc another account created, so this id
        // is taken (a local copy that outlived a sign-in switch). Retry once under a
        // fresh id the user owns, after finally releases the in-flight guard.
        if (code === 'permission-denied' && uid && online && !forkRetrying.current) forkOnForeignOwner = true;
        else setSaveFeedback({error:true, queued:false});
      }
    } finally {
      if (saveAttempt.current === attempt) {
        saveAttempt.current = null;
        useEditorStore.getState().setSaving(false);
      }
    }
    return forkOnForeignOwner ? saveUnderNewId() : false;
  }

  async function saveUnderNewId(): Promise<boolean> {
    const cur = useEditorStore.getState().currentItem;
    if (!cur) return false;
    const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID() : String(Date.now());
    const moved: Item = { ...cur, id: newId, updatedOn: Date.now() };
    delete moved.createdBy;
    delete moved.isShared;
    delete moved.shareToken;
    delete moved.sharedAt;
    useEditorStore.setState({ currentItem: moved, dirty: true, unsavedCount: 1 });
    onForkedToNewId(newId);
    forkRetrying.current = true;
    try { return await save(); } finally { forkRetrying.current = false; }
  }

  // #952: header New saves first.
  //
  // Ordering matters: handleNewDiagram() swaps currentItem synchronously and save()
  // aborts before itemService.setItem whenever currentItem.id changed mid-flight, so
  // New must never run while a save is pending, or the edit is silently lost.
  async function saveBeforeNew(): Promise<boolean> {
    const startId = useEditorStore.getState().currentItem?.id;
    if (!startId) return true;
    // A save already in flight (the 15 s auto-save tick, or Cmd+S) would make save()
    // return false at once without writing. Wait for it to settle instead of treating
    // that as a failure. saveAttempt and `saving` are set and cleared together; the
    // `saving` check also keeps a stale attempt from spinning this loop.
    while (saveAttempt.current && useEditorStore.getState().saving) {
      await new Promise<void>((resolve) => {
        const off = useEditorStore.subscribe((s) => {
          if (!s.saving) { off(); resolve(); }
        });
        if (!useEditorStore.getState().saving) { off(); resolve(); }
      });
    }
    const after = useEditorStore.getState();
    if (after.currentItem?.id !== startId) return false;
    // The awaited attempt already stored everything (it marks the item clean).
    if (!after.dirty) return true;
    // Silent (#951): New is a navigation step, not a "you saved" moment. The
    // one-time notice would otherwise open on top of the fresh blank editor and
    // take the focus New just gave it; the next ordinary save still shows it.
    const saved = await save({ silent: true });
    if (saved) return true;
    // save() returns false for a queued (offline, signed-in) save as well, but it
    // calls markSaved() first because the item is retained locally. Failures keep
    // the item dirty: errors, read-only items, and over-limit (which re-marks it).
    const now = useEditorStore.getState();
    return now.currentItem?.id === startId && !now.dirty;
  }

  // Callers (auto-save interval, the ⌘S listener) hold `save` across renders; route
  // through a ref so they always run this render's closure (latest subscription etc.).
  const saveImpl = useRef(save);
  saveImpl.current = save;
  const stableSave = useCallback((o?: { silent?: boolean }) => saveImpl.current(o), []);
  const saveBeforeNewImpl = useRef(saveBeforeNew);
  saveBeforeNewImpl.current = saveBeforeNew;
  const stableSaveBeforeNew = useCallback(() => saveBeforeNewImpl.current(), []);

  return { save: stableSave, saveBeforeNew: stableSaveBeforeNew, saveFeedback, cloudConfirmed };
}
