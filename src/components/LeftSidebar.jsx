import { h, Component } from 'preact';
import LibraryPanel from './LibraryPanel.jsx';

export default class LeftSidebar extends Component {
  render() {
    const { 
      isLibraryPanelOpen, 
      activeLeftPanel,
      onToggleLibraryPanel,
      onSwitchPanel,
      // LibraryPanel props
      items,
      itemClickHandler,
      itemRemoveBtnClickHandler,
      itemForkBtnClickHandler,
      exportBtnClickHandler,
      mergeImportedItems,
    } = this.props;

    // When editor is active, we show a placeholder - the actual editor 
    // is repositioned via CSS from ContentWrap
    const showEditorPlaceholder = activeLeftPanel === 'editor';

    return (
      <div class="flex shrink-0">
        {/* Icon Bar */}
        <div class="flex flex-col items-center gap-2 bg-[#111722] p-2 border-r border-white/10">
          <button 
            class={`p-2.5 rounded-md transition-colors ${
              activeLeftPanel === 'library' && isLibraryPanelOpen
                ? 'text-white bg-[#232f48]' 
                : 'text-white/70 hover:text-white hover:bg-[#232f48]'
            }`}
            onClick={() => {
              if (activeLeftPanel === 'library' && isLibraryPanelOpen) {
                onToggleLibraryPanel();
              } else {
                onSwitchPanel('library');
                if (!isLibraryPanelOpen) {
                  onToggleLibraryPanel();
                }
              }
            }}
            title="My Library"
          >
            <span class="material-symbols-outlined">folder_open</span>
          </button>
          <button 
            class={`p-2.5 rounded-md transition-colors ${
              activeLeftPanel === 'editor'
                ? 'text-white bg-[#232f48]' 
                : 'text-white/70 hover:text-white hover:bg-[#232f48]'
            }`}
            onClick={() => {
              if (activeLeftPanel === 'editor') {
                // Toggle off - switch to library but keep it closed
                onSwitchPanel('library');
              } else {
                onSwitchPanel('editor');
              }
            }}
            title="Code Editor"
          >
            <span class="material-symbols-outlined">code_blocks</span>
          </button>
        </div>

        {/* Library Panel - only show when library is active */}
        {activeLeftPanel === 'library' && isLibraryPanelOpen && (
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
