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
	return <a className='block rounded-lg w-full py-2 px-3 bg-primary text-sm text-gray-100 hover:no-underline' id="UpgradeLink" href='#' onClick={checkout}>Upgrade now</a>;
};

export { UpgradeLink };
