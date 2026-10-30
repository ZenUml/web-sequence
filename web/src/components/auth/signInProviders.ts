import type { ProviderName } from '../../services/types';

// Providers the sign-in UI offers. The backend still knows facebook/twitter
// (ProviderName, services/firebase); only the UI entry points are retired.
export const SIGN_IN_PROVIDERS = ['google', 'github'] as const;
export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number];

export const PROVIDER_LABEL: Record<SignInProvider, string> = { google: 'Google', github: 'GitHub' };

export function toSignInProvider(value: unknown): SignInProvider | null {
  if (typeof value !== 'string') return null;
  const v = value.toLowerCase();
  return (SIGN_IN_PROVIDERS as readonly string[]).includes(v) ? (v as SignInProvider) : null;
}

function otherProviderLabel(provider: ProviderName): string {
  return provider === 'github' ? PROVIDER_LABEL.google : PROVIDER_LABEL.github;
}

function providerLabel(provider: ProviderName): string {
  return toSignInProvider(provider) ? PROVIDER_LABEL[provider as SignInProvider] : provider;
}

// Inline, actionable copy for a failed attempt. Always names a next step: retry
// the same provider or use the other one.
export function describeLoginFailure(provider: ProviderName, code: string | undefined): string {
  const name = providerLabel(provider);
  const other = otherProviderLabel(provider);
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return `The ${name} window was closed before sign-in finished. Try again or use ${other}.`;
    case 'auth/popup-blocked':
      return `Your browser blocked the ${name} window. Allow pop-ups for this site, then try again.`;
    case 'auth/account-exists-with-different-credential':
      return `This email already uses a different sign-in method. Try ${other}.`;
    case 'auth/network-request-failed':
      return `Couldn't reach ${name}. Check your connection, then try again or use ${other}.`;
    default:
      return `Couldn't sign in. Try again or use ${other}.`;
  }
}
