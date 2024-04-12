import React, { Component } from 'preact';
import { saveAs } from 'file-saver';
import UserCodeMirror from './UserCodeMirror.jsx';
import Toolbox from './Toolbox.jsx';
import Tabs from './Tabs.jsx';
import { computeCss, computeHtml, computeJs } from '../computes';
import { CssModes, HtmlModes, JsModes, modes } from '../codeModes';
import { getCompleteHtml, loadJS, log } from '../utils';
import { SplitPane } from './SplitPane.jsx';
import { trackEvent } from '../analytics';
import CodeMirror from '../CodeMirror';
import 'codemirror/mode/javascript/javascript.js';
import { Console } from './Console';
import { deferred } from '../deferred';
import CssSettingsModal from './CssSettingsModal';
import codeService from '../services/code_service';
import { alertsService } from '../notifications';
import userService from '../services/user_service';
import mixpanel from '../services/mixpanel';

const minCodeWrapSize = 33;

/* global htmlCodeEl, jsCodeEl, cssCodeEl, logCountEl
 */

export default class ContentWrap extends Component {
  constructor(props) {
    super(props);
    this.state = {
      lineOfCode: 0,
      isConsoleOpen: false,
      isCssSettingsModalOpen: false,
      imageBase64: null,
      isSharePanelVisible: false,
    };
    this.updateTimer = null;
    this.updateDelay = 500;
    this.htmlMode = HtmlModes.HTML;
    this.jsMode = HtmlModes.HTML;
    this.cssMode = CssModes.CSS;
    this.jsMode = JsModes.JS;
    this.prefs = {};
    this.codeInPreview = { html: null, css: null, js: null };
    this.cmCodes = { html: props.currentItem.html, css: '', js: '' };
    this.cm = {};
    this.logCount = 0;

    window.onMessageFromConsole = this.onMessageFromConsole.bind(this);

    window.previewException = this.previewException.bind(this);
    // `clearConsole` is on window because it gets called from inside iframe also.
    window.clearConsole = this.clearConsole.bind(this);
  }

  // shouldComponentUpdate(nextProps, nextState) - removed, but not quite sure.

  componentDidUpdate() {
    // HACK: becuase its a DOM manipulation
    this.updateLogCount();

    // log('🚀', 'didupdate', this.props.currentItem);
    // if (this.isValidItem(this.props.currentItem)) {
    // this.refreshEditor();
    // }
  }

  componentDidMount() {
    this.props.onRef(this);
    window.addEventListener('message', this.handleMessageCodeUpdate.bind(this));
  }

  componentWillUnmount() {
    window.removeEventListener(
      'message',
      this.handleMessageCodeUpdate.bind(this),
    );
  }

  handleMessageCodeUpdate(e) {
    const code = e.data && e.data.code;
    if (code) {
      this.cm.js.setValue(code);
      this.cm.js.refresh();
    }
  }

  onHtmlCodeChange(editor, change) {
    this.cmCodes.html = editor.getValue();
    this.props.onCodeChange(
      'html',
      this.cmCodes.html,
      change.origin !== 'setValue',
    );
    this.onCodeChange(editor, change);
  }

  onCssCodeChange(editor, change) {
    this.cmCodes.css = editor.getValue();
    this.props.onCodeChange(
      'css',
      this.cmCodes.css,
      change.origin !== 'setValue',
    );
    this.onCodeChange(editor, change);
  }

  async onJsCodeChange(editor, change) {
    await this.setState({ lineOfCode: editor.doc.size });
    this.cmCodes.js = editor.getValue();
    this.props.onCodeChange(
      'js',
      this.cmCodes.js,
      change.origin !== 'setValue',
    );

    const targetWindow =
      this.detachedWindow ||
      document.getElementById('demo-frame').contentWindow;
    targetWindow.postMessage({ code: this.cmCodes.js }, '*');
  }

  onCursorMove(editor) {
    const cursor = editor.getCursor();
    const line = cursor.line;
    let pos = cursor.ch;

    for (let i = 0; i < line; i++) {
      pos += editor.getLine(i).length + 1;
    }

    const targetWindow =
      this.detachedWindow ||
      document.getElementById('demo-frame').contentWindow;
    targetWindow.postMessage({ cursor: pos }, '*');
  }

  onCodeChange(editor, change) {
    clearTimeout(this.updateTimer);

    this.updateTimer = setTimeout(() => {
      // This is done so that multiple simultaneous setValue don't trigger too many preview refreshes
      // and in turn too many file writes on a single file (eg. preview.html).
      if (change.origin !== 'setValue') {
        // Specifically checking for false so that the condition doesn't get true even
        // on absent key - possible when the setting key hasn't been fetched yet.
        if (this.prefs.autoPreview !== false) {
          this.setPreviewContent();
        }

        // Track when people actually are working.
        trackEvent.previewCount = (trackEvent.previewCount || 0) + 1;
        if (trackEvent.previewCount === 4) {
          trackEvent('fn', 'usingPreview');
        }
        if (trackEvent.previewCount % 4 === 0) {
          trackEvent('fn', 'userEdit', '', trackEvent.previewCount);
        }
      }
    }, this.updateDelay);
  }

