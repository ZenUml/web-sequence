// Shared icons. One definition per glyph: import from here instead of drawing a
// local copy. Icons are aria-hidden; `className` (where taken) only sizes or
// positions the glyph, the stroke stays in the icon.
//
// The Diagrams page icons are drawn on the 28×28 hit-target grid used by the Figma
// frame (36:7530) so the glyph bounds match the design: fork ≈10.4×14.4 at
// (8.8, 6.8), trash 14×14 at (7, 7). They share a 1.3px round stroke.

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
};

export function ForkIcon() {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <g {...stroke}>
        <circle cx="10.4" cy="8.4" r="1.6" />
        <circle cx="17.6" cy="8.4" r="1.6" />
        <circle cx="10.4" cy="19.6" r="1.6" />
        <path d="M10.4 10v8" />
        <path d="M17.6 10v1.4a3 3 0 0 1-3 3h-1.2a3 3 0 0 0-3 3" />
      </g>
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <g {...stroke}>
        <path d="M7 9.6h14" />
        <path d="M11.6 9.6V7.8h4.8v1.8" />
        <path d="M8.9 9.6l.9 11.4h8.4l.9-11.4" />
        <path d="M12.6 12.8v5.4M15.4 12.8v5.4" />
      </g>
    </svg>
  );
}

// Move to folder: folder outline with an arrow entering it (same 28 grid as Fork).
export function MoveToFolderIcon() {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <g {...stroke}>
        <path d="M7 10.2V19a1.2 1.2 0 0 0 1.2 1.2h11.6A1.2 1.2 0 0 0 21 19v-6.8a1.2 1.2 0 0 0-1.2-1.2h-6l-1.6-2H8.2A1.2 1.2 0 0 0 7 10.2z" />
        <path d="M11.4 15.6h5.2M14.6 13.6l2 2-2 2" />
      </g>
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <g {...stroke}>
        <path d="M8.5 19.5l.7-3.2 8.6-8.6a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1l-8.6 8.6z" />
        <path d="M16.6 8.9l2.5 2.5" />
      </g>
    </svg>
  );
}

// Empty-folder illustration (design: outlined folder, ~52×40).
export function FolderOutlineIcon() {
  return (
    <svg viewBox="0 0 56 44" width="56" height="44" aria-hidden="true" focusable="false">
      <path
        d="M3 6.5A3.5 3.5 0 0 1 6.5 3h13l5 6h25A3.5 3.5 0 0 1 53 12.5v25A3.5 3.5 0 0 1 49.5 41h-43A3.5 3.5 0 0 1 3 37.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M3 13h50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5l3 3 6-7" {...stroke} strokeWidth={1.6} />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 3v10M3 8h10" {...stroke} strokeWidth={1.6} />
    </svg>
  );
}

export function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} aria-hidden="true" focusable="false">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" {...stroke} strokeWidth={1.7} />
    </svg>
  );
}

export function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} aria-hidden="true" focusable="false">
      <g {...stroke} strokeWidth={1.7}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </g>
    </svg>
  );
}

// Import: tray with an arrow coming down into it. Export: arrow leaving the tray.
export function ImportIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <g {...stroke}>
        <path d="M8 2.5v7M5.2 6.8 8 9.6l2.8-2.8" />
        <path d="M3 10.5v3h10v-3" />
      </g>
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <g {...stroke}>
        <path d="M8 9.6v-7M5.2 5.3 8 2.5l2.8 2.8" />
        <path d="M3 10.5v3h10v-3" />
      </g>
    </svg>
  );
}

// Sidebar toggle: rectangle with a left split; no arrow (the state is carried by
// aria-pressed on the button).
export function SidebarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
    </svg>
  );
}

// Circled exclamation for failed import/export feedback (22 grid).
export function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" width="22" height="22" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 6.6v5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="11" cy="15.2" r="0.95" fill="currentColor" />
    </svg>
  );
}
