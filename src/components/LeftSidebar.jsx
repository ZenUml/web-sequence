import { h, Component } from 'preact';
import LibraryPanel from './LibraryPanel.jsx';

export default class LeftSidebar extends Component {
  render() {
    const { 
      isLibraryPanelOpen,
      isEditorPanelOpen,
      activeLeftPanel,
      onToggleLibraryPanel,
      onToggleEditorPanel,
      onSwitchPanel,
      onSettingsClick,
      onCheatsheetClick,
      onShortcutsClick,
      // LibraryPanel props
      items,
      itemClickHandler,
      itemRemoveBtnClickHandler,
      itemForkBtnClickHandler,
      exportBtnClickHandler,
      mergeImportedItems,
    } = this.props;

    // Check if panels are active and open
    const isLibraryActive = activeLeftPanel === 'library' && isLibraryPanelOpen;
    const isEditorActive = activeLeftPanel === 'editor' && isEditorPanelOpen;

    return (
      <div class="flex shrink-0">
        {/* Icon Bar */}
        <div class="flex flex-col items-center gap-2 bg-[#111722] p-2 border-r border-white/10 justify-between h-full">
          <div class="flex flex-col items-center gap-2">
            <button 
              class={`p-2.5 rounded-md transition-colors ${
                isLibraryActive
                  ? 'text-white bg-[#232f48]' 
                  : 'text-white/70 hover:text-white hover:bg-[#232f48]'
              }`}
              onClick={() => {
                if (activeLeftPanel === 'library') {
                  // Toggle library panel open/close
                  onToggleLibraryPanel();
                } else {
                  // Switch to library and open it
                  onSwitchPanel('library');
                }
              }}
              title="My Library"
            >
              <span class="material-symbols-outlined">folder_open</span>
            </button>
            <button 
              class={`p-2.5 rounded-md transition-colors ${
                isEditorActive
                  ? 'text-white bg-[#232f48]' 
                  : 'text-white/70 hover:text-white hover:bg-[#232f48]'
              }`}
              onClick={() => {
                if (activeLeftPanel === 'editor') {
                  // Toggle editor panel open/close
                  onToggleEditorPanel();
                } else {
                  // Switch to editor and open it
                  onSwitchPanel('editor');
                }
              }}
              title="Code Editor"
            >
              <span class="material-symbols-outlined">code_blocks</span>
            </button>
          </div>
          <div class="flex flex-col items-center gap-2">
            <button 
              class="p-2.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-[#232f48]"
              onClick={onShortcutsClick}
              title="Keyboard Shortcuts"
            >
              <span class="material-symbols-outlined">keyboard</span>
            </button>
            <button 
              class="p-2.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-[#232f48]"
              onClick={onCheatsheetClick}
              title="Cheatsheet"
            >
              <span class="material-symbols-outlined">quick_reference</span>
            </button>
            <a 
              class="p-2.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-[#232f48]"
              href="https://zenuml.com/docs/category/language-guide"
              target="_blank"
              title="Language Guide"
            >
              <span class="material-symbols-outlined">menu_book</span>
            </a>
            <button 
              class="p-2.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-[#232f48]"
              onClick={onSettingsClick}
              title="Settings"
            >
              <span class="material-symbols-outlined">settings</span>
            </button>
          </div>
        </div>

        {/* Library Panel - only show when library is active and open */}
        {isLibraryActive && (
          <LibraryPanel
            items={items}
            onClose={onToggleLibraryPanel}
            itemClickHandler={itemClickHandler}
            itemRemoveBtnClickHandler={itemRemoveBtnClickHandler}
            itemForkBtnClickHandler={itemForkBtnClickHandler}
            exportBtnClickHandler={exportBtnClickHandler}
            mergeImportedItems={mergeImportedItems}
          />
        )}
      </div>
    );
  }
}
