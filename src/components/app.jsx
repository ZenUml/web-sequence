/* global htmlCodeEl, cssCodeEl, jsCodeEl, runBtn
 */

import { h, Component } from 'preact';
import { MainHeader } from './MainHeader.jsx';
import ContentWrap from './ContentWrap.jsx';
import Footer from './Footer.jsx';
import SavedItemPane from './SavedItemPane.jsx';
import AddLibrary from './AddLibrary.jsx';
import Modal from './Modal.jsx';
import Login from './Login.jsx';
import { computeHtml, computeCss, computeJs } from '../computes';
import {
	log,
	generateRandomId,
	semverCompare,
	saveAsHtml,
	handleDownloadsPermission,
	downloadFile,
	getCompleteHtml,
	getFilenameFromUrl,
	blobToBase64,
} from '../utils';
import { itemService } from '../itemService';
import '../db';
import { Notifications } from './Notifications';
import Settings from './Settings.jsx';
import { modes, HtmlModes, CssModes, JsModes } from '../codeModes';
import { trackEvent, trackGaSetField, trackPageView } from '../analytics';
import { deferred } from '../deferred';
import { alertsService } from '../notifications';
import firebase from 'firebase/app';
import 'firebase/auth';
import { Profile } from './Profile';
import { auth } from '../auth';
import { SupportDeveloperModal } from './SupportDeveloperModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { takeScreenshot } from '../takeScreenshot';
import { AskToImportModal } from './AskToImportModal';
import { Alerts } from './Alerts';
import { HelpModal } from './HelpModal';
import { ProFeatureListModal } from './subscription/ProFeatureListModal';
import { Js13KModal } from './Js13KModal';
import { CreateNewModal } from './CreateNewModal';
import { Icons } from './Icons';
import JSZip from 'jszip';
import { loadSubscriptionToApp } from '../javascript/firebase/subscription';
import { currentBrowserTab } from '../services/browserService';
import { syncDiagram, getShareLink } from '../services/syncService';

if (module.hot) {
	require('preact/debug');
}

const LocalStorageKeys = {
	LOGIN_AND_SAVE_MESSAGE_SEEN: 'loginAndsaveMessageSeen',
	ASKED_TO_IMPORT_CREATIONS: 'askedToImportCreations',
};
const UNSAVED_WARNING_COUNT = 15;
const version = '3.6.1';

export default class App extends Component {
	constructor() {
		super();
		this.AUTO_SAVE_INTERVAL = 15000; // 15 seconds
		this.modalDefaultStates = {
			isModalOpen: false,
			isAddLibraryModalOpen: false,
			isSettingsModalOpen: false,
			isHelpModalOpen: false,
			isProFeatureListModalOpen: false,
			isNotificationsModalOpen: false,
			isLoginModalOpen: false,
			isProfileModalOpen: false,
			isSupportDeveloperModalOpen: false,
			isKeyboardShortcutsModalOpen: false,
			isAskToImportModalOpen: false,
			isOnboardModalOpen: false,
			isJs13KModalOpen: false,
			isCreateNewModalOpen: false,
		};
		this.state = {
			isSavedItemPaneOpen: false,
			...this.modalDefaultStates,
			prefs: {},
			currentItem: {
				title: '',
				externalLibs: { js: '', css: '' },
			},
		};
		this.defaultSettings = {
			preserveLastCode: true,
			replaceNewTab: false,
			htmlMode: 'html',
			jsMode: 'js',
			cssMode: 'css',
			isCodeBlastOn: false,
			indentWith: 'spaces',
			indentSize: 2,
			editorTheme: 'monokai',
			keymap: 'sublime',
			fontSize: 16,
			refreshOnResize: false,
			autoPreview: true,
			editorFont: 'FiraCode',
			editorCustomFont: '',
			autoSave: true,
			autoComplete: true,
			preserveConsoleLogs: true,
			lightVersion: false,
			lineWrap: true,
			infiniteLoopTimeout: 1000,
			layoutMode: 2,
			isJs13kModeOn: false,
			autoCloseTags: true,
		};
		this.prefs = {};
		if (window.zenumlDesktop) {
			// hack savedItems, so we can load them on the desktop, without this object, the log in saveBtnClickHandler will not work.
			this.state.savedItems = {};
			// hack rename function
			window.zd_nameChangedHandler = this.titleInputBlurHandler.bind(this);
			window.zd_openBtnHandler = this.openBtnClickHandler.bind(this);
			window.zd_newBtnHandler = this.newBtnClickHandler.bind(this);
			window.zd_saveBtnHandler = this.saveBtnClickHandler.bind(this);
			window.zd_loginBtnHandler = this.loginBtnClickHandler.bind(this);
			window.zd_proBtHandler = this.proBtnClickHandler.bind(this);
			window.zd_profileBtHandler = this.profileBtnClickHandler.bind(this);
			// window.zd_libraryBtHander = this.openAddLibrary.bind(this)
		}
		firebase.auth().onAuthStateChanged(async (user) => {
			await this.setState({ isLoginModalOpen: false });
			if (user) {
				log('You are -> ', user);
				alertsService.add('You are now logged in!');
				await this.setState({ user });
				window.user = user;
				if (!window.localStorage[LocalStorageKeys.ASKED_TO_IMPORT_CREATIONS]) {
					this.fetchItems(false, true).then(async (items) => {
						if (!items.length) {
							return;
						}
						this.oldSavedItems = items;
						this.oldSavedCreationsCount = items.length;
						await this.setState({
							isAskToImportModalOpen: true,
						});
						trackEvent('ui', 'askToImportModalSeen');
					});
				}
				window.db.getUser(user.uid).then(async (customUser) => {
					if (customUser) {
						const prefs = { ...this.state.prefs };
						Object.assign(prefs, user.settings);
						await this.setState({ prefs: prefs });
						await this.updateSetting();
					}

					if (this.onUserItemsResolved) {
						this.onUserItemsResolved(user.items);
					}
				});

				//load subscription from firestore
				this.loadUserSubscription();
			} else {
				// User is signed out.
				await this.setState({ user: undefined });
				delete window.user;

				if (this.onUserItemsResolved) {
					this.onUserItemsResolved(null);
				}
			}
			this.updateProfileUi();
		});
	}
	componentWillMount() {
		var lastCode;
		window.onunload = () => {
			this.saveCode('code');
			if (this.detachedWindow) {
				this.detachedWindow.close();
			}
		};

		db.local.get(
			{
				layoutMode: 1,
				code: '',
			},
			(result) => {
				this.toggleLayout(result.layoutMode);
				this.state.prefs.layoutMode = result.layoutMode;
				if (result.code) {
					lastCode = result.code;
				}
			}
		);
		// Get synced `preserveLastCode` setting to get back last code (or not).
		db.getSettings(this.defaultSettings).then(async (result) => {
			const getQueryParameter = (key) => {
				let search = window.location.search;
				if (search.length < 1) return;

				let query = search.substr(1);
				let array = query.split('&');
				for (let i = 0; i < array.length; i++) {
					let pair = array[i].split('=');
					if (pair[0] === key) {
						return decodeURIComponent(pair[1]);
					}
				}
			};

			//If query parameter 'itemId' presents
			let itemId = getQueryParameter('itemId');
			if (window.zenumlDesktop) {
				itemId = await itemService.getCurrentItemId();
			}
			if (itemId) {
				itemService.getItem(itemId).then(
					(item) => {
						if (item) {
							const resolveCurrentItem = (items) => {
								if ((items && items[item.id]) || window.zenumlDesktop) {
									this.setCurrentItem(item).then(() => this.refreshEditor());
								} else {
									this.forkItem(item);
								}
							};
							if (this.state.user && this.state.user.items) {
								resolveCurrentItem(user.items);
							} else {
								this.onUserItemsResolved = resolveCurrentItem;
							}
						} else {
							//Invalid itemId
							if (window.zenumlDesktop) {
								this.createNewItem();
							} else {
								window.location.href = '/';
							}
						}
					},
					(error) => {
						//Insufficient permission
						if (window.zenumlDesktop) {
							this.createNewItem();
						} else {
							window.location.href = '/';
						}
					}
				);
			} else if (result.preserveLastCode && lastCode && lastCode.js) {
				await this.setState({ unsavedEditCount: 0 });

				// For web app environment we don't fetch item from localStorage,
				// because the item isn't stored in the localStorage.
				if (lastCode.id && window.IS_EXTENSION) {
					db.local.get(lastCode.id, (itemResult) => {
						if (itemResult[lastCode.id]) {
							log('Load item ', lastCode.id);
							this.setCurrentItem(itemResult[lastCode.id]).then(() =>
								this.refreshEditor()
							);
						}
					});
				} else {
					log('Load last unsaved item', lastCode);
					this.setCurrentItem(lastCode).then(() => this.refreshEditor());
				}
			} else {
				this.createNewItem();
			}
			Object.assign(this.state.prefs, result);
			await this.setState({ prefs: this.state.prefs });
			await this.updateSetting();
		});

		// Check for new version notifications
		db.getUserLastSeenVersion().then(async (lastSeenVersion) => {
			// Check if new user
			if (!lastSeenVersion) {
				await this.setState({
					isOnboardModalOpen: true,
				});
				if (document.cookie.indexOf('onboarded') === -1) {
					trackEvent('ui', 'onboardModalSeen', version);
					document.cookie = 'onboarded=1';
				}
				await window.db.setUserLastSeenVersion(version);
				// set some initial preferences on closing the onboard modal
				// Old onboarding.
				//once(document, 'overlaysClosed', function() {});
			}
			// If its an upgrade
			if (
				lastSeenVersion &&
				semverCompare(lastSeenVersion, version) === -1 &&
				!window.localStorage.pledgeModalSeen
			) {
				this.openSupportDeveloperModal();
				window.localStorage.pledgeModalSeen = true;
			}

			if (!lastSeenVersion || semverCompare(lastSeenVersion, version) === -1) {
				await this.setState({ hasUnseenChangelog: true });
				this.hasSeenNotifications = false;
			}
		});
	}

