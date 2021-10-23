import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Tab from './Tab';

class Tabs extends Component {
	static propTypes = {
		children: PropTypes.instanceOf(Array).isRequired,
	}

	constructor(props) {
		super(props);
		this.onInit();
	}

	onInit = () => {
		this.state = {
			activeTab: this.props.children[0].props.label,
		};
	}
	onClickTabItem = (tab) => {
		this.setState({ activeTab: tab });
		this.props.onChange(tab);
	}

	static modifyChildren(child, visible) {
		const className = [child.props.className, visible ? '' : 'hide'].join(' ');

		const props = {
			className
		};

		return React.cloneElement(child, props);
	}
	render() {
		const {
			onClickTabItem,
			props: {
				children,
			},
			state: {
				activeTab,
			}
		} = this;
		return (
			<div className="tabs" style="height:100%">
				<ol className="tab-list editor-nav">
					{children.map((child) => {
						const { label,lineOfCode } = child.props;
						return (
							<Tab
								activeTab={activeTab}
								key={label}
								label={label}
								lineOfCode={lineOfCode}
								onClick={onClickTabItem}
							/>
						);
					})}
				</ol>
				<div className="tab-content" style="height: calc(100% - 45px); overflow-y:auto;-webkit-overflow-scrolling: touch;">
					{
						React.Children.map(children,
							(child) => {
								if (child.props.label !== activeTab) {
									return React.Children.map(child.props.children, c => Tabs.modifyChildren(c, false));
								}
								return child.props.children;
							})
					}
				</div>
			</div>
		);
	}
}

export default Tabs;
