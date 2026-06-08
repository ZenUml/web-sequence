import { useEffect, useRef } from 'react';
import { AUTO_SAVE_INTERVAL } from '../config/constants';

export interface AutoSaveOpts {
  enabled: boolean;
  hasUnsaved: boolean;
  onSave: () => void;
}

// 15s loop gated by settings.autoSave + unsaved edits. Reads the latest
// hasUnsaved/onSave via refs so the interval (keyed only on `enabled`) never
// fires a stale closure — same pattern as PreviewFrame (M01).
export function useAutoSave({ enabled, hasUnsaved, onSave }: AutoSaveOpts): void {
  const hasUnsavedRef = useRef(hasUnsaved);
  const onSaveRef = useRef(onSave);
  hasUnsavedRef.current = hasUnsaved;
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (hasUnsavedRef.current) onSaveRef.current();
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(id);
  }, [enabled]);
}