	loadUserSubscription() {
		loadSubscriptionToApp(this).then(() => this.refreshEditor());
	}

	updateProfileUi() {
		if (this.state.user) {
			document.body.classList.add('is-logged-in');
		} else {
			document.body.classList.remove('is-logged-in');
		}
	}

	refreshEditor() {
		this.toggleLayout(
			this.state.currentItem.layoutMode || this.state.prefs.layoutMode
		);
		this.updateExternalLibCount();
		this.contentWrap.refreshEditor();
	}
	// Creates a new item with passed item's contents
	forkItem(sourceItem) {
		if (this.state.unsavedEditCount) {
			var shouldDiscard = confirm(
				'You have unsaved changes in your current work. Do you want to discard unsaved changes and continue?'
			);
			if (!shouldDiscard) {
				return;
			}
		}
		const fork = JSON.parse(JSON.stringify(sourceItem));
		delete fork.id;
		fork.title = '(Forked) ' + sourceItem.title;
		fork.updatedOn = Date.now();
		this.setCurrentItem(fork).then(() => this.refreshEditor());
		alertsService.add(`"${sourceItem.title}" was forked`);
		trackEvent('fn', 'itemForked');
	}
	createNewItem() {
		var d = new Date();
		this.setCurrentItem({
			title:
				'Untitled ' +
				d.getDate() +
				'-' +
				(d.getMonth() + 1) +
				'-' +
				d.getHours() +
				':' +
				d.getMinutes(),
			html: '',
			css: '/* Prefix your CSS rules with `#diagram` */',
			js: `// An example for a RESTful endpoint<br>
// Go to the "Cheat sheet" tab or https://docs.zenuml.com
// to find all syntax<br>
// \`POST /v1/book/{id}/borrow\`
BookLibService.Borrow(id) {
  User = Session.GetUser()
  if(User.isActive) {
    try {
      BookRepository.Update(id, onLoan, User)
      receipt = new Receipt(id, dueDate)
    } catch (BookNotFoundException) {
      ErrorService.onException(BookNotFoundException)
    } finally {
      Connection.close()
    }
  }
  return receipt
}`,
			externalLibs: { js: '', css: '' },
			layoutMode: this.state.currentLayoutMode,
		}).then(() => this.refreshEditor());
		alertsService.add('New item created');
	}
	openItem(item) {
		this.setCurrentItem(item).then(() => this.refreshEditor());
		alertsService.add('Saved item loaded');
	}
	async removeItem(item) {
		var answer = confirm(`Are you sure you want to delete "${item.title}"?`);
		if (!answer) {
			return;
		}

		// Remove from items list
		itemService.unsetItemForUser(item.id);

		// Remove individual item too.
		itemService.removeItem(item.id).then(() => {
			alertsService.add('Item removed.', item);
			// This item is open in the editor. Lets open a new one.
			if (this.state.currentItem.id === item.id) {
				this.createNewItem();
			}
		});

		// Remove from cached list
		delete this.state.savedItems[item.id];
		await this.setState({
			savedItems: { ...this.state.savedItems },
		});

		trackEvent('fn', 'itemRemoved');
	}
	async setCurrentItem(item) {
		const d = deferred();
		// TODO: remove later
		item.htmlMode =
			item.htmlMode || this.state.prefs.htmlMode || HtmlModes.HTML;
		item.cssMode = item.cssMode || this.state.prefs.cssMode || CssModes.CSS;
		item.jsMode = item.jsMode || this.state.prefs.jsMode || JsModes.JS;

		await this.setState({ currentItem: item }, d.resolve);

		// Reset auto-saving flag
		if (window.zenumlDesktop) {
			this.saveItem(); // in desktop mode, always enable auto-saving
		} else {
			this.isAutoSavingEnabled = false;
		}

		// Reset unsaved count, in UI also.
		await this.setState({ unsavedEditCount: 0 });
		currentBrowserTab.setTitle(item.title);

		return d.promise;
	}
	saveBtnClickHandler() {
		trackEvent(
			'ui',
			'saveBtnClick',
			!this.state.user
				? 'not-logged-in'
				: this.state.currentItem.id
				? 'saved'
				: 'new'
		);
		if (this.state.user || window.zenumlDesktop) {
			this.saveItem();
			const numOfItems = Object.keys(this.state.savedItems).length;
			trackEvent('fn', 'save', 'no_of_files_' + numOfItems);
		} else {
			this.loginBtnClickHandler();
		}
	}

