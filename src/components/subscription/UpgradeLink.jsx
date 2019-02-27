import userService from '../../services/user_service';

//__PADDLE_CHECKOUT_URL__ is a placeholder which will be replaced by Webpack
const baseCheckoutUrl = __PADDLE_CHECKOUT_URL__;  //eslint-disable-line

const UpgradeLink = ({ user }) => {
	if (!user) return null;

	if (!userService.isPro()) {
		const upgradeLink = `${baseCheckoutUrl}?passthrough=${user.uid}&guest_email=${user.email}`;
		return <a id='UpgradeLink' href={upgradeLink} target='_blank'>Upgrade</a>;
	}
};

export { UpgradeLink };