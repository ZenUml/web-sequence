import { Dialog, DialogContent, Button } from '../../ui';
import type { ProviderName } from '../../services/types';

const PROVIDERS: { id: ProviderName; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'facebook', label: 'Continue with Facebook' },
  { id: 'twitter', label: 'Continue with Twitter' },
];

export interface LoginModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  onLogin(provider: ProviderName): void;
  lastProvider?: string | null;
}

export function LoginModal({ open, onOpenChange, onLogin, lastProvider }: LoginModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Sign in to ZenUML"
        description="Save and sync your diagrams across devices."
      >
        {lastProvider && (
          <p className="mb-3 font-mono text-[11px] text-onlight-muted uppercase tracking-[0.1em]">
            Last used: {lastProvider}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {PROVIDERS.map(({ id, label }) => (
            <Button
              key={id}
              variant="subtle"
              surface="light"
              className="w-full justify-start"
              data-testid={`login-${id}`}
              onClick={() => onLogin(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
