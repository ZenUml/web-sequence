import config from './configuration';

//TODO(refactor): It is necessary to integrate more plan-related logic into this module.

const IPlan = {
  getMaxItemsCount: () => {},
  canCustomizeCSS: () => {},
  getProductId: () => {},
  getPlanType: () => {},
};

const getPlanByType = (planType) => {
  const planMap = {
    free: {
      getMaxItemsCount: () => 3,
      canCustomizeCSS: () => false,
      getProductId: () => '',
      getPlanType: () => 'free',
    },
    'basic-monthly': {
      getMaxItemsCount: () => 20,
      canCustomizeCSS: () => false,
      getProductId: () => config.paddleProductBasicMonthly,
      getPlanType: () => 'basic-monthly',
    },
    'plus-monthly': {
      getMaxItemsCount: () => 999999,
      canCustomizeCSS: () => true,
      getProductId: () => config.paddleProductPlusMonthly,
      getPlanType: () => 'plus-monthly',
    },
    'basic-yearly': {
      getMaxItemsCount: () => 20,
      canCustomizeCSS: () => false,
      getProductId: () => config.paddleProductBasicYearly,
      getPlanType: () => 'basic-yearly',
    },
    'plus-yearly': {
      getMaxItemsCount: () => 999999,
      canCustomizeCSS: () => true,
      getProductId: () => config.paddleProductPlusYearly,
      getPlanType: () => 'plus-yearly',
    },
  };

  return planMap[planType] || planMap['free'];
};
export default {
  getPlanByType: getPlanByType,
};
