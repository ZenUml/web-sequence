import type { PlanType } from '../../domain/types';
import { cn } from '../../ui';

// REQ-SUB-7: a small font-mono badge rendered next to the avatar for subscribed
// users. Presentational only — the caller decides when a user counts as "pro".
// `free` renders nothing (no badge for the Starter tier).
export interface ProBadgeProps {
  planType: PlanType;
  className?: string;
}

// The human-facing tier label shown inside the badge.
function tierLabel(planType: PlanType): string | null {
  if (planType.startsWith('basic')) return 'BASIC';
  if (planType.startsWith('plus')) return 'PLUS';
  if (planType === 'enterprise') return 'ENTERPRISE';
  return null; // 'free' — no badge
}

export function ProBadge({ planType, className }: ProBadgeProps) {
  const label = tierLabel(planType);
  if (!label) return null;
  return (
    <span
      data-testid="pro-badge"
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5',
        'font-mono text-[10px] font-medium uppercase tracking-[0.12em]',
        'bg-signal-amber/15 text-signal-amber',
        className,
      )}
    >
      {label}
    </span>
  );
}
