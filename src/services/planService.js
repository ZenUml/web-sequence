import config from './configuration';

//TODO(refactor): It is necessary to integrate more plan-related logic into this module.

const getProductByPlanType = (planType) => {
  const productMap = {
    'basic-monthly': config.paddleProductBasicMonthly,
    'plus-monthly': config.paddleProductPlusMonthly,
    'basic-yearly': config.paddleProductBasicYearly,
    'plus-yearly': config.paddleProductPlusYearly,
  };

  const product = productMap[planType] || '';
  console.debug('getProductByPlanType', planType, product);
  return product;
};

export default {
  getProductByPlanType: getProductByPlanType,
};
