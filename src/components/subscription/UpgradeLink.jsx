//__PADDLE_CHECKOUT_URL__ is a placeholder which will be replaced by Webpack
const baseCheckoutUrl = __PADDLE_CHECKOUT_URL__;  //eslint-disable-line

const UpgradeLink = (props) => {
	const upgradeLink = `${baseCheckoutUrl}?passthrough=${props.userId}&guest_email=${props.userEmail}`;
	return <a id="UpgradeLink" href={upgradeLink} target="_blank">Upgrade</a>;
};

export { UpgradeLink };
