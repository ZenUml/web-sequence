import { Button } from 'web-sequence-web';

// Drafting Table is a dark-surface DS: `dark` (default) controls live on the ink
// chrome. Preview them on that ink panel so the quiet variants (ghost/subtle) read
// with proper contrast; the `light` variant gets the warm paper panel.
const Ink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#10141B', padding: 16, borderRadius: 8 }}>
    {children}
  </div>
);

// Intent-based variants on the dark `ink` chrome (header/toolbar surface).
export function Variants() {
  return (
    <Ink>
      <Button variant="primary">Save changes</Button>
      <Button variant="subtle">Cancel</Button>
      <Button variant="ghost">Dismiss</Button>
      <Button variant="danger">Delete page</Button>
    </Ink>
  );
}

// Two sizes for toolbars (sm) vs. dialogs/forms (md).
export function Sizes() {
  return (
    <Ink>
      <Button variant="primary" size="sm">Run</Button>
      <Button variant="primary" size="md">Run diagram</Button>
      <Button variant="subtle" size="sm">Export</Button>
      <Button variant="subtle" size="md">Export as PNG</Button>
    </Ink>
  );
}

// Disabled state (dark) + the light-paper surface variant (used inside modals/menus).
export function StatesAndSurface() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Ink>
        <Button variant="primary" disabled>Saving…</Button>
        <Button variant="subtle" disabled>Cancel</Button>
      </Ink>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#FAF7F1', padding: 16, borderRadius: 8 }}>
        <Button variant="primary" surface="light">Confirm</Button>
        <Button variant="subtle" surface="light">Cancel</Button>
        <Button variant="danger" surface="light">Remove</Button>
      </div>
    </div>
  );
}