	async populateItemsInSavedPane(items) {
		// TODO: sort desc. by updation date
		await this.setState({
			savedItems: { ...this.state.savedItems },
		});

		await this.toggleSavedItemsPane();
		// HACK: Set overflow after sometime so that the items can animate without getting cropped.
		// setTimeout(() => $('#js-saved-items-wrap').style.overflowY = 'auto', 1000);
	}
	async toggleSavedItemsPane(shouldOpen) {
		await this.setState({
			isSavedItemPaneOpen:
				shouldOpen === undefined ? !this.state.isSavedItemPaneOpen : shouldOpen,
		});

		if (this.state.isSavedItemPaneOpen) {
			window.searchInput.focus();
		} else {
			window.searchInput.value = '';
		}
		document.body.classList[this.state.isSavedItemPaneOpen ? 'add' : 'remove'](
			'overlay-visible'
		);
	}

	/**
	 * Fetches all items from storage
	 * @param  {boolean} shouldSaveGlobally Whether to store the fetched items in global arr for later use.
	 * @return {promise}                    Promise.
	 */
	async fetchItems(shouldSaveGlobally, shouldFetchLocally) {
		var d = deferred();
		// HACK: This empty assignment is being used when importing locally saved items
		// to cloud, `fetchItems` runs once on account login which clears the
		// savedItems object and hence, while merging no saved item matches with itself.
		this.state.savedItems = {};
		var items = [];
		if ((window.user || window.zenumlDesktop) && !shouldFetchLocally) {
			items = await itemService.getAllItems();
			log('got items');
			if (shouldSaveGlobally) {
				items.forEach((item) => {
					this.state.savedItems[item.id] = item;
				});
			}
			d.resolve(items);
			return d.promise;
		}
		db.local.get('items', (result) => {
			var itemIds = Object.getOwnPropertyNames(result.items || {});
			if (!itemIds.length) {
				d.resolve([]);
			}

			trackEvent('fn', 'fetchItems', itemIds.length);
			for (let i = 0; i < itemIds.length; i++) {
				/* eslint-disable no-loop-func */
				db.local.get(itemIds[i], (itemResult) => {
					if (shouldSaveGlobally) {
						this.state.savedItems[itemIds[i]] = itemResult[itemIds[i]];
					}
					items.push(itemResult[itemIds[i]]);
					// Check if we have all items now.
					if (itemIds.length === items.length) {
						d.resolve(items);
					}
				});

				/* eslint-enable no-loop-func */
			}
		});
		return d.promise;
	}

	async openSavedItemsPane() {
		await this.setState({
			isFetchingItems: true,
		});
		this.fetchItems(true).then(async (items) => {
			await this.setState({
				isFetchingItems: false,
			});
			await this.populateItemsInSavedPane(items);
		});
	}
	async openAddLibrary() {
		await this.setState({ isAddLibraryModalOpen: true });
	}
	async closeSavedItemsPane() {
		await this.setState({
			isSavedItemPaneOpen: false,
		});
		document.body.classList.remove('overlay-visible');

		if (this.editorWithFocus) {
			this.editorWithFocus.focus();
		}
	}
	componentDidMount() {
		function setBodySize() {
			document.body.style.height = `${window.innerHeight}px`;
		}
		window.addEventListener('resize', () => {
			setBodySize();
		});

		// Editor keyboard shortucuts
		window.addEventListener('keydown', async (event) => {
			// TODO: refactor common listener code
			// Ctrl/⌘ + S
			if ((event.ctrlKey || event.metaKey) && event.keyCode === 83) {
				event.preventDefault();
				this.saveItem();
				trackEvent('ui', 'saveItemKeyboardShortcut');
			}
			// Ctrl/⌘ + Shift + 5
			if (
				(event.ctrlKey || event.metaKey) &&
				event.shiftKey &&
				event.keyCode === 53
			) {
				event.preventDefault();
				this.contentWrap.setPreviewContent(true, true);
				trackEvent('ui', 'previewKeyboardShortcut');
			} else if ((event.ctrlKey || event.metaKey) && event.keyCode === 79) {
				// Ctrl/⌘ + O
				event.preventDefault();
				await this.openSavedItemsPane();
				trackEvent('ui', 'openCreationKeyboardShortcut');
			} else if (
				(event.ctrlKey || event.metaKey) &&
				event.shiftKey &&
				event.keyCode === 191
			) {
				// Ctrl/⌘ + Shift + ?
				event.preventDefault();
				await this.setState({
					isKeyboardShortcutsModalOpen:
						!this.state.isKeyboardShortcutsModalOpen,
				});
				trackEvent('ui', 'showKeyboardShortcutsShortcut');
			} else if (event.keyCode === 27) {
				await this.closeSavedItemsPane();
			}
		});

		// Basic Focus trapping
		window.addEventListener('focusin', (e) => {
			if (document.body.classList.contains('overlay-visible')) {
				const modal = $('.is-modal-visible');
				if (!modal) {
					return;
				}
				if (!modal.contains(e.target)) {
					e.preventDefault();
					modal.querySelector('.js-modal__close-btn').focus();
				}
			}
		});

		trackGaSetField('page', '/');
		trackPageView();
	}

