# Diagram ID in URL Feature

## Overview
This feature displays the current diagram ID in the URL, making it easier for users to:
- Share direct links to specific diagrams
- Bookmark specific diagrams
- See which diagram they are currently viewing
- Navigate back to specific diagrams using browser history

## Implementation Details

### Core Changes
1. **`updateUrlWithDiagramId(diagramId)` method**: Updates the browser URL with the diagram ID using `window.history.replaceState()`
2. **Modified `setCurrentItem(item)` method**: Automatically updates URL when a diagram is loaded/switched
3. **Modified `createNewItem()` method**: Ensures new items get unique IDs before setting them as current
4. **Modified `forkItem(sourceItem)` method**: Generates new IDs for forked diagrams
5. **Enhanced lastCode handling**: Ensures restored items from localStorage have IDs

### URL Format
- **With diagram**: `https://app.zenuml.com/?id=<diagram-id>`
- **Without diagram**: `https://app.zenuml.com/` (ID parameter removed)

### Behavior
- **New diagrams**: URL automatically updates with new random ID
- **Existing diagrams**: URL updates when diagram is opened/loaded
- **Forked diagrams**: URL updates with new forked diagram ID
- **Shared diagrams**: URL includes the shared diagram ID
- **Desktop app**: URL updates are skipped (no browser context)

## Testing

### Manual Testing
1. Open http://localhost:3000
2. Create a new diagram → URL should show `?id=<new-id>`
3. Open an existing diagram → URL should update to show that diagram's ID
4. Fork a diagram → URL should show new forked diagram's ID
5. Refresh page with `?id=<existing-id>` → Should load that specific diagram

### Automated Testing
Run the test script in browser console:
```javascript
// Load the test script and run
testUrlFunctionality();
```

## Benefits
- **Shareable links**: Users can copy URL to share specific diagrams
- **Bookmarking**: Users can bookmark specific diagrams
- **Navigation**: Browser back/forward works with diagram contexts
- **User experience**: Clear indication of which diagram is currently active

## Technical Notes
- Uses `replaceState` instead of `pushState` to avoid cluttering browser history
- Skips URL updates in desktop app environment
- Maintains backward compatibility with existing URL parameter handling
- Generates unique IDs for all new diagrams to ensure URL uniqueness

## Files Modified
- `src/components/app.jsx`: Core implementation of URL updating logic