  // Called for both detached window and non-detached window
  async createPreviewFile(html, css, js) {
    // isNotChrome
    const shouldInlineJs =
      !window.webkitRequestFileSystem || !window.IS_EXTENSION;
    const contents = getCompleteHtml(
      html,
      css,
      shouldInlineJs ? js : null,
      this.props.currentItem,
    );

    // Track if people have written code.
    if (!trackEvent.hasTrackedCode && (html || css || js)) {
      trackEvent('fn', 'hasCode');
      trackEvent.hasTrackedCode = true;
    }
    const that = this;
    that.frame.onload = function () {
      that.frame.contentWindow.postMessage({ code: that.cmCodes.js }, '*');
    };

    if (this.detachedWindow) {
      this.detachedWindow.postMessage({ contents }, '*');
    } else {
      this.frame.src = this.frame.src;
      setTimeout(() => {
        that.frame.contentDocument.open();
        that.frame.contentDocument.write(contents);
        that.frame.contentDocument.close();
      }, 10);
    }
  }

  cleanupErrors(lang) {
    this.cm[lang].clearGutter('error-gutter');
  }

  showErrors(lang, errors) {
    var editor = this.cm[lang];
    errors.forEach(function (e) {
      editor.operation(function () {
        var n = document.createElement('div');
        n.setAttribute('data-title', e.message);
        n.classList.add('gutter-error-marker');
        editor.setGutterMarker(e.lineNumber, 'error-gutter', n);
      });
    });
  }

  /**
   * Generates the preview from the current code.
   * @param {boolean} isForced Should refresh everything without any check or not
   * @param {boolean} isManual Is this a manual preview request from user?
   */
  setPreviewContent(isForced, isManual) {
    if (!this.props.prefs.autoPreview && !isManual) {
      return;
    }

    if (!this.props.prefs.preserveConsoleLogs) {
      this.clearConsole();
    }
    this.cleanupErrors('css');
    this.cleanupErrors('js');

    var currentCode = {
      css: this.cmCodes.css,
      js: this.cmCodes.js,
    };
    log('🔎 setPreviewContent', isForced);
    const targetFrame = this.detachedWindow
      ? this.detachedWindow.document.querySelector('iframe')
      : this.frame;

    const cssMode = this.props.currentItem.cssMode;
    // If just CSS was changed (and everything shudn't be empty),
    // change the styles inside the iframe.
    if (!isForced && currentCode.js === this.codeInPreview.js) {
      computeCss(
        cssMode === CssModes.ACSS ? currentCode.html : currentCode.css,
        cssMode,
        this.props.currentItem.cssSettings,
      ).then((result) => {
        if (cssMode === CssModes.ACSS) {
          this.cm.css.setValue(result.code || '');
        }
        if (targetFrame.contentDocument.querySelector('#zenumlstyle')) {
          targetFrame.contentDocument.querySelector(
            '#zenumlstyle',
          ).textContent = result.code || '';
        }
      });
    } else {
      var htmlPromise = computeHtml(
        currentCode.html,
        this.props.currentItem.htmlMode,
      );
      var cssPromise = computeCss(
        cssMode === CssModes.ACSS ? currentCode.html : currentCode.css,
        cssMode,
        this.props.currentItem.cssSettings,
      );
      var jsPromise = computeJs(
        currentCode.js,
        this.props.currentItem.jsMode,
        true,
        this.props.prefs.infiniteLoopTimeout,
      );
      Promise.all([htmlPromise, cssPromise, jsPromise]).then((result) => {
        if (cssMode === CssModes.ACSS) {
          this.cm.css.setValue(result[1].code || '');
        }

        this.createPreviewFile(
          result[0].code || '',
          result[1].code || '',
          result[2].code || '',
        );
        result.forEach((resultItem) => {
          if (resultItem.errors) {
            this.showErrors(resultItem.errors.lang, resultItem.errors.data);
          }
        });
      });
    }

    this.codeInPreview.html = currentCode.html;
    this.codeInPreview.css = currentCode.css;
    this.codeInPreview.js = currentCode.js;
  }

  isValidItem(item) {
    return !!item.title;
  }

  refreshEditor() {
    this.cmCodes.css = this.props.currentItem.css;
    this.cmCodes.js = this.props.currentItem.js;
    this.cm.css.setValue(this.cmCodes.css || '');
    this.cm.js.setValue(this.cmCodes.js || '');
    this.cm.css.refresh();
    this.cm.js.refresh();

    this.clearConsole();

    // Set preview only when all modes are updated so that preview doesn't generate on partially
    // correct modes and also doesn't happen 3 times.
    Promise.all([
      this.updateHtmlMode(this.props.currentItem.htmlMode),
      this.updateCssMode(this.props.currentItem.cssMode),
      this.updateJsMode(this.props.currentItem.jsMode),
    ]).then(() => this.setPreviewContent(true));
  }

