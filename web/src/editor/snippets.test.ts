import { describe, it, expect } from 'vitest';
import { SNIPPETS, addCode, NEW_PARTICIPANT } from './snippets';

describe('SNIPPETS', () => {
  it('contains the 9 DSL snippets with exact payloads', () => {
    const byId = Object.fromEntries(SNIPPETS.map((s) => [s.id, s.code]));
    expect(byId.participant).toBe('NewParticipant');
    expect(byId.async).toBe('A->B:message');
    expect(byId.sync).toBe('A.message {\n}');
    expect(byId.return).toBe('result = A.message {\n}');
    expect(byId.self).toBe('A.message() {\n  selfMessage()\n}');
    expect(byId.instance).toBe('a = new A()');
    expect(byId.if).toBe('if(condition) {\n  A.method()\n}');
    expect(byId.while).toBe('while(condition) {\n  A.method()\n}');
    expect(byId.comment).toBe('//Note\nA.message()');
  });
});

describe('addCode', () => {
  it('appends a normal snippet on a new line', () => {
    expect(addCode('A.b', 'a = new A()')).toBe('A.b\na = new A()');
  });
  it('prepends NewParticipant after leading comments', () => {
    expect(addCode('// title\nA.b', NEW_PARTICIPANT)).toBe('// title\nNewParticipant\nA.b');
  });
});
