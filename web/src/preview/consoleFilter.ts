import type { ConsoleEntry } from './Console';

// Internal starter-seed logs leak `_STARTER_` markers into the preview console.
// They are noise to the user, so we drop them before rendering. Match the marker
// anywhere in the rendered message (the args joined the same way Console renders
// them), not just as an exact value, since it can appear mid-string.
const STARTER_MARKER = '_STARTER_';

function renderMessage(entry: ConsoleEntry): string {
  return entry.args.join(' ');
}

export function filterStarterNoise(entries: ConsoleEntry[]): ConsoleEntry[] {
  return entries.filter((entry) => !renderMessage(entry).includes(STARTER_MARKER));
}

export function countErrors(entries: ConsoleEntry[]): number {
  return entries.reduce((n, entry) => (entry.level === 'error' ? n + 1 : n), 0);
}
