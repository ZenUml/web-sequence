import config from './configuration';

const getPlanByType = (planType) => {
  const planMap = {
    free: {
      getMaxItemsCount: () => 3,
      canCustomizeCSS: () => false,
      getProductId: () => '',
      getPlanType: () => 'free',
      isSubscribed: () => false,
    },
    'basic-monthly': {
      getMaxItemsCount: () => 20,
      canCustomizeCSS: () => false,
      getProductId: () => config.paddleProductBasicMonthly,
      getPlanType: () => 'basic-monthly',
      isSubscribed: () => true,
    },
    'plus-monthly': {
      getMaxItemsCount: () => 999999,
      canCustomizeCSS: () => true,
      getProductId: () => config.paddleProductPlusMonthly,
      getPlanType: () => 'plus-monthly',
      isSubscribed: () => true,
    },
    'basic-yearly': {
      getMaxItemsCount: () => 20,
      canCustomizeCSS: () => false,
      getProductId: () => config.paddleProductBasicYearly,
      getPlanType: () => 'basic-yearly',
      isSubscribed: () => true,
    },
    'plus-yearly': {
      getMaxItemsCount: () => 999999,
      canCustomizeCSS: () => true,
      getProductId: () => config.paddleProductPlusYearly,
      getPlanType: () => 'plus-yearly',
      isSubscribed: () => true,
    },
  };

  return planMap[planType] || planMap['free'];
};

const checkPlanTypeFromUserSubscription = (
  isSubscribed,
  getSubscriptionPassthroughFunc,
) => {
  if (!isSubscribed) return 'free';

  try {
    return (
      JSON.parse(getSubscriptionPassthroughFunc())?.planType || 'plus-monthly'
    );
  } catch {
    return 'plus-monthly';
  }
};

export default {
  checkPlanTypeFromUserSubscription: checkPlanTypeFromUserSubscription,
  getPlanByType: getPlanByType,
};
