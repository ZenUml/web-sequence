const user = () => window.user;
const subscription = () => user() && user().subscription;

export default {
  user: user,
  subscription: subscription,
  isSubscribed: function () {
    console.debug('Feng subscription', subscription());
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
    return getPlanTypeFromPassthrough(currentSubscription.passthrough);
  },
};

// Compatible with previous pro users, before subscription.passthrough only stored userId
function getPlanTypeFromPassthrough(passthrough) {
  return isJSONString(passthrough)
    ? JSON.parse(passthrough).planType
    : 'basic-monthly';
}

function isJSONString(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}
