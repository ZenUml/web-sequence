import { Component } from 'react';

export class Alerts extends Component {
  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }

  render() {
    return <div className="alerts-container" id="js-alerts-container" />;
  }
}