	async closeAllOverlays() {
		if (this.state.isSavedItemPaneOpen) {
			await this.closeSavedItemsPane();
		}

		await this.setState({
			...this.modalDefaultStates,
		});
	}
	async onExternalLibChange(newValues) {
		log('onExternalLibChange');
		this.state.currentItem.externalLibs = {
			js: newValues.js,
			css: newValues.css,
		};
		await this.updateExternalLibCount();
		await this.setState({
			currentItem: { ...this.state.currentItem },
		});
		this.contentWrap.setPreviewContent(true);
		alertsService.add('Libraries updated.');
	}
	async updateExternalLibCount() {
		// Calculate no. of external libs
		var noOfExternalLibs = 0;
		// There is no external libs
		// if (!this.state.currentItem.externalLibs) {
		// 	return;
		// }
		// noOfExternalLibs += this.state.currentItem.externalLibs.js
		// 	.split('\n')
		// 	.filter(lib => !!lib).length;
		// noOfExternalLibs += this.state.currentItem.externalLibs.css
		// 	.split('\n')
		// 	.filter(lib => !!lib).length;
		await this.setState({
			externalLibCount: noOfExternalLibs,
		});
	}
	async toggleLayout(mode) {
		/* eslint-disable no-param-reassign */
		mode = window.innerWidth < 600 ? 2 : mode;

		if (this.state.currentLayoutMode === mode) {
			this.contentWrap.resetSplitting();
			// mainSplitInstance.setSizes(getMainSplitSizesToApply());
			// codeSplitInstance.setSizes(currentItem.sizes || [33.33, 33.33, 33.33]);
			await this.setState({ currentLayoutMode: mode });
			return;
		}
		// Remove all layout classes
		[1, 2, 3, 4, 5].forEach((layoutNumber) => {
			window[`layoutBtn${layoutNumber}`].classList.remove('selected');
			document.body.classList.remove(`layout-${layoutNumber}`);
		});
		$('#layoutBtn' + mode).classList.add('selected');
		document.body.classList.add('layout-' + mode);

		await this.setState({ currentLayoutMode: mode }, () => {
			this.contentWrap.resetSplitting();
			this.contentWrap.setPreviewContent(true);
		});
	}

	layoutBtnClickHandler(layoutId) {
		this.saveSetting('layoutMode', layoutId);
		trackEvent('ui', 'toggleLayoutClick', layoutId);
		this.toggleLayout(layoutId);
	}

	// Calculates the sizes of html, css & js code panes.
	getCodePaneSizes() {
		var sizes;
		const currentLayoutMode = this.state.currentLayoutMode;
		var dimensionProperty =
			currentLayoutMode === 2 || currentLayoutMode === 5 ? 'width' : 'height';
		try {
			sizes = [
				htmlCodeEl.style[dimensionProperty],
				cssCodeEl.style[dimensionProperty],
				jsCodeEl.style[dimensionProperty],
			];
		} catch (e) {
			sizes = [0, 30, 70];
		} finally {
			/* eslint-disable no-unsafe-finally */
			return sizes;

			/* eslint-enable no-unsafe-finally */
		}
	}

	// Calculates the current sizes of code & preview panes.
	getMainPaneSizes() {
		var sizes;
		const currentLayoutMode = this.state.currentLayoutMode;
		var dimensionProperty = currentLayoutMode === 2 ? 'height' : 'width';
		try {
			sizes = [
				+$('#js-code-side').style[dimensionProperty].match(/([\d.]+)%/)[1],
				+$('#js-demo-side').style[dimensionProperty].match(/([\d.]+)%/)[1],
			];
		} catch (e) {
			sizes = [50, 50];
		} finally {
			/* eslint-disable no-unsafe-finally */
			return sizes;

			/* eslint-enable no-unsafe-finally */
		}
	}
	saveSetting(setting, value) {
		const d = deferred();
		const obj = {
			[setting]: value,
		};
		db.local.set(obj, d.resolve);
		return d.promise;
	}

	async saveCode(key) {
		this.state.currentItem.updatedOn = Date.now();
		this.state.currentItem.layoutMode = this.state.currentLayoutMode;

		this.state.currentItem.sizes = this.getCodePaneSizes();
		this.state.currentItem.mainSizes = this.getMainPaneSizes();

		log('saving key', key || this.state.currentItem.id, this.state.currentItem);

		async function onSaveComplete() {
			if (window.user && !navigator.onLine) {
				alertsService.add(
					'Item saved locally. Will save to account when you are online.'
				);
			} else {
				alertsService.add('Item saved.');
			}
			await this.setState({ unsavedEditCount: 0 });
		}

		console.log('on saving, ', this.state.currentItem);

		itemService
			.setItem(key || this.state.currentItem.id, this.state.currentItem)
			.then(onSaveComplete.bind(this));

		try {
			const result = await syncDiagram(this.state.currentItem);
			if(result) {
				this.state.currentItem.shareLink = getShareLink(result);
			}
		} catch (e) {
			console.error(e);
		}
	}

