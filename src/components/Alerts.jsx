import React from 'react';

export class Alerts extends React.Component {
  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }

  render() {
    return <div class="alerts-container" id="js-alerts-container" />;
  }
}
