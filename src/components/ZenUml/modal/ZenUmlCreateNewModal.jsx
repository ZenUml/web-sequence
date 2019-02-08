import { h, Component } from 'preact';
import { CreateNewModal } from '../../CreateNewModal';
import Modal from '../../Modal';

export class ZenUmlCreateNewModal extends Component {
	isAnonymous() {
		return !this.props.user;
	}

	shouldPromoteToSignUp(){
		return this.isAnonymous() && this.props.savedItems && Object.keys(this.props.savedItems).length >= 3;
	}

	render() {
		let view = null;
		if (this.shouldPromoteToSignUp()) {
			view = this.signUpPromotionModal();
		} else {
			view = this.createNewModal();
		}
		return view;
	}

	signUpPromotionModal() {
		return (<Modal show={this.props.show} closeHandler={this.props.closeHandler} smll>
			Anonymous User:
			<hr />
			Please Login/SignUp to unlock more UMLs.
			<hr />
		</Modal>);
	}

	createNewModal() {
		return (<CreateNewModal
			show={this.props.show}
			closeHandler={this.props.closeHandler}
			onBlankTemplateSelect={this.props.onBlankTemplateSelect}
			onTemplateSelect={this.props.onTemplateSelect}
		        />);
	}
}
