//__PADDLE_CHECKOUT_PRODUCT__ is a placeholder which will be replaced by Webpack
const checkoutProduct = __PADDLE_CHECKOUT_PRODUCT__;  //eslint-disable-line

const UpgradeLink = (props) => {
	const checkout = (e) => {
		e.preventDefault();
		props.closeModalHandler();

		Paddle.Checkout.open({
			product: checkoutProduct,
			email: props.userEmail,
			passthrough: props.userId
		});
	};
	return <a id="UpgradeLink" href='#' onClick={checkout}>Upgrade</a>;
};

export { UpgradeLink };
