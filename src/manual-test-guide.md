# Manual Testing Guide for Pages Implementation

This guide will help you manually test the Phase 1 implementation of the pages concept.

## Setup

1. Make sure the development server is running (`yarn dev`)
2. Open the application in your browser (http://localhost:8080)
3. Open the browser's developer console (F12 or right-click and select "Inspect")

## Test 1: Basic Migration Test

1. Run the following in the console:
```javascript
// Create a test item
const testItem = {
  id: 'test-item',
  title: 'Test Item',
  js: '// Test JS content',
  css: '/* Test CSS content */'
};

// Migrate it to the new format
const migratedItem = window.migrateItemToPages(testItem);

// Log the results
console.log('Original item:', testItem);
console.log('Migrated item:', migratedItem);
```

**Expected Result**: The migrated item should have a `pages` array with one page that contains the original JS and CSS content, and a `currentPageId` that matches the page's ID.

## Test 2: App Methods Test

1. Run the following in the console:
```javascript
// Access the app instance
const app = window._app;

// Check current page
console.log('Current page:', app.getCurrentPage());

// Add a new page
const newPageId = app.addNewPage('Test Page');
console.log('New page added with ID:', newPageId);

// Switch back to the first page
app.switchToPage(app.state.currentItem.pages[0].id);
console.log('Switched to first page');

// Update the page title
app.updatePage(app.state.currentItem.pages[0].id, { title: 'Updated Page Title' });
console.log('Updated page title');
```

**Expected Result**: Each command should execute without errors, and you should see the appropriate console output.

## Test 3: Content Editing Test

1. Edit the JS content in the editor
2. Check the console to see if the changes are reflected in the current page:
```javascript
console.log('Current page JS:', window._app.getCurrentPage().js);
```

3. Switch to another page:
```javascript
window._app.switchToPage(window._app.state.currentItem.pages[1].id);
```

4. Edit the JS content again
5. Check the console to see if the changes are reflected in the current page:
```javascript
console.log('Current page JS:', window._app.getCurrentPage().js);
```

**Expected Result**: Each page should maintain its own JS and CSS content.

## Test 4: Persistence Test

1. Save the item by clicking the save button
2. Reload the page
3. Check if the pages structure is preserved:
```javascript
console.log('Item after reload:', window._app.state.currentItem);
```

**Expected Result**: The item should still have its pages array and currentPageId after reloading.

## Test 5: Automated Test Script

Run the full test script:
```javascript
testPagesImplementation()
```

**Expected Result**: The test should run without errors and show detailed results in the console.

## Troubleshooting

If you encounter issues:

1. Check if the app instance is accessible:
```javascript
console.log(window._app);
```

2. Verify that the migration function is available:
```javascript
console.log(window.migrateItemToPages);
```

3. Check for any JavaScript errors in the console

4. Try creating a new item and testing with that:
```javascript
window._app.createNewItem();
```
