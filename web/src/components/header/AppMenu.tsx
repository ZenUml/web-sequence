import type { ReactNode } from 'react';
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
  BrandLogo,
  cn,
} from '../../ui';

export interface AppMenuProps {
  // Mirrors the AppHeader callbacks the app menu drives. All optional so the
  // brand button still renders (and the menu opens) in tests that omit handlers.
  onNew(): void;
  onOpenCreateNew?(): void;
  onOpenSettings?(): void;
  onOpenShortcuts?(): void;
  onOpenCheatSheet?(): void;
  onOpenHelp?(): void;
  onOpenPricing?(): void;
  onSave(): void;
  // Pricing only exists when payments are enabled (REQ-SUB-6, mirrored from header).
  paymentEnabled?: boolean;
}

// The "ZenUML" mark from the design's `.brand` tile — a small cobalt-gradient
// square holding the column/arrow glyph. Used as the visual of the app-menu
// trigger so the logo itself opens the document/app menu (Figma/Docs pattern).

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={cn('h-3.5 w-3.5', className)}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// A keyboard hint chip pinned to the right edge of a menu item (e.g. ⌘S on Save).
function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto pl-6 font-mono text-[11px] text-ondark-faint" aria-hidden="true">
      {children}
    </span>
  );
}

// AppMenu — the logo brand button (▾) whose dropdown holds the "app/document"
// verbs that left the top bar: New, New from template, Settings, Keyboard
// shortcuts, DSL cheat sheet, Help, Pricing (gated), and Save (⌘S). Each item
// wires to the corresponding AppHeader callback. The `onNew` passed here is the
// header's guarded handler, so the unsaved-changes confirm still applies.
export function AppMenu({
  onNew,
  onOpenCreateNew,
  onOpenSettings,
  onOpenShortcuts,
  onOpenCheatSheet,
  onOpenHelp,
  onOpenPricing,
  onSave,
  paymentEnabled = false,
}: AppMenuProps) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          data-testid="header-menu"
          aria-label="App menu"
          className={cn(
            'flex items-center gap-1.5 shrink-0 rounded-lg px-1.5 h-9',
            'text-ondark-strong transition-colors duration-150 ease-draft',
            'hover:bg-white/5 ring-draft',
          )}
        >
          <BrandLogo className="h-[30px] w-[30px] shrink-0" />
          <Chevron className="text-ondark-muted" />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuItem data-testid="header-new" onSelect={() => onNew()}>
          New
        </MenuItem>
        <MenuItem data-testid="header-create-new" onSelect={() => onOpenCreateNew?.()}>
          New from template…
        </MenuItem>
        <MenuSeparator />
        <MenuItem data-testid="header-settings" onSelect={() => onOpenSettings?.()}>
          Settings
        </MenuItem>
        <MenuItem data-testid="header-shortcuts" onSelect={() => onOpenShortcuts?.()}>
          Keyboard shortcuts
        </MenuItem>
        <MenuItem data-testid="header-cheatsheet" onSelect={() => onOpenCheatSheet?.()}>
          DSL cheat sheet
        </MenuItem>
        <MenuItem data-testid="header-help" onSelect={() => onOpenHelp?.()}>
          Help
        </MenuItem>
        {paymentEnabled && (
          <MenuItem data-testid="header-pricing" onSelect={() => onOpenPricing?.()}>
            Pricing
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem
          data-testid="header-save"
          onSelect={() => onSave()}
          className="flex items-center"
        >
          Save
          <Hint>⌘S</Hint>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
