import userService from '../../services/user_service';
import { UpgradeLink } from './UpgradeLink';
import {CancellationLink} from "./CancellationLink";
import {Button} from "../common";

const SubscriptionAction = (props) => {
	const user = userService.user();
	if (!user) return <Button
		onClick={props.loginCallback}
		data-event-category="ui"
		data-event-action="loginButtonClick"
		className="hide-on-login btn--dark flex  flex-v-center  hint--rounded  hint--bottom-left button button-editor-solid"
		aria-label="Login/Signup"
	>
		Login/Signup
	</Button>;
	if (userService.isPro()) {
		const subscription = userService.subscription();
		return <CancellationLink cancelUrl={subscription.cancel_url} />;
	}
	return <UpgradeLink userId={user.uid} userEmail={user.email}
		preActionCallback={props.preActionCallback} postActionCallback={props.postActionCallback} />;
};

export { SubscriptionAction };

