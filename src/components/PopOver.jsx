import { Component, createRef } from 'preact';
import PropTypes from 'prop-types';

export class Popover extends Component {
	constructor(props) {
		super(props);
		this.state = {
			isVisible: false
		};
		this.popoverRef = createRef();
	}

	componentDidMount() {
		document.addEventListener(
			'click',
			this.handleDocumentClick.bind(this),
			true
		);
	}

	componentWillUnmount() {
		document.removeEventListener('click', this.handleDocumentClick.bind(this));
	}

	togglePopover = () => {
		if (this.props.isVisible !== undefined) {
			this.props.onVisibilityChange &&
			this.props.onVisibilityChange(!this.props.isVisible);
		} else {
			this.setState((prevState) => ({
				isVisible: !prevState.isVisible
			}));
		}
	};

	handleDocumentClick = (event) => {
		if (
			this.popoverRef.current &&
			!this.popoverRef.current.contains(event.target)
		) {
			this.props.onVisibilityChange && this.props.onVisibilityChange(false);
			this.setState({ isVisible: false });
		}
	};

	render() {
		const { trigger, content, closeOnBlur, placement, hasArrow, hasShadow } =
			this.props;
		const isVisible =
			this.props.isVisible !== undefined
				? this.props.isVisible
				: this.state.isVisible;

		return (
			<div className={`popover`}>
				<div className='popover-trigger mb-3' onClick={this.togglePopover}>
					{trigger}
				</div>
				<div style={{ display: isVisible ? 'block' : 'none' }}>
					{closeOnBlur && <div className='popover-backdrop' />}
					<div
						className={`popover-content rounded-lg ${placement}  ${
							hasShadow ? 'shadow' : ''
						}`}
						ref={this.popoverRef}
					>
						{hasArrow && <div className={`popover-arrow`}></div>}
						{content}
					</div>
				</div>
			</div>
		);
	}
}

Popover.propTypes = {
	trigger: PropTypes.node.isRequired,
	content: PropTypes.node.isRequired,
	isVisible: PropTypes.bool,
	onVisibilityChange: PropTypes.func,
	closeOnBlur: PropTypes.bool,
	hasArrow: PropTypes.bool,
	hasShadow: PropTypes.bool,
	placement: PropTypes.oneOf(['top', 'bottom'])
};
