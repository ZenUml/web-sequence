import Modal from './Modal.jsx';

export function OnboardingModal(props) {
  return (
    <Modal show={props.show} closeHandler={props.closeHandler}>
      <div class="tac">
        <h1 style="margin-top:20px">Welcome to ZenUML Sequence</h1>
      </div>
      <div class="onboard-step">
        <img src="./animation/10s.gif" alt="ZenUML animation" />
      </div>
    </Modal>
  );
}
