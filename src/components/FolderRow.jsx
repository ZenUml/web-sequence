import { h } from 'preact';

export const FolderRow = ({ folder, isOpen, onToggle, onRename, onDelete, itemCount }) => {
  return (
    <div class="flex items-center justify-between p-2 rounded-md hover:bg-white/10 text-white/80 group cursor-pointer">
      <div class="flex items-center gap-2 flex-grow overflow-hidden" onClick={onToggle}>
        <span class="material-symbols-outlined text-base">
          {isOpen ? 'expand_more' : 'chevron_right'}
        </span>
        <span class="material-symbols-outlined text-base text-yellow-500">
          {isOpen ? 'folder_open' : 'folder'}
        </span>
        <span class="truncate">{folder.name}</span>
        <span class="text-white/50 text-xs">({itemCount})</span>
      </div>
      <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onRename(folder); }} 
          class="p-0.5 hover:bg-white/10 rounded text-white/50 hover:text-white transition-colors"
          title="Rename Folder"
        >
          <span class="material-symbols-outlined text-base">edit</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(folder); }} 
          class="p-0.5 hover:bg-white/10 rounded text-white/50 hover:text-red-400 transition-colors"
          title="Delete Folder"
        >
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
      </div>
    </div>
  );
};
