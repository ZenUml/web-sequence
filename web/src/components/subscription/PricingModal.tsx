import { Dialog, DialogContent, Button, cn } from '../../ui';
import type { PlanType } from '../../domain/types';

// REQ-SUB-1/7: the four-tier pricing surface. Presentational only — the parent
// owns the billing period (controlled via `billingPeriod`/`onPeriodChange`) and
// the upgrade/checkout side effects (`onUpgrade`, `onContactEnterprise`).
//
// Tier copy, prices, and savings figures are ported from the legacy modal
// (src/components/subscription/PricingModal.jsx) — do NOT invent pricing.
export type BillingPeriod = 'monthly' | 'yearly';

export interface PricingModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  currentPlanType: PlanType;
  billingPeriod: BillingPeriod;
  onPeriodChange(period: BillingPeriod): void;
  // Receives the composed paid planType, e.g. 'basic-yearly' | 'plus-monthly'.
  onUpgrade(planType: PlanType): void;
  onContactEnterprise(): void;
}

// The tier "family" a planType belongs to — used to mark the current tier
// regardless of the billing period the user picked (a basic-yearly subscriber's
// current tier is Basic even when the toggle shows monthly prices).
type TierKey = 'free' | 'basic' | 'plus' | 'enterprise';

function tierOf(planType: PlanType): TierKey {
  if (planType.startsWith('basic')) return 'basic';
  if (planType.startsWith('plus')) return 'plus';
  if (planType === 'enterprise') return 'enterprise';
  return 'free';
}

interface TierSpec {
  key: TierKey;
  name: string;
  // Price strings keyed by period; Free/Enterprise ignore the toggle.
  price: { monthly: string; yearly: string };
  priceTerm?: string;
  priceNote: { monthly: string; yearly: string };
  // Yearly-only savings copy (empty on monthly).
  savings: string;
  includeDesc?: string;
  features: string[];
}

