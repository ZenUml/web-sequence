import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from 'web-sequence-web';

// Design-system Popover over Radix Popover. The trigger sits on the dark ink chrome;
// PopoverContent floats as a LIGHT paper panel (bg-paper-50) — it brings its own
// surface, so we still wrap the whole thing in a dark ink panel so the trigger reads.
// Rendered OPEN (`defaultOpen`) so the card shows the floated content. Body copied
// from the app's SharePopover (read-only share link + Copy / Stop sharing).
const inkPanel: React.CSSProperties = {
  background: '#10141B',
  padding: 16,
  borderRadius: 8,
};

const trigger: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 32,
  padding: '0 12px',
  borderRadius: 6,
  fontSize: 13,
  color: '#E7ECF3',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const field: React.CSSProperties = {
  flex: 1,
  height: 32,
  padding: '0 8px',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'IBM Plex Mono, monospace',
  color: '#2B2B2B',
  background: '#FFFFFF',
  border: '1px solid #E3DDD2',
};

export function ShareLink() {
  return (
    <div style={inkPanel}>
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <button type="button" style={trigger}>
            Share
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} style={{ width: 300 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#6B6359', margin: 0 }}>
              Anyone with this link can view a read-only copy of this diagram.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                readOnly
                value="app.zenuml.com/s/9f3a2c"
                style={field}
              />
              <Button variant="primary" surface="light" size="md">
                Copy
              </Button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="danger" surface="light" size="sm">
                Stop sharing
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