  applyCodemirrorSettings(prefs) {
    if (!this.cm) {
      return;
    }
    cssCodeEl.querySelector('.CodeMirror').style.fontSize =
      jsCodeEl.querySelector('.CodeMirror').style.fontSize = `${parseInt(
        prefs.fontSize,
        10,
      )}px`;
    window.consoleEl.querySelector('.CodeMirror').style.fontSize = `${parseInt(
      prefs.fontSize,
      10,
    )}px`;

    // Replace correct css file in LINK tags's href
    window.editorThemeLinkTag.href = `lib/codemirror/theme/${prefs.editorTheme}.css`;
    window.fontStyleTag.textContent =
      window.fontStyleTemplate.textContent.replace(
        /fontname/g,
        (prefs.editorFont === 'other'
          ? prefs.editorCustomFont
          : prefs.editorFont) || 'FiraCode',
      );
    // window.customEditorFontInput.classList[
    // 	prefs.editorFont === 'other' ? 'remove' : 'add'
    // ]('hide');
    this.consoleCm.setOption('theme', prefs.editorTheme);

    ['js', 'css'].forEach((type) => {
      this.cm[type].setOption('indentWithTabs', prefs.indentWith !== 'spaces');
      this.cm[type].setOption(
        'blastCode',
        prefs.isCodeBlastOn ? { effect: 2, shake: false } : false,
      );
      this.cm[type].setOption('indentUnit', +prefs.indentSize);
      this.cm[type].setOption('tabSize', +prefs.indentSize);
      this.cm[type].setOption('theme', prefs.editorTheme);

      this.cm[type].setOption('keyMap', prefs.keymap);
      this.cm[type].setOption('lineWrapping', prefs.lineWrap);
      this.cm[type].setOption('autoCloseTags', prefs.autoCloseTags);
      this.cm[type].refresh();
    });
  }

  // Check all the code wrap if they are minimized or maximized
  updateCodeWrapCollapseStates() {
    // This is debounced!
    clearTimeout(this.updateCodeWrapCollapseStates.timeout);
    this.updateCodeWrapCollapseStates.timeout = setTimeout(() => {
      const { currentLayoutMode } = this.props;
      const prop =
        currentLayoutMode === 2 || currentLayoutMode === 5 ? 'width' : 'height';
      [htmlCodeEl, cssCodeEl, jsCodeEl].forEach(function (el) {
        const bounds = el.getBoundingClientRect();
        const size = bounds[prop];
        if (size < 100) {
          el.classList.add('is-minimized');
        } else {
          el.classList.remove('is-minimized');
        }
        if (el.style[prop].indexOf(`100% - ${minCodeWrapSize * 2}px`) !== -1) {
          el.classList.add('is-maximized');
        } else {
          el.classList.remove('is-maximized');
        }
      });
    }, 50);
  }

  toggleCodeWrapCollapse(codeWrapEl) {
    if (
      codeWrapEl.classList.contains('is-minimized') ||
      codeWrapEl.classList.contains('is-maximized')
    ) {
      codeWrapEl.classList.remove('is-minimized');
      codeWrapEl.classList.remove('is-maximized');
      this.codeSplitInstance.setSizes([85, 4, 11]);
    } else {
      const id = parseInt(codeWrapEl.dataset.codeWrapId, 10);
      var arr = [
        `${minCodeWrapSize}px`,
        `${minCodeWrapSize}px`,
        `${minCodeWrapSize}px`,
      ];
      arr[id] = `calc(100% - ${minCodeWrapSize * 2}px)`;

      this.codeSplitInstance.setSizes(arr);
      codeWrapEl.classList.add('is-maximized');
    }
    this.updateSplits();
  }

  collapseBtnHandler(e) {
    var codeWrapParent =
      e.currentTarget.parentElement.parentElement.parentElement;
    this.toggleCodeWrapCollapse(codeWrapParent);
    trackEvent('ui', 'paneCollapseBtnClick', codeWrapParent.dataset.type);
  }

  codeWrapHeaderDblClickHandler(e) {
    if (!e.target.classList.contains('js-code-wrap__header')) {
      return;
    }
    const codeWrapParent = e.target.parentElement;
    this.toggleCodeWrapCollapse(codeWrapParent);
    trackEvent('ui', 'paneHeaderDblClick', codeWrapParent.dataset.type);
  }

  async exportPngClickHandler(e) {
    if (!window.user) {
      this.props.onLogin();
      return;
    }
    const png = await this.getPngBlob();
    saveAs(png, 'zenuml.png');
    mixpanel.track({ event: 'downloadPng', category: 'ui' });
  }

  async getPngBlob() {
    const mountingPoint =
      this.frame.contentWindow.document.getElementById('diagram');
    // eslint-disable-next-line
    return await mountingPoint
      .getElementsByClassName('frame')[0]
      .parentElement.__vue__.toBlob();
  }

