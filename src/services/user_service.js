import planService from './planService';
const user = () => window.user;
const subscription = () => user() && user().subscription;

export default {
  user: user,
  subscription: subscription,
  getPlanType: function () {
    const status = subscription()?.status;
    const isSubscribed = status === 'active' || status === 'trialing';
    return planService.checkPlanTypeFromUserSubscription(
      isSubscribed,
      () => subscription().passthrough,
    );
  },
  getPlan: function () {
    return planService.getPlanByType(this.getPlanType());
  },
};
