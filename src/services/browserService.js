const currentBrowserTab = {
  setTitle: (title) => {
    window.document.title = title || 'ZenUML | Untitled';
  },
  getTitle: () => window.document.title,
};
export { currentBrowserTab };
