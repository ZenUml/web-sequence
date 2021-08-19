import React, { Component } from 'react';
import PropTypes from 'prop-types';

class Tab extends Component {
	static propTypes = {
		activeTab: PropTypes.string.isRequired,
		label: PropTypes.string.isRequired,
		onClick: PropTypes.func.isRequired,
	};

	onClick = () => {
		const { label, onClick } = this.props;
		onClick(label);
	}

	render() {
		const {
			onClick,
			props: {
				activeTab,
				label,
				lineOfCode
			},
		} = this;

		let className = 'tab-list-item';

		if (activeTab === label) {
			className += ' tab-list-active';
		}
		let loc;
		if (lineOfCode > 0) {
			loc = <span className="line-of-code p-2" title="line of code">{lineOfCode}</span>;
		}

		return (
			<li
				className={className}
				onClick={onClick}
			>{label} {loc}</li>
		);
	}
}

export default Tab;
