import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
} from 'web-sequence-web';

// Design-system dropdown Menu over Radix DropdownMenu. Menus are DARK (ink) — they
// drop from the dark chrome (header, diagram-card kebab) and bring their own surface.
// Rendered OPEN (`defaultOpen`) so the card shows the floated menu items, not just
// the trigger. Content + items copied from the DiagramCard kebab menu (Duplicate /
// Export / a separator / a destructive Delete), the canonical realistic item list.
const inkPanel: React.CSSProperties = {
  background: '#10141B',
  padding: 16,
  borderRadius: 8,
};

const trigger: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: '0 10px',
  borderRadius: 6,
  fontSize: 13,
  color: '#E7ECF3',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
};

export function DiagramActions() {
  return (
    <div style={inkPanel}>
      <Menu defaultOpen>
        <MenuTrigger asChild>
          <button type="button" style={trigger} aria-label="Diagram options">
            Order processing flow ▾
          </button>
        </MenuTrigger>
        <MenuContent align="start" sideOffset={6}>
          <MenuLabel>Diagram</MenuLabel>
          <MenuItem>Rename</MenuItem>
          <MenuItem>Duplicate</MenuItem>
          <MenuItem>Export as HTML</MenuItem>
          <MenuSeparator />
          <MenuItem tone="danger">Delete</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
