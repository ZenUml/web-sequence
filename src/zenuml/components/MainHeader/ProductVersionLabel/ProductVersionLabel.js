import { Component } from 'preact';
import userService from '../../../../services/user_service';
import { ProductVersionLabelBasic } from './ProductVersionLabelBasic';

export class ProductVersionLabel extends Component {
	isAnonymous() {
		return !this.props.user;
	}

	render() {
		let view = null;

		if (userService.isPro()) {
			view = null;
		} else {
			view = <ProductVersionLabelBasic tooltip={this.getBasicTooltip()} clickHandler={this.props.clickHandler} />
			//Todo in_subscription
		}

		return view;
	}

	getBasicTooltip() {
		return this.isAnonymous() ? 'Please login to upgrade to Pro' : 'Get more out of ZenUML — Go Pro';
	}
}
