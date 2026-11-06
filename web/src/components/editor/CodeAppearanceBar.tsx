import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { Select, SelectContent, SelectItem, SelectValue } from '../../ui/Select';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  CODE_THEME_OPTIONS,
  canDecreaseCodeFontSize,
  canIncreaseCodeFontSize,
  effectiveCodeThemeId,
  stepCodeFontSize,
} from './codeAppearance';
import './CodeAppearanceBar.css';
import type { Appearance } from '../../domain/types';

export interface CodeAppearanceBarProps {
  /** Stored Settings.editorTheme. 'ink' is shown as "Follow app". */
  appearance?: Appearance;
  themeId: string;
  /** Stored Settings.fontSize, shown verbatim. */
  fontSize: number;
  onThemeChange: (themeId: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  /** Delay (ms) before the bar hides after the pointer leaves. */
  hideDelay?: number;
}

function PaletteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="code-appearance-icon"
    >
      <path d="M8 2a6 6 0 0 0 0 12c.7 0 1.2-.5 1.2-1.1 0-.3-.1-.6-.3-.8-.2-.2-.3-.5-.3-.8 0-.6.5-1.1 1.2-1.1h1.4A3 3 0 0 0 14 7.3C14 4.4 11.3 2 8 2Z" />
      <circle cx="5" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="6.7" cy="4.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="4.7" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="code-appearance-chevron"
    >
      <path d="m5 6.5 3 3 3-3" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="code-appearance-icon">
      <path d="M4 8h8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="code-appearance-icon">
      <path d="M4 8h8M8 4v8" />
    </svg>
  );
}

// Keyboard focus reveals the bar; focus that follows a pointer interaction (e.g.
// Radix returning focus to the trigger after a pointer selection) does not pin
// it. `:focus-visible` cannot tell these apart: Chrome reports Radix's
// programmatic focus as focus-visible even after a click. So track the last
// input modality instead.
let lastInputWasKeyboard = false;
let modalityListeners = 0;
const onKeyDownModality = (e: KeyboardEvent) => {
  if (!e.metaKey && !e.ctrlKey && !e.altKey) lastInputWasKeyboard = true;
};
const onPointerDownModality = () => {
  lastInputWasKeyboard = false;
};
function useInputModality() {
  useEffect(() => {
    if (modalityListeners++ === 0) {
      window.addEventListener('keydown', onKeyDownModality, true);
      window.addEventListener('pointerdown', onPointerDownModality, true);
    }
    return () => {
      if (--modalityListeners === 0) {
        window.removeEventListener('keydown', onKeyDownModality, true);
        window.removeEventListener('pointerdown', onPointerDownModality, true);
      }
    };
  }, []);
}

// The code editors the bar overlays, scoped by their containers in the left
// workspace. Used to align the bar with the code text and to add scroll room
// under an editor's last line only when that editor overflows.
const EDITOR_SCOPES = {
  dsl: '.editor-source-stack',
  css: '.editor-css-panel',
} as const;
type EditorKey = keyof typeof EDITOR_SCOPES;

const REVEAL_ABOVE = 28; // px above the slot that reveal the bar
const REVEAL_BELOW = 6; // px below the slot that still count
const CLEARANCE_GAP = 8; // px between a scrolled-to-end last line and the bar

interface Slot {
  left: number | null; // px from the workspace's padding edge
  right: number | null;
}
type Clearance = Record<EditorKey, number>;

// The bar's slot in viewport coordinates. offsetTop ignores the hidden-state
// transform, so the slot is stable while the bar animates.
function slotBounds(area: HTMLElement, bar: HTMLElement) {
  const a = area.getBoundingClientRect();
  const top = a.top + area.clientTop + bar.offsetTop;
  return { top, bottom: top + bar.offsetHeight, left: a.left, right: a.right };
}

