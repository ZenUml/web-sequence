import { useState, useEffect } from 'react';
import { Dialog, DialogContent, Button, Textarea } from '../../ui';

// The item's `cssSettings` payload when cssMode === 'acss'. `acssConfig` is a
// JSON *string* (the Atomizer config) — transpilers.ts does JSON.parse(acssConfig)
// downstream, so we must store/emit the string form, not a parsed object.
export interface CssSettings {
  acssConfig?: string;
}

export interface AtomicCssSettingsModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  value: CssSettings;
  onChange(next: CssSettings): void;
}

// Atomic-CSS (Atomizer) settings (REQ-ED-2; M01 carry-forward — ACSS was
// read-only until M04). Presentational `{ open, onOpenChange, value, onChange }`.
// Legacy (src/components/CssSettingsModal.jsx) edited a single freeform JSON
// string `acssConfig` in a CodeMirror box; we render it as a validated JSON
// textarea. Save parses for validation only (parse errors surface inline and
// block onChange), then emits `{ ...value, acssConfig: <string> }` so the stored
// shape stays a JSON string for transpilers.ts.
export function AtomicCssSettingsModal({
  open,
  onOpenChange,
  value,
  onChange,
}: AtomicCssSettingsModalProps) {
  const [text, setText] = useState(value.acssConfig ?? '');
  const [error, setError] = useState<string | null>(null);

  // Re-seed the editor from `value` whenever the modal (re)opens so it reflects
  // the current item's config rather than stale local edits.
  useEffect(() => {
    if (open) {
      setText(value.acssConfig ?? '');
      setError(null);
    }
  }, [open, value.acssConfig]);

  const handleSave = () => {
    try {
      JSON.parse(text);
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    setError(null);
    onChange({ ...value, acssConfig: text });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Atomic CSS Settings"
        description="Configure the Atomizer JSON settings for this diagram's styling."
      >
        <div className="space-y-3" data-testid="acss-modal">
          <Textarea
            surface="light"
            rows={10}
            spellCheck={false}
            className="w-full font-mono text-[12px]"
            aria-label="Atomizer JSON configuration"
            data-testid="acss-config"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
          />
          {error ? (
            <p className="text-[12px] text-danger" data-testid="acss-error">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              variant="primary"
              surface="light"
              data-testid="acss-save"
              onClick={handleSave}
            >
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
