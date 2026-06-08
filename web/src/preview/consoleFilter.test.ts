import { describe, it, expect } from 'vitest';
import { filterStarterNoise, countErrors } from './consoleFilter';
import type { ConsoleEntry } from './Console';

describe('filterStarterNoise', () => {
  it('drops an entry whose single arg is exactly the starter marker', () => {
    const entries: ConsoleEntry[] = [{ level: 'log', args: ['_STARTER_'] }];
    expect(filterStarterNoise(entries)).toEqual([]);
  });

  it('drops an entry where the marker appears mid-string', () => {
    const entries: ConsoleEntry[] = [
      { level: 'log', args: ['seed:_STARTER_:42 done'] },
    ];
    expect(filterStarterNoise(entries)).toEqual([]);
  });

  it('drops an entry where the marker spans multiple args once joined', () => {
    // args render as args.join(' '), so "foo _STARTER_" only matches across the join
    const entries: ConsoleEntry[] = [
      { level: 'log', args: ['foo', '_STARTER_', 'bar'] },
    ];
    expect(filterStarterNoise(entries)).toEqual([]);
  });

  it('keeps non-starter entries untouched', () => {
    const entries: ConsoleEntry[] = [
      { level: 'log', args: ['hello world'] },
      { level: 'error', args: ['boom'] },
    ];
    expect(filterStarterNoise(entries)).toEqual(entries);
  });

  it('keeps only non-starter entries from a mixed list, preserving order', () => {
    const kept1: ConsoleEntry = { level: 'log', args: ['real log'] };
    const kept2: ConsoleEntry = { level: 'error', args: ['real error'] };
    const entries: ConsoleEntry[] = [
      { level: 'debug', args: ['_STARTER_ a'] },
      kept1,
      { level: 'log', args: ['x _STARTER_ y'] },
      kept2,
    ];
    expect(filterStarterNoise(entries)).toEqual([kept1, kept2]);
  });

  it('KEEPS a genuine error even if its message contains the marker', () => {
    // A real error must never be silently dropped (it would vanish from the log AND
    // the error count/pill) just because its text happens to include _STARTER_.
    const err: ConsoleEntry = { level: 'error', args: ['Participant _STARTER_ not found'] };
    expect(filterStarterNoise([err])).toEqual([err]);
  });

  it('returns an empty array for empty input', () => {
    expect(filterStarterNoise([])).toEqual([]);
  });

  it('does not match a lowercase or partial marker', () => {
    const entries: ConsoleEntry[] = [
      { level: 'log', args: ['_starter_'] },
      { level: 'log', args: ['STARTER'] },
    ];
    expect(filterStarterNoise(entries)).toEqual(entries);
  });
});

describe('countErrors', () => {
  it('counts only level === "error" entries', () => {
    const entries: ConsoleEntry[] = [
      { level: 'error', args: ['a'] },
      { level: 'warn', args: ['b'] },
      { level: 'log', args: ['c'] },
      { level: 'error', args: ['d'] },
    ];
    expect(countErrors(entries)).toBe(2);
  });

  it('does not count warn or log as errors', () => {
    const entries: ConsoleEntry[] = [
      { level: 'warn', args: ['w'] },
      { level: 'log', args: ['l'] },
      { level: 'info', args: ['i'] },
    ];
    expect(countErrors(entries)).toBe(0);
  });

  it('returns 0 for an empty array', () => {
    expect(countErrors([])).toBe(0);
  });
});