  async copyImageClickHandler(e) {
    if (!window.user) {
      this.props.onLogin();
      return;
    }
    if (!navigator.clipboard || !navigator.clipboard.write) {
      this.showCopyErrorNotice();
      mixpanel.track({ event: 'copyImageFailed1', category: 'ui' });
      return;
    }
    navigator.clipboard
      .write([
        new ClipboardItem({
          'image/png': new Promise(async (resolve) => {
            const png = await this.getPngBlob();
            resolve(png);
          }),
        }),
      ])
      .then(
        () => alertsService.add('PNG file was copied'),
        (err) => {
          this.showCopyErrorNotice();
          console.log(err);
          mixpanel.track({ event: 'copyImageFailed2', category: 'ui' });
        },
      );
    mixpanel.track({ event: 'copyImage', category: 'ui' });
  }

  showCopyErrorNotice() {
    alertsService.add(
      'Copy failed, please try on another browser or upgrade your browser!',
    );
  }

  async shareClickHandler() {
    const image = await this.getPngBlob();
    await this.props.onUpdateImage(image);
    this.setState({ isSharePanelVisible: true });
    trackEvent('ui', 'shareLink');
  }

  async resetSplitting() {
    await this.setState({
      codeSplitSizes: this.getCodeSplitSizes(),
      mainSplitSizes: this.getMainSplitSizesToApply(),
    });
  }

  updateSplits() {
    this.props.onSplitUpdate();
    // Not using setState to avoid re-render
    this.state.codeSplitSizes = this.props.currentItem.sizes;
    this.state.mainSplitSizes = this.props.currentItem.mainSizes;
  }

  // Returns the sizes of main code & preview panes.
  getMainSplitSizesToApply() {
    var mainSplitSizes;
    const { currentItem, currentLayoutMode } = this.props;
    if (currentItem && currentItem.mainSizes) {
      // For layout mode 3, main panes are reversed using flex-direction.
      // So we need to apply the saved sizes in reverse order.
      mainSplitSizes =
        currentLayoutMode === 3
          ? [currentItem.mainSizes[1], currentItem.mainSizes[0]]
          : currentItem.mainSizes;
    } else {
      mainSplitSizes = currentLayoutMode === 5 ? [75, 25] : [30, 70];
    }
    return mainSplitSizes;
  }

  getCodeSplitSizes() {
    if (this.props.currentItem && this.props.currentItem.sizes) {
      return this.props.currentItem.sizes;
    }
    return [85, 4, 11];
  }

  mainSplitDragEndHandler() {
    if (this.props.prefs.refreshOnResize) {
      // Running preview updation in next call stack, so that error there
      // doesn't affect this dragend listener.
      setTimeout(() => {
        this.setPreviewContent(true);
      }, 1);
    }
    this.updateSplits();
  }

  codeSplitDragStart() {
    document.body.classList.add('is-dragging');
  }

  codeSplitDragEnd() {
    this.updateCodeWrapCollapseStates();
    document.body.classList.remove('is-dragging');
    this.updateSplits();
  }

  /**
   * Loaded the code comiler based on the mode selected
   */
  handleModeRequirements(mode) {
    const baseTranspilerPath = 'lib/transpilers';
    // Exit if already loaded
    var d = deferred();
    if (modes[mode].hasLoaded) {
      d.resolve();
      return d.promise;
    }

    function setLoadedFlag() {
      modes[mode].hasLoaded = true;
      d.resolve();
    }

    if (mode === HtmlModes.JADE) {
      loadJS(`${baseTranspilerPath}/jade.js`).then(setLoadedFlag);
    } else if (mode === HtmlModes.MARKDOWN) {
      loadJS(`${baseTranspilerPath}/marked.js`).then(setLoadedFlag);
    } else if (mode === CssModes.LESS) {
      loadJS(`${baseTranspilerPath}/less.min.js`).then(setLoadedFlag);
    } else if (mode === CssModes.SCSS || mode === CssModes.SASS) {
      loadJS(`${baseTranspilerPath}/sass.js`).then(function () {
        window.sass = new Sass(`${baseTranspilerPath}/sass.worker.js`);
        setLoadedFlag();
      });
    } else if (mode === CssModes.STYLUS) {
      loadJS(`${baseTranspilerPath}/stylus.min.js`).then(setLoadedFlag);
    } else if (mode === CssModes.ACSS) {
      loadJS(`${baseTranspilerPath}/atomizer.browser.js`).then(setLoadedFlag);
    } else if (mode === JsModes.COFFEESCRIPT) {
      loadJS(`${baseTranspilerPath}/coffee-script.js`).then(setLoadedFlag);
    } else if (mode === JsModes.ES6) {
      loadJS(`${baseTranspilerPath}/babel.min.js`).then(setLoadedFlag);
    } else if (mode === JsModes.TS) {
      loadJS(`${baseTranspilerPath}/typescript.js`).then(setLoadedFlag);
    } else {
      d.resolve();
    }

    return d.promise;
  }

  updateHtmlMode(value) {
    this.props.onCodeModeChange('html', value);
    this.props.currentItem.htmlMode = value;
    CodeMirror.autoLoadMode(
      this.cm.html,
      modes[value].cmPath || modes[value].cmMode,
    );
    return this.handleModeRequirements(value);
  }

