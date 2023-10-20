import { Component, createRef } from 'preact';
import PropTypes from 'prop-types';


export class Popover extends Component {
	constructor(props) {
		super(props);
		this.state = {
			isVisible: false,
		};
		this.popoverRef = createRef();
	}

	componentDidMount() {
		// Add a click event listener to the document
		console.log('xxx')
		document.addEventListener('click', this.handleDocumentClick, true);
	}

	componentWillUnmount() {
		// Remove the click event listener when the component unmounts
		console.log('yyy')
		document.removeEventListener('click', this.handleDocumentClick);
	}

	togglePopover = () => {
		this.setState((prevState) => ({
			isVisible: !prevState.isVisible,
		}));
	};

	handleDocumentClick = (event) => {
		console.log('handleDocumentClick', event.target)
		// Check if the click target is outside the popover
		if (this.popoverRef.current && !this.popoverRef.current.contains(event.target)) {
			this.setState({ isVisible: false });
		}
	};


	render() {
		const { trigger, content } = this.props;
		const { isVisible } = this.state;

		return (
			<div className="popover" >
				<div className="popover-trigger" onClick={this.togglePopover}>
					{trigger}
				</div>
				{isVisible && (
					<>
						<div className="popover-backdrop" />
						<div className="popover-content" ref={this.popoverRef}>
							<div className="popover-arrow"></div>
							{content}
						</div>
					</>
				)}
			</div>
		);
	}
}


Popover.propTypes = {
	trigger: PropTypes.node.isRequired,
	content: PropTypes.node.isRequired,
}
