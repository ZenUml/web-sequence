export const NEW_PARTICIPANT = 'NewParticipant';

// `group` clusters the toolbar into two `.igroup` rows (redesign.css): message-level
// constructs vs. structural/block constructs. `icon` is a key into the icon registry
// in Toolbox.tsx (kept out of this .ts data module so the file stays JSX-free).
export type SnippetGroup = 'message' | 'structure';
export type SnippetIcon =
  | 'participant'
  | 'sync'
  | 'async'
  | 'return'
  | 'self'
  | 'instance'
  | 'if'
  | 'while'
  | 'comment';

export interface Snippet {
  id: string;
  /** Full descriptive label — feeds `title`/`aria-label`. */
  label: string;
  /** Short single-token display label for the compact `.ibtn` grid (redesign.css). */
  short: string;
  code: string;
  group: SnippetGroup;
  icon: SnippetIcon;
}

export const SNIPPETS: Snippet[] = [
  { id: 'participant', label: 'New participant', short: 'Participant', code: NEW_PARTICIPANT, group: 'message', icon: 'participant' },
  { id: 'async', label: 'Async message', short: 'Async', code: 'A->B:message', group: 'message', icon: 'async' },
  { id: 'sync', label: 'Sync message', short: 'Sync', code: 'A.message {\n}', group: 'message', icon: 'sync' },
  { id: 'return', label: 'Return value', short: 'Return', code: 'result = A.message {\n}', group: 'message', icon: 'return' },
  { id: 'self', label: 'Self message', short: 'Self', code: 'A.message() {\n  selfMessage()\n}', group: 'message', icon: 'self' },
  { id: 'instance', label: 'New instance', short: 'Instance', code: 'a = new A()', group: 'structure', icon: 'instance' },
  { id: 'if', label: 'Conditional', short: 'Alt', code: 'if(condition) {\n  A.method()\n}', group: 'structure', icon: 'if' },
  { id: 'while', label: 'Loop', short: 'Loop', code: 'while(condition) {\n  A.method()\n}', group: 'structure', icon: 'while' },
  { id: 'comment', label: 'Comment + message', short: 'Note', code: '//Note\nA.message()', group: 'structure', icon: 'comment' },
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
