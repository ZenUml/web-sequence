import { SearchInput } from 'web-sequence-web';

// SearchInput = leading magnifier glyph + input + a clear (×) affordance that
// appears only when there's a value. It's a dark-surface control (home/library
// toolbars), so the dark cells sit on the ink panel; the `light` variant gets
// the warm paper panel. `onChange` is value-style and required; the cells pass
// a fixed value + no-op so the populated state (and its clear button) render
// statically on the capture sheet.
const noop = (_: string) => {};

const Ink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', background: '#10141B', padding: 16, borderRadius: 8 }}>
    {children}
  </div>
);

const Paper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', background: '#FAF7F1', padding: 16, borderRadius: 8 }}>
    {children}
  </div>
);

// Dark surface, empty: just the placeholder + search glyph (home toolbar).
export function Placeholder() {
  return (
    <Ink>
      <SearchInput
        value=""
        onChange={noop}
        surface="dark"
        placeholder="Search your diagrams…"
        style={{ width: 260 }}
      />
    </Ink>
  );
}

// Dark surface, with a query: clear (×) button now shows on the right.
export function WithValue() {
  return (
    <Ink>
      <SearchInput
        value="checkout flow"
        onChange={noop}
        surface="dark"
        placeholder="Search your diagrams…"
        style={{ width: 260 }}
      />
    </Ink>
  );
}

// Light (paper) surface: empty placeholder + a populated query with clear button.
export function Light() {
  return (
    <Paper>
      <SearchInput
        value=""
        onChange={noop}
        surface="light"
        placeholder="Search diagrams"
        style={{ width: 260 }}
      />
      <SearchInput
        value="auth sequence"
        onChange={noop}
        surface="light"
        placeholder="Search diagrams"
        style={{ width: 260 }}
      />
    </Paper>
  );
}
