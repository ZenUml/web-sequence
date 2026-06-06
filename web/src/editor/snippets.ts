export const NEW_PARTICIPANT = 'NewParticipant';

export interface Snippet { id: string; label: string; code: string; }

export const SNIPPETS: Snippet[] = [
  { id: 'participant', label: 'New participant', code: NEW_PARTICIPANT },
  { id: 'async', label: 'Async message', code: 'A->B:message' },
  { id: 'sync', label: 'Sync message', code: 'A.message {\n}' },
  { id: 'return', label: 'Return value', code: 'result = A.message {\n}' },
  { id: 'self', label: 'Self message', code: 'A.message() {\n  selfMessage()\n}' },
  { id: 'instance', label: 'New instance', code: 'a = new A()' },
  { id: 'if', label: 'Conditional', code: 'if(condition) {\n  A.method()\n}' },
  { id: 'while', label: 'Loop', code: 'while(condition) {\n  A.method()\n}' },
  { id: 'comment', label: 'Comment + message', code: '//Note\nA.message()' },
];

const isComment = (line: string) => line.trimStart().startsWith('//');
const isEmpty = (s: string) => s.trim().length === 0;

// Ported from legacy code_service.addCode: NewParticipant is inserted after any
// leading comment block; every other snippet is appended on a new line.
export function addCode(code: string, snippet: string): string {
  if (isEmpty(code)) return snippet;
  if (snippet === NEW_PARTICIPANT) {
    const lines = code.split('\n');
    let i = 0;
    while (i < lines.length && (isEmpty(lines[i]) || isComment(lines[i]))) i++;
    return [...lines.slice(0, i), NEW_PARTICIPANT, ...lines.slice(i)].join('\n');
  }
  return `${code}\n${snippet}`;
}
