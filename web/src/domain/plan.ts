import type { PlanType, Subscription } from './types';

function isJson(s: string): boolean {
  try { JSON.parse(s); return true; } catch { return false; }
}

export function isSubscribed(s: Subscription | null | undefined): boolean {
  return !!s && (s.status === 'active' || s.status === 'trialing');
}

export function getPlanType(s: Subscription | null | undefined): PlanType {
  if (!isSubscribed(s)) return 'free';
  const pt = s!.passthrough;
  if (isJson(pt)) {
    const parsed = JSON.parse(pt) as { planType?: PlanType };
    return parsed.planType ?? 'basic-monthly';
  }
  return 'basic-monthly'; // legacy plain-userId passthrough
}

export function isPlus(s: Subscription | null | undefined): boolean {
  return getPlanType(s).includes('plus');
}

export function isBasic(s: Subscription | null | undefined): boolean {
  return getPlanType(s).includes('basic');
}
