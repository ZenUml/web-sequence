import config from '../../services/configuration'

const UpgradeLink = (props) => {
	const checkout = (e) => {
		e.preventDefault();
		props.preActionCallback();

		Paddle.Checkout.open({
			product: config.paddleProduct,
			email: props.userEmail,
			passthrough: props.userId,
			successCallback: props.postActionCallback
		});
	};
	return <a id="UpgradeLink" href='#' onClick={checkout}>Upgrade</a>;
};

export { UpgradeLink };
