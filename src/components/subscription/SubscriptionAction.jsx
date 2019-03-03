import userService from '../../services/user_service';
import { UpgradeLink } from './UpgradeLink';
import {CancellationLink} from "./CancellationLink";

const SubscriptionAction = () => {
	const user = userService.user();
	if (!user) return null;
	if (userService.isPro()) {
		const subscription = userService.subscription();
		return <CancellationLink cancelUrl={subscription.cancel_url} />;
	}
	return <UpgradeLink userId={user.uid} userEmail={user.email} />;
};

export { SubscriptionAction };

