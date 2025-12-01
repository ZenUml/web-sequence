import { h, Component } from 'preact';
import UserCodeMirror from './UserCodeMirror.jsx';
import Toolbox from './Toolbox.jsx';
import Tabs from './Tabs.jsx';
import { modes } from '../codeModes';

/**
 * EditorPanel - Code editor panel for the left sidebar
 * Contains ZenUML and CSS tabs with their respective editors
 */
export default class EditorPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      lineOfCode: 0,
    };
    this.cm = {};
    this.initialCodeSet = false;
  }

  componentDidUpdate(prevProps) {
    // Set initial code when editors are ready
    if (!this.initialCodeSet && this.cm.js && this.cm.css) {
      this.setInitialCode();
    }
    
    // Update code if currentItem changed (e.g., loading a different item)
    if (prevProps.currentItem?.id !== this.props.currentItem?.id) {
      this.initialCodeSet = false;
      this.setInitialCode();
    }
  }

  // Called when CodeMirror instances are created
  onJsEditorCreation(cm) {
    this.cm.js = cm;
    // Try to set initial code once both editors are ready
    setTimeout(() => this.setInitialCode(), 100);
  }

  onCssEditorCreation(cm) {
    this.cm.css = cm;
    // Try to set initial code once both editors are ready
    setTimeout(() => this.setInitialCode(), 100);
  }

  setInitialCode() {
    const { currentItem } = this.props;
    if (!currentItem) return;
    
    // Get code from current page or item
    let jsCode = '';
    let cssCode = '';
    
    if (currentItem.pages && currentItem.pages.length > 0) {
      const currentPage = currentItem.pages.find(p => p.id === currentItem.currentPageId) || currentItem.pages[0];
      jsCode = currentPage.js || '';
      cssCode = currentPage.css || '';
    } else {
      jsCode = currentItem.js || '';
      cssCode = currentItem.css || '';
    }
    
    if (this.cm.js && jsCode) {
      this.cm.js.setValue(jsCode);
      this.cm.js.refresh();
    }
    if (this.cm.css) {
      this.cm.css.setValue(cssCode);
      this.cm.css.refresh();
    }
    
    this.initialCodeSet = true;
  }

  onJsCodeChange(editor, change) {
    this.setState({ lineOfCode: editor.lineCount() });
    this.props.onCodeChange('js', editor.getValue(), change);
  }

  onCssCodeChange(editor, change) {
    this.props.onCodeChange('css', editor.getValue(), change);
  }

  onCursorMove(editor) {
    // Could be used for cursor position tracking
  }

  editorFocusHandler(editor) {
    this.props.onEditorFocus && this.props.onEditorFocus(editor);
  }

  onTabChanges(index) {
    // Track tab changes if needed
  }

  codeModeChangeHandler(e) {
    const mode = e.target.value;
    const type = e.target.dataset.type;
    this.props.onCodeModeChange && this.props.onCodeModeChange(type, mode);
  }

  cssSettingsBtnClickHandler(e) {
    e.preventDefault();
    this.props.onCssSettingsClick && this.props.onCssSettingsClick();
  }

  toolboxUpdateToApp(svg) {
    this.props.onToolboxClick && this.props.onToolboxClick(svg);
  }

  // Public methods that can be called from parent
  setCode(type, code) {
    if (type === 'js' && this.dslEditor) {
      this.dslEditor.setValue(code);
    } else if (type === 'css' && this.cssEditor) {
      this.cssEditor.setValue(code);
    }
  }

  getCode(type) {
    if (type === 'js' && this.dslEditor) {
      return this.dslEditor.getValue();
    } else if (type === 'css' && this.cssEditor) {
      return this.cssEditor.getValue();
    }
    return '';
  }

  refresh() {
    if (this.cm.js) this.cm.js.refresh();
    if (this.cm.css) this.cm.css.refresh();
  }

  render() {
    const { currentItem, prefs, keyboardShortcutsBtnClickHandler, onClose } = this.props;

    return (
      <aside class="flex flex-col bg-[#111722] border-r border-white/10 w-80 h-full overflow-hidden">
        {/* Header */}
        <div class="flex justify-between items-center p-3 border-b border-white/10">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#135bec] text-xl">code</span>
            <p class="text-white text-sm font-medium">Code Editor</p>
          </div>
          <button 
            class="p-1 text-white/60 hover:text-white"
            onClick={onClose}
            title="Collapse panel"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
        </div>

        {/* Editor Tabs */}
        <div class="flex-grow overflow-hidden editor-panel-content">
          <Tabs
            keyboardShortcutsBtnClickHandler={keyboardShortcutsBtnClickHandler}
            ref={(tabs) => (this.tabsRef = tabs)}
            onChange={this.onTabChanges.bind(this)}
            style="display:flex;flex-direction: column; height: 100%;"
            darkMode={true}
          >
            <div label="ZenUML" lineOfCode={this.state.lineOfCode}>
              <div
                data-code-wrap-id="2"
                id="editorPanelJsCodeEl"
                data-type="js"
                className="code-wrap sidebar-code-wrap"
              >
                <Toolbox clickSvg={this.toolboxUpdateToApp.bind(this)} compact={true} />
                <UserCodeMirror
                  ref={(dslEditor) => (this.dslEditor = dslEditor)}
                  options={{
                    mode: 'javascript',
                    gutters: [
                      'CodeMirror-linenumbers',
                      'CodeMirror-foldgutter',
                    ],
                    noAutocomplete: true,
                    prettier: true,
                    prettierParser: 'babel',
                    emmet: false,
                    theme: 'monokai',
                  }}
                  prefs={prefs}
                  autoComplete={prefs.autoComplete}
                  onChange={this.onJsCodeChange.bind(this)}
                  onCursorMove={this.onCursorMove.bind(this)}
                  onCreation={this.onJsEditorCreation.bind(this)}
                  onFocus={this.editorFocusHandler.bind(this)}
                />
              </div>
            </div>
            <div
              label="CSS"
            >
              <div
                data-code-wrap-id="1"
                id="editorPanelCssCodeEl"
                data-type="css"
                className="code-wrap sidebar-code-wrap"
              >
                <div className="css-mode-selector flex items-center gap-2 px-2 py-1 bg-[#1a2332] border-b border-white/10">
                  <label className="flex items-center gap-1 text-xs text-white/70">
                    <span>Mode:</span>
                    <select
                      data-type="css"
                      className="bg-[#232f48] text-white text-xs rounded px-1 py-0.5 border border-white/20"
                      onChange={this.codeModeChangeHandler.bind(this)}
                      value={currentItem.cssMode || 'css'}
                    >
                      <option value="css">CSS</option>
                      <option value="scss">SCSS</option>
                      <option value="sass">SASS</option>
                      <option value="less">LESS</option>
                      <option value="stylus">Stylus</option>
                      <option value="acss">Atomic CSS</option>
                    </select>
                  </label>
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
                    theme: 'monokai',
                  }}
                  prefs={prefs}
                  onChange={this.onCssCodeChange.bind(this)}
                  onCreation={this.onCssEditorCreation.bind(this)}
                  onFocus={this.editorFocusHandler.bind(this)}
                />
              </div>
            </div>
          </Tabs>
        </div>
      </aside>
    );
  }
}

