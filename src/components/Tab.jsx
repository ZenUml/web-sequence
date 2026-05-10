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
      props: { activeTab, label, lineOfCode, locked },
    } = this;

    let className =
      'h-8 flex items-center justify-center px-6 gap-1.5 tab-list-item bg-black-800 font-semibold transition-colors text-gray-400 hover:text-gray-200 hover:bg-black-700 cursor-pointer';

    if (activeTab === label) {
      className += ' border-b-2 border-primary bg-black-500 text-primary-400 font-bold';
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
      <li
        className={className}
        onClick={onClick}
        title={locked ? `${label} — sign in required` : label}
      >
        {label}
        {loc}
        {locked && (
          <span
            className="material-symbols-outlined text-xs opacity-60 leading-none"
            aria-label="sign in required"
          >
            lock
          </span>
        )}
      </li>
    );
  }
}

export default Tab;
