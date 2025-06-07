import { Component } from 'preact';
import ClosePageModal from './ClosePageModal';

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

  handleCloseClick = (e, pageId) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ pageToClose: pageId, isCloseModalOpen: true });
  };

  handleConfirmClose = () => {
    if (this.state.pageToClose) {
      this.props.onClosePage(this.state.pageToClose);
    }
    this.setState({ isCloseModalOpen: false, pageToClose: null });
  };

  handleCancelClose = () => {
    this.setState({ isCloseModalOpen: false, pageToClose: null });
  };

  render() {
    const { pages, currentPageId, onTabClick } = this.props;
    const { isCloseModalOpen } = this.state;

    if (!pages || pages.length === 0) {
      return null;
    }

    return (
      <>
        <div className="page-tabs bg-black-500 border-b border-black-700 px-2 py-1 flex overflow-x-auto items-center">
          {pages.map((page, index) => (
            <div
              key={page.id}
              className={`relative flex items-center group rounded-t-lg group mx-1 px-3 py-2 gap-2 ${
                page.id === currentPageId ? 'bg-primary' : 'bg-black-600'
              } ${index === 0 ? '' : 'pr-7'}`}
            >
              <button
                className={`text-sm font-medium w-full h-full ${
                  page.id === currentPageId
                    ? 'text-white'
                    : 'text-gray-400'
                }`}
                onClick={() => onTabClick(page.id)}
              >
                {page.title || 'Untitled'}
              </button>
              {index !== 0 && <button
                onClick={(e) => this.handleCloseClick(e, page.id)}
                className={`p-1 rounded-full opacity-0 group-hover:opacity-100  absolute right-1 top-1/2 -translate-y-1/2 ${
                  page.id === currentPageId
                    ? 'text-white'
                    : 'text-gray-400'
                }`}
                title="Close page"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>}
            </div>
          ))}
          <button
            className="ml-1 px-3 py-2 bg-black-600 text-gray-400 hover:bg-black-700 hover:text-gray-300 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
            onClick={this.handleAddPage}
            title="Add new page"
          >
            <span className="mr-1 font-bold text-lg leading-none">+</span>
            Add Page
          </button>
        </div>
        <ClosePageModal
          open={isCloseModalOpen}
          onClose={this.handleCancelClose}
          onConfirm={this.handleConfirmClose}
        />
      </>
    );
  }
}

export default PageTabs;
