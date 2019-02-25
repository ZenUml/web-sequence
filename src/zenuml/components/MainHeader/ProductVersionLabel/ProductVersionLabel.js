import { Component } from 'preact';
import { ProductVersionLabelBasic } from './ProductVersionLabelBasic';
import { ProductVersionLabelProfessional } from './ProductVersionLabelProfessional';

export class ProductVersionLabel extends Component {
	isAnonymous() {
		return !this.props.user;
	}

	render() {
		let view = null;

		if (this.isPro()) {
			view = <ProductVersionLabelProfessional clickHandler={this.props.clickHandler} />;
		} else {
			view = <ProductVersionLabelBasic tooltip={this.getBasicTooltip()} clickHandler={this.props.clickHandler} />
		}

		return view;
	}

	getBasicTooltip() {
		return this.isAnonymous() ? 'Please login to upgrade to Pro' : 'Get more out of ZenUML — Go Pro';
	}

	//Todo: should define how to check pro
	isPro() {
		return window.user && window.user.subscription;
	}
}
