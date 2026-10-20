import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Loads the real primitive stylesheet, then the Tailwind utilities that the
// production build emits later. Computed assertions therefore see the same
// cascade the review measured, not only class names.
let installed = false;

export function installUiCascade(): void {
  if (installed) return;
  installed = true;
  let css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8').replace(
    '@tailwind components;',
    '',
  );
  // jsdom keeps @layer, so a later utility would beat every layered rule.
  // The production build flattens layers; unwrap here so the test measures that cascade.
  const layerOpen = css.indexOf('@layer components {');
  if (layerOpen >= 0) {
    const bodyStart = layerOpen + '@layer components {'.length;
    let depth = 1;
    let i = bodyStart;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    css = css.slice(0, layerOpen) + css.slice(bodyStart, i - 1) + css.slice(i);
  }
  const utilities = `
    .text-danger { color: #E0524A; }
    .text-danger-strong { color: #B23A33; }
    .bg-transparent { background-color: transparent; }
    .border { border-width: 1px; border-style: solid; }
    .border-danger-strong\\/40 { border-color: rgb(178 58 51 / 0.4); }
    .border-danger\\/30 { border-color: rgb(224 82 74 / 0.3); }
    .data-\\[highlighted\\]\\:bg-danger\\/20[data-highlighted] { background-color: rgb(224 82 74 / 0.2); }
    .data-\\[highlighted\\]\\:text-ondark-strong[data-highlighted] { color: #E8EEF7; }
    .h-7 { height: 1.75rem; }
    .h-12 { height: 3rem; }
    .disabled\\:pointer-events-none:disabled { pointer-events: none; }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-ui-cascade', 'test');
  style.textContent = `${css}\n${utilities}`;
  document.head.appendChild(style);
}

export function usedColor(el: Element, property: 'color' | 'backgroundColor'): [number, number, number, number] {
  return resolveCssColor(el, getComputedStyle(el)[property]);
}

export function tokenColor(el: Element, name: string): [number, number, number, number] {
  return resolveCssColor(el, getComputedStyle(el).getPropertyValue(name).trim());
}

function resolveCssColor(el: Element, raw: string): [number, number, number, number] {
  const variable = raw.match(/var\(\s*(--[\w-]+)\s*\)/);
  if (variable) {
    const value = getComputedStyle(el).getPropertyValue(variable[1]).trim();
    if (!value) throw new Error(`unset ${variable[1]}`);
    return resolveCssColor(el, value);
  }
  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
      1,
    ];
  }
  return rgb(raw);
}

export function rgb(color: string): [number, number, number, number] {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) throw new Error(`unparsed color: ${color}`);
  const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  const [r, g, b, a = 1] = parts;
  return [r, g, b, a];
}

function channel(value: number): number {
  const x = value / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function composite(
  fore: [number, number, number, number],
  back: [number, number, number, number],
): [number, number, number] {
  const a = fore[3];
  return [
    fore[0] * a + back[0] * (1 - a),
    fore[1] * a + back[1] * (1 - a),
    fore[2] * a + back[2] * (1 - a),
  ];
}

export function contrastRatio(
  fore: [number, number, number],
  back: [number, number, number],
): number {
  const a = luminance(...fore);
  const b = luminance(...back);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
