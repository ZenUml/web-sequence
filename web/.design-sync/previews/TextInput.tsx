import { TextInput } from 'web-sequence-web';

// TextInput is a dark-surface DS control by default (lives on the ink chrome —
// e.g. inline page-tab rename). The grading sheet is white, so dark-surface
// cells sit on the ink panel; the `light` variant (share URL, settings fields)
// gets the warm paper panel it's designed for.
const Ink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#10141B', padding: 16, borderRadius: 8 }}>
    {children}
  </div>
);

const Paper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#FAF7F1', padding: 16, borderRadius: 8 }}>
    {children}
  </div>
);

const labelDark: React.CSSProperties = { fontSize: 12, color: '#9aa4b2', fontFamily: 'Hanken Grotesk, sans-serif' };
const labelLight: React.CSSProperties = { fontSize: 12, color: '#6b6356', fontFamily: 'Hanken Grotesk, sans-serif' };

// Default dark surface: placeholder vs. a typed value (page-tab rename field).
export function Dark() {
  return (
    <Ink>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelDark}>Diagram title</span>
        <TextInput placeholder="Untitled diagram" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelDark}>Diagram title</span>
        <TextInput defaultValue="Order checkout flow" />
      </label>
    </Ink>
  );
}

// Disabled (dark) — used while a save is in flight.
export function Disabled() {
  return (
    <Ink>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelDark}>Diagram title</span>
        <TextInput defaultValue="Order checkout flow" disabled />
      </label>
    </Ink>
  );
}

// Light (paper) surface: the share-URL field (read-only) and a settings input.
export function Light() {
  return (
    <Paper>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelLight}>Share link</span>
        <TextInput surface="light" readOnly value="https://app.zenuml.com/p/9fK2a" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelLight}>Display name</span>
        <TextInput surface="light" placeholder="Your name" />
      </label>
    </Paper>
  );
}
