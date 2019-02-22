import { Component } from 'preact';
import { ProductVersionLabelBasic } from './ProductVersionLabelBasic';

export class ProductVersionLabel extends Component {
	isAnonymous() {
		return !this.props.user;
	}

	render() {
		let view = null;
		if (this.isAnonymous()) {
			view = <ProductVersionLabelBasic tooltips={"Please login to upgrade to Pro"} />;
		} else {
			view = <ProductVersionLabelBasic tooltips={"Please login to upgrade to Pro"} />
			//Todo in_subscription
		}
		return view;
	}
}