	// Save current item to storage
	async saveItem() {
		if (
			!window.user &&
			!window.localStorage[LocalStorageKeys.LOGIN_AND_SAVE_MESSAGE_SEEN] &&
			!window.zenumlDesktop
		) {
			const answer = confirm(
				'Saving without signing in will save your work only on this machine and this browser. If you want it to be secure & available anywhere, please login in your account and then save.\n\nDo you still want to continue saving locally?'
			);
			window.localStorage[LocalStorageKeys.LOGIN_AND_SAVE_MESSAGE_SEEN] = true;
			if (!answer) {
				trackEvent('ui', LocalStorageKeys.LOGIN_AND_SAVE_MESSAGE_SEEN, 'login');
				await this.closeAllOverlays();
				await this.setState({ isLoginModalOpen: true });
				return;
			}
			trackEvent('ui', LocalStorageKeys.LOGIN_AND_SAVE_MESSAGE_SEEN, 'local');
		}
		var isNewItem = !this.state.currentItem.id;
		this.state.currentItem.id =
			this.state.currentItem.id || 'item-' + generateRandomId();
		await this.setState({
			isSaving: true,
		});
		this.saveCode().then(async () => {
			await this.setState({
				isSaving: false,
			});
			// TODO: May be setState with currentItem

			// If this is the first save, and auto-saving settings is enabled,
			// then start auto-saving from now on.
			// This is done in `saveCode()` completion so that the
			// auto-save notification overrides the `saveCode` function's notification.
			if (!this.isAutoSavingEnabled && this.state.prefs.autoSave) {
				this.isAutoSavingEnabled = true;
				alertsService.add('Auto-save enabled.');
			}
		});
		// Push into the items hash if its a new item being saved
		if (isNewItem) {
			await itemService.setItemForUser(this.state.currentItem.id);
		}
	}
	async onCodeModeChange(ofWhat, mode) {
		const item = { ...this.state.currentItem };
		item[`${ofWhat}Mode`] = mode;
		await this.setState({ currentItem: item });
	}
	async onCodeChange(type, code, isUserChange) {
		this.state.currentItem[type] = code;
		if (isUserChange) {
			await this.setState({
				unsavedEditCount: this.state.unsavedEditCount + 1,
			});

			if (
				this.state.unsavedEditCount % UNSAVED_WARNING_COUNT === 0 &&
				this.state.unsavedEditCount >= UNSAVED_WARNING_COUNT
			) {
				window.saveBtn.classList.add('animated');
				window.saveBtn.classList.add('wobble');
				window.saveBtn.addEventListener('animationend', () => {
					window.saveBtn.classList.remove('animated');
					window.saveBtn.classList.remove('wobble');
				});
			}
		}
		if (this.state.prefs.isJs13kModeOn) {
			// Throttling codesize calculation
			if (this.codeSizeCalculationTimeout) {
				clearTimeout(this.codeSizeCalculationTimeout);
			}
			this.codeSizeCalculationTimeout = setTimeout(() => {
				this.calculateCodeSize();
				this.codeSizeCalculationTimeout = null;
			}, 1000);
		}
	}
	onCodeSettingsChange(type, settings) {
		this.state.currentItem[`${type}Settings`] = {
			acssConfig: settings,
		};
	}

	titleInputBlurHandler(e) {
		this.state.currentItem.title = e.target.value;
		this.setState({
			currentItem: {
				...this.state.currentItem,
				title: e.target.value,
			},
		});
		currentBrowserTab.setTitle(this.state.currentItem.title);
		if (this.state.currentItem.id) {
			this.saveItem();
			trackEvent('ui', 'titleChanged');
		}
	}

	/**
	 * Handles all user triggered preference changes in the UI.
	 */
	async updateSetting(e) {
		// If this was triggered from user interaction, save the setting
		if (e) {
			var settingName = e.target.dataset.setting;
			var obj = {};
			var el = e.target;
			log(settingName, el.type === 'checkbox' ? el.checked : el.value);
			const prefs = { ...this.state.prefs };
			prefs[settingName] = el.type === 'checkbox' ? el.checked : el.value;
			obj[settingName] = prefs[settingName];
			await this.setState({ prefs });

			// We always save locally so that it gets fetched
			// faster on future loads.
			db.sync.set(obj, function () {
				alertsService.add('Setting saved');
			});
			if (window.user) {
				window.db.getDb().then((remoteDb) => {
					remoteDb
						.collection('users')
						.doc(window.user.uid)
						.update({
							[`settings.${settingName}`]: this.state.prefs[settingName],
						})
						.then((arg) => {
							log(`Setting "${settingName}" for user`, arg);
						})
						.catch((error) => log(error));
				});
			}
			trackEvent('ui', 'updatePref-' + settingName, prefs[settingName]);
		}

		const prefs = this.state.prefs;

		this.contentWrap.applyCodemirrorSettings(this.state.prefs);

		if (prefs.autoSave) {
			if (!this.autoSaveInterval) {
				this.autoSaveInterval = setInterval(() => {
					this.autoSaveLoop();
				}, this.AUTO_SAVE_INTERVAL);
			}
		} else {
			clearInterval(this.autoSaveInterval);
			this.autoSaveInterval = null;
		}

		document.body.classList[prefs.lightVersion ? 'add' : 'remove'](
			'light-version'
		);
	}

	// Keeps getting called after certain interval to auto-save current creation
	// if it needs to be.
	autoSaveLoop() {
		if (this.isAutoSavingEnabled && this.state.unsavedEditCount) {
			this.saveItem();
		}
	}

	async loginBtnClickHandler() {
		await this.setState({ isLoginModalOpen: true });
	}

	async proBtnClickHandler() {
		trackEvent('ui', 'proBtnClick');
		await this.setState({ isProFeatureListModalOpen: true });
	}
	async profileBtnClickHandler() {
		await this.setState({ isProfileModalOpen: true });
	}

	async onUpdateImage(image) {
		const imageBase64 = await blobToBase64(image);
		this.setState({
			currentItem: {
				...this.state.currentItem,
				imageBase64,
			},
		});
		trackEvent('ui', 'shareLink');
	}

	async logout() {
		if (this.state.unsavedEditCount) {
			var shouldDiscard = confirm(
				'You have unsaved changes. Do you still want to logout?'
			);
			if (!shouldDiscard) {
				return;
			}
		}
		trackEvent('fn', 'loggedOut');
		auth.logout();
		await this.setState({ isProfileModalOpen: false });
		alertsService.add('Log out successful');
	}