  updateCssMode(value) {
    this.props.onCodeModeChange('css', value);
    this.props.currentItem.cssMode = value;
    this.cm.css.setOption('mode', modes[value].cmMode);
    this.cm.css.setOption('readOnly', modes[value].cmDisable);
    window.cssSettingsBtn.classList[
      modes[value].hasSettings ? 'remove' : 'add'
    ]('hide');
    CodeMirror.autoLoadMode(
      this.cm.css,
      modes[value].cmPath || modes[value].cmMode,
    );
    return this.handleModeRequirements(value);
  }

  updateJsMode(value) {
    this.props.onCodeModeChange('js', value);
    this.props.currentItem.jsMode = value;
    this.cm.js.setOption('mode', modes[value].cmMode);
    CodeMirror.autoLoadMode(
      this.cm.js,
      modes[value].cmPath || modes[value].cmMode,
    );
    return this.handleModeRequirements(value);
  }

  codeModeChangeHandler(e) {
    var mode = e.target.value;
    var type = e.target.dataset.type;
    var currentMode =
      this.props.currentItem[
        type === 'html' ? 'htmlMode' : type === 'css' ? 'cssMode' : 'jsMode'
      ];
    if (currentMode !== mode) {
      if (type === 'html') {
        this.updateHtmlMode(mode).then(() => this.setPreviewContent(true));
      } else if (type === 'js') {
        this.updateJsMode(mode).then(() => this.setPreviewContent(true));
      } else if (type === 'css') {
        this.updateCssMode(mode).then(() => this.setPreviewContent(true));
      }
      trackEvent('ui', 'updateCodeMode', mode);
    }
  }

  detachPreview() {
    if (this.detachedWindow) {
      this.detachedWindow.focus();
      return;
    }
    const iframeBounds = this.frame.getBoundingClientRect();
    const iframeWidth = iframeBounds.width;
    const iframeHeight = iframeBounds.height;
    document.body.classList.add('is-detached-mode');

    this.detachedWindow = window.open(
      './preview.html?last_update=20200607',
      'ZenUML',
      `width=${iframeWidth},height=${iframeHeight},resizable,scrollbars=yes,status=1`,
    );
    const that = this;
    this.detachedWindow.onload = function () {
      that.setPreviewContent(true);
      const frm = that.detachedWindow.document.querySelector('iframe');
      frm.onload = function () {
        that.detachedWindow.postMessage({ code: that.cmCodes.js }, '*');
      };
    };

    var intervalID = window.setInterval((checkWindow) => {
      if (this.detachedWindow && this.detachedWindow.closed) {
        clearInterval(intervalID);
        document.body.classList.remove('is-detached-mode');
        this.detachedWindow = null;
        // Update main frame preview to get latest changes (which were not
        // getting reflected while detached window was open)
        this.setPreviewContent(true);
      }
    }, 500);
  }

  updateLogCount() {
    if (window.logCountEl) {
      logCountEl.textContent = this.logCount;
    }
  }

  onMessageFromConsole() {
    /* eslint-disable no-param-reassign */
    [...arguments].forEach((arg) => {
      if (
        arg &&
        arg.indexOf &&
        arg.indexOf('filesystem:chrome-extension') !== -1
      ) {
        arg = arg.replace(
          /filesystem:chrome-extension.*\.js:(\d+):*(\d*)/g,
          'script $1:$2',
        );
      }
      try {
        this.consoleCm.replaceRange(
          arg +
            ' ' +
            ((arg + '').match(/\[object \w+]/) ? JSON.stringify(arg) : '') +
            '\n',
          {
            line: Infinity,
          },
        );
      } catch (e) {
        this.consoleCm.replaceRange('🌀\n', {
          line: Infinity,
        });
      }
      this.consoleCm.scrollTo(0, Infinity);
      this.logCount++;
    });
    this.updateLogCount();

    /* eslint-enable no-param-reassign */
  }

  previewException(error) {
    console.error('Possible infinite loop detected.', error.stack);
    this.onMessageFromConsole('Possible infinite loop detected.', error.stack);
  }

  async toggleConsole() {
    await this.setState({ isConsoleOpen: !this.state.isConsoleOpen });
    trackEvent('ui', 'consoleToggle');
  }

  consoleHeaderDblClickHandler(e) {
    if (!e.target.classList.contains('js-console__header')) {
      return;
    }
    trackEvent('ui', 'consoleToggleDblClick');
    this.toggleConsole();
  }

  clearConsole() {
    this.consoleCm.setValue('');
    this.logCount = 0;
    this.updateLogCount();
  }

  clearConsoleBtnClickHandler() {
    this.clearConsole();
    trackEvent('ui', 'consoleClearBtnClick');
  }

  evalConsoleExpr(e) {
    // Clear console on CTRL + L
    if ((e.which === 76 || e.which === 12) && e.ctrlKey) {
      this.clearConsole();
      trackEvent('ui', 'consoleClearKeyboardShortcut');
    } else if (e.which === 13) {
      this.onMessageFromConsole('> ' + e.target.value);

      /* eslint-disable no-underscore-dangle */
      this.frame.contentWindow._wmEvaluate(e.target.value);

      /* eslint-enable no-underscore-dangle */

      e.target.value = '';
      trackEvent('fn', 'evalConsoleExpr');
    }
  }

