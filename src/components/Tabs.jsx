import React from 'react';
class Tabs extends React.Component {
    constructor() {
      super();
      this.state = {
        data: [
          {content:"ZenUML"},
          {content:"CSS"},
          {content:"About"}
        ],
        index: 0
      }
    }
    render() {
      return (
        <div>
          <button
            className="tab"
            onClick = {() => this.setState({index:0})}
          >
            ZenUML
          </button>
          <button
            className="tab"
            onClick = {() => this.setState({index:1})}>
            CSS
          </button>
          <button
            className="tab"
            onClick = {() => this.setState({index:2})}>
            About
          </button>

          <div className="tabContent">
           {this.state.data[this.state.index].content}
          </div>
        </div>
      );
    }
  }
  export default Tabs;