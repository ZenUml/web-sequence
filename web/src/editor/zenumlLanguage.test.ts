import { describe, it, expect } from 'vitest';
import { zenumlStream } from './zenumlLanguage';

// Minimal fake of CM6 StringStream — only the methods zenumlStream.token calls.
class FakeStream {
  pos = 0;
  constructor(public string: string) {}
  match(pattern: RegExp): boolean {
    const m = pattern.exec(this.string.slice(this.pos));
    if (m && m.index === 0) { this.pos += m[0].length; return true; }
    return false;
  }
  next(): string { return this.string[this.pos++]; }
  eol(): boolean { return this.pos >= this.string.length; }
}

function firstToken(src: string): string | null {
  const s = new FakeStream(src) as unknown as Parameters<typeof zenumlStream.token>[0];
  return zenumlStream.token(s, {} as never) ?? null;
}

describe('zenumlStream tokens', () => {
  it('marks keywords', () => {
    expect(firstToken('if (x) {')).toBe('keyword');
    expect(firstToken('while (x)')).toBe('keyword');
    expect(firstToken('return x')).toBe('keyword');
    expect(firstToken('new A()')).toBe('keyword');
  });
  it('marks comments', () => {
    expect(firstToken('// note here')).toBe('comment');
  });
  it('marks strings', () => {
    expect(firstToken('"hello"')).toBe('string');
  });
  it('marks identifiers as variableName and call targets as function', () => {
    expect(firstToken('Alice')).toBe('variableName');
    expect(firstToken('method(')).toBe('function');
  });
});
