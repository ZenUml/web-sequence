import { h } from 'preact';
import { useState } from 'preact/hooks'
import { Button } from './common';
import { ProductVersionLabel } from '../zenuml/components/MainHeader/ProductVersionLabel/ProductVersionLabel';
import featureToggle from '../services/feature_toggle';

const DEFAULT_PROFILE_IMG =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='#ccc' d='M12,19.2C9.5,19.2 7.29,17.92 6,16C6.03,14 10,12.9 12,12.9C14,12.9 17.97,14 18,16C16.71,17.92 14.5,19.2 12,19.2M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z' /%3E%3C/svg%3E";

export function MainHeader(props) {
	const [isEditing, setEditing] = useState(false);

	const entryEditing = () => {
		setEditing(true);
	}

	const exitEditing = () => {
		setEditing(false);
	}

	const onBlur = (e) => {
		exitEditing();
		props.titleInputBlurHandler(e);
	}

	return (
		<div className="main-header">
			<div className="header-logo">
				<img src="assets/logo-400x400.png" alt="zenuml logo" />
			</div>
			{
				isEditing ? (<input
				autoFocus
				type="text"
				id="titleInput"
				title="Click to edit"
				className="item-title-input"
				value={props.title}
				onBlur={onBlur}
			/>) :  (<div className="title" onClick={() => entryEditing()}>
								<span>{props.title || 'Untitled'} </span>
								<span class="material-symbols-outlined">border_color</span>
						</div>)
			}
			<div className="main-header__btn-wrap  flex  flex-v-center">
				<button
					id="runBtn"
					className="hide btn--dark flex flex-v-center hint--rounded hint--bottom-left"
					aria-label="Support ZenUML as an Open source project on Github"
					onClick={props.runBtnClickHandler}
				>
					{/*<iframe src="https://github.com/sponsors/ZenUml/button" title="Sponsor ZenUml" height="35" width="107" style="border: 0;" />*/}
				</button>

				<Button
					onClick={props.addLibraryBtnHandler}
					data-event-category="ui"
					data-event-action="addLibraryButtonClick"
					className="btn--dark flex-v-center hint--rounded hint--bottom-left"
					style="display: none"
					aria-label="Add a JS/CSS library"
				>
					Add library{' '}
					<span
						id="js-external-lib-count"
						style={`display:${props.externalLibCount ? 'inline' : 'none'}`}
						class="count-label"
					>
						{props.externalLibCount}
					</span>
				</Button>
				<button
					className="btn--dark flex  flex-v-center hint--rounded hint--bottom-left button icon-button button-editor-solid"
					aria-label="Start a new creation"
					onClick={props.newBtnHandler}
				>
					<span class="material-symbols-outlined">add</span>
					<span>New</span>
				</button>
				<button
					id="saveBtn"
					className={`btn--dark flex  flex-v-center hint--rounded hint--bottom-left button icon-button button-editor-solid ${
						props.isSaving ? 'is-loading' : ''
					} ${props.unsavedEditCount ? 'is-marked' : 0}`}
					aria-label="Save current creation (Ctrl/⌘ + S)"
					onClick={props.saveBtnHandler}
				>
					<span class="material-symbols-outlined">save</span>
					<span>Save</span>
				</button>
				<button
					id="openItemsBtn"
					className={`btn--dark flex flex-v-center hint--rounded hint--bottom-left button icon-button button-editor-solid ${
						props.isFetchingItems ? 'is-loading' : ''
					}`}
					aria-label="Open a saved creation (Ctrl/⌘ + O)"
					onClick={props.openBtnHandler}
				>
					<span class="material-symbols-outlined">open_in_new</span>
					<span>Open</span>
				</button>
				<Button
					onClick={props.loginBtnHandler}
					data-event-category="ui"
					data-event-action="loginButtonClick"
					className="hide-on-login btn--dark flex  flex-v-center  hint--rounded  hint--bottom-left button icon-button button-editor-solid"
					aria-label="Signin"
				>
					<span class="material-symbols-outlined">login</span>Sign in
				</Button>
				<Button
					onClick={props.profileBtnHandler}
					data-event-category="ui"
					data-event-action="headerAvatarClick"
					aria-label="See profile or Logout"
					className="hide-on-logout btn--dark hint--rounded hint--bottom-left button button-editor-solid"
				>
					<img
						id="headerAvatarImg"
						width="20"
						src={props.user ? props.user.photoURL || DEFAULT_PROFILE_IMG : ''}
						className="main-header__avatar-img"
					/>
				</Button>
				{ featureToggle.isPaymentEnabled ? (
					<ProductVersionLabel user={props.user} clickHandler={props.proBtnHandler} />
					) : null }
			</div>
		</div>
	);
}
