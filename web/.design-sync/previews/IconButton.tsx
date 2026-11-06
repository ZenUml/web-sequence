import { IconButton } from 'web-sequence-web';

// Drafting Table is a dark-surface DS: its `dark` controls are muted neutrals meant
// to sit on the ink chrome. Preview them on that ink panel (else the icons read as
// faint gray on a white card). The `light` variant gets the warm paper panel.
const Ink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#10141B', padding: 12, borderRadius: 8 }}>
    {children}
  </div>
);
const Paper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#FAF7F1', padding: 12, borderRadius: 8 }}>
    {children}
  </div>
);

const Close = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const Plus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// Icon-only controls for toolbars and tab affordances. aria-label is required.
export function Toolbar() {
  return (
    <Ink>
      <IconButton aria-label="Add page"><Plus /></IconButton>
      <IconButton aria-label="Close"><Close /></IconButton>
    </Ink>
  );
}

export function Sizes() {
  return (
    <Ink>
      <IconButton size="sm" aria-label="Add page (small)"><Plus /></IconButton>
      <IconButton size="md" aria-label="Add page (medium)"><Plus /></IconButton>
    </Ink>
  );
}

// The light-paper surface variant + a disabled control.
export function SurfaceAndDisabled() {
  return (
    <Paper>
      <IconButton surface="light" aria-label="Close on light"><Close /></IconButton>
      <IconButton surface="light" aria-label="Add on light"><Plus /></IconButton>
      <IconButton surface="light" aria-label="Close (disabled)" disabled><Close /></IconButton>
    </Paper>
  );
}