function measureSlot(area: HTMLElement): Slot {
  const cm = area.querySelector<HTMLElement>(`${EDITOR_SCOPES.dsl} .cm-editor`);
  const line = cm?.querySelector<HTMLElement>('.cm-line');
  if (!cm || !line) return { left: null, right: null };
  const a = area.getBoundingClientRect();
  const originLeft = a.left + area.clientLeft;
  const textLeft = line.getBoundingClientRect().left + parseFloat(getComputedStyle(line).paddingLeft || '0');
  const right = a.right - area.clientLeft - cm.getBoundingClientRect().right;
  return { left: Math.round(textLeft - originLeft), right: Math.max(0, Math.round(right)) };
}

// The element that clips the editor (its visible box): the nearest ancestor up
// to the scope container that does not let content overflow visibly.
function clippingBox(cm: HTMLElement, scope: HTMLElement): HTMLElement {
  let el = cm.parentElement;
  while (el && el !== scope) {
    if (getComputedStyle(el).overflowY !== 'visible') return el;
    el = el.parentElement;
  }
  return scope;
}

// Scroll room for an editor whose visible box reaches under the bar's slot and
// whose content overflows that box. Short documents get none, so no extra
// theme-coloured strip appears under them.
function measureClearance(area: HTMLElement, bar: HTMLElement, current: Clearance): Clearance {
  const slot = slotBounds(area, bar);
  const next: Clearance = { dsl: 0, css: 0 };
  for (const key of Object.keys(EDITOR_SCOPES) as EditorKey[]) {
    const scope = area.querySelector<HTMLElement>(EDITOR_SCOPES[key]);
    const cm = scope?.querySelector<HTMLElement>('.cm-editor');
    const box = cm && scope ? clippingBox(cm, scope) : null;
    if (!cm || !box) continue;
    const r = box.getBoundingClientRect();
    if (r.height === 0 || r.bottom <= slot.top || r.top >= slot.bottom) continue;
    const scroller = cm.querySelector<HTMLElement>('.cm-scroller');
    const applied = current[key];
    const overflows =
      cm.offsetHeight - applied > box.clientHeight + 1 ||
      (scroller ? scroller.scrollHeight - applied > scroller.clientHeight + 1 : false);
    if (overflows) next[key] = Math.ceil(r.bottom - slot.top + CLEARANCE_GAP);
  }
  return next;
}

function clearanceCss(c: Clearance): string {
  return (Object.keys(EDITOR_SCOPES) as EditorKey[])
    .filter((k) => c[k] > 0)
    .map((k) => `.editor-source-pane ${EDITOR_SCOPES[k]} .cm-editor .cm-content{padding-bottom:${c[k]}px}`)
    .join('');
}

/**
 * Inline code appearance control (theme + font size) shared by the DSL and
 * Custom CSS editors. It sits in one fixed slot at the bottom of the left
 * workspace, from the code text's left edge (never over the line-number lane)
 * to the code column's right edge, and stays there when Custom CSS expands.
 *
 * It appears on demand: when a mouse approaches the slot, while the pointer is
 * over it, while its theme menu is open, and while it holds keyboard focus. With
 * a coarse primary pointer it is always shown; on a hybrid device a touch in the
 * workspace shows it until the mouse moves again.
 *
 * Render it as a direct child of the positioned left workspace
 * (.editor-source-pane); it watches that element's pointer input.
 */
