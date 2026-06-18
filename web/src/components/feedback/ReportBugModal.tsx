import { useEffect, useState } from 'react';
import { Dialog, DialogContent, Button, Textarea, Switch } from '../../ui';
import { buildIssueUrl } from '../../services/bugReport';

// Verified contact page (same URL the Help modal links to). Used as the fallback
// for reporters without a GitHub account.
const CONTACT_URL = 'https://zenuml.com/docs/about/contact-us';

export interface ReportBugModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  // Current editor source. Empty/whitespace => no DSL option (hub, or empty doc).
  dsl?: string;
  appVersion: string;
  view: string;
  signedIn: boolean;
  // Side-effect injected for testability; defaults to opening a new tab.
  openUrl?(url: string): void;
  onSubmitted?(meta: { includedDsl: boolean }): void;
}

export function ReportBugModal({
  open,
  onOpenChange,
  dsl,
  appVersion,
  view,
  signedIn,
  openUrl = (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  onSubmitted,
}: ReportBugModalProps) {
  const hasDsl = !!(dsl && dsl.trim());
  const [description, setDescription] = useState('');
  const [includeDsl, setIncludeDsl] = useState(true);

  // Reset the form whenever the modal closes so a reopen starts clean.
  useEffect(() => {
    if (!open) {
      setDescription('');
      setIncludeDsl(true);
    }
  }, [open]);

  const canSubmit = description.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const included = hasDsl && includeDsl;
    const url = buildIssueUrl({
      description,
      includeDsl: included,
      dsl,
      appVersion,
      userAgent: navigator.userAgent,
      view,
      signedIn,
    });
    openUrl(url);
    onSubmitted?.({ includedDsl: included });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Report a bug"
        description="Opens a prefilled GitHub issue — review it before submitting."
      >
        <div data-testid="report-bug-modal" className="space-y-4">
          <Textarea
            data-testid="report-bug-description"
            aria-label="Describe the bug"
            placeholder="What went wrong? What did you expect to happen?"
            rows={5}
            className="w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {hasDsl && (
            <label className="flex items-center justify-between gap-3 text-[13px] text-ondark-muted">
              <span>
                Include my diagram code{' '}
                <span className="text-ondark-faint">(will be public)</span>
              </span>
              <Switch
                data-testid="report-bug-include-dsl"
                aria-label="Include my diagram code"
                checked={includeDsl}
                onCheckedChange={setIncludeDsl}
              />
            </label>
          )}

          <div
            data-testid="report-bug-summary"
            className="rounded border border-ink-line/50 bg-ink-900/40 p-3 text-[12px] text-ondark-faint space-y-1"
          >
            <p className="font-mono uppercase tracking-[0.12em] text-[10px]">Attached</p>
            <p>
              App version {appVersion} · {view} · {signedIn ? 'signed in' : 'anonymous'}
            </p>
            <p>{hasDsl && includeDsl ? 'Your diagram code (public)' : 'No diagram code'}</p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <a
              className="text-[12px] text-ondark-faint hover:text-ondark-muted underline underline-offset-2 rounded ring-draft"
              href={CONTACT_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              No GitHub account? Contact us
            </a>
            <Button
              variant="primary"
              size="md"
              data-testid="report-bug-submit"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Open GitHub issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
