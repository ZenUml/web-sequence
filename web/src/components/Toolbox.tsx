import { SNIPPETS, type Snippet, type SnippetIcon } from '../editor/snippets';
import { cn } from '../ui/cn';

// Icon registry — recreates the "Drafting Table" insert-toolbar glyphs (redesign.css
// `.ibtn svg`, 16px, 1.7 stroke, currentColor) as inline SVGs. Kept here so the data
// module (snippets.ts) stays JSX-free; snippets reference these by `icon` key.
function Glyph({ children, dash }: { children: React.ReactNode; dash?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dash ? '3 2' : undefined}
      className="h-4 w-4"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<SnippetIcon, () => React.ReactElement> = {
  participant: () => (
    <Glyph>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M9 18v2M15 18v2" />
    </Glyph>
  ),
  sync: () => (
    <Glyph>
      <path d="M4 12h13" />
      <path d="M14 8l4 4-4 4" />
    </Glyph>
  ),
  async: () => (
    <Glyph dash>
      <path d="M4 12h13" />
    </Glyph>
  ),
  return: () => (
    <Glyph dash>
      <path d="M20 12H7" />
      <path d="M10 8l-4 4 4 4" />
    </Glyph>
  ),
  self: () => (
    <Glyph>
      <path d="M14 8h-4a3 3 0 000 6h4" />
      <path d="M11 5l-3 3 3 3" />
    </Glyph>
  ),
  instance: () => (
    <Glyph>
      <rect x="4" y="7" width="16" height="11" rx="2" />
      <path d="M12 4v3M9 11h6M9 14h6" />
    </Glyph>
  ),
  if: () => (
    <Glyph>
      <path d="M8 4H6a2 2 0 00-2 2v3l-2 1 2 1v3a2 2 0 002 2h2M16 4h2a2 2 0 012 2v3l2 1-2 1v3a2 2 0 01-2 2h-2" />
    </Glyph>
  ),
  while: () => (
    <Glyph>
      <path d="M5 8a7 7 0 0111 -1" />
      <path d="M19 16a7 7 0 01-11 1" />
      <path d="M16 5v2.5h-2.5M8 19v-2.5h2.5" />
    </Glyph>
  ),
  comment: () => (
    <Glyph>
      <path d="M4 5h16v9H9l-4 4z" />
    </Glyph>
  ),
};

function SnippetButton({ snippet, onInsert }: { snippet: Snippet; onInsert: (code: string) => void }) {
  const Icon = ICONS[snippet.icon];
  return (
    <button
      type="button"
      data-testid={`snippet-${snippet.id}`}
      title={snippet.label}
      aria-label={snippet.label}
      onClick={() => onInsert(snippet.code)}
      className={cn(
        // .ibtn — icon stacked over a small label
        'flex min-w-[46px] flex-col items-center gap-[3px] rounded-md px-[7px] pb-[5px] pt-1.5',
        'text-ondark-muted transition-colors duration-150 ease-draft ring-draft',
        'hover:bg-ink-700/70 hover:text-ondark-strong',
      )}
    >
      <Icon />
      <small className="whitespace-nowrap text-[8.5px] tracking-[0.02em]">{snippet.short}</small>
    </button>
  );
}

function Group({ snippets, onInsert }: { snippets: Snippet[]; onInsert: (code: string) => void }) {
  return (
    // .igroup — cluster of .ibtn buttons
    <div className="flex items-center gap-[3px] rounded-[9px] border border-ink-line/40 bg-ink-950/50 p-[3px]">
      {snippets.map((s) => (
        <SnippetButton key={s.id} snippet={s} onInsert={onInsert} />
      ))}
    </div>
  );
}

export function Toolbox({ onInsert }: { onInsert: (snippetCode: string) => void }) {
  // Design spec group 1: message-level constructs (Self moves to group 2).
  const message = SNIPPETS.filter((s) => s.group === 'message' && s.id !== 'self');

  // Design spec group 2: Self · "Alt / Loop" (merged if+while button) · Note.
  // Instance is intentionally absent from the toolbar per the design spec.
  const self = SNIPPETS.find((s) => s.id === 'self')!;
  const alt = SNIPPETS.find((s) => s.id === 'if')!;
  const note = SNIPPETS.find((s) => s.id === 'comment')!;
  const altLoop: Snippet = { ...alt, short: 'Alt / Loop' };
  const structure = [self, altLoop, note];

  return (
    // .insert — keep the hidden md:flex responsive wrapper
    <div
      role="toolbar"
      aria-label="Insert snippet"
      className="hidden flex-wrap items-center gap-1.5 border-b border-ink-line bg-ink-850 px-3 py-[9px] md:flex"
    >
      <Group snippets={message} onInsert={onInsert} />
      <Group snippets={structure} onInsert={onInsert} />
    </div>
  );
}
