import { useUiStore } from '../state/uiStore';

export function Sidebar() {
  const active = useUiStore((s) => s.activePanel);
  const setActive = useUiStore((s) => s.setActivePanel);
  const btn = (panel: 'editor' | 'library', label: string) => (
    <button
      data-testid={`sidebar-${panel}`}
      aria-pressed={active === panel}
      onClick={() => setActive(panel)}
      className={`p-2 rounded ${active === panel ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
    >{label}</button>
  );
  return (
    <nav aria-label="Primary" className="flex flex-col gap-2 bg-gray-900 p-2 border-r border-white/10">
      {btn('editor', 'Editor')}
      {btn('library', 'Library')}
    </nav>
  );
}
