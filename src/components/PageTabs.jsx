import { Component } from 'preact';
import DeletePageModal from './DeletePageModal';

/**
 * PageTabs component displays tabs for each page and handles tab switching
 */
export class PageTabs extends Component {
  state = {
    isCloseModalOpen: false,
    pageToClose: null,
  };

  /**
   * Wrapper for the onAddPage callback to properly handle the event object.
   * This prevents the synthetic event from being passed to the App's addNewPage method,
   * which expects either no parameters or a title string, not an event object.
   * Without this wrapper, the event object would cause errors when passed to addNewPage.
   */
  handleAddPage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof this.props.onAddPage === 'function') {
      this.props.onAddPage();
    }
  };

  handleDeleteClick = (e, pageId) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ pageToClose: pageId, isCloseModalOpen: true });
  };

  handleConfirmDelete = () => {
    if (this.state.pageToClose) {
      this.props.onDeletePage(this.state.pageToClose);
    }
    this.setState({ isCloseModalOpen: false, pageToClose: null });
  };

  handleCancelDelete = () => {
    this.setState({ isCloseModalOpen: false, pageToClose: null });
  };

  render() {
    const { pages, currentPageId, onTabClick, onToggleFullscreen, onExportPng, onCopyImage } = this.props;
    const { isCloseModalOpen } = this.state;

    if (!pages || pages.length === 0) {
      return null;
    }

    return (
      <>
        <div className="page-tabs bg-black-500 border-b border-black-700 px-2 py-1 flex overflow-x-auto items-center justify-between">
          <div className="flex items-center">
            {pages.map((page, index) => {
              return (
                <div
                  key={page.id}
                  className={`relative flex items-center group rounded-t-lg group mx-1 px-3 py-1 gap-2 ${page.id === currentPageId ? 'bg-black-500' : 'bg-black-600'} ${index === 0 ? '' : 'pr-7'}`}
                >
                  <button
                    className={`text-sm font-normal w-full h-full ${page.id === currentPageId
                        ? 'text-white'
                        : 'text-gray-400'}`}
                    onClick={() => onTabClick(page.id)}
                  >
                    {page.title || 'Untitled'}
                  </button>
                  {index !== 0 && <button
                    onClick={(e) => this.handleDeleteClick(e, page.id)}
                    className={`p-1 rounded-full opacity-0 group-hover:opacity-100  absolute right-1 top-1/2 -translate-y-1/2 ${page.id === currentPageId
                        ? 'text-white'
                        : 'text-gray-400'}`}
                    title="Delete page"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>}
                </div>
              );
            })}
            <button
              className="ml-1 px-3 py-1 bg-black-600 text-gray-400 hover:bg-black-700 hover:text-gray-300 rounded-lg text-sm font-normal transition-colors duration-200 flex items-center"
              onClick={this.handleAddPage}
              title="Add new page"
            >
              <span className="mr-1 font-normal text-lg leading-none">+</span>
              Add Page
            </button>
          </div>
          {!window.zenumlDesktop && (
            <div className="flex items-center gap-2 text-sm font-normal ml-4">
              <button
                className="px-3 py-1 bg-black-600 text-gray-400 flex items-center gap-1.5 rounded-lg hover:bg-black-700 hover:text-gray-300 duration-200"
                aria-label="Toggle Fullscreen"
                onClick={onToggleFullscreen}
                title="Toggle Fullscreen Presenting Mode"
              >
                <svg className="w-4 h-4 fill-current">
                  <use xlinkHref="#fullscreen-icon"/>
                </svg>
                <span>Present</span>
              </button>
              <button
                className="px-3 py-1 bg-black-600 text-gray-400 flex items-center gap-1.5 rounded-lg hover:bg-black-700 hover:text-gray-300 duration-200"
                aria-label="Export as PNG"
                onClick={onExportPng}
              >
                <svg className="w-4 h-4 fill-current">
                  <use xlinkHref="#icon-download"/>
                </svg>
                <span>PNG</span>
              </button>
              <button
                className="px-3 py-1 bg-black-600 text-gray-400 flex items-center gap-1.5 rounded-lg hover:bg-black-700 hover:text-gray-300 duration-200"
                aria-label="Copy PNG to Clipboard"
                onClick={onCopyImage}
              >
                <svg className="w-4 h-4 fill-current">
                  <use xlinkHref="#icon-copy"/>
                </svg>
                <span>Copy PNG</span>
              </button>
            </div>
          )}
        </div>
        <DeletePageModal
          open={isCloseModalOpen}
          onClose={this.handleCancelDelete}
          onConfirm={this.handleConfirmDelete}
        />
      </>
    );
  }
}

export default PageTabs;
