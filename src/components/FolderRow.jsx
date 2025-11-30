import { h } from 'preact';

export const FolderRow = ({ folder, isOpen, onToggle, onRename, onDelete, itemCount }) => {
  return (
    <div class="folder-row flex items-center justify-between py-2 px-2 hover:bg-white/5 cursor-pointer group rounded select-none mb-1">
       <div class="flex items-center gap-2 flex-grow overflow-hidden" onClick={onToggle}>
         <span class="material-symbols-outlined text-gray-400 text-lg transition-transform duration-200">
           {isOpen ? 'expand_more' : 'chevron_right'}
         </span>
         <span class="material-symbols-outlined text-amber-400 text-xl">
           {isOpen ? 'folder_open' : 'folder'}
         </span>
         <span class="text-gray-300 font-medium truncate">{folder.name}</span>
         <span class="text-gray-500 text-xs">({itemCount})</span>
       </div>
       <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
         <button 
            onClick={(e) => { e.stopPropagation(); onRename(folder); }} 
            class="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
            title="Rename Folder"
         >
           <span class="material-symbols-outlined text-base">edit</span>
         </button>
         <button 
            onClick={(e) => { e.stopPropagation(); onDelete(folder); }} 
            class="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"
            title="Delete Folder"
         >
           <span class="material-symbols-outlined text-base">delete</span>
         </button>
       </div>
    </div>
  );
};

