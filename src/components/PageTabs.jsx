import React from 'react';

/**
 * PageTabs component displays tabs for each page and handles tab switching
 * 
 * @param {Object} props - Component props
 * @param {Array} props.pages - Array of page objects
 * @param {String} props.currentPageId - ID of the currently active page
 * @param {Function} props.onTabClick - Callback function when a tab is clicked
 * @param {Function} props.onAddPage - Callback function when the add page button is clicked
 */
export function PageTabs({ pages, currentPageId, onTabClick, onAddPage }) {
  if (!pages || pages.length === 0) {
    return null;
  }

  /**
   * Wrapper for the onAddPage callback to properly handle the event object.
   * This prevents the synthetic event from being passed to the App's addNewPage method,
   * which expects either no parameters or a title string, not an event object.
   * Without this wrapper, the event object would cause errors when passed to addNewPage.
   */
  const handleAddPage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onAddPage === 'function') {
      onAddPage();
    }
  };

  return (
    <div className="page-tabs bg-black-500 border-b border-black-700 px-2 py-1 flex overflow-x-auto items-center">
      {pages.map(page => (
        <button
          key={page.id}
          className={`px-4 py-2 mx-1 rounded-t-lg text-sm font-medium transition-colors duration-200 ${
            page.id === currentPageId
              ? 'bg-primary text-white'
              : 'bg-black-600 text-gray-400 hover:bg-black-700 hover:text-gray-300'
          }`}
          onClick={() => onTabClick(page.id)}
        >
          {page.title || 'Untitled'}
        </button>
      ))}
      <button
        className="ml-2 px-3 py-2 bg-black-600 text-gray-400 hover:bg-black-700 hover:text-gray-300 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
        onClick={handleAddPage}
        title="Add new page"
      >
        <span className="mr-1 font-bold text-lg leading-none">+</span>
        Add Page
      </button>
    </div>
  );
}

export default PageTabs;
