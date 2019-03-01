import userService from '../../services/user_service';
import { UpgradeLink } from './UpgradeLink';

const UserSubscription = () => {
	if (!userService.user()) return null;

	if (userService.isPro()) {
		return <a href={userService.subscription().cancel_url} target='_blank'>Cancel subscription</a>;
	} else {
        return <UpgradeLink/>;
    }
};

export { UserSubscription };