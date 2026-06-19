import { Switch } from 'web-sequence-web';

// Drafting Table is a dark-surface DS: settings toggles live on the ink chrome
// (the Settings modal sits on the dark surface). Preview the Switch on the ink
// panel so the paper-200 track + cobalt-accent checked fill read with proper
// contrast against the panel rather than washing out on the white grading sheet.
const Ink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ background: '#10141B', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
    {children}
  </div>
);

// A labelled settings row, the way SettingsModal composes Switch (SwitchRow).
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, minWidth: 240 }}>
    <span style={{ color: '#E7ECF3', fontSize: 13 }}>{label}</span>
    {children}
  </div>
);

// On vs. off — the two resting states a settings toggle alternates between.
export function OnAndOff() {
  return (
    <Ink>
      <Row label="Auto-preview">
        <Switch defaultChecked aria-label="Auto-preview" />
      </Row>
      <Row label="Line numbers">
        <Switch aria-label="Line numbers" />
      </Row>
    </Ink>
  );
}

// Disabled toggles — locked-on and locked-off (e.g. a Pro-gated setting).
export function Disabled() {
  return (
    <Ink>
      <Row label="Cloud sync (Pro)">
        <Switch defaultChecked disabled aria-label="Cloud sync" />
      </Row>
      <Row label="Telemetry">
        <Switch disabled aria-label="Telemetry" />
      </Row>
    </Ink>
  );
}
