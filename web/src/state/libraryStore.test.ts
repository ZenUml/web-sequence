import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore } from './libraryStore';

describe('libraryStore', () => {
  beforeEach(() =>
    useLibraryStore.setState({ query: '', activeFolderId: null, sort: 'updated' }),
  );

  it('has the expected defaults', () => {
    const s = useLibraryStore.getState();
    expect(s.query).toBe('');
    expect(s.activeFolderId).toBeNull();
    expect(s.sort).toBe('updated');
  });

  it('setQuery updates the query', () => {
    useLibraryStore.getState().setQuery('login flow');
    expect(useLibraryStore.getState().query).toBe('login flow');
  });

  it('setActiveFolder accepts a folder id, unfiled, and null', () => {
    useLibraryStore.getState().setActiveFolder('folder-1');
    expect(useLibraryStore.getState().activeFolderId).toBe('folder-1');

    useLibraryStore.getState().setActiveFolder('unfiled');
    expect(useLibraryStore.getState().activeFolderId).toBe('unfiled');

    useLibraryStore.getState().setActiveFolder(null);
    expect(useLibraryStore.getState().activeFolderId).toBeNull();
  });

  it('setSort updates the sort key', () => {
    useLibraryStore.getState().setSort('title');
    expect(useLibraryStore.getState().sort).toBe('title');
  });
});
