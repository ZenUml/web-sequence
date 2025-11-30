import { h } from 'preact';

export const FolderRow = ({ folder, isOpen, onToggle, onRename, onDelete, itemCount }) => {
  return (
    <div class="flex items-center justify-between py-2 text-gray-400 hover:text-gray-200 group cursor-pointer rounded transition-colors">
      <div class="flex items-center gap-2 flex-grow overflow-hidden" onClick={onToggle}>
        <span class="material-symbols-outlined text-lg transition-transform duration-200">
          {isOpen ? 'expand_more' : 'chevron_right'}
        </span>
        <span class="material-symbols-outlined text-lg text-yellow-500">
          {isOpen ? 'folder_open' : 'folder'}
        </span>
        <span class="font-medium text-gray-300 truncate">{folder.name}</span>
        <span class="text-sm text-gray-500">({itemCount})</span>
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onRename(folder); }} 
          class="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-gray-200 transition-colors"
          title="Rename Folder"
        >
          <span class="material-symbols-outlined text-lg">edit</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(folder); }} 
          class="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400 transition-colors"
          title="Delete Folder"
        >
          <span class="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
    </div>
  );
};
