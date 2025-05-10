import React from 'preact';

/**
 * PageTabs component displays tabs for each page and handles tab switching
 *
 * @param {Object} props - Component props
 * @param {Array} props.pages - Array of page objects
 * @param {String} props.currentPageId - ID of the currently active page
 * @param {Function} props.onTabClick - Callback function when a tab is clicked
 */
export function PageTabs({ pages, currentPageId, onTabClick }) {
  if (!pages || pages.length === 0) {
    return null;
  }

  return (
    <div className="page-tabs bg-black-500 border-b border-black-700 px-2 py-1 flex overflow-x-auto">
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
    </div>
  );
}

export default PageTabs;
