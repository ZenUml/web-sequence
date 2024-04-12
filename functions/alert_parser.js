const alertParsers = {
  subscription_created: (req) => ({
    cancel_url: req.body.cancel_url,
    checkout_id: req.body.checkout_id,
    currency: req.body.currency,
    email: req.body.email,
    event_time: req.body.event_time,
    marketing_consent: req.body.marketing_consent,
    next_bill_date: req.body.next_bill_date,
    passthrough: req.body.passthrough,
    quantity: req.body.quantity,
    status: req.body.status,
    subscription_id: req.body.subscription_id,
    subscription_plan_id: req.body.subscription_plan_id,
    unit_price: req.body.unit_price,
    update_url: req.body.update_url,
  }),
  subscription_cancelled: (req) => ({
    cancellation_effective_date: req.body.cancellation_effective_date,
    checkout_id: req.body.checkout_id,
    currency: req.body.currency,
    email: req.body.email,
    event_time: req.body.event_time,
    marketing_consent: req.body.marketing_consent,
    passthrough: req.body.passthrough,
    quantity: req.body.quantity,
    status: req.body.status,
    subscription_id: req.body.subscription_id,
    subscription_plan_id: req.body.subscription_plan_id,
    unit_price: req.body.unit_price,
    user_id: req.body.user_id,
  }),
};

exports.supports = (req) => alertParsers[req.body.alert_name] != null;

exports.parse = (req) => {
  const alert = req.body.alert_name;
  return alertParsers[alert] && alertParsers[alert](req);
};
