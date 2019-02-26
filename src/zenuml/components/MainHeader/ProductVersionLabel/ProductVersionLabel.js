import { Component } from 'preact';
import userService from '../../../../services/user_service';
import { ProductVersionLabelBasic } from './ProductVersionLabelBasic';
import { ProductVersionLabelProfessional } from './ProductVersionLabelProfessional';

export class ProductVersionLabel extends Component {
	isAnonymous() {
		return !this.props.user;
	}

	render() {
		let view = null;

		if (userService.isPro()) {
			view = <ProductVersionLabelProfessional clickHandler={this.props.clickHandler} />;
		} else {
			view = <ProductVersionLabelBasic tooltip={this.getBasicTooltip()} clickHandler={this.props.clickHandler} />
		}

		return view;
	}

	getBasicTooltip() {
		return this.isAnonymous() ? 'Please login to upgrade to Pro' : 'Get more out of ZenUML — Go Pro';
	}
}
