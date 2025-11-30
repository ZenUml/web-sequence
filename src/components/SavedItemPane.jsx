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
      if (window.searchInput) {
        window.searchInput.value = '';
      }
      await this.fetchFolders();
    }
  }

  async fetchFolders() {
    try {
      const folders = await folderService.getFolders();
      folders.sort((a, b) => a.name.localeCompare(b.name));
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
        expandedFolders: { ...this.state.expandedFolders, [folder.id]: true }
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
    if (folderName === null) return;

    let targetFolderId = null;
    
    if (folderName.trim()) {
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

    const updatedItem = { ...item, folderId: targetFolderId, updatedOn: Date.now() };
    
    try {
      await itemService.setItem(item.id, updatedItem);
      
      const itemIndex = this.items.findIndex(i => i.id === item.id);
      if (itemIndex !== -1) {
        this.items[itemIndex] = updatedItem;
      }
      
      if (this.props.items && this.props.items[item.id]) {
        this.props.items[item.id] = updatedItem;
      }
      
      const targetFolderName = targetFolderId 
        ? this.state.folders.find(f => f.id === targetFolderId)?.name || 'folder'
        : 'Unfiled';
      alertsService.add(`Moved to ${targetFolderName}`);
      
      if (targetFolderId) {
        this.setState({
          expandedFolders: { ...this.state.expandedFolders, [targetFolderId]: true }
        });
      } else {
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
    
    const folderGroups = {};
    const unfiledItems = [];
    
    items.forEach(item => {
      if (item.folderId && folders.some(f => f.id === item.folderId)) {
        if (!folderGroups[item.folderId]) folderGroups[item.folderId] = [];
        folderGroups[item.folderId].push(item);
      } else {
        unfiledItems.push(item);
      }
    });

    return (
      <div class="space-y-3">
        {/* Folders */}
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
                <div class="pl-5 space-y-1.5">
                  {folderItems.map(item => (
                    <ItemTile
                      key={item.id}
                      item={item}
                      compact={true}
                      onClick={this.itemClickHandler.bind(this, item)}
                      onForkBtnClick={this.itemForkBtnClickHandler.bind(this, item)}
                      onRemoveBtnClick={this.itemRemoveBtnClickHandler.bind(this, item)}
                      onMoveBtnClick={this.itemMoveBtnClickHandler.bind(this, item)}
                    />
                  ))}
                  {folderItems.length === 0 && (
                    <div class="text-gray-500 text-sm italic py-1.5">Empty folder</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Unfiled Items */}
        {unfiledItems.length > 0 && (
          <div>
            <div class="flex items-center justify-between py-1.5 text-gray-600 dark:text-gray-400">
              <div class="flex items-center space-x-1.5">
                <span class="material-symbols-outlined text-lg">expand_more</span>
                <span class="font-medium text-gray-800 dark:text-gray-200">UNFILED</span>
                <span class="text-sm">({unfiledItems.length})</span>
              </div>
            </div>
            <div class="space-y-1.5">
              {unfiledItems.map(item => (
                <ItemTile
                  key={item.id}
                  item={item}
                  compact={true}
                  onClick={this.itemClickHandler.bind(this, item)}
                  onForkBtnClick={this.itemForkBtnClickHandler.bind(this, item)}
                  onRemoveBtnClick={this.itemRemoveBtnClickHandler.bind(this, item)}
                  onMoveBtnClick={this.itemMoveBtnClickHandler.bind(this, item)}
                />
              ))}
            </div>
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
        class={`h-screen w-full flex flex-col fixed right-0 top-0 bottom-0 w-[420px] z-10 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 shadow-2xl duration-300 ease-out ${this.props.isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        onKeyDown={this.keyDownHandler.bind(this)}
      >
        <div class="p-3 flex flex-col h-full">
          {/* Title Row */}
          <div class="flex items-center justify-between mb-3">
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">
              My Library ({this.items.length})
            </h1>
            <button 
              onClick={this.onCloseIntent.bind(this)}
              class="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              id="js-saved-items-pane-close-btn"
            >
              <span class="material-symbols-outlined text-gray-600 dark:text-gray-400">close</span>
            </button>
          </div>

          {/* Search Input */}
          <div class="mb-3">
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                search
              </span>
              <input
                id="searchInput"
                class="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-transparent rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                onInput={this.searchInputHandler.bind(this)}
                placeholder="Search your creations..."
              />
            </div>
          </div>

          {/* Action Buttons Row */}
          <div class="flex items-center justify-between mb-3">
            <button 
              onClick={this.createFolder.bind(this)}
              class="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <span class="material-symbols-outlined text-base">create_new_folder</span>
              <span>Add Folder</span>
            </button>
            <div class="flex items-center space-x-1">
              <button
                onClick={this.props.exportBtnClickHandler}
                class="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="Export all your creations"
                title="Export"
              >
                <span class="material-symbols-outlined text-gray-600 dark:text-gray-400">file_upload</span>
              </button>
              <button
                onClick={this.importBtnClickHandler.bind(this)}
                class="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="Import your creations"
                title="Import"
              >
                <span class="material-symbols-outlined text-gray-600 dark:text-gray-400">file_download</span>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div id="js-saved-items-wrap" class="flex-grow overflow-y-auto space-y-3">
            {!this.filteredItems().length && this.items.length ? (
              <div class="text-gray-500 text-center py-8">No match found.</div>
            ) : null}
            
            {isSearching ? (
              <div class="space-y-1.5">
                {this.filteredItems().map((item) => (
                  <ItemTile
                    key={item.id}
                    item={item}
                    compact={true}
                    onClick={this.itemClickHandler.bind(this, item)}
                    onForkBtnClick={this.itemForkBtnClickHandler.bind(this, item)}
                    onRemoveBtnClick={this.itemRemoveBtnClickHandler.bind(this, item)}
                    onMoveBtnClick={this.itemMoveBtnClickHandler.bind(this, item)}
                  />
                ))}
              </div>
            ) : (
              this.renderTree()
            )}
            
            {!this.items.length ? (
              <div class="text-gray-500 text-center py-12">
                <span class="material-symbols-outlined text-4xl mb-2 block">folder_off</span>
                <p>Nothing saved here yet.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
