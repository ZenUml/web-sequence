import Modal from './Modal';

export function SupportDeveloperModal({ show, closeHandler }) {
  return (
    <Modal extraClasses="pledge-modal" show={show} closeHandler={closeHandler}>
      <div className="tac">
        <h1>Welcome!</h1>
        <div className="flex" style={{ marginTop: '100px' }}>
          <div className="onboard-step">
            <img src="./animation/10s.gif" alt="Middleman logo" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
