import { useUiStore, type LeftPanel } from '../state/uiStore';
import { cn } from '../ui/cn';

interface SidebarProps {
  /** Open the templates picker (Phase 1 wires this to a placeholder/createNew). */
  onOpenTemplates?: () => void;
  /** Open the Help modal. */
  onOpenHelp?: () => void;
}

// Inline 20px icons (design rail = 20px glyphs, `redesign.css` `.railbtn svg`).
function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 9v12" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// Recreates `redesign.css` `.railbtn` (icon over small label) with Tailwind tokens.
// `active` carries the `.railbtn.active` treatment + left accent rail marker.
// `pressed` toggles aria-pressed; only panel entries (Editor/Library) are toggle
// controls — Templates/Help are fire-and-forget actions and expose no pressed state.
function RailButton({
  icon,
  label,
  testid,
  active,
  pressed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  testid: string;
  active: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-1 rounded-[9px] px-0.5 py-2.5',
        'text-[9.5px] font-medium tracking-[0.02em] transition-colors duration-150 ease-draft ring-draft',
        active
          ? 'text-ondark-strong bg-accent-soft before:absolute before:-left-2 before:top-1/2 before:-translate-y-1/2 before:h-[22px] before:w-[3px] before:rounded-r-[3px] before:bg-accent'
          : 'text-ondark-faint hover:text-ondark-strong hover:bg-white/5',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Sidebar({ onOpenTemplates, onOpenHelp }: SidebarProps) {
  const active = useUiStore((s) => s.activePanel);
  const setActive = useUiStore((s) => s.setActivePanel);

  const panel = (id: LeftPanel, label: string, icon: React.ReactNode) => (
    <RailButton
      icon={icon}
      label={label}
      testid={`sidebar-${id}`}
      active={active === id}
      pressed={active === id}
      onClick={() => setActive(id)}
    />
  );

  return (
    <nav
      aria-label="Primary"
      className="flex w-16 flex-col gap-1 bg-ink-950 px-2 py-2.5 border-r border-ink-line"
    >
      {panel('editor', 'Editor', <PencilIcon />)}
      {panel('library', 'Library', <GridIcon />)}
      <RailButton
        icon={<TemplateIcon />}
        label="Templates"
        testid="sidebar-templates"
        active={false}
        onClick={() => onOpenTemplates?.()}
      />
      <div className="flex-1" />
      <RailButton
        icon={<HelpIcon />}
        label="Help"
        testid="sidebar-help"
        active={false}
        onClick={() => onOpenHelp?.()}
      />
    </nav>
  );
}
