import { Dialog, DialogContent } from '../../ui';

export interface HelpModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  // Supplied by the integrate layer (Task 16). Presentational here — do not read
  // package.json (it's 0.0.0) nor hardcode a stale literal like legacy's "v2.0.0".
  version?: string;
}

// Real URLs sourced from legacy (`src/components/HelpModal.jsx`,
// `Notifications.jsx`, `subscription/ContactUsLink.jsx`) — not invented.
const DOCS_URL = 'https://www.zenuml.com/help.html';
const CONTACT_URL = 'https://zenuml.com/docs/about/contact-us';
const GITHUB_URL = 'https://github.com/ZenUml/web-sequence';

export function HelpModal({ open, onOpenChange, version }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="ZenUML Sequence"
        description="A free, real-time sequence diagram tool — write diagrams as code."
      >
        <div
          data-testid="help-modal"
          className="space-y-5 text-[14px] text-ondark-muted"
        >
          {version ? (
            <p
              data-testid="help-version"
              className="font-mono uppercase tracking-[0.12em] text-[11px] text-ondark-muted"
            >
              Version {version}
            </p>
          ) : null}

          <p>
            ZenUML turns plain-text DSL into UML sequence diagrams instantly,
            in your browser or as a Chrome extension. Free to use, with optional
            cloud sync.
          </p>

          <ul className="space-y-2">
            <li>
              <a
                className="text-accent-press hover:text-accent underline underline-offset-2 rounded ring-draft"
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                Documentation &amp; help
              </a>
            </li>
            <li>
              <a
                className="text-accent-press hover:text-accent underline underline-offset-2 rounded ring-draft"
                href={CONTACT_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                Contact us
              </a>
            </li>
            <li>
              <a
                className="text-accent-press hover:text-accent underline underline-offset-2 rounded ring-draft"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
