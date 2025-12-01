import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Tab from './Tab';

class Tabs extends Component {
  static propTypes = {
    children: PropTypes.instanceOf(Array).isRequired,
  };

  constructor(props) {
    super(props);
    this.onInit();
  }

  onInit = () => {
    this.state = {
      activeTab: this.props.children[0].props.label,
    };
  };
  onClickTabItem = async (tab) => {
    const child = this.props.children.find((c) => c.props.label === tab);
    if (child && child.props.onBeforeActiviation) {
      const result = child.props.onBeforeActiviation();
      if (!result) {
        return;
      }
    }

    await this.setState({ activeTab: tab });
    this.props.onChange(tab);
  };

  static modifyChildren(child, visible) {
    const className = [child.props.className, visible ? '' : 'hide'].join(' ');

    const props = {
      className,
    };

    return React.cloneElement(child, props);
  }

  render() {
    const {
      onClickTabItem,
      props: { children },
      state: { activeTab },
    } = this;
    return (
      <div className="h-full flex flex-col">
        <div className="h-8 flex justify-between items-center bg-black-500">
          <div className="flex justify-start tab-list">
            {children.map((child) => {
              const { label, lineOfCode } = child.props;
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
          </div>
        </div>
        <div className="grow overflow-y-auto">
          {React.Children.map(children, (child) => {
            if (child.props.label !== activeTab) {
              return React.Children.map(child.props.children, (c) =>
                Tabs.modifyChildren(c, false),
              );
            }
            return child.props.children;
          })}
        </div>
      </div>
    );
  }
}

export default Tabs;
