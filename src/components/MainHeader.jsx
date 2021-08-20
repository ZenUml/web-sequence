import { h } from 'preact';
import { Button } from './common';
import { ProductVersionLabel } from '../zenuml/components/MainHeader/ProductVersionLabel/ProductVersionLabel';
import featureToggle from '../services/feature_toggle';

const DEFAULT_PROFILE_IMG =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='#ccc' d='M12,19.2C9.5,19.2 7.29,17.92 6,16C6.03,14 10,12.9 12,12.9C14,12.9 17.97,14 18,16C16.71,17.92 14.5,19.2 12,19.2M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z' /%3E%3C/svg%3E";

export function MainHeader(props) {
	return (
		<div className="flex items-center border-b py-2">
			<div class="flex items-center justify-start p-1 bg-white">
				<a href="#_" class="inline-block py-4 md:py-0">
					<svg xmlns="http://www.w3.org/2000/svg" width="50" height="40" viewBox="0 0 800 640"><g id="Layer_2" data-name="Layer 2"><g id="Layer_1-2" data-name="Layer 1"><rect style="fill: #0094d9" y="459.02" width="800" height="51.49" rx="25.75"/><rect style="fill: #0094d9" x="66.69" y="340.02" width="666.61" height="299.98" rx="22.09"/><path style="fill: #fff" d="M176.28,533.52q10.26,12.75,27.6,12.75t27.47-12.75q10.13-12.75,10.12-34.83V397.22h41V500q0,40-22.08,61.38T203.88,582.8q-34.44,0-56.65-21.55T125,500V397.22h41V498.69Q166,520.77,176.28,533.52Z"/><path style="fill: #fff" d="M480.83,465.3,431.15,565.72H406.7L357.28,465.3V581h-41V397.22h55.46l47.32,100.94,47.58-100.94h55.2V581h-41Z" /><path style="fill: #fff" d="M555.64,581V397.22h41v147.2H675V581Z"/><path style="fill: #0094d9" d="M299,260.7h0A17.27,17.27,0,0,1,281.73,278H84A17.28,17.28,0,0,1,66.69,260.7v-1.33a17.26,17.26,0,0,1,3.74-10.73L229,48.68a8.72,8.72,0,0,0-6.83-14.13H85.56A17.28,17.28,0,0,1,68.28,17.27h0A17.28,17.28,0,0,1,85.56,0H275.77A17.27,17.27,0,0,1,293,17.27v.95a17.27,17.27,0,0,1-3.72,10.71L131.06,229.3a8.71,8.71,0,0,0,6.84,14.12H281.73A17.28,17.28,0,0,1,299,260.7Z"/><path style="fill: #0094d9" d="M482.12,234.57h0a16.41,16.41,0,0,1-2,23.23c-18.16,14.76-42.54,22.55-70.81,22.55-67.9,0-113.17-44.87-113.17-107.61,0-62.34,44.47-107.22,105.63-107.22,50.55,0,91.3,31.21,101.31,81.28a21.88,21.88,0,0,1-17.22,25.78L349.14,199.2a8.76,8.76,0,0,0-5.89,13C356,234.44,379.8,247,410.47,247c18.87,0,35.41-4.91,49.09-14.89A16.56,16.56,0,0,1,482.12,234.57ZM343.65,172.72l114.5-21.61a8.66,8.66,0,0,0,6.64-11.38c-9.47-25-32.64-42-63.06-42-37.2,0-64.49,24.94-68.25,63.72-.06.56-.11,1.35-.15,2.27A8.74,8.74,0,0,0,343.65,172.72Z"/><path style="fill: #0094d9" d="M733.31,156.86V258.91A19.06,19.06,0,0,1,714.25,278h0a19.06,19.06,0,0,1-19.06-19.06V161.22c0-41.3-20.65-61.55-56.79-61.55-40.51,0-66.71,24.23-66.71,69.89v89.35A19.06,19.06,0,0,1,552.63,278h0a19.06,19.06,0,0,1-19.06-19.06V85.77a18.27,18.27,0,0,1,18.26-18.26h0A18.27,18.27,0,0,1,570.1,85.77V99.28c15.49-21.45,42.49-33.76,75.84-33.76C697.17,65.52,733.31,94.91,733.31,156.86Z"/></g></g></svg>
				</a>
			</div>
			<input
				type="text"
				id="titleInput"
				title="Click to edit"
				className="appearance-none bg-transparent border-none w-full text-white-700 mr-3 py-1 px-2 leading-tight hover:bg-red-700 focus:ring-2 focus:ring-blue-600"
				value={props.title}
				onBlur={props.titleInputBlurHandler}
			/>
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
					className="btn--dark flex  flex-v-center hint--rounded hint--bottom-left button button-editor-solid"
					aria-label="Start a new creation"
					onClick={props.newBtnHandler}
				>
					<svg
						style="vertical-align:middle;width:14px;height:14px"
						viewBox="0 0 24 24"
					>
						<path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
					</svg>New
				</button>
				<button
					id="saveBtn"
					className={`btn--dark flex  flex-v-center hint--rounded hint--bottom-left  button button-editor-solid ${
						props.isSaving ? 'is-loading' : ''
					} ${props.unsavedEditCount ? 'is-marked' : 0}`}
					aria-label="Save current creation (Ctrl/⌘ + S)"
					onClick={props.saveBtnHandler}
				>
					<svg
						style="vertical-align:middle;width:14px;height:14px"
						viewBox="0 0 24 24"
					>
						<path d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z" />
					</svg>
					<svg className="btn-loader" width="15" height="15" stroke="#fff">
						<use xlinkHref="#loader-icon" />
					</svg>
					Save
				</button>
				<button
					id="openItemsBtn"
					className={`btn--dark flex flex-v-center hint--rounded hint--bottom-left button button-editor-solid ${
						props.isFetchingItems ? 'is-loading' : ''
					}`}
					aria-label="Open a saved creation (Ctrl/⌘ + O)"
					onClick={props.openBtnHandler}
				>
					<svg
						style="width:14px;height:14px;vertical-align:middle;"
						viewBox="0 0 24 24"
					>
						<path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z" />
					</svg>
					<svg className="btn-loader" width="15" height="15" stroke="#fff">
						<use xlinkHref="#loader-icon" />
					</svg>
					Open
				</button>
				<Button
					onClick={props.loginBtnHandler}
					data-event-category="ui"
					data-event-action="loginButtonClick"
					className="hide-on-login btn--dark flex  flex-v-center  hint--rounded  hint--bottom-left button button-editor-solid"
					aria-label="Login/Signup"
				>
					Login/Signup
				</Button>
				<Button
					onClick={props.profileBtnHandler}
					data-event-category="ui"
					data-event-action="headerAvatarClick"
					aria-label="See profile or Logout"
					className="hide-on-logout btn--dark hint--rounded  hint--bottom-left button button-editor-solid"
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
