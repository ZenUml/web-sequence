import type { Item } from '../../domain/types';
import { TEMPLATES, blankTemplate, type Template } from '../../domain/templates';
import { Dialog, DialogContent, cn } from '../../ui';

export interface CreateNewModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  onSelect(item: Partial<Item>): void;
}

// Theme tints for the schematic thumbnails — the design §04 swatch tints that
// EVOKE each template's look, used purely as data to paint the CSS mock, NOT as
// design-system tokens. Sanctioned exception to the "tokens only" rule (REQ §04).
// These are intentional approximations, NOT a copy of each template's literal CSS:
//   B&W   = black borders/lines on white (matches the template's #000).
//   Blue  = #2F6BFF border (spec §04 line: "Blue = #2F6BFF tint" — note this is
//           a brighter cobalt than the template CSS's own #032C72, by design) /
//           #9bbcff line / #EEF3FF fill (approximated pale-blue surface).
//   amber = #e3c98f border / #FBF4E6 cream fill (approximates starUML's look;
//           the template CSS itself uses #b94065 / #fffec8).
//   Basic = ink/gray on white — onlight.faint/onlight.muted token VALUES inlined
//           here (basic has no template CSS of its own); inlined rather than via a
//           class because thumbnails paint through inline `style`.
type Tint = { box: string; fill: string; line: string };
const THUMB_TINTS: Record<Template['id'], Tint> = {
  // Basic — ink/gray on white. onlight.faint = #8A93A1, onlight.muted = #5A6473.
  basic: { box: '#8A93A1', fill: '#FFFFFF', line: '#5A6473' },
  // Black & White — black borders/lines on white.
  'black-white': { box: '#000000', fill: '#FFFFFF', line: '#000000' },
  // Blue — cobalt border, soft-blue line, pale-blue fill.
  blue: { box: '#2F6BFF', fill: '#EEF3FF', line: '#9bbcff' },
  // starUML — amber border on cream.
  starUMLTheme: { box: '#e3c98f', fill: '#FBF4E6', line: '#e3c98f' },
};

// Schematic preview of a styled diagram: two participant boxes on a row joined by
// 1–2 horizontal message lines (with an arrowhead), tinted to the template theme.
// Pure CSS — no @zenuml/core render (out of scope/expensive per spec). Decorative:
// aria-hidden, no inner text, so the button's accessible name stays the title.
function Thumb({ tint }: { tint: Tint }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-[60px] w-full items-center justify-center gap-2 rounded-[5px] bg-white px-3"
    >
      {/* left participant */}
      <span
        className="h-4 w-7 shrink-0 rounded-[2px] border"
        style={{ borderColor: tint.box, background: tint.fill }}
      />
      {/* message lines + arrowhead between the two participants */}
      <span className="relative flex flex-1 flex-col gap-2">
        {/* message 1 → arrowhead points right */}
        <span className="relative block h-px w-full" style={{ background: tint.line }}>
          <span
            className="absolute -top-[3px] right-0 h-0 w-0"
            style={{
              borderTop: '3px solid transparent',
              borderBottom: '3px solid transparent',
              borderLeft: `5px solid ${tint.line}`,
            }}
          />
        </span>
        {/* message 2 ← arrowhead points left (return) */}
        <span className="relative block h-px w-full" style={{ background: tint.line }}>
          <span
            className="absolute -top-[3px] left-0 h-0 w-0"
            style={{
              borderTop: '3px solid transparent',
              borderBottom: '3px solid transparent',
              borderRight: `5px solid ${tint.line}`,
            }}
          />
        </span>
      </span>
      {/* right participant */}
      <span
        className="h-4 w-7 shrink-0 rounded-[2px] border"
        style={{ borderColor: tint.box, background: tint.fill }}
      />
    </div>
  );
}

// Dashed "blank" preview: a centered "+" in a dashed card, no diagram (REQ §04).
function BlankThumb() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex h-[60px] w-full items-center justify-center rounded-[5px]',
        'border border-dashed border-paper-line bg-white',
      )}
    >
      {/* On the white "blank canvas" thumbnail the + must stay DARK (onlight), even
          though the modal chrome is now dark — this preview represents a paper canvas. */}
      <span className="grid h-6 w-6 place-items-center rounded-full border border-onlight-faint text-[15px] leading-none text-onlight-muted">
        +
      </span>
    </div>
  );
}

const cardClass = cn(
  'flex flex-col items-stretch gap-2 rounded-md border border-ink-line bg-ink-700',
  'p-3 text-left transition hover:border-accent hover:shadow-pop',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

const eyelabelClass = 'mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ondark-faint';

// Presentational "Create New" picker (REQ-MOD-4 / §04). Two labelled sections —
// Start (Blank + the 'basic' starter) and Styles (the themed templates) — each on
// its own 3-column grid. Cards show a SCHEMATIC CSS thumbnail of the template's
// look, not its raw DSL. Selecting fires onSelect(item) and closes. DESIGN SYSTEM:
// paper surface via DialogContent; tokens only except the theme-swatch tints above.
export function CreateNewModal({ open, onOpenChange, onSelect }: CreateNewModalProps) {
  function choose(item: Partial<Item>) {
    onSelect(item);
    onOpenChange(false);
  }

  const startTemplates = TEMPLATES.filter((t) => t.group === 'start');
  const styleTemplates = TEMPLATES.filter((t) => t.group !== 'start');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Create a new diagram"
        description="Start from scratch or pick a styled template."
        className="w-[min(620px,calc(100vw-2rem))]"
      >
        <div data-testid="create-new-modal" className="flex flex-col gap-5">
          {/* Start: blank + example starters */}
          <section>
            <div className={eyelabelClass}>Start</div>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                data-testid="create-blank"
                onClick={() => choose(blankTemplate())}
                className={cardClass}
              >
                <BlankThumb />
                <span className="font-serif text-[15px] text-ondark-strong">Blank</span>
              </button>

              {startTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`create-template-${t.id}`}
                  onClick={() => choose(t.item)}
                  className={cardClass}
                >
                  <Thumb tint={THUMB_TINTS[t.id]} />
                  <span className="font-serif text-[15px] text-ondark-strong">{t.title}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Styles: themed looks */}
          <section>
            <div className={eyelabelClass}>Styles</div>
            <div className="grid grid-cols-3 gap-3">
              {styleTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`create-template-${t.id}`}
                  onClick={() => choose(t.item)}
                  className={cardClass}
                >
                  <Thumb tint={THUMB_TINTS[t.id]} />
                  <span className="font-serif text-[15px] text-ondark-strong">{t.title}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
