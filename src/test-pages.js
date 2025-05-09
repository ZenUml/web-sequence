/**
 * Test script for verifying the pages implementation
 * 
 * This script can be run in the browser console to test the pages functionality
 */

// Test function to verify pages implementation
function testPagesImplementation() {
  console.log('=== Testing Pages Implementation ===');
  
  // 1. Test migration of existing item
  const existingItem = {
    id: 'test-item',
    title: 'Test Item',
    js: '// Test JS content',
    css: '/* Test CSS content */'
  };
  
  console.log('1. Testing migration of existing item...');
  const migratedItem = window.migrateItemToPages(existingItem);
  console.log('Original item:', existingItem);
  console.log('Migrated item:', migratedItem);
  console.assert(migratedItem.pages && migratedItem.pages.length === 1, 'Migrated item should have one page');
  console.assert(migratedItem.pages[0].js === existingItem.js, 'Page JS should match original item JS');
  console.assert(migratedItem.pages[0].css === existingItem.css, 'Page CSS should match original item CSS');
  console.assert(migratedItem.currentPageId === migratedItem.pages[0].id, 'Current page ID should be set');
  
  // 2. Access the app instance
  console.log('\n2. Accessing app instance...');
  
  // Try different ways to access the app instance
  let app = null;
  
  // Method 1: Try to get the app from window._app (if exposed)
  if (window._app) {
    console.log('Found app via window._app');
    app = window._app;
  } 
  // Method 2: Try to get the app from window.__APP__ (another common pattern)
  else if (window.__APP__) {
    console.log('Found app via window.__APP__');
    app = window.__APP__;
  }
  // Method 3: Try to find the app component in the DOM
  else {
    console.log('Trying to find app component in DOM...');
    // Look for app element
    const appElement = document.querySelector('#app');
    if (appElement) {
      console.log('Found #app element, checking for instance...');
      
      // Try different ways to access the instance
      if (appElement.__preactInstance) {
        app = appElement.__preactInstance;
        console.log('Found app via __preactInstance');
      } else if (appElement._reactRootContainer) {
        app = appElement._reactRootContainer._internalRoot.current.child.stateNode;
        console.log('Found app via React root container');
      } else {
        console.log('Could not find app instance on #app element');
      }
    } else {
      console.log('Could not find #app element in DOM');
    }
  }
  
  if (!app) {
    console.error('Could not access app instance. Try one of these manual methods:');
    console.log('1. In the console, type: window._app = document.querySelector("your-app-selector").__instance');
    console.log('2. In your app.jsx, add this line in the constructor: window._app = this;');
    return 'Test failed: Could not access app instance. See console for details.';
  }
  
  // 3. Test App page management methods
  console.log('\n3. Testing App page management methods...');
  
  // Test getCurrentPage
  console.log('Testing getCurrentPage()...');
  if (typeof app.getCurrentPage === 'function') {
    const currentPage = app.getCurrentPage();
    console.log('Current page:', currentPage);
  } else {
    console.log('getCurrentPage method not found on app instance');
  }
  
  // Test addNewPage
  console.log('Testing addNewPage()...');
  if (typeof app.addNewPage === 'function') {
    const newPageId = app.addNewPage('Test Page');
    console.log('New page ID:', newPageId);
    
    // Test switchToPage
    console.log('Testing switchToPage()...');
    if (typeof app.switchToPage === 'function' && app.state && app.state.currentItem && app.state.currentItem.pages) {
      app.switchToPage(app.state.currentItem.pages[0].id);
      console.log('Switched to first page');
      
      // Test updatePage
      console.log('Testing updatePage()...');
      if (typeof app.updatePage === 'function') {
        app.updatePage(app.state.currentItem.pages[0].id, { title: 'Updated Page Title' });
        console.log('Updated page title');
      } else {
        console.log('updatePage method not found on app instance');
      }
    } else {
      console.log('switchToPage method not found or currentItem not available');
    }
  } else {
    console.log('addNewPage method not found on app instance');
  }
  
  // 4. Test ContentWrap methods
  console.log('\n4. Testing ContentWrap methods...');
  if (app.contentWrap) {
    const contentWrap = app.contentWrap;
    
    // Test getCurrentPage in ContentWrap
    console.log('Testing ContentWrap.getCurrentPage()...');
    if (typeof contentWrap.getCurrentPage === 'function') {
      const contentWrapCurrentPage = contentWrap.getCurrentPage();
      console.log('ContentWrap current page:', contentWrapCurrentPage);
    } else {
      console.log('getCurrentPage method not found on contentWrap instance');
    }
  } else {
    console.log('contentWrap not found on app instance');
  }
  
  // 5. Verify data persistence
  console.log('\n5. Testing data persistence...');
  if (app.state && app.state.currentItem) {
    console.log('Current item state:', app.state.currentItem);
  } else {
    console.log('currentItem not found in app state');
  }
  
  return 'Tests completed. Check console for results.';
}

// Export the test function to make it available in the console
window.testPagesImplementation = testPagesImplementation;
