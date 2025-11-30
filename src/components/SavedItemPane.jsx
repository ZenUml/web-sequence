import { h, Component } from 'preact';
import { log } from '../utils';
import { trackEvent } from '../analytics';
import { ItemTile } from './ItemTile';
import { folderService } from '../services/folderService';
import { FolderRow } from './FolderRow';
import { alertsService } from '../notifications';
import { itemService } from '../itemService';

export default class SavedItemPane extends Component {
  constructor(props) {
    super(props);
    this.items = [];
    this.state = {
      searchText: null,
      folders: [],
      expandedFolders: {},
    };
  }

  componentWillUpdate(nextProps) {
    if (this.props.items !== nextProps.items) {
      this.items = Object.values(nextProps.items);
      this.items.sort(function (a, b) {
        return b.updatedOn - a.updatedOn;
      });
    }
  }

  async componentDidMount() {
    await this.fetchFolders();
  }

  async componentDidUpdate(prevProps) {
    if (this.props.isOpen && !prevProps.isOpen) {
      window.searchInput.value = '';
      await this.fetchFolders();
    }
  }

  async fetchFolders() {
    try {
      const folders = await folderService.getFolders();
      // Sort folders by name or update time? Let's sort by name
      folders.sort((a, b) => a.name.localeCompare(b.name));
      
      // Initialize expanded state for new folders (default: collapsed)
      // Or maybe expand all by default? Let's keep collapsed.
      // If we want to remember expansion state, we can keep it in state.
      
      this.setState({ folders });
    } catch (error) {
      console.error('Error fetching folders', error);
    }
  }

  async createFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;

