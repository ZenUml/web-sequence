import { getHumanDate } from '../utils';

export function ItemTile({
  item,
  onClick,
  onForkBtnClick,
  onRemoveBtnClick,
  onMoveBtnClick,
  focusable,
  compact,
}) {
  // Compact mode: simplified display matching the mockup
  if (compact) {
    return (
      <div
        role={focusable ? 'button' : null}
        tabindex={focusable ? 0 : null}
        class="js-saved-item-tile bg-gray-700 hover:bg-gray-600 p-3 rounded-lg flex justify-between items-center cursor-pointer transition-colors group"
        data-item-id={item.id}
        onClick={onClick}
      >
        <h2 class="font-semibold truncate text-white flex-1 min-w-0">
          {item.title || 'Untitled'}
        </h2>
        <div class="flex items-center gap-2 ml-2 flex-shrink-0">
          {/* Action buttons - show on hover */}
          <div class="hidden group-hover:flex items-center gap-1">
            {onMoveBtnClick && (
              <button
                class="p-1 hover:bg-gray-500 rounded text-gray-400 hover:text-white transition-colors"
                aria-label="Move to folder"
                onClick={(e) => { e.stopPropagation(); onMoveBtnClick(); }}
                title="Move to Folder"
              >
                <span class="material-symbols-outlined text-sm">drive_file_move</span>
              </button>
            )}
            {onForkBtnClick && (
              <button
                class="p-1 hover:bg-gray-500 rounded text-gray-400 hover:text-white transition-colors"
                aria-label="Fork"
                onClick={(e) => { e.stopPropagation(); onForkBtnClick(e); }}
                title="Fork"
              >
                <span class="material-symbols-outlined text-sm">content_copy</span>
              </button>
            )}
            {onRemoveBtnClick && (
              <button
                class="p-1 hover:bg-gray-500 rounded text-gray-400 hover:text-red-400 transition-colors"
                aria-label="Remove"
                onClick={(e) => { e.stopPropagation(); onRemoveBtnClick(e); }}
                title="Delete"
              >
                <span class="material-symbols-outlined text-sm">delete</span>
              </button>
            )}
          </div>
          {/* Time - hide on hover when buttons show */}
          <p class="text-xs text-gray-400 group-hover:hidden">
            {item.updatedOn ? getHumanDate(item.updatedOn) : ''}
          </p>
        </div>
      </div>
    );
  }

  // Original full mode (for backwards compatibility)
  return (
    <div
      role={focusable ? 'button' : null}
      tabindex={focusable ? 0 : null}
      className="js-saved-item-tile saved-item-tile text-gray-200 rounded-lg"
      data-item-id={item.id}
      onClick={onClick}
    >
      <div class="saved-item-tile__btns flex items-center gap-2">
        {onForkBtnClick ? (
          <button
            class="no-underline text-xs h-7 px-2 bg-black-600 hover:bg-black-700 rounded-lg gap-1.5 flex items-center duration-200"
            aria-label="Creates a duplicate of this creation (Ctrl/⌘ + F)"
            onClick={onForkBtnClick}
            title="Fork"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              stroke-width="0"
              viewBox="0 0 24 24"
              height="14px"
              width="14px"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.559 8.855c.166 1.183.789 3.207 3.087 4.079C11 13.829 11 14.534 11 15v.163c-1.44.434-2.5 1.757-2.5 3.337 0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5c0-1.58-1.06-2.903-2.5-3.337V15c0-.466 0-1.171 2.354-2.065 2.298-.872 2.921-2.896 3.087-4.079C19.912 8.441 21 7.102 21 5.5 21 3.57 19.43 2 17.5 2S14 3.57 14 5.5c0 1.552 1.022 2.855 2.424 3.313-.146.735-.565 1.791-1.778 2.252-1.192.452-2.053.953-2.646 1.536-.593-.583-1.453-1.084-2.646-1.536-1.213-.461-1.633-1.517-1.778-2.252C8.978 8.355 10 7.052 10 5.5 10 3.57 8.43 2 6.5 2S3 3.57 3 5.5c0 1.602 1.088 2.941 2.559 3.355zM17.5 4c.827 0 1.5.673 1.5 1.5S18.327 7 17.5 7 16 6.327 16 5.5 16.673 4 17.5 4zm-4 14.5c0 .827-.673 1.5-1.5 1.5s-1.5-.673-1.5-1.5.673-1.5 1.5-1.5 1.5.673 1.5 1.5zM6.5 4C7.327 4 8 4.673 8 5.5S7.327 7 6.5 7 5 6.327 5 5.5 5.673 4 6.5 4z"></path>
            </svg>
          </button>
        ) : null}
        {onMoveBtnClick ? (
          <button
            class="no-underline text-xs h-7 px-2 bg-black-600 hover:bg-black-700 rounded-lg gap-1.5 flex items-center duration-200"
            aria-label="Move to folder"
            onClick={(e) => { e.stopPropagation(); onMoveBtnClick(); }}
            title="Move to Folder"
          >
            <span class="material-symbols-outlined text-sm">drive_file_move</span>
          </button>
        ) : null}
        {onRemoveBtnClick ? (
          <button
            class="text-xs h-7 p-2 bg-black-600 hover:bg-black-700 rounded-lg flex items-center gap-1.5 duration-200"
            aria-label="Remove"
            onClick={onRemoveBtnClick}
          >
            Remove{' '}
            <span className="material-symbols-outlined font-bold text-sm">
              delete
            </span>
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {item.img ? (
          <div>
            <img class="w-10" height="40" src={item.img} alt="" />
          </div>
        ) : null}
        <h3 class="saved-item-tile__title">{item.title}</h3>
      </div>
      {item.updatedOn ? (
        <div class="saved-item-tile__meta text-gray-300">
          Last updated: {getHumanDate(item.updatedOn)}
        </div>
      ) : null}
    </div>
  );
}
