import { h } from 'preact';
import Modal from './Modal';
import { ItemTile } from './ItemTile';
import templates from '../templateList';

export function CreateNewModal({
	show,
	closeHandler,
	onBlankTemplateSelect,
	onTemplateSelect
}) {
	return (
		<Modal show={show} closeHandler={closeHandler} smll>
			<div class="tac">
				<button className="btn" onClick={onBlankTemplateSelect}>
					Start a blank creation
				</button>
			</div>
			<hr />
			Or choose from a template:
			<div class="create-new-pane__container">
				{templates.map(template => (
					<ItemTile
						inline
						item={template}
						focusable
						onClick={onTemplateSelect.bind(null, template)}
					/>
				))}
			</div>
			<hr />
			The development team needs your help. If you are actively using ZenUML,
			please tweet about ZenUML at least once a month!
		</Modal>
	);
}
