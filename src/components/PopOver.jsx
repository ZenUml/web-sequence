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
		document.addEventListener('click', this.handleDocumentClick, true);
	}

	componentWillUnmount() {
		console.log('yyy')
		document.removeEventListener('click', this.handleDocumentClick);
	}

	togglePopover = () => {
		this.setState((prevState) => ({
			isVisible: !prevState.isVisible,
		}));
	};

	handleDocumentClick = (event) => {
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
