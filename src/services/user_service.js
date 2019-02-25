const subscription = () => window.user && window.user.subscription;

export default {
    subscription: subscription,
    isPro: () => subscription() && subscription().status === 'active'
};