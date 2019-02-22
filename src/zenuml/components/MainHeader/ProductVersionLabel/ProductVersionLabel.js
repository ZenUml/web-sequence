import { Component } from 'preact';
import { ProductVersionLabelBasic } from './ProductVersionLabelBasic';

export class ProductVersionLabel extends Component {
	isAnonymous() {
		return !this.props.user;
	}

	render() {
		let view = null;

		if (this.isPro()) {
			view = null;
		} else {
			view = <ProductVersionLabelBasic tooltip={"Get more out of ZenUML — Go Pro"} />
			//Todo in_subscription
		}

		return view;
	}

	getBasicTooltip() {
		return this.isAnonymous() ? 'Please login to upgrade to Pro' : 'Get more out of ZenUML — Go Pro';
	}

	//Todo: should define how to check pro
	isPro() {
		return false;
	}
}