	async itemClickHandler(item) {
		setTimeout(() => {
			this.openItem(item);
		}, 350);
		await this.toggleSavedItemsPane();
	}
	async itemRemoveBtnClickHandler(item) {
		await this.removeItem(item);
	}
	async itemForkBtnClickHandler(item) {
		await this.toggleSavedItemsPane();
		setTimeout(() => {
			this.forkItem(item);
		}, 350);
	}
	async newBtnClickHandler() {
		trackEvent('ui', 'newBtnClick');
		if (this.state.unsavedEditCount) {
			var shouldDiscard = confirm(
				'You have unsaved changes. Do you still want to create something new?'
			);
			if (shouldDiscard) {
				await this.setState({
					isCreateNewModalOpen: true,
				});
			}
		} else {
			await this.setState({
				isCreateNewModalOpen: true,
			});
		}
	}
	async openBtnClickHandler() {
		trackEvent('ui', 'openBtnClick');
		await this.openSavedItemsPane();
	}
	detachedPreviewBtnHandler() {
		trackEvent('ui', 'detachPreviewBtnClick');

		this.contentWrap.detachPreview();
	}
	async notificationsBtnClickHandler() {
		await this.setState({ isNotificationsModalOpen: true });

		if (this.state.isNotificationsModalOpen && !this.hasSeenNotifications) {
			this.hasSeenNotifications = true;
			await this.setState({ hasUnseenChangelog: false });
			await window.db.setUserLastSeenVersion(version);
		}
		trackEvent('ui', 'notificationButtonClick', version);
		return false;
	}
	codepenBtnClickHandler(e) {
		if (this.state.currentItem.cssMode === CssModes.ACSS) {
			alert(
				"Oops! CodePen doesn't supports Atomic CSS currently. \nHere is something you can still do -> https://medium.com/web-maker/sharing-your-atomic-css-work-on-codepen-a402001b26ab"
			);
			e.preventDefault();
			return;
		}
		var json = {
			title: 'A ZenUML experiment',
			html: this.state.currentItem.html,
			css: this.state.currentItem.css,
			js: this.state.currentItem.js,

			/* eslint-disable camelcase */
			html_pre_processor: modes[this.state.currentItem.htmlMode].codepenVal,
			css_pre_processor: modes[this.state.currentItem.cssMode].codepenVal,
			js_pre_processor: modes[this.state.currentItem.jsMode].codepenVal,

			css_external: this.state.currentItem.externalLibs.css
				.split('\n')
				.join(';'),
			js_external: this.state.currentItem.externalLibs.js.split('\n').join(';'),

			/* eslint-enable camelcase */
		};
		if (!this.state.currentItem.title.match(/Untitled\s\d\d*-\d/)) {
			json.title = this.state.currentItem.title;
		}
		json = JSON.stringify(json);
		window.codepenForm.querySelector('input').value = json;
		window.codepenForm.submit();
		trackEvent('ui', 'openInCodepen');
		e.preventDefault();
	}
	saveHtmlBtnClickHandler(e) {
		saveAsHtml(this.state.currentItem);
		trackEvent('ui', 'saveHtmlClick');
		e.preventDefault();
	}
	runBtnClickHandler() {
		trackEvent('ui', 'sponsorBtnClick');
	}
	exportItems() {
		handleDownloadsPermission().then(() => {
			this.fetchItems().then((items) => {
				var d = new Date();
				var fileName = [
					'web-maker-export',
					d.getFullYear(),
					d.getMonth() + 1,
					d.getDate(),
					d.getHours(),
					d.getMinutes(),
					d.getSeconds(),
				].join('-');
				fileName += '.json';
				var blob = new Blob([JSON.stringify(items, false, 2)], {
					type: 'application/json;charset=UTF-8',
				});

				downloadFile(fileName, blob);

				trackEvent('fn', 'exportItems');
			});
		});
	}
	exportBtnClickHandler(e) {
		this.exportItems();
		e.preventDefault();
		trackEvent('ui', 'exportBtnClicked');
	}
	screenshotBtnClickHandler(e) {
		this.contentWrap.getDemoFrame((frame) => {
			takeScreenshot(frame.getBoundingClientRect());
		});
		e.preventDefault();
	}
	openSupportDeveloperModal() {
		this.closeAllOverlays();
		// this.setState({
		// 	isSupportDeveloperModalOpen: true
		// });
	}
	supportDeveloperBtnClickHandler(e) {
		this.openSupportDeveloperModal(e);
	}

	/**
	 * Called from inside ask-to-import-modal
	 */
	async dontAskToImportAnymore(e) {
		await this.setState({ isAskToImportModalOpen: false });
		window.localStorage[LocalStorageKeys.ASKED_TO_IMPORT_CREATIONS] = true;
		if (e) {
			trackEvent('ui', 'dontAskToImportBtnClick');
		}
	}

	mergeImportedItems(items) {
		var existingItemIds = [];
		var toMergeItems = {};
		const d = deferred();
		const { savedItems } = this.state;
		items.forEach((item) => {
			// We can access `savedItems` here because this gets set when user
			// opens the saved creations panel. And import option is available
			// inside the saved items panel.
			// HACK: Also when this fn is called for importing locally saved items
			// to cloud, `fetchItems` runs once on account login which clears the
			// savedItems object and hence, no match happens for `existingItemIds`.
			if (savedItems[item.id]) {
				// Item already exists
				existingItemIds.push(item.id);
			} else {
				log('merging', item.id);
				toMergeItems[item.id] = item;
			}
		});
		var mergedItemCount = items.length - existingItemIds.length;
		if (existingItemIds.length) {
			var shouldReplace = confirm(
				existingItemIds.length +
					' creations already exist. Do you want to replace them?'
			);
			if (shouldReplace) {
				log('shouldreplace', shouldReplace);
				items.forEach((item) => {
					toMergeItems[item.id] = item;
				});
				mergedItemCount = items.length;
			}
		}
		if (mergedItemCount) {
			itemService.saveItems(toMergeItems).then(() => {
				d.resolve();
				alertsService.add(
					mergedItemCount + ' creations imported successfully.'
				);
				trackEvent('fn', 'itemsImported', mergedItemCount);
			});
		} else {
			d.resolve();
		}
		this.closeSavedItemsPane();
		return d.promise;
	}

	/**
	 * Called from inside ask-to-import-modal
	 */
	importCreationsAndSettingsIntoApp() {
		this.mergeImportedItems(this.oldSavedItems).then(() => {
			trackEvent('fn', 'oldItemsImported');
			this.dontAskToImportAnymore();
		});
	}

	editorFocusHandler(editor) {
		this.editorWithFocus = editor;
	}
	async modalOverlayClickHandler() {
		await this.closeAllOverlays();
	}

	splitUpdateHandler(mainSplitInstance, codeSplitInstance) {
		// Not using setState to avoid re-render
		this.state.currentItem.sizes = this.getCodePaneSizes();
		this.state.currentItem.mainSizes = this.getMainPaneSizes();
	}

