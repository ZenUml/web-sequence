// Paddle Classic SDK bridge (contract §6.1, REQ-SUB-3). Loads the Classic
// paddle.js once, runs `Paddle.Setup({ vendor: 39343 })` exactly once
// (module-level guard, idempotent across hook mounts), and exposes
// `openCheckout` which resolves the configured product ID for the selected
// plan and opens a checkout carrying the FROZEN `{ userId, planType }`
// passthrough. Paddle stays CLASSIC (vendor 39343) — do NOT switch to
// Billing v2 (contract C-PAY-1).
import { useEffect } from 'react';
import { config as defaultConfig, type AppConfig } from '../config/firebaseConfig';
import type { PlanType } from '../domain/types';

const PADDLE_VENDOR = 39343;
const PADDLE_CDN = 'https://cdn.paddle.com/paddle/paddle.js';

// Plans that can actually be purchased — never 'free' or 'enterprise'.
export type CheckoutPlanType = Exclude<PlanType, 'free' | 'enterprise'>;

// Compile-time-exhaustive map: a wrong field (e.g. plus-monthly → BasicMonthly)
// is a type error, not a runtime surprise.
const PRODUCT_FIELD: Record<CheckoutPlanType, keyof AppConfig> = {
  'basic-monthly': 'paddleProductBasicMonthly',
  'plus-monthly': 'paddleProductPlusMonthly',
  'basic-yearly': 'paddleProductBasicYearly',
  'plus-yearly': 'paddleProductPlusYearly',
};

interface PaddleSDK {
  Setup: (opts: { vendor: number }) => void;
  Checkout: {
    open: (opts: {
      product: string;
      email?: string;
      passthrough: string;
      successCallback?: () => void;
    }) => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleSDK;
  }
}

// Persists across hook mounts within a module instance — that's the point.
let isSetup = false;
let scriptInjected = false;

function setupOnce(): void {
  if (isSetup) return;
  if (typeof window === 'undefined' || !window.Paddle) return;
  window.Paddle.Setup({ vendor: PADDLE_VENDOR });
  isSetup = true;
}

function ensurePaddle(): void {
  if (typeof window === 'undefined') return;
  // Paddle already present (extension bundles /lib/paddle.js — M05 — or a test
  // stub): just run Setup. The protocol guard wraps ONLY the CDN inject; Setup
  // must still run under chrome-extension:.
  if (window.Paddle) {
    setupOnce();
    return;
  }
  // Skip the CDN inject under the extension (M05 ships the bundled copy).
  if (window.location?.protocol === 'chrome-extension:') return;
  if (scriptInjected) return;
  scriptInjected = true;
  const script = document.createElement('script');
  script.src = PADDLE_CDN;
  script.async = true;
  script.onload = () => setupOnce();
  document.head.appendChild(script);
}

export interface OpenCheckoutArgs {
  planType: CheckoutPlanType;
  email?: string;
  userId: string;
  onSuccess?: () => void;
}

export interface UsePaddleResult {
  openCheckout: (args: OpenCheckoutArgs) => void;
}

export function usePaddle(appConfig: AppConfig = defaultConfig): UsePaddleResult {
  useEffect(() => {
    ensurePaddle();
  }, []);

  function openCheckout({ planType, email, userId, onSuccess }: OpenCheckoutArgs): void {
    ensurePaddle();
    if (typeof window === 'undefined' || !window.Paddle) return;
    const product = appConfig[PRODUCT_FIELD[planType]] as string;
    window.Paddle.Checkout.open({
      product,
      email,
      passthrough: JSON.stringify({ userId, planType }),
      successCallback: onSuccess,
    });
  }

  return { openCheckout };
}
