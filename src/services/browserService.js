const currentBrowserTab = {
  setTitle: (title) => {
    window.document.title = title;
  },
  getTitle: () => window.document.title,
};
export { currentBrowserTab };
