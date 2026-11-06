import { Textarea } from 'web-sequence-web';

// Textarea mirrors TextInput's surface tokens as a multi-line field. The dark
// surface (default) hosts the Atomizer JSON config editor (mono); the light
// (paper) surface hosts modal copy like the bug-report description.
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

const ACSS_CONFIG = `{
  "custom": {
    "1px": "1px solid #d8d4cc"
  },
  "breakPoints": {
    "sm": "@media (min-width: 640px)"
  }
}`;

// Dark surface, mono — the Atomizer JSON configuration editor.
export function DarkCode() {
  return (
    <Ink>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelDark}>Atomizer configuration</span>
        <Textarea
          surface="dark"
          rows={6}
          spellCheck={false}
          className="w-full font-mono text-[12px]"
          defaultValue={ACSS_CONFIG}
          style={{ minWidth: 320 }}
        />
      </label>
    </Ink>
  );
}

// Light (paper) surface: empty placeholder vs. filled — the bug-report field.
export function Light() {
  return (
    <Paper>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelLight}>Describe the bug</span>
        <Textarea
          surface="light"
          rows={4}
          className="w-full"
          placeholder="What went wrong? What did you expect to happen?"
          style={{ minWidth: 320 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelLight}>Describe the bug</span>
        <Textarea
          surface="light"
          rows={4}
          className="w-full"
          defaultValue="The preview pane stays blank after I rename a participant — reloading fixes it."
          style={{ minWidth: 320 }}
        />
      </label>
    </Paper>
  );
}

// Disabled (light) — submitted, awaiting the GitHub issue redirect.
export function Disabled() {
  return (
    <Paper>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelLight}>Describe the bug</span>
        <Textarea
          surface="light"
          rows={4}
          disabled
          className="w-full"
          defaultValue="Submitting your report…"
          style={{ minWidth: 320 }}
        />
      </label>
    </Paper>
  );
}
