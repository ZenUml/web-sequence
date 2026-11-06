import { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, Button, Textarea, Switch } from '../../ui';
import { buildIssueUrl } from '../../services/bugReport';
import { useSettingsStore } from '../../state/settingsStore';
import './report-bug.css';

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
  const surface = useSettingsStore((s) => s.settings.appearance);
  const descriptionId = useId();
  const codeHelpId = useId();
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
        bare
        className="rb-dialog"
        titleClassName="rb-title"
        descriptionClassName="rb-helper"
        bodyClassName="rb-body"
        closeClassName="rb-close"
        overlayClassName="rb-overlay"
        restoreFocus
        focusContentOnOpen
        title="Report a bug"
        description="Opens a prefilled GitHub issue — review it before submitting."
      >
        <div data-testid="report-bug-modal" className="rb-form">
          <div className="rb-field">
            <label className="rb-label" htmlFor={descriptionId}>What happened?</label>
            <Textarea
              id={descriptionId}
              surface={surface}
              data-testid="report-bug-description"
              placeholder="What went wrong? What did you expect to happen?"
              className="rb-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {hasDsl && (
            <div className="rb-code-row">
              <div>
                <label className="rb-label" htmlFor={`${descriptionId}-include`}>Include diagram code</label>
                <p id={codeHelpId} className="rb-code-help">Your diagram code will be public on GitHub.</p>
              </div>
              <Switch
                id={`${descriptionId}-include`}
                surface={surface}
                data-testid="report-bug-include-dsl"
                aria-label="Include diagram code"
                aria-describedby={codeHelpId}
                checked={includeDsl}
                onCheckedChange={setIncludeDsl}
              />
            </div>
          )}

          <div data-testid="report-bug-summary" className="rb-summary">
            <p className="rb-summary-title">Attached information</p>
            <p>App version {appVersion} · {view} · {signedIn ? 'signed in' : 'anonymous'}</p>
            <p>{hasDsl && includeDsl ? 'Diagram code included (public)' : 'Diagram code excluded'}</p>
          </div>

          <div className="rb-footer">
            <a className="rb-contact" aria-label="No GitHub account? Contact us" href={CONTACT_URL} target="_blank" rel="noreferrer noopener">
              Contact us
            </a>
            <div className="rb-actions">
              <Button surface={surface} size="md" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                surface={surface}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
