import { create } from 'zustand';

// `activeFolderId`:
//   null        → show all items (no folder filter)
//   'unfiled'   → show only items not in any folder
//   string      → a specific folder id
export type ActiveFolderId = string | null | 'unfiled';
export type LibrarySort = 'updated' | 'title';

interface LibraryState {
  query: string;
  activeFolderId: ActiveFolderId;
  sort: LibrarySort;
  setQuery(q: string): void;
  setActiveFolder(id: ActiveFolderId): void;
  setSort(s: LibrarySort): void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  query: '',
  activeFolderId: null,
  sort: 'updated',
  setQuery: (query) => set({ query }),
  setActiveFolder: (activeFolderId) => set({ activeFolderId }),
  setSort: (sort) => set({ sort }),
}));
