import { Dialog, DialogContent } from '../../ui';

export interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
}

// Bindings are VERBATIM from requirements §11 (the authoritative source — where
// the M04 plan paraphrased, §11 wins, e.g. Find & replace is Ctrl/Cmd+Alt/Opt+F).
interface Shortcut {
  action: string;
  keys: string;
}

const GLOBAL: Shortcut[] = [
  { action: 'Save', keys: 'Ctrl/Cmd+S' },
  { action: 'Manual preview refresh', keys: 'Ctrl/Cmd+Shift+5' },
  { action: 'Open library', keys: 'Ctrl/Cmd+O' },
  { action: 'Search/quick-open library', keys: 'Ctrl/Cmd+K' },
  { action: 'Keyboard-shortcuts help', keys: 'Ctrl/Cmd+Shift+?' },
  { action: 'Clear console', keys: 'Ctrl+L' },
  { action: 'Close overlays/modals/library', keys: 'Esc' },
];

const EDITOR: Shortcut[] = [
  { action: 'Find', keys: 'Ctrl/Cmd+F' },
  { action: 'Find next', keys: 'Ctrl/Cmd+G' },
  { action: 'Find prev', keys: 'Ctrl/Cmd+Shift+G' },
  { action: 'Find & replace', keys: 'Ctrl/Cmd+Alt/Opt+F' },
  { action: 'Toggle comment', keys: 'Ctrl/Cmd+/' },
  { action: 'Indent right/left', keys: 'Ctrl/Cmd+] / Ctrl/Cmd+[' },
  { action: 'Re-indent', keys: 'Shift+Tab' },
  { action: 'Autocomplete', keys: 'Ctrl/Cmd+Space' },
  { action: 'Emmet expand (CSS editor)', keys: 'Tab' },
  { action: 'Prettier format', keys: 'Ctrl+Shift+F' },
];

function Section({ title, items }: { title: string; items: Shortcut[] }) {
  return (
    <div>
      <h3 className="mb-2 font-mono uppercase tracking-[0.12em] text-[11px] text-onlight-faint">
        {title}
      </h3>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {items.map((s) => (
            <tr key={s.action} className="border-b border-paper-line/60">
              <td className="py-1.5 pr-3 text-onlight-muted">{s.action}</td>
              <td className="py-1.5 pl-3 text-right font-mono text-[12px] text-onlight-strong whitespace-nowrap">
                {s.keys}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Keyboard shortcuts"
        description="All keyboard bindings for ZenUML."
        className="w-[min(520px,calc(100vw-2rem))]"
      >
        <div
          data-testid="shortcuts-modal"
          className="max-h-[60vh] space-y-6 overflow-y-auto"
        >
          <Section title="Global" items={GLOBAL} />
          <Section title="Editor" items={EDITOR} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