const TIERS: TierSpec[] = [
  {
    key: 'free',
    name: 'Starter',
    price: { monthly: 'Free', yearly: 'Free' },
    priceNote: { monthly: 'Free for everyone', yearly: 'Free for everyone' },
    savings: '',
    features: [
      'Real time sequence diagram editor',
      'Export diagrams to PNG',
      'Sharable online diagrams',
      'Up to 3 saved diagram files',
    ],
  },
  {
    key: 'basic',
    name: 'Basic',
    price: { monthly: '$4.99', yearly: '$0.83' },
    priceTerm: '/month',
    priceNote: { monthly: ' ', yearly: 'Billed yearly' },
    savings: 'Save 49.92 USD',
    includeDesc: 'All features from Free Tier',
    features: ['Up to 20 saved diagram files'],
  },
  {
    key: 'plus',
    name: 'Plus',
    price: { monthly: '$7.99', yearly: '$1.25' },
    priceTerm: '/month',
    priceNote: { monthly: ' ', yearly: 'Billed yearly' },
    savings: 'Save 80.88 USD',
    includeDesc: 'All features from Basic Tier',
    features: [
      'Unlimited diagram files',
      'Customized CSS',
      'Premium support from our experts to design your unique diagram style',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: { monthly: 'Custom', yearly: 'Custom' },
    priceNote: { monthly: ' ', yearly: ' ' },
    savings: '',
    includeDesc: 'All features from Plus Tier',
    features: ['Host data on your own domains and branding', 'More...'],
  },
];

export function PricingModal({
  open,
  onOpenChange,
  currentPlanType,
  billingPeriod,
  onPeriodChange,
  onUpgrade,
  onContactEnterprise,
}: PricingModalProps) {
  const currentTier = tierOf(currentPlanType);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Choose your plan"
        description="The price is in $USD. Viewers are always free."
        className="w-[min(940px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto"
      >
        <div data-testid="pricing-modal">
          {/* Monthly / yearly toggle */}
          <div className="mb-5 inline-flex items-center gap-0.5 rounded-md bg-ink-900 p-0.5">
            <button
              type="button"
              data-testid="pricing-period-monthly"
              aria-pressed={billingPeriod === 'monthly'}
              onClick={() => onPeriodChange('monthly')}
              className={cn(
                'rounded px-4 py-1.5 text-[12px] font-medium transition-colors ring-draft',
                billingPeriod === 'monthly'
                  ? 'bg-ink-700 text-ondark-strong shadow-sm'
                  : 'text-ondark-muted hover:text-ondark-strong',
              )}
            >
              Billed monthly
            </button>
            <button
              type="button"
              data-testid="pricing-period-yearly"
              aria-pressed={billingPeriod === 'yearly'}
              onClick={() => onPeriodChange('yearly')}
              className={cn(
                'rounded px-4 py-1.5 text-[12px] font-medium transition-colors ring-draft',
                billingPeriod === 'yearly'
                  ? 'bg-ink-700 text-ondark-strong shadow-sm'
                  : 'text-ondark-muted hover:text-ondark-strong',
              )}
            >
              Billed yearly{' '}
              <span className="text-signal-amberStrong">(Save up to 83%)</span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TIERS.map((tier) => {
              const isCurrent = tier.key === currentTier;
              const composedPlan = (
                tier.key === 'enterprise' || tier.key === 'free'
                  ? tier.key
                  : `${tier.key}-${billingPeriod}`
              ) as PlanType;
              return (
                <div
                  key={tier.key}
                  className={cn(
                    'flex flex-col rounded-lg border border-ink-line bg-ink-700 p-4',
                    tier.key === 'plus' && 'border-accent/40 ring-1 ring-accent/20',
                  )}
                >
                  <h3 className="font-serif text-[18px] text-ondark-strong">
                    {tier.name}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    {/* §05: on yearly, prove the discount AT the price — show the
                        struck monthly-equivalent before the discounted per-month price
                        (only for paid tiers that actually differ; Free/Custom skip). */}
                    {billingPeriod === 'yearly' &&
                      tier.price.monthly.startsWith('$') &&
                      tier.price.monthly !== tier.price.yearly && (
                        <span
                          data-testid={`pricing-struck-${tier.key}`}
                          // ondark-muted (not faint): the struck "was" price is
                          // load-bearing (it proves the discount), so it must clear AA
                          // on paper. The line-through + smaller size de-emphasize it.
                          className="font-serif text-[15px] text-ondark-muted line-through"
                        >
                          {tier.price.monthly}
                        </span>
                      )}
                    <span className="font-serif text-[24px] text-ondark-strong">
                      {tier.price[billingPeriod]}
                    </span>
                    {tier.priceTerm && (
                      <span className="text-[12px] text-ondark-muted">
                        {tier.priceTerm}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 min-h-[16px] text-[11px] text-ondark-muted">
                    {tier.priceNote[billingPeriod]}
                  </p>
                  {billingPeriod === 'yearly' && tier.savings && (
                    <p className="text-[11px] font-medium text-signal-amberStrong">
                      {tier.savings}
                    </p>
                  )}

                  {tier.includeDesc && (
                    <p className="mt-3 text-[12px] font-medium text-ondark-muted">
                      {tier.includeDesc}
                    </p>
                  )}
                  <ul className="mt-2 flex-1 space-y-1.5">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex gap-1.5 text-[12px] text-ondark-strong"
                      >
                        <span aria-hidden className="text-accent">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4">
                    {isCurrent ? (
                      <p
                        data-testid={`pricing-current-${tier.key}`}
                        className="font-mono text-[11px] uppercase tracking-[0.1em] text-ondark-muted"
                      >
                        Current plan
                      </p>
                    ) : tier.key === 'free' ? (
                      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ondark-muted">
                        Included
                      </p>
                    ) : tier.key === 'enterprise' ? (
                      <Button
                        variant="subtle"
                        surface="dark"
                        className="w-full"
                        data-testid="pricing-enterprise"
                        onClick={onContactEnterprise}
                      >
                        Contact us
                      </Button>
                    ) : (
                      <Button
                        variant={tier.key === 'plus' ? 'primary' : 'subtle'}
                        surface="dark"
                        className="w-full"
                        data-testid={`pricing-upgrade-${tier.key}`}
                        onClick={() => onUpgrade(composedPlan)}
                      >
                        Upgrade to {tier.name}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
