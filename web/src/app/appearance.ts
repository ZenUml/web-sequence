import { usesTemplateLightBase } from '../domain/templates';
import type { Appearance } from '../domain/types';
import type { RenderOptions } from '../preview/previewProtocol';

// Global light/dark appearance. The value is an ordinary Settings key, persisted
// by the existing settings path (syncStore + cloud user settings). This module
// only mirrors it onto <html data-appearance> so the editor chrome tokens in
// globals.css — including Radix portals outside the editor shell — follow it.

export const APPEARANCE_KEY = 'appearance';

export function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark';
}

export function applyAppearance(appearance: Appearance): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.appearance = appearance;
}

// First-paint hint for the web app. syncStore falls back to localStorage on the
// web (JSON-encoded), so read that key synchronously before React mounts to avoid
// a light flash for dark users. The settings boot load remains authoritative.
export function readStoredAppearance(): Appearance {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return isAppearance(parsed) ? parsed : 'light';
  } catch {
    return 'light';
  }
}

// Keep a bundled light template light while the application workspace stays dark.
export function previewThemeFor(appearance: Appearance, documentCss = ''): RenderOptions['theme'] {
  if (usesTemplateLightBase(documentCss)) return 'theme-default';
  return appearance === 'dark' ? 'theme-dark' : 'theme-default';
}
