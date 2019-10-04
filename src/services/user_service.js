const user = () => window.user;
const subscription = () => user() && user().subscription;

export default {
    user: user,
    subscription: subscription,
    isPro: () => subscription() && (subscription().status === 'active' || subscription().status === 'trialing')
};
