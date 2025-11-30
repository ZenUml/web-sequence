import { h } from 'preact';

export const FolderRow = ({ folder, isOpen, onToggle, onRename, onDelete, itemCount }) => {
  return (
    <div class="flex items-center justify-between py-1.5 text-gray-600 dark:text-gray-400">
      <div class="flex items-center space-x-1.5 flex-grow overflow-hidden cursor-pointer" onClick={onToggle}>
        <span class="material-symbols-outlined text-lg">
          {isOpen ? 'expand_more' : 'chevron_right'}
        </span>
        <span class="material-symbols-outlined text-lg text-yellow-500">
          {isOpen ? 'folder_open' : 'folder'}
        </span>
        <span class="font-medium text-gray-800 dark:text-gray-200 truncate">{folder.name}</span>
        <span class="text-sm">({itemCount})</span>
      </div>
      <div class="flex items-center space-x-1">
        <button 
          onClick={(e) => { e.stopPropagation(); onRename(folder); }} 
          class="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          title="Rename Folder"
        >
          <span class="material-symbols-outlined text-lg">edit</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(folder); }} 
          class="hover:text-red-500 transition-colors"
          title="Delete Folder"
        >
          <span class="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
    </div>
  );
};
