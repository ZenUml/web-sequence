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
        <ol className="h-12 flex justify-start tab-list bg-black-500">
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
        </ol>
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
        <div className="px-6 py-3 bg-black-800 border-t border-black-700 flex justify-end box-border">
          <button
            onClick={this.props.keyboardShortcutsBtnClickHandler}
            className="text-xs h-7 px-2 text-gray-500 bg-black-600 hover:bg-black-400 rounded-lg gap-2 flex items-center duration-200"
          >
            <svg className="w-4 h-4">
              <use xlinkHref="#icon-keyboard" />
            </svg>
            Shortcuts
          </button>
        </div>
      </div>
    );
  }
}

export default Tabs;
