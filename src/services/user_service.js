import planService from './planService';
const user = () => window.user;
const subscription = () => user() && user().subscription;

export default {
  user: user,
  subscription: subscription,
  isSubscribed: function () {
    return (
      subscription() &&
      (subscription().status === 'active' ||
        subscription().status === 'trialing')
    );
  },
  getPlanType: function () {
    return planService.checkPlanTypeFromUserSubscription(
      this.isSubscribed(),
      () => subscription().passthrough,
    );
  },
  getPlan: function () {
    return planService.getPlanByType(this.getPlanType());
  },
};