export function CodeAppearanceBar({
  appearance = 'light',
  themeId,
  fontSize,
  onThemeChange,
  onFontSizeChange,
  hideDelay = 350,
}: CodeAppearanceBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useInputModality();
  const coarse = useMediaQuery('(pointer: coarse)');
  const [nearBottom, setNearBottom] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const [slot, setSlot] = useState<Slot>({ left: null, right: null });
  const [clearance, setClearance] = useState<Clearance>({ dsl: 0, css: 0 });
  const clearanceRef = useRef(clearance);
  clearanceRef.current = clearance;

  const wantVisible = coarse || touchMode || nearBottom || hovered || focused || menuOpen;
  const [visible, setVisible] = useState(wantVisible);

  // Show immediately; hide after a short delay so a pointer that briefly leaves
  // (or crosses the gap to the menu) does not make the bar flicker.
  useEffect(() => {
    if (wantVisible) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), hideDelay);
    return () => window.clearTimeout(timer);
  }, [wantVisible, hideDelay]);

  // Follow the editors' live geometry (gutter width changes with font size and
  // line count; content height changes while typing).
  useEffect(() => {
    const area = rootRef.current?.parentElement;
    const bar = rootRef.current;
    if (!area || !bar) return;
    let frame = 0;
    const observed = new Set<Element>();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule());
    function run() {
      frame = 0;
      if (!area || !bar) return;
      const nextSlot = measureSlot(area);
      setSlot((s) => (s.left === nextSlot.left && s.right === nextSlot.right ? s : nextSlot));
      const next = measureClearance(area, bar, clearanceRef.current);
      setClearance((c) => (c.dsl === next.dsl && c.css === next.css ? c : next));
      if (ro) {
        // Watch the current editors only. AppRoot keys the DSL editor by page,
        // so a page switch replaces these nodes while the bar stays mounted;
        // drop the replaced ones so detached editor DOM is not retained.
        const current = new Set(area.querySelectorAll('.cm-editor, .cm-gutters'));
        for (const el of observed) {
          if (!current.has(el)) { observed.delete(el); ro.unobserve(el); }
        }
        for (const el of current) {
          if (!observed.has(el)) { observed.add(el); ro.observe(el); }
        }
      }
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(run);
    }
    // A page switch replaces an editor without input in this area and need not
    // resize it, so watch for editors being added or removed. Typing also adds
    // and removes lines; those records do not match and are ignored.
    const touchesEditor = (nodes: NodeList) =>
      Array.prototype.some.call(nodes, (n: Node) =>
        n instanceof Element && (n.matches('.cm-editor') || n.querySelector('.cm-editor') !== null));
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver((records) => {
      if (records.some((r) => touchesEditor(r.addedNodes) || touchesEditor(r.removedNodes))) schedule();
    });
    mo?.observe(area, { childList: true, subtree: true });
    ro?.observe(area);
    schedule();
    area.addEventListener('input', schedule);
    area.addEventListener('keyup', schedule);
    area.addEventListener('focusin', schedule);
    area.addEventListener('click', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      ro?.disconnect();
      mo?.disconnect();
      observed.clear();
      area.removeEventListener('input', schedule);
      area.removeEventListener('keyup', schedule);
      area.removeEventListener('focusin', schedule);
      area.removeEventListener('click', schedule);
    };
  }, []);

  // Re-measure after appearance changes reconfigure the editors.
  useEffect(() => {
    const area = rootRef.current?.parentElement;
    const bar = rootRef.current;
    if (!area || !bar) return;
    const frame = window.requestAnimationFrame(() => {
      setSlot(measureSlot(area));
      setClearance(measureClearance(area, bar, clearanceRef.current));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fontSize, themeId]);

  // Pointer input on the left workspace (the parent).
  useEffect(() => {
    const area = rootRef.current?.parentElement;
    const bar = rootRef.current;
    if (!area || !bar) return;
    let lastMouse: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      if (e.pointerType === 'mouse') {
        // Leave touch mode only on real movement: browsers also send synthetic
        // mouse moves at the old position after layout changes.
        if (lastMouse && Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y) > 2) setTouchMode(false);
        lastMouse = { x: e.clientX, y: e.clientY };
      }
      // A drag-selection near the bottom must not pop the bar over the text.
      if (e.buttons !== 0) {
        setNearBottom(false);
        return;
      }
      const s = slotBounds(area, bar);
      setNearBottom(
        e.clientY >= s.top - REVEAL_ABOVE &&
          e.clientY <= s.bottom + REVEAL_BELOW &&
          e.clientX >= s.left &&
          e.clientX <= s.right,
      );
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouchMode(true);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') setNearBottom(false);
    };
    // Typing in the editor hides the bar until the pointer moves again.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof Node && bar.contains(e.target)) return;
      setNearBottom(false);
    };
    // Hover on the bar itself uses native DOM events: React's synthetic
    // enter/leave treat the portaled theme menu as part of the bar, and miss the
    // leave when the menu unmounts under the pointer after a selection.
    const onBarEnter = (e: PointerEvent) => { if (e.pointerType !== 'touch') setHovered(true); };
    const onBarLeave = () => setHovered(false);
    area.addEventListener('pointermove', onMove);
    area.addEventListener('pointerdown', onDown, true);
    area.addEventListener('pointerleave', onLeave);
    area.addEventListener('keydown', onKeyDown);
    bar.addEventListener('pointerenter', onBarEnter);
    bar.addEventListener('pointerleave', onBarLeave);
    return () => {
      area.removeEventListener('pointermove', onMove);
      area.removeEventListener('pointerdown', onDown, true);
      area.removeEventListener('pointerleave', onLeave);
      area.removeEventListener('keydown', onKeyDown);
      bar.removeEventListener('pointerenter', onBarEnter);
      bar.removeEventListener('pointerleave', onBarLeave);
    };
  }, []);

  const onFocusCapture = useCallback(() => {
    if (lastInputWasKeyboard) setFocused(true);
  }, []);
  const onBlurCapture = useCallback((e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    setFocused(false);
  }, []);

  const value = effectiveCodeThemeId(themeId);
  const canDecrease = canDecreaseCodeFontSize(fontSize);
  const canIncrease = canIncreaseCodeFontSize(fontSize);

  return (
    <div
      ref={rootRef}
      data-testid="code-appearance-bar"
      data-state={visible ? 'visible' : 'hidden'}
      role="group"
      aria-label="Code appearance"
      className="code-appearance-bar"
      style={{
        left: slot.left ?? undefined,
        right: slot.right ?? undefined,
      }}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <Select
        value={value}
        onValueChange={(next) => { if (next !== themeId) onThemeChange(next); }}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      >
        <RadixSelect.Trigger
          data-testid="code-theme-select"
          aria-label="Code theme"
          title="Code theme"
          className="code-appearance-theme"
        >
          <PaletteIcon />
          <span className="code-appearance-theme-label">
            <SelectValue />
          </span>
          <ChevronIcon />
        </RadixSelect.Trigger>
        <SelectContent
          surface={appearance}
          side="top"
          align="start"
          data-testid="code-theme-menu"
          className="editor-hifi-select-menu"
        >
          {CODE_THEME_OPTIONS.map((t) => (
            <SelectItem key={t.id} value={t.id} data-testid={`code-theme-option-${t.id}`}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="code-appearance-divider" aria-hidden="true" />

      <div className="code-appearance-size">
        <span className="code-appearance-size-cue" aria-hidden="true">
          <span className="code-appearance-size-cue-small">A</span>
          <span className="code-appearance-size-cue-large">A</span>
        </span>
        <button
          type="button"
          data-testid="code-font-decrease"
          aria-label="Decrease code font size"
          title={`Decrease code font size (min ${CODE_FONT_SIZE_MIN})`}
          className="code-appearance-step"
          disabled={!canDecrease}
          // Keep focus (and the visible caret/selection) in the code editor on click.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFontSizeChange(stepCodeFontSize(fontSize, -1))}
        >
          <MinusIcon />
        </button>
        <output
          data-testid="code-font-size-value"
          aria-live="polite"
          aria-label={`Code font size ${fontSize}`}
          className="code-appearance-size-value"
        >
          {fontSize}
        </output>
        <button
          type="button"
          data-testid="code-font-increase"
          aria-label="Increase code font size"
          title={`Increase code font size (max ${CODE_FONT_SIZE_MAX})`}
          className="code-appearance-step"
          disabled={!canIncrease}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFontSizeChange(stepCodeFontSize(fontSize, 1))}
        >
          <PlusIcon />
        </button>
      </div>
      {clearanceCss(clearance) && <style data-testid="code-appearance-clearance">{clearanceCss(clearance)}</style>}
    </div>
  );
}