	/**
	 * Calculate byte size of a text snippet
	 * @author Lea Verou
	 * MIT License
	 */
	calculateTextSize(text) {
		if (!text) {
			return 0;
		}
		var crlf = /(\r?\n|\r)/g,
			whitespace = /(\r?\n|\r|\s+)/g;

		const ByteSize = {
			count: function (text, options) {
				// Set option defaults
				options = options || {};
				options.lineBreaks = options.lineBreaks || 1;
				options.ignoreWhitespace = options.ignoreWhitespace || false;

				var length = text.length,
					nonAscii = length - text.replace(/[\u0100-\uFFFF]/g, '').length,
					lineBreaks = length - text.replace(crlf, '').length;

				if (options.ignoreWhitespace) {
					// Strip whitespace
					text = text.replace(whitespace, '');

					return text.length + nonAscii;
				} else {
					return (
						length +
						nonAscii +
						Math.max(0, options.lineBreaks * (lineBreaks - 1))
					);
				}
			},

			format: function (count, plainText) {
				var level = 0;

				while (count > 1024) {
					count /= 1024;
					level++;
				}

				// Round to 2 decimals
				count = Math.round(count * 100) / 100;

				level = ['', 'K', 'M', 'G', 'T'][level];

				return (
					(plainText ? count : '<strong>' + count + '</strong>') +
					' ' +
					level +
					'B'
				);
			},
		};

		return ByteSize.count(text);
	}
	getExternalLibCode() {
		const item = this.state.currentItem;
		var libs = (item.externalLibs && item.externalLibs.js) || '';
		libs += ('\n' + item.externalLibs && item.externalLibs.css) || '';
		libs = libs.split('\n').filter((lib) => lib);
		return libs.map((lib) =>
			fetch(lib)
				.then((res) => res.text())
				.then((data) => {
					return {
						code: data,
						fileName: getFilenameFromUrl(lib),
					};
				})
		);
	}
	calculateCodeSize() {
		const item = this.state.currentItem;
		var htmlPromise = computeHtml(item.html, item.htmlMode);
		var cssPromise = computeCss(item.css, item.cssMode);
		var jsPromise = computeJs(item.js, item.jsMode, false);
		Promise.all([
			htmlPromise,
			cssPromise,
			jsPromise,
			...this.getExternalLibCode(),
		]).then((result) => {
			var html = result[0].code || '',
				css = result[1].code || '',
				js = result[2].code || '';

			var fileContent = getCompleteHtml(html, css, js, item, true);

			// Replace external lib urls with local relative urls (picked from zip)
			fileContent = fileContent.replace(
				/<script src="(.*\/)([^/<]*?)"/g,
				'<script src="$2"'
			);

			var zip = new JSZip();
			zip.file('index.html', fileContent);
			for (let i = 3; i < result.length; i++) {
				const externalLib = result[i];
				zip.file(externalLib.fileName, externalLib.code);
			}

			// console.log('ORIGINAL', this.calculateTextSize(fileContent));

			var promise = null;
			if (0 && JSZip.support.uint8array) {
				promise = zip.generateAsync({ type: 'uint8array' });
			} else {
				promise = zip.generateAsync({
					type: 'base64',
					compression: 'DEFLATE',
					compressionOptions: {
						level: 9,
					},
				});
			}

			promise.then(async (data) => {
				const zipContent = data;
				const size = this.calculateTextSize(atob(data));
				await this.setState({
					codeSize: size,
				});
				this.currentItemZipBase64Data = data;
			});
		});
	}

	async js13KHelpBtnClickHandler() {
		await this.setState({
			isJs13KModalOpen: true,
		});
	}
	js13KDownloadBtnClickHandler() {
		const a = document.createElement('a');
		a.setAttribute('download', this.state.currentItem.title);
		a.href = 'data:application/zip;base64,' + this.currentItemZipBase64Data;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}
	async blankTemplateSelectHandler() {
		this.createNewItem();
		await this.setState({ isCreateNewModalOpen: false, activeTab: 'ZenUML' });
		this.contentWrap.resetTabs();
	}

	async templateSelectHandler(template) {
		fetch(`templates/template-${template.id}.json`)
			.then((res) => res.json())
			.then((json) => {
				this.forkItem(json);
			});
		await this.setState({ isCreateNewModalOpen: false, activeTab: 'ZenUML' });
		this.contentWrap.resetTabs();
	}

