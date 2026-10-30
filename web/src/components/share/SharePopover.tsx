import { useEffect, useRef } from 'react';
import { PopoverContent, cn } from '../../ui';
import './SharePopover.css';

export interface SharePopoverProps {
  url: string | null;
  sharing: boolean;
  error: string | null;
  // Transient confirmation from useShare: when true the Copy button shows
  // "Copied ✓" for ~1.5s after a successful copy. Optional so callers that don't
  // wire it (and the legacy default) simply never show the confirmation.
  copied?: boolean;
  // Share panel states from useShare (all optional; omitted = previous behaviour).
  // `stopping`: stopSharing in flight. `failure`: which backend operation failed —
  // when set, the panel shows designed guidance instead of the raw `error` text.
  // `copyFailed`: the clipboard write was rejected or unavailable.
  stopping?: boolean;
  failure?: 'create' | 'stop' | null;
  copyFailed?: boolean;
  onShare(): void;
  onStop(): void;
  onCopy(): void;
}

const SENTENCE = 'Anyone with the link can view this diagram.';

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" className="share-panel__icon" aria-hidden="true">
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinejoin="round" className="share-panel__icon" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

// The compact, menu-like body of the share affordance (Figma F18/F19/F26 light,
// F29/F30/F31 dark). It renders only the PopoverContent — the Popover Root +
// trigger live in ShareButton so there is exactly one Root. One operation and one
// feedback line at a time; the link appears only after the backend confirmed it and
// disappears only after Stop sharing is confirmed. Colours come from the global
// --editor-* tokens via the editor portal class, so the panel follows the app theme.
export function SharePopover({
  url,
  sharing,
  error,
  copied = false,
  stopping = false,
  failure = null,
  copyFailed = false,
  onShare,
  onStop,
  onCopy,
}: SharePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);

  // The pressed action unmounts when the link appears/disappears; keep focus inside
  // the panel on the next action instead of dropping it to <body>.
  const hadUrl = useRef(url !== null);
  useEffect(() => {
    const hasUrl = url !== null;
    if (hasUrl === hadUrl.current) return;
    hadUrl.current = hasUrl;
    const active = document.activeElement;
    const focusLost = !active || active === document.body || panelRef.current?.contains(active);
    if (!focusLost) return;
    (hasUrl ? copyRef.current : createRef.current)?.focus();
  }, [url]);

  // Copy failed: select the link so the user can copy it by hand.
  useEffect(() => {
    if (!copyFailed || !urlRef.current) return;
    urlRef.current.focus();
    urlRef.current.select();
  }, [copyFailed]);

  const state = url
    ? stopping ? 'stopping' : failure === 'stop' ? 'stop-failed' : copyFailed ? 'copy-failed' : copied ? 'copied' : 'created'
    : sharing ? 'creating' : failure === 'create' ? 'create-failed' : 'create';

  // One feedback line at a time; failures outrank progress/confirmation.
  let feedback: { tone: 'status' | 'alert'; text: string; testId?: string } | null = null;
  if (url) {
    if (failure === 'stop') feedback = { tone: 'alert', text: 'Couldn’t stop sharing. Your link is still active. Try again.', testId: 'share-error-text' };
    else if (stopping) feedback = { tone: 'status', text: 'Your link stays active until this finishes.' };
    else if (copyFailed) feedback = { tone: 'alert', text: 'Couldn’t copy. Select the link above and copy it manually.', testId: 'share-copy-error' };
    else if (error) feedback = { tone: 'alert', text: error, testId: 'share-error-text' };
    else if (copied) feedback = { tone: 'status', text: 'Link copied to clipboard.' };
  } else {
    if (sharing) feedback = { tone: 'status', text: 'Creating your read-only link…' };
    else if (failure === 'create') feedback = { tone: 'alert', text: 'Couldn’t create a link. Check your connection and try again.', testId: 'share-error-text' };
    else if (error) feedback = { tone: 'alert', text: error, testId: 'share-error-text' };
  }

  return (
    <PopoverContent
      className={cn('editor-hifi-menu share-panel', url ? 'share-panel--link' : 'share-panel--create')}
      aria-label="Share link"
    >
      <div ref={panelRef} data-testid="share-panel" data-state={state} className="share-panel__body">
        <p className="share-panel__eyebrow">Share link</p>

        {url ? (
          <>
            <p className="share-panel__sentence">{SENTENCE}</p>
            <input
              ref={urlRef}
              data-testid="share-url"
              aria-label="Share link"
              className="share-panel__url"
              readOnly
              value={url}
              // Selecting the text on focus makes manual copy easy.
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="share-panel__actions">
              <button
                ref={copyRef}
                type="button"
                data-testid="share-copy"
                className="share-panel__button share-panel__button--primary"
                onClick={onCopy}
                disabled={stopping}
              >
                <CopyIcon />
                {copied ? 'Copied ✓' : 'Copy share link'}
              </button>
              <button
                type="button"
                data-testid="share-stop"
                className="share-panel__button share-panel__button--secondary"
                onClick={onStop}
                disabled={stopping}
                aria-busy={stopping}
              >
                {stopping ? 'Stopping…' : 'Stop sharing'}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              ref={createRef}
              type="button"
              data-testid="share-create"
              className="share-panel__row"
              onClick={onShare}
              disabled={sharing}
              aria-busy={sharing}
            >
              <LinkIcon />
              {sharing ? 'Creating…' : failure === 'create' ? 'Try again' : 'Create share link'}
            </button>
            <p className="share-panel__sentence">{SENTENCE}</p>
          </>
        )}

        {/* Polite region always present so progress/confirmation is announced. */}
        <p role="status" className={cn('share-panel__feedback', feedback?.tone !== 'status' && 'share-panel__feedback--empty')}>
          {feedback?.tone === 'status' ? feedback.text : ''}
        </p>
        {feedback?.tone === 'alert' ? (
          <p role="alert" data-testid={feedback.testId} className="share-panel__feedback share-panel__feedback--error">
            {feedback.text}
          </p>
        ) : null}
      </div>
    </PopoverContent>
  );
}
