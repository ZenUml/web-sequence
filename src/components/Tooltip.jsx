import React, { Component } from 'react';

class Tooltip extends Component {
  state = {
    isTooltipVisible: false,
  };

  handleMouseOver = () => {
    this.setState({ isTooltipVisible: true });
  };

  handleMouseOut = () => {
    this.setState({ isTooltipVisible: false });
  };

  render() {
    return (
      <div>
        {this.props.children}
        {this.state.isTooltipVisible && (
          <div className="tooltip">{this.props.children}</div>
        )}
      </div>
    );
  }
}
