// The shared "+" glyph (add page, New). Drawn on a 10×10 grid with round caps;
// `size` scales it and `strokeWidth` is in grid units.
interface PlusIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function PlusIcon({ size = 10, strokeWidth = 1.5, className }: PlusIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" className={className} aria-hidden="true">
      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}
