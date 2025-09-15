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
  };

  render() {
    const {
      onClick,
      props: { activeTab, label, lineOfCode },
    } = this;

    let className =
      'h-8 flex items-center px-10 tab-list-item bg-black-800 font-semibold';

    if (activeTab === label) {
      className += ' border-b border-primary bg-black-500 text-primary-400';
    }
    let loc;
    if (lineOfCode > 0) {
      loc = (
        <span className="line-of-code" title="line of code">
          {lineOfCode}
        </span>
      );
    }

    return (
      <li className={className} onClick={onClick}>
        {label}
      </li>
    );
  }
}

export default Tab;
