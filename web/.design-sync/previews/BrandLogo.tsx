import { BrandLogo } from 'web-sequence-web';

// The official ZenUML mark — a self-contained #2E94D4 rounded-square SVG that
// carries its own background, so it reads on any surface. Sized via a wrapping
// div width (the SVG fills 100% of its box at a 300×300 viewBox).
// NOTE: BrandLogo trips a [RENDER_THIN] warn — it's an SVG with no text nodes,
// which is a FALSE POSITIVE for a logo. Grade `good` whenever the mark renders.

// The logo at the three sizes the app uses it: brand wordmark (48), header /
// menu avatar (30), and a compact favicon-scale chip (20) — on neutral paper.
export function Sizes() {
  return (
    <div style={{ background: '#FAF7F1', padding: 16, borderRadius: 8, display: 'flex', gap: 16, alignItems: 'flex-end' }}>
      <div style={{ width: 48 }}><BrandLogo /></div>
      <div style={{ width: 30 }}><BrandLogo /></div>
      <div style={{ width: 20 }}><BrandLogo /></div>
    </div>
  );
}

// In context: the mark sitting in the dark app header next to the product name,
// exactly as AppMenu / HomeView place it (className-sized to 30×30).
export function InHeader() {
  return (
    <div style={{ background: '#10141B', padding: 16, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
      <BrandLogo className="h-[30px] w-[30px] shrink-0" />
      <span style={{ color: '#E7ECF3', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>ZenUML</span>
    </div>
  );
}
