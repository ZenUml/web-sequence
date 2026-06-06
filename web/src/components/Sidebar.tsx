import { useUiStore } from '../state/uiStore';

export function Sidebar() {
  const active = useUiStore((s) => s.activePanel);
  const setActive = useUiStore((s) => s.setActivePanel);
  const btn = (panel: 'editor' | 'library', label: string) => (
    <button
      data-testid={`sidebar-${panel}`}
      aria-pressed={active === panel}
      onClick={() => setActive(panel)}
      className={`relative px-2 py-2 rounded text-[11px] font-mono uppercase tracking-[0.12em] transition-colors duration-150 ease-draft ring-draft ${
        active === panel
          ? 'text-ondark-strong bg-accent-soft before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[2px] before:rounded-full before:bg-accent'
          : 'text-ondark-faint hover:text-ondark-strong hover:bg-white/5'
      }`}
    >{label}</button>
  );
  return (
    <nav
      aria-label="Primary"
      className="flex flex-col gap-1.5 bg-blueprint p-2 border-r border-ink-line/40"
    >
      {btn('editor', 'Editor')}
      {btn('library', 'Library')}
    </nav>
  );
}
