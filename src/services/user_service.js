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
  isBasic: function () {
    return this.getPlanType().includes('basic');
  },
  isPlus: function () {
    return this.getPlanType().includes('plus');
  },
  isPlusOrAdvanced: function () {
    return this.isPlus();
  },
  getPlanType: function () {
    if (!this.isSubscribed()) return 'free';
    const currentSubscription = subscription();

    // Compatible with previous pro users, before subscription.passthrough only stored userId
    if (typeof currentSubscription.passthrough === 'string') {
      return 'basic-monthly';
    }

    return currentSubscription.passthrough.planType;
  },
};
