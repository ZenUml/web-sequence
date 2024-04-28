import userService from '../../services/user_service';
import { UpgradeLink } from './UpgradeLink';
import { CancellationLink } from './CancellationLink';
import { DisabledUpgradeLink } from './DisabledUpgradeLink';

const SubscriptionAction = (props) => {
  const user = userService.user();

  if (!user) {
    return null;
  }

  if (userService.isSubscribed()) {
    const subscription = userService.subscription();
    if (props.planType == userService.getPlanType()) {
      return <CancellationLink cancelUrl={subscription.cancel_url} />;
    }
    return <DisabledUpgradeLink upgradeBtnName={props.upgradeBtnName} />;
  }

  if (props.planType == 'free') {
    return <DisabledUpgradeLink upgradeBtnName={props.upgradeBtnName} />;
  }

  return (
    <UpgradeLink
      userId={user.uid}
      userEmail={user.email}
      planType={props.planType}
      upgradeBtnName={props.upgradeBtnName}
      preActionCallback={props.preActionCallback}
      postActionCallback={props.postActionCallback}
    />
  );
};

export { SubscriptionAction };
