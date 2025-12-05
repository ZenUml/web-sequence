import { Component } from 'preact';

class JS13K extends Component {
  constructor(props) {
    super(props);
    const compoDate = new Date('August 13 2018 11:00 GMT');
    var now = new Date();
    var daysLeft;
    if (+compoDate > +now) {
      daysLeft = Math.floor((compoDate - now) / 1000 / 3600 / 24);
    }
  }

  render() {
    const codeSizeInKb = this.props.codeSize
      ? (this.props.codeSize / 1024).toFixed(2)
      : 0;
    return (
      <div
        role="button"
        class="flex flex-v-center"
        tabIndex="0"
        onClick={this.props.onClick}
        onBlur={this.props.onBlur}
      >
        <img src="assets/js13kgames.png" alt="JS13K Games logo" height="24" />{' '}
        <div class="footer__js13k-days-left">
          {this.state.daysLeft} days to go
        </div>
        <div
          class="footer__js13k-code-size"
          style={{
            color: codeSizeInKb > 10 ? 'crimson' : 'limegreen',
          }}
        >
          {codeSizeInKb} KB/ 13KB
        </div>
        <span
          class="caret"
          style={`transition:0.3s ease; transform-origin: center 2px; ${
            this.props.isOpen ? 'transform:rotate(180deg);' : ''
          }`}
        />
      </div>
    );
  }
}

export default class Footer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isKeyboardShortcutsModalOpen: false,
      isJs13kDropdownOpen: false,
    };
  }

  async js13kClickHandler() {
    // console.log(999);
    await this.setState({
      isJs13kDropdownOpen: !this.state.isJs13kDropdownOpen,
    });
  }

  render() {
    return (
      <div
        id="footer"
        class="flex w-full items-center justify-between z-10 bg-black py-2 px-6 text-gray-500 text-xs"
      >
        {window.zenumlDesktop ? (
          <div></div>
        ) : (
          //no footer if it in electron
          <div class="flex items-center gap-4">
            <span class="text-gray-600 text-xs">
              v2.0.0 ({__COMMITHASH__})
            </span>
          </div>
        )}
      </div>
    );
  }
}
