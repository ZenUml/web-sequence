// Explicit light/dark surface. Legacy defaults stay on each component.
// Portals render under document.body, so a surface on an ancestor does not
// reach them. Portaled controls set `ui-surface-*` and `data-ui-surface` on
// the portaled node itself. `buttonClassName` includes the same class so an
// anchor can match a button without a nested <button>.
export type UISurface = 'dark' | 'light';

export function surfaceClass(surface: UISurface): string {
  return surface === 'light' ? 'ui-surface-light' : 'ui-surface-dark';
}
