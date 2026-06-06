import { PopoverContent, Button, TextInput } from '../../ui';

export interface SharePopoverProps {
  url: string | null;
  sharing: boolean;
  error: string | null;
  onShare(): void;
  onStop(): void;
  onCopy(): void;
}

// The paper body of the share affordance. It renders only the PopoverContent —
// the Popover Root + trigger live in ShareButton so there is exactly one Root.
export function SharePopover({ url, sharing, error, onShare, onStop, onCopy }: SharePopoverProps) {
  return (
    <PopoverContent className="w-[min(360px,calc(100vw-2rem))]">
      {url ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-onlight-muted">
            Anyone with this link can view a read-only copy of this diagram.
          </p>
          <div className="flex items-center gap-2">
            <TextInput
              data-testid="share-url"
              surface="light"
              className="flex-1"
              readOnly
              value={url}
              // Selecting the text on focus makes manual copy easy.
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              data-testid="share-copy"
              variant="primary"
              surface="light"
              size="sm"
              onClick={onCopy}
            >
              Copy
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              data-testid="share-stop"
              variant="danger"
              surface="light"
              size="sm"
              onClick={onStop}
            >
              Stop sharing
            </Button>
          </div>
          {/* A failed "Stop sharing" surfaces here so the user knows the link is
              still live (advisor fix #7) — the error slot previously existed only
              in the no-url branch. */}
          {error ? (
            <p data-testid="share-error-text" className="text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-onlight-muted">
            Create a read-only link to share this diagram.
          </p>
          <Button
            data-testid="share-create"
            variant="primary"
            surface="light"
            onClick={onShare}
            disabled={sharing}
          >
            {sharing ? 'Creating…' : 'Create share link'}
          </Button>
          {error ? (
            <p data-testid="share-error-text" className="text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </PopoverContent>
  );
}