  async cssSettingsBtnClickHandler() {
    await this.setState({ isCssSettingsModalOpen: true });
    trackEvent('ui', 'cssSettingsBtnClick');
  }

  cssSettingsChangeHandler(settings) {
    this.props.onCodeSettingsChange('css', settings);
    this.setPreviewContent(true);
  }

  getDemoFrame(callback) {
    callback(this.frame);
  }

  editorFocusHandler(editor) {
    this.props.onEditorFocus(editor);
  }

  resetTabs() {
    this.tabsRef.onInit();
  }

  onTabChanges(tab) {
    if (tab === 'ZenUML') {
      this.dslEditor.refreshEditor();
      mixpanel.track({ event: 'switchToZenUMLTab', category: 'ui' });
    } else {
      this.cssEditor.refreshEditor();
      mixpanel.track({ event: 'switchToCSSTab', category: 'ui' });
    }
  }

  onCSSActiviation() {
    if (!window.user) {
      this.props.onLogin();
    } else if (userService.isPro()) {
      return true;
    } else {
      this.props.onProFeature();
    }
  }

  toolboxUpdateToApp(param) {
    trackEvent('ui', 'code', 'toolbox');
    const code = this.cm.js.getValue();
    this.cm.js.setValue(codeService.addCode(code, param));
  }

