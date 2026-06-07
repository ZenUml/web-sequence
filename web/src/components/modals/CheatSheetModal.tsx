import { Dialog, DialogContent } from '../../ui';

export interface CheatSheetModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
}

// ZenUML DSL reference. Examples are SOURCED, not invented:
// - participant / message / async / nested / self / alt / loop: legacy
//   `src/components/CheatSheetModal.jsx`.
// - return + instance-creation: the M04 plan (Task 12) gives exact syntax inline.
// - comment: ZenUML lexer rule `COMMENT : '//' ~[\r\n]*` (zenuml-core
//   sequenceLexer.g4) + legacy basic template `// This is a sample`.
interface Row {
  feature: string;
  example: string;
}

const ROWS: Row[] = [
  { feature: 'Participant', example: 'ParticipantA\nParticipantB' },
  { feature: 'Message', example: 'A.messageA()' },
  { feature: 'Async message', example: 'Alice->Bob: How are you?' },
  { feature: 'Nested message', example: 'A.messageA() {\n  B.messageB()\n}' },
  { feature: 'Self-message', example: 'internalMessage()' },
  { feature: 'Return', example: 'result = A.method() {}' },
  { feature: 'Instance creation', example: 'a = new A()' },
  {
    feature: 'Alt (conditional)',
    example:
      'if (condition1) {\n  A.methodA()\n} else if (condition2) {\n  B.methodB()\n} else {\n  C.methodC()\n}',
  },
  { feature: 'Loop', example: 'while (condition) {\n  A.methodA()\n}' },
  { feature: 'Comment', example: '// This is a comment' },
];

export function CheatSheetModal({ open, onOpenChange }: CheatSheetModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Cheat sheet"
        description="A quick reference for the ZenUML DSL."
        className="w-[min(560px,calc(100vw-2rem))]"
      >
        <div data-testid="cheatsheet-modal" className="max-h-[60vh] overflow-y-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-paper-line">
                <th className="px-3 py-2 text-left font-mono uppercase tracking-[0.12em] text-[11px] text-onlight-faint">
                  Feature
                </th>
                <th className="px-3 py-2 text-left font-mono uppercase tracking-[0.12em] text-[11px] text-onlight-faint">
                  Example
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.feature} className="border-b border-paper-line/60">
                  <td className="px-3 py-2 align-top text-onlight-strong">
                    {row.feature}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <pre className="rounded bg-paper-200 p-2">
                      <code className="font-mono text-[12px] text-onlight-strong whitespace-pre">
                        {row.example}
                      </code>
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
