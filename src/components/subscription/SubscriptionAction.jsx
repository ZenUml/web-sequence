import userService from '../../services/user_service';
import { UpgradeLink } from './UpgradeLink';
import { CancellationLink } from './CancellationLink';

const SubscriptionAction = (props) => {
  const user = userService.user();

  if (!user) {
    return null;
  }

  if (userService.isPro()) {
    const subscription = userService.subscription();
    return <CancellationLink cancelUrl={subscription.cancel_url} />;
  }

  return (
    <UpgradeLink
      userId={user.uid}
      userEmail={user.email}
      preActionCallback={props.preActionCallback}
      postActionCallback={props.postActionCallback}
    />
  );
};

export { SubscriptionAction };
