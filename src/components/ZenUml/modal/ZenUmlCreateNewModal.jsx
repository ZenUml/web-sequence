import { h, Component } from 'preact';
import { CreateNewModal } from '../../CreateNewModal';

export class ZenUmlCreateNewModal extends Component {
	async componentWillReceiveProps() {
		console.log("receive props");
	}
	async componentWillUpdate() {
		console.log("update");
		console.log("saved",this.props.app.state.savedItems);
	}

	render() {

		return (<CreateNewModal
			show={this.props.show}
			closeHandler={this.props.closeHandler}
			onBlankTemplateSelect={this.props.onBlankTemplateSelect}
			onTemplateSelect={this.props.onTemplateSelect}
		        />);
	}
}
