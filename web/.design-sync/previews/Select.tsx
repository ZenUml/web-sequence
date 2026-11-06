import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from 'web-sequence-web';

// Design-system Select over Radix Select. The trigger sits on dark ink chrome
// (the Settings modal context) and the floating SelectContent is a dark ink panel
// itself. Rendered OPEN (`defaultOpen`) so the card shows the dropdown list, not
// just the collapsed field. Realistic options copied from SettingsModal's theme row.
const inkPanel: React.CSSProperties = {
  background: '#10141B',
  padding: 16,
  borderRadius: 8,
};

export function ThemeSelect() {
  return (
    <div style={inkPanel}>
      <Select defaultValue="theme-default" defaultOpen>
        <SelectTrigger surface="dark" aria-label="Theme" style={{ minWidth: 168 }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="theme-default">Default</SelectItem>
          <SelectItem value="theme-clean-light">Clean light</SelectItem>
          <SelectItem value="theme-clean-dark">Clean dark</SelectItem>
          <SelectItem value="theme-blue">Blue</SelectItem>
          <SelectItem value="theme-mocha">Mocha</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