  render() {
    return (
      <SplitPane
        class="content-wrap  flex  flex-grow"
        id="content-wrap"
        sizes={this.state.mainSplitSizes}
        minSize={580}
        style=""
        direction={
          this.props.currentLayoutMode === 2 ? 'vertical' : 'horizontal'
        }
        onDragEnd={this.mainSplitDragEndHandler.bind(this)}
      >
        <div id="js-code-side">
          <Tabs
            keyboardShortcutsBtnClickHandler={
              this.props.keyboardShortcutsBtnClickHandler
            }
            ref={(tabs) => (this.tabsRef = tabs)}
            onChange={this.onTabChanges.bind(this)}
            style="display:flex;flex-direction: column;"
          >
            <div label="ZenUML" lineOfCode={this.state.lineOfCode}>
              <div
                data-code-wrap-id="2"
                id="jsCodeEl"
                data-type="js"
                className="code-wrap"
                onTransitionEnd={this.updateCodeWrapCollapseStates.bind(this)}
              >
                {/* <div
								className="js-code-wrap__header  code-wrap__header"
								title="Double click to toggle code pane"
								ondblclick={this.codeWrapHeaderDblClickHandler.bind(this)}
							>
								<label className="btn-group" title="Click to change">
									<span className="code-wrap__header-label">ZenUML</span>
									<span className="caret" style="display:none" />
									<select
										data-type="js"
										className="js-mode-select  hidden-select"
										style="display: none"
										onChange={this.codeModeChangeHandler.bind(this)}
										value={this.props.currentItem.jsMode}
									>
										<option value="js">JS</option>
										<option value="coffee">CoffeeScript</option>
										<option value="es6">ES6 (Babel)</option>
										<option value="typescript">TypeScript</option>
									</select>
								</label>
								<div className="code-wrap__header-right-options">
									<a
										className="js-code-collapse-btn  code-wrap__header-btn  code-wrap__collapse-btn"
										title="Toggle code pane"
										onClick={this.collapseBtnHandler.bind(this)}
									/>
								</div>
							</div> */}
                <Toolbox clickSvg={this.toolboxUpdateToApp.bind(this)} />
                <UserCodeMirror
                  ref={(dslEditor) => (this.dslEditor = dslEditor)}
                  options={{
                    mode: 'htmlmixed',
                    profile: 'xhtml',
                    gutters: [
                      'CodeMirror-linenumbers',
                      'CodeMirror-foldgutter',
                    ],
                    noAutocomplete: true,
                    matchTags: { bothTags: true },
                    prettier: true,
                    prettierParser: 'html',
                    emmet: true,
                  }}
                  prefs={this.props.prefs}
                  autoComplete={this.props.prefs.autoComplete}
                  onChange={this.onJsCodeChange.bind(this)}
                  onCursorMove={this.onCursorMove.bind(this)}
                  onCreation={(el) => (this.cm.js = el)}
                  onFocus={this.editorFocusHandler.bind(this)}
                />
              </div>
            </div>
            <div
              label="CSS"
              onBeforeActiviation={this.onCSSActiviation.bind(this)}
            >
              <div
                data-code-wrap-id="1"
                id="cssCodeEl"
                data-type="css"
                className="code-wrap"
                onTransitionEnd={this.updateCodeWrapCollapseStates.bind(this)}
              >
                <div
                  className="js-code-wrap__header  code-wrap__header"
                  titl
                  e="Double click to toggle code pane"
                  ondblclick={this.codeWrapHeaderDblClickHandler.bind(this)}
                >
                  <span className="caret" />
                  <label className="btn-group" title="Click to change">
                    <span className="code-wrap__header-label">
                      {modes[this.props.currentItem.cssMode || 'css'].label}
                    </span>

                    <select
                      data-type="css"
                      className="js-mode-select  hidden-select"
                      onChange={this.codeModeChangeHandler.bind(this)}
                      value={this.props.currentItem.cssMode}
                    >
                      <option value="css">CSS</option>
                      <option value="scss">SCSS</option>
                      <option value="sass">SASS</option>
                      <option value="less">LESS</option>
                      <option value="stylus">Stylus</option>
                      <option value="acss">Atomic CSS</option>
                    </select>
                  </label>
                  <div className="code-wrap__header-right-options">
                    <a
                      href="#"
                      id="cssSettingsBtn"
                      title="Atomic CSS configuration"
                      onClick={this.cssSettingsBtnClickHandler.bind(this)}
                      className="code-wrap__header-btn hide"
                    >
                      <svg>
                        <use xlinkHref="#settings-icon" />
                      </svg>
                    </a>
                    {/* <a
										className="js-code-collapse-btn  code-wrap__header-btn  code-wrap__collapse-btn"
										title="Toggle code pane"
										onClick={this.collapseBtnHandler.bind(this)}
									/> */}
                  </div>
                </div>
                <UserCodeMirror
                  ref={(cssEditor) => (this.cssEditor = cssEditor)}
                  options={{
                    mode: 'css',
                    gutters: [
                      'error-gutter',
                      'CodeMirror-linenumbers',
                      'CodeMirror-foldgutter',
                    ],
                    emmet: true,
                    prettier: true,
                    prettierParser: 'css',
                  }}
                  prefs={this.props.prefs}
                  onChange={this.onCssCodeChange.bind(this)}
                  onCreation={(el) => (this.cm.css = el)}
                  onFocus={this.editorFocusHandler.bind(this)}
                />
              </div>
            </div>
            {/*<div label="Cheat sheet">*/}
            {/*	<div*/}
            {/*		data-code-wrap-id="0"*/}
            {/*		id="htmlCodeEl"*/}
            {/*		data-type="html"*/}
            {/*		class="code-wrap"*/}
            {/*		onTransitionEnd={this.updateCodeWrapCollapseStates.bind(this)}*/}
            {/*	>*/}
            {/*		/!* <div*/}
            {/*		class="js-code-wrap__header  code-wrap__header"*/}
            {/*		onDblClick={this.codeWrapHeaderDblClickHandler.bind(this)}*/}
            {/*	>*/}
            {/*		<label class="btn-group" dropdow title="Click to change">*/}
            {/*			About*/}
            {/*		</label>*/}
            {/*		<div class="code-wrap__header-right-options">*/}
            {/*			<a*/}
            {/*				class="js-code-collapse-btn  code-wrap__header-btn  code-wrap__collapse-btn"*/}
            {/*				title="Toggle code pane"*/}
            {/*				onClick={this.collapseBtnHandler.bind(this)}*/}
            {/*			/>*/}
            {/*		</div>*/}
            {/*	</div> *!/*/}
            {/*		<div className="cheat-sheet">*/}
            {/*			<table>*/}
            {/*				<tr>*/}
            {/*					<th>Feature</th>*/}
            {/*					<th>Sample</th>*/}
            {/*				</tr>*/}
            {/*				<tr>*/}
            {/*					<td>Participant</td>*/}
            {/*					<td>*/}
            {/*						ParticipantA*/}
            {/*						<br />*/}
            {/*						ParticipantB*/}
            {/*					</td>*/}
            {/*				</tr>*/}
            {/*				<tr>*/}
            {/*					<td>Message</td>*/}
            {/*					<td>A.messageA()</td>*/}
            {/*				</tr>*/}
            {/*				<tr>*/}
            {/*					<td>Asyc message</td>*/}
            {/*					<td>Alice-&gt;Bob: How are you?</td>*/}
            {/*				</tr>*/}
            {/*				<tr>*/}
            {/*					<td>Nested message</td>*/}
            {/*					<td>*/}
            {/*						A.messageA() {'{'}*/}
            {/*						<br />*/}
            {/*						&nbsp;&nbsp;B.messageB()*/}
            {/*						<br />*/}
            {/*						{'}'}*/}
            {/*					</td>*/}
            {/*				</tr>*/}
            {/*				<tr>*/}
            {/*					<td class="tg-0pky">Self-message</td>*/}
            {/*					<td class="tg-0pky">internalMessage()</td>*/}
            {/*				</tr>*/}
            {/*				<tr>*/}
            {/*					<td>Alt</td>*/}
            {/*					<td>*/}
            {/*						if (condition1) {'{'}*/}
            {/*						<br />*/}
            {/*						&nbsp;&nbsp;A.methodA()*/}
            {/*						<br />*/}
            {/*						{'}'} else if (condition2) {'{'}*/}
            {/*						<br />*/}
            {/*						&nbsp;&nbsp;B.methodB()*/}
            {/*						<br />*/}
            {/*						{'}'} else {'{'}*/}
            {/*						<br />*/}
            {/*						&nbsp;&nbsp;C.methodC()*/}
            {/*						<br />*/}
            {/*						{'}'}*/}
            {/*					</td>*/}
            {/*				</tr>*/}
            {/*				<tr>*/}
            {/*					<td>Loop</td>*/}
            {/*					<td>*/}
            {/*						while (condition) {'{'}*/}
            {/*						<br />*/}
            {/*						&nbsp;&nbsp;A.methodA()*/}
            {/*						<br />*/}
            {/*						{'}'}*/}
            {/*					</td>*/}
            {/*				</tr>*/}
            {/*			</table>*/}
            {/*		</div>*/}
            {/*	</div>*/}
            {/*</div>*/}
          </Tabs>
        </div>
        {/*<SplitPane*/}
        {/*class="code-side"*/}
        {/*id="js-code-side"*/}
        {/*sizes={this.state.codeSplitSizes}*/}
        {/*minSize={minCodeWrapSize}*/}
        {/*direction={*/}
        {/*this.props.currentLayoutMode === 2 ||*/}
        {/*this.props.currentLayoutMode === 5*/}
        {/*? 'horizontal'*/}
        {/*: 'vertical'*/}
        {/*}*/}
        {/*onDragStart={this.codeSplitDragStart.bind(this)}*/}
        {/*onDragEnd={this.codeSplitDragEnd.bind(this)}*/}
        {/*onSplit={splitInstance => (this.codeSplitInstance = splitInstance)}*/}
        {/*>*/}
        {/**/}
        {/**/}
        {/*</Tabs>*/}
        <div class="demo-side" id="js-demo-side">
          <div className="h-full flex flex-col">
            <div
              className="flex-grow"
              style="overflow-y: auto; -webkit-overflow-scrolling: touch; "
            >
              <iframe
                ref={(el) => (this.frame = el)}
                frameBorder="0"
                id="demo-frame"
                allowFullScreen
              />
            </div>
            {window.zenumlDesktop ? null : (
              <div className="shrink-0 relative z-10 bg-gray-200 py-2 px-6 flex justify-between">
                <div className="flex gap-4 items-center">
                  <button
                    onClick={() => this.props.layoutBtnClickHandler(1)}
                    id="layoutBtn1"
                    className="w-7 h-7 hover:bg-gray-300 flex items-center justify-center rounded-lg duration-200"
                    aria-label="Switch to layout with preview on right"
                  >
                    <svg className="w-5 h-5">
                      <use xlinkHref="#icon-layout-1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => this.props.layoutBtnClickHandler(2)}
                    id="layoutBtn2"
                    className="w-7 h-7 hover:bg-gray-300 flex items-center justify-center rounded-lg duration-200"
                    aria-label="Switch to layout with preview on bottom"
                  >
                    <svg className="w-5 h-5">
                      <use xlinkHref="#icon-layout-2" />
                    </svg>
                  </button>
                  <button
                    onClick={() => this.props.layoutBtnClickHandler(3)}
                    id="layoutBtn3"
                    className="w-7 h-7 hover:bg-gray-300 flex items-center justify-center rounded-lg duration-200"
                    aria-label="Switch to layout with preview on left"
                  >
                    <svg className="w-5 h-5">
                      <use xlinkHref="#icon-layout-3" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-3 text-sm font-semibold">
                  <button
                    className="px-3 py-1 bg-gray-300 text-gray-600 flex items-center gap-1.5 rounded-lg hover:bg-gray-400 duration-200"
                    aria-label="Export as PNG"
                    onClick={this.exportPngClickHandler.bind(this)}
                  >
                    <svg className="w-5 h-5 fill-current">
                      <use xlinkHref="#icon-download" />
                    </svg>
                    <span>PNG</span>
                  </button>
                  <button
                    className="px-3 py-1 bg-gray-300 text-gray-600 flex items-center gap-1.5 rounded-lg hover:bg-gray-400 duration-200"
                    aria-label="Copy PNG to Clipboard"
                    onClick={this.copyImageClickHandler.bind(this)}
                  >
                    <svg className="w-5 h-5 fill-current">
                      <use xlinkHref="#icon-copy" />
                    </svg>
                    <span>Copy PNG</span>
                  </button>
                </div>
              </div>
            )}
            <Console
              isConsoleOpen={this.state.isConsoleOpen}
              onConsoleHeaderDblClick={this.consoleHeaderDblClickHandler.bind(
                this,
              )}
              onClearConsoleBtnClick={this.clearConsoleBtnClickHandler.bind(
                this,
              )}
              toggleConsole={this.toggleConsole.bind(this)}
              onEvalInputKeyup={this.evalConsoleExpr.bind(this)}
              onReady={(el) => (this.consoleCm = el)}
            />
            <CssSettingsModal
              show={this.state.isCssSettingsModalOpen}
              closeHandler={async () =>
                await this.setState({ isCssSettingsModalOpen: false })
              }
              onChange={this.cssSettingsChangeHandler.bind(this)}
              settings={this.props.currentItem.cssSettings}
              editorTheme={this.props.prefs.editorTheme}
            />
          </div>
        </div>
      </SplitPane>
    );
  }
}