    try {
      const folder = await folderService.createFolder(name);
      this.setState({
        folders: [...this.state.folders, folder].sort((a, b) => a.name.localeCompare(b.name)),
        expandedFolders: { ...this.state.expandedFolders, [folder.id]: true } // Auto-expand new folder
      });
      alertsService.add('Folder created');
      trackEvent('ui', 'folderCreated');
    } catch (error) {
      alertsService.add('Failed to create folder: ' + error.message);
    }
  }

  async renameFolder(folder) {
    const name = prompt('Enter new folder name:', folder.name);
    if (!name || name === folder.name) return;

    try {
      await folderService.renameFolder(folder.id, name);
      const folders = this.state.folders.map(f => 
        f.id === folder.id ? { ...f, name } : f
      ).sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ folders });
      alertsService.add('Folder renamed');
    } catch (error) {
      alertsService.add('Failed to rename folder: ' + error.message);
    }
  }

  async deleteFolder(folder) {
    if (!confirm(`Delete folder "${folder.name}"? Items inside will be moved to Unfiled.`)) return;

    try {
      await folderService.deleteFolder(folder.id);
      this.setState({
        folders: this.state.folders.filter(f => f.id !== folder.id)
      });
      alertsService.add('Folder deleted');
      // Ideally we should update items that were in this folder to remove folderId locally,
      // but next time items fetch they might still have it if backend didn't clear.
      // For now, UI will just show them as Unfiled because folder doesn't exist.
    } catch (error) {
      alertsService.add('Failed to delete folder: ' + error.message);
    }
  }

  toggleFolder(folder) {
    this.setState({
      expandedFolders: {
        ...this.state.expandedFolders,
        [folder.id]: !this.state.expandedFolders[folder.id]
      }
    });
  }

  async moveItemToFolder(item) {
    const folderName = prompt('Enter folder name to move to (leave empty to unfile):');
    if (folderName === null) return; // Cancelled

    let targetFolderId = null;
    
    if (folderName.trim()) {
      // Find folder by name
      const folder = this.state.folders.find(f => f.name.toLowerCase() === folderName.trim().toLowerCase());
      if (folder) {
        targetFolderId = folder.id;
      } else {
        if (confirm(`Folder "${folderName}" does not exist. Create it?`)) {
          try {
            const newFolder = await folderService.createFolder(folderName);
            this.setState({
              folders: [...this.state.folders, newFolder].sort((a, b) => a.name.localeCompare(b.name)),
              expandedFolders: { ...this.state.expandedFolders, [newFolder.id]: true }
            });
            targetFolderId = newFolder.id;
          } catch (e) {
            alertsService.add('Failed to create folder');
            return;
          }
        } else {
          return;
        }
      }
    }

    // Update item
    const updatedItem = { ...item, folderId: targetFolderId, updatedOn: Date.now() };
    
    try {
      await itemService.setItem(item.id, updatedItem);
      
      // Optimistic local update: update this.items array directly
      const itemIndex = this.items.findIndex(i => i.id === item.id);
      if (itemIndex !== -1) {
        this.items[itemIndex] = updatedItem;
      }
      
      // Also update in props.items if it exists (for consistency)
      if (this.props.items && this.props.items[item.id]) {
        this.props.items[item.id] = updatedItem;
      }
      
      // Get folder name for feedback message
      const targetFolderName = targetFolderId 
        ? this.state.folders.find(f => f.id === targetFolderId)?.name || 'folder'
        : 'Unfiled';
      alertsService.add(`Moved to ${targetFolderName}`);
      
      // Expand the target folder so user can see the moved item, then force re-render
      if (targetFolderId) {
        this.setState({
          expandedFolders: { ...this.state.expandedFolders, [targetFolderId]: true }
        });
      } else {
        // Force re-render to show the item in new location
        this.forceUpdate();
      }
    } catch (e) {
      alertsService.add('Failed to move item');
      console.error(e);
    }
  }

  onCloseIntent() {
    this.props.closeHandler();
  }

  itemClickHandler(item) {
    this.props.itemClickHandler(item);
  }

  itemRemoveBtnClickHandler(item, e) {
    e.stopPropagation();
    this.props.itemRemoveBtnClickHandler(item);
  }

  itemForkBtnClickHandler(item, e) {
    e.stopPropagation();
    this.props.itemForkBtnClickHandler(item);
  }

  itemMoveBtnClickHandler(item) {
    this.moveItemToFolder(item);
  }

  keyDownHandler(event) {
    if (!this.props.isOpen) {
      return;
    }

    const isCtrlOrMetaPressed = event.ctrlKey || event.metaKey;
    const isForkKeyPressed = isCtrlOrMetaPressed && event.keyCode === 70;
    const isDownKeyPressed = event.keyCode === 40;
    const isUpKeyPressed = event.keyCode === 38;
    const isEnterKeyPressed = event.keyCode === 13;

    const selectedItemElement = $('.js-saved-item-tile.selected');
    const havePaneItems = $all('.js-saved-item-tile').length !== 0;

    if ((isDownKeyPressed || isUpKeyPressed) && havePaneItems) {
      const method = isDownKeyPressed ? 'nextUntil' : 'previousUntil';

      if (selectedItemElement) {
        selectedItemElement.classList.remove('selected');
        selectedItemElement[method](
          '.js-saved-item-tile:not(.hide)',
        ).classList.add('selected');
      } else {
        $('.js-saved-item-tile:not(.hide)').classList.add('selected');
      }
      $('.js-saved-item-tile.selected').scrollIntoView(false);
    }

    if (isEnterKeyPressed && selectedItemElement) {
      const item = this.props.items[selectedItemElement.dataset.itemId];
      console.log('opening', item);
      this.props.itemClickHandler(item);
      trackEvent('ui', 'openItemKeyboardShortcut');
    }

    // Fork shortcut inside saved creations panel with Ctrl/⌘ + F
    if (isForkKeyPressed) {
      event.preventDefault();
      const item = this.props.items[selectedItemElement.dataset.itemId];
      this.props.itemForkBtnClickHandler(item);
      trackEvent('ui', 'forkKeyboardShortcut');
    }
  }

  importFileChangeHandler(e) {
    var file = e.target.files[0];

    var reader = new FileReader();
    reader.addEventListener('load', (progressEvent) => {
      var items;
      try {
        items = JSON.parse(progressEvent.target.result);
        log(items);
        this.props.mergeImportedItems(items);
      } catch (exception) {
        log(exception);
        alert(
          'Oops! Selected file is corrupted. Please select a file that was generated by clicking the "Export" button.',
        );
      }
    });

    reader.readAsText(file, 'utf-8');
  }

  importBtnClickHandler(e) {
    var input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.accept = 'accept="application/json';
    document.body.appendChild(input);
    input.addEventListener('change', this.importFileChangeHandler.bind(this));
    input.click();
    trackEvent('ui', 'importBtnClicked');
    e.preventDefault();
  }

  async searchInputHandler(e) {
    console.log('search input handler');
    const text = e.target.value;
    await this.setState({
      searchText: text,
    });
    trackEvent('ui', 'searchInputType');
  }

  filteredItems() {
    return this.items.filter(
      (item) => {
        const searchQuery = this.state.searchText?.toLowerCase() || '';
        const titleMatch = item.title?.toLowerCase().includes(searchQuery);
        const dslMatch = item.js?.toLowerCase().includes(searchQuery);

        return !this.state.searchText || titleMatch || dslMatch;
      },
    );
  }

  renderTree() {
    const { folders, expandedFolders } = this.state;
    const items = this.filteredItems();
    
    // Group items by folder
    const folderGroups = {};
    const unfiledItems = [];
    
    items.forEach(item => {
      // Check if item belongs to a valid folder
      if (item.folderId && folders.some(f => f.id === item.folderId)) {
        if (!folderGroups[item.folderId]) folderGroups[item.folderId] = [];
        folderGroups[item.folderId].push(item);
      } else {
        unfiledItems.push(item);
      }
    });

    return (
      <div>
        {folders.map(folder => {
          const folderItems = folderGroups[folder.id] || [];
          const isExpanded = expandedFolders[folder.id];
          
          return (
            <div key={folder.id}>
              <FolderRow 
                folder={folder} 
                isOpen={isExpanded} 
                itemCount={folderItems.length}
                onToggle={() => this.toggleFolder(folder)}
                onRename={this.renameFolder.bind(this)}
                onDelete={this.deleteFolder.bind(this)}
              />
              {isExpanded && (
                <div class="pl-4 border-l border-gray-700 ml-2">
                  {folderItems.map(item => (
                    <ItemTile
                      key={item.id}
                      item={item}
                      inline={true}
                      onClick={this.itemClickHandler.bind(this, item)}
                      onForkBtnClick={this.itemForkBtnClickHandler.bind(this, item)}
                      onRemoveBtnClick={this.itemRemoveBtnClickHandler.bind(this, item)}
                      onMoveBtnClick={this.itemMoveBtnClickHandler.bind(this, item)}
                    />
                  ))}
                  {folderItems.length === 0 && (
                    <div class="text-gray-500 text-sm italic pl-2 py-1">Empty folder</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Unfiled Items (or Root items) */}
        {unfiledItems.length > 0 && (
          <div class="mt-2">
            {folders.length > 0 && <div class="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2 px-2 mt-4">Unfiled</div>}
            {unfiledItems.map(item => (
              <ItemTile
                key={item.id}
                item={item}
                onClick={this.itemClickHandler.bind(this, item)}
                onForkBtnClick={this.itemForkBtnClickHandler.bind(this, item)}
                onRemoveBtnClick={this.itemRemoveBtnClickHandler.bind(this, item)}
                onMoveBtnClick={this.itemMoveBtnClickHandler.bind(this, item)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  render() {
    const isSearching = !!this.state.searchText;

    return (
      <div
        id="js-saved-items-pane"
        class={`flex flex-col fixed right-0 top-0 bottom-0 w-[450px] py-5 z-10 bg-black-400 duration-200 ease-in text-gray-500  ${this.props.isOpen ? 'translate-x-0 duration-300' : 'translate-x-full'}`}
        onKeyDown={this.keyDownHandler.bind(this)}
      >
        <button
          onClick={this.onCloseIntent.bind(this)}
          class="btn icon-button modal__close-btn w-7 h-7 rounded-md"
          id="js-saved-items-pane-close-btn"
        >
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
        <div class="flex items-center justify-between my-10 px-5">
          <div class="flex items-center gap-2">
            <h3 className="text-lg text-gray-200">
              My Library <span className="text-sm">({this.items.length})</span>
            </h3>
            <button 
              onClick={this.createFolder.bind(this)}
              class="text-xs h-7 px-2 text-gray-500 bg-black-600 hover:opacity-80 rounded-lg gap-1.5 flex items-center duration-200"
              title="Create New Folder"
            >
              <span class="material-symbols-outlined text-sm">create_new_folder</span>
            </button>
          </div>
          <div className="my-library-buttons">
            <button
              onClick={this.props.exportBtnClickHandler}
              class="text-xs h-7 px-2 text-gray-500 bg-black-600 hover:opacity-80 rounded-lg gap-1.5 flex items-center duration-200"
              aria-label="Export all your creations into a single importable file."
            >
              <svg className="w-4 h-4 fill-current">
                <use xlinkHref="#icon-download" />
              </svg>
              <span>Export</span>
            </button>
            <button
              onClick={this.importBtnClickHandler.bind(this)}
              class="text-xs h-7 px-2 text-gray-500 bg-black-600 hover:opacity-80 rounded-lg gap-1.5 flex items-center duration-200"
              aria-label="Import your creations. Only the file that you export through the 'Export' button can be imported."
            >
              <svg className="w-4 h-4 fill-current">
                <use xlinkHref="#icon-upload" />
              </svg>
              <span>Import</span>
            </button>
          </div>
        </div>
        <div className="px-5">
          <input
            id="searchInput"
            className="appearance-none px-3 py-2 w-full rounded-lg"
            onInput={this.searchInputHandler.bind(this)}
            placeholder="Search your creations..."
          />
        </div>

        <div id="js-saved-items-wrap" class="px-5 overflow-y-auto flex-grow mt-4">
          {!this.filteredItems().length && this.items.length ? (
            <div class="mt-1">No match found.</div>
          ) : null}
          
          {isSearching ? (
            // Flat list when searching
            this.filteredItems().map((item) => (
              <ItemTile
                key={item.id}
                item={item}
                onClick={this.itemClickHandler.bind(this, item)}
                onForkBtnClick={this.itemForkBtnClickHandler.bind(this, item)}
                onRemoveBtnClick={this.itemRemoveBtnClickHandler.bind(this, item)}
                onMoveBtnClick={this.itemMoveBtnClickHandler.bind(this, item)}
              />
            ))
          ) : (
            // Tree view when not searching
            this.renderTree()
          )}
          
          {!this.items.length ? (
            <h2 class="opacity--30">Nothing saved here.</h2>
          ) : null}
        </div>
      </div>
    );
  }
}
