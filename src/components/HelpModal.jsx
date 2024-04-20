import Modal from './Modal';

const commitHash = __COMMITHASH__; //eslint-disable-line

export function HelpModal(props) {
  return (
    <Modal show={props.show} closeHandler={props.closeHandler}>
      <h1>
        <div class="web-maker-with-tag">ZenUML Sequence</div>
        <small style="font-size:14px;"> v2.0.0 ({commitHash})</small>
        <div class="flex">
          <div class="onboard-step">
            <img src="./animation/10s.gif" alt="Middleman logo" />
          </div>
        </div>
        <p>
          Get more help from{' '}
          <a href="https://www.zenuml.com/help.html">ZenUML.com</a>
        </p>
      </h1>
    </Modal>
  );
}
