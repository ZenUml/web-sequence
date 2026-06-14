import { useState } from 'react';
import { Button, cn } from '../../ui';
import { ReportBugModal } from './ReportBugModal';

export interface ReportBugButtonProps {
  dsl?: string;
  appVersion: string;
  view: string;
  signedIn: boolean;
  onOpen?(): void;
  onSubmitted?(meta: { includedDsl: boolean }): void;
}

function BugIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 9V5a3 3 0 0 1 6 0v4" />
      <rect x="8" y="9" width="8" height="10" rx="4" />
      <path d="M3 13h5M16 13h5M4 19l4-2M20 19l-4-2M4 7l4 2M20 7l-4 2" />
    </svg>
  );
}

// Persistent bottom-right FAB. position:fixed, so its DOM position within the app
// tree is irrelevant — only z-index matters (sits below the Dialog overlay z-40).
export function ReportBugButton({
  dsl,
  appVersion,
  view,
  signedIn,
  onOpen,
  onSubmitted,
}: ReportBugButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        size="md"
        data-testid="report-bug-fab"
        aria-label="Report a bug"
        className={cn('fixed bottom-4 right-4 z-30 shadow-pop')}
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
      >
        <BugIcon />
        <span className="hidden md:inline">Report a bug</span>
      </Button>
      <ReportBugModal
        open={open}
        onOpenChange={setOpen}
        dsl={dsl}
        appVersion={appVersion}
        view={view}
        signedIn={signedIn}
        onSubmitted={onSubmitted}
      />
    </>
  );
}