	render() {
		return (
			<div>
				<div class="main-container">
					{window.zenumlDesktop ? null : (
						<MainHeader
							externalLibCount={this.state.externalLibCount}
							openBtnHandler={this.openBtnClickHandler.bind(this)}
							newBtnHandler={this.newBtnClickHandler.bind(this)}
							saveBtnHandler={this.saveBtnClickHandler.bind(this)}
							loginBtnHandler={this.loginBtnClickHandler.bind(this)}
							proBtnHandler={this.proBtnClickHandler.bind(this)}
							profileBtnHandler={this.profileBtnClickHandler.bind(this)}
							addLibraryBtnHandler={this.openAddLibrary.bind(this)}
							runBtnClickHandler={this.runBtnClickHandler.bind(this)}
							isFetchingItems={this.state.isFetchingItems}
							isSaving={this.state.isSaving}
							title={this.state.currentItem.title}
							titleInputBlurHandler={this.titleInputBlurHandler.bind(this)}
							user={this.state.user}
							unsavedEditCount={this.state.unsavedEditCount}
						/>
					)}
					<ContentWrap
						currentLayoutMode={this.state.currentLayoutMode}
						currentItem={this.state.currentItem}
						onLogin={this.loginBtnClickHandler.bind(this)}
						onCodeChange={this.onCodeChange.bind(this)}
						onUpdateImage={this.onUpdateImage.bind(this)}
						onCodeSettingsChange={this.onCodeSettingsChange.bind(this)}
						onCodeModeChange={this.onCodeModeChange.bind(this)}
						onRef={(comp) => (this.contentWrap = comp)}
						prefs={this.state.prefs}
						onEditorFocus={this.editorFocusHandler.bind(this)}
						onSplitUpdate={this.splitUpdateHandler.bind(this)}
					/>
					<Footer
						prefs={this.state.prefs}
						layoutBtnClickHandler={this.layoutBtnClickHandler.bind(this)}
						helpBtnClickHandler={async () =>
							await this.setState({ isHelpModalOpen: true })
						}
						settingsBtnClickHandler={async () =>
							await this.setState({ isSettingsModalOpen: true })
						}
						notificationsBtnClickHandler={this.notificationsBtnClickHandler.bind(
							this
						)}
						supportDeveloperBtnClickHandler={this.supportDeveloperBtnClickHandler.bind(
							this
						)}
						detachedPreviewBtnHandler={this.detachedPreviewBtnHandler.bind(
							this
						)}
						codepenBtnClickHandler={this.codepenBtnClickHandler.bind(this)}
						saveHtmlBtnClickHandler={this.saveHtmlBtnClickHandler.bind(this)}
						keyboardShortcutsBtnClickHandler={async () =>
							await this.setState({ isKeyboardShortcutsModalOpen: true })
						}
						screenshotBtnClickHandler={this.screenshotBtnClickHandler.bind(
							this
						)}
						onJs13KHelpBtnClick={this.js13KHelpBtnClickHandler.bind(this)}
						onJs13KDownloadBtnClick={this.js13KDownloadBtnClickHandler.bind(
							this
						)}
						hasUnseenChangelog={this.state.hasUnseenChangelog}
						codeSize={this.state.codeSize}
					/>
				</div>

				<SavedItemPane
					items={this.state.savedItems}
					isOpen={this.state.isSavedItemPaneOpen}
					closeHandler={this.closeSavedItemsPane.bind(this)}
					itemClickHandler={this.itemClickHandler.bind(this)}
					itemRemoveBtnClickHandler={this.itemRemoveBtnClickHandler.bind(this)}
					itemForkBtnClickHandler={this.itemForkBtnClickHandler.bind(this)}
					exportBtnClickHandler={this.exportBtnClickHandler.bind(this)}
					mergeImportedItems={this.mergeImportedItems.bind(this)}
				/>

				<Alerts />

				<form
					style="display:none;"
					action="https://codepen.io/pen/define"
					method="POST"
					target="_blank"
					id="js-codepen-form"
				>
					<input
						type="hidden"
						name="data"
						value='{"title": "New Pen!", "html": "<div>Hello, World!</div>"}'
					/>
				</form>

				<Modal
					show={this.state.isAddLibraryModalOpen}
					closeHandler={async () =>
						await this.setState({ isAddLibraryModalOpen: false })
					}
				>
					<AddLibrary
						js={
							this.state.currentItem.externalLibs
								? this.state.currentItem.externalLibs.js
								: ''
						}
						css={
							this.state.currentItem.externalLibs
								? this.state.currentItem.externalLibs.css
								: ''
						}
						onChange={this.onExternalLibChange.bind(this)}
					/>
				</Modal>
				<Modal
					show={this.state.isNotificationsModalOpen}
					closeHandler={async () =>
						await this.setState({ isNotificationsModalOpen: false })
					}
				>
					<Notifications
						onSupportBtnClick={this.openSupportDeveloperModal.bind(this)}
					/>
				</Modal>
				<Modal
					extraClasses="modal--settings"
					show={this.state.isSettingsModalOpen}
					closeHandler={async () =>
						await this.setState({ isSettingsModalOpen: false })
					}
				>
					<Settings
						prefs={this.state.prefs}
						onChange={this.updateSetting.bind(this)}
					/>
				</Modal>
				<Modal
					extraClasses="login-modal"
					show={this.state.isLoginModalOpen}
					closeHandler={async () =>
						await this.setState({ isLoginModalOpen: false })
					}
				>
					<Login />
				</Modal>
				<Modal
					show={this.state.isProfileModalOpen}
					closeHandler={async () =>
						await this.setState({ isProfileModalOpen: false })
					}
				>
					<Profile
						user={this.state.user}
						logoutBtnHandler={this.logout.bind(this)}
					/>
				</Modal>
				<HelpModal
					show={this.state.isHelpModalOpen}
					closeHandler={async () =>
						await this.setState({ isHelpModalOpen: false })
					}
					onSupportBtnClick={this.openSupportDeveloperModal.bind(this)}
					version={version}
				/>
				<ProFeatureListModal
					show={this.state.isProFeatureListModalOpen}
					closeHandler={async () =>
						await this.setState({ isProFeatureListModalOpen: false })
					}
					onSupportBtnClick={this.openSupportDeveloperModal.bind(this)}
					version={version}
					onSubscriptionChange={this.loadUserSubscription.bind(this)}
					loginHandler={this.loginBtnClickHandler.bind(this)}
				/>
				<SupportDeveloperModal
					show={this.state.isSupportDeveloperModalOpen}
					closeHandler={async () =>
						await this.setState({ isSupportDeveloperModalOpen: false })
					}
				/>
				<KeyboardShortcutsModal
					show={this.state.isKeyboardShortcutsModalOpen}
					closeHandler={async () =>
						await this.setState({ isKeyboardShortcutsModalOpen: false })
					}
				/>
				<AskToImportModal
					show={this.state.isAskToImportModalOpen}
					closeHandler={async () =>
						await this.setState({ isAskToImportModalOpen: false })
					}
					oldSavedCreationsCount={this.oldSavedCreationsCount}
					importBtnClickHandler={this.importCreationsAndSettingsIntoApp.bind(
						this
					)}
					dontAskBtnClickHandler={this.dontAskToImportAnymore.bind(this)}
				/>

				<Js13KModal
					show={this.state.isJs13KModalOpen}
					closeHandler={async () =>
						await this.setState({ isJs13KModalOpen: false })
					}
				/>

				<CreateNewModal
					show={this.state.isCreateNewModalOpen}
					closeHandler={async () =>
						await this.setState({ isCreateNewModalOpen: false })
					}
					onBlankTemplateSelect={this.blankTemplateSelectHandler.bind(this)}
					onTemplateSelect={this.templateSelectHandler.bind(this)}
				/>

				<div
					class="modal-overlay"
					onClick={this.modalOverlayClickHandler.bind(this)}
				/>

				<Icons />
				<form
					style="display:none;"
					action="https://codepen.io/pen/define"
					method="POST"
					target="_blank"
					id="codepenForm"
				>
					<input
						type="hidden"
						name="data"
						value='{"title": "New Pen!", "html": "<div>Hello, World!</div>"}'
					/>
				</form>
			</div>
		);
	}
}
