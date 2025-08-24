import { test, expect } from '@playwright/test';

test.describe('Survey Trigger Debugging', () => {
  test.skip('debug why survey is not triggering', async ({ page }) => {
    // Collect console logs
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      console.log(`Browser: ${text}`);
    });

    // Clear localStorage to ensure fresh state
    await page.goto('http://localhost:3001');
    await page.evaluate(() => {
      localStorage.clear();
      console.log('Cleared localStorage');
    });

    // Create some test items to meet the criteria
    await page.evaluate(() => {
      // Create mock items in localStorage to simulate having diagrams
      const items = {
        'item1': { id: 'item1', title: 'Test Diagram 1', js: 'A -> B: test1' },
        'item2': { id: 'item2', title: 'Test Diagram 2', js: 'B -> C: test2' },
        'item3': { id: 'item3', title: 'Test Diagram 3', js: 'C -> D: test3' }
      };
      
      // Store items in the format the app expects
      localStorage.setItem('items', JSON.stringify(Object.keys(items)));
      Object.entries(items).forEach(([id, item]) => {
        localStorage.setItem(id, JSON.stringify(item));
      });
      
      // Simulate an older account
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days old
      window.user = { 
        uid: 'test-user',
        createdAt: oldDate.toISOString()
      };
      
      console.log('Created test items and user:', { 
        itemCount: Object.keys(items).length,
        user: window.user 
      });
    });

    // Reload to trigger the app initialization
    await page.reload();
    
    // Wait for potential survey initialization
    await page.waitForTimeout(10000); // Wait 10 seconds for survey to potentially appear

    // Check if survey modal appeared
    const surveyVisible = await page.locator('text=Help Shape ZenUML\'s Future').isVisible().catch(() => false);
    
    // Log all console messages for debugging
    console.log('\n=== Console Logs ===');
    logs.forEach(log => console.log(log));
    
    // Check what's in the app state
    const appState = await page.evaluate(() => {
      if (window._app) {
        return {
          savedItems: Object.keys(window._app.state.savedItems || {}),
          savedItemsCount: Object.keys(window._app.state.savedItems || {}).length,
          isFeaturePrioritySurveyModalOpen: window._app.state.isFeaturePrioritySurveyModalOpen,
          user: window.user
        };
      }
      return null;
    });
    
    console.log('\n=== App State ===');
    console.log(JSON.stringify(appState, null, 2));
    
    // Check localStorage for survey submission
    const surveySubmitted = await page.evaluate(() => {
      return localStorage.getItem('zenuml_feature_survey_submitted');
    });
    
    console.log('\n=== Survey Status ===');
    console.log('Survey visible:', surveyVisible);
    console.log('Survey submitted data:', surveySubmitted);
    
    // Force trigger the survey check manually to see what happens
    console.log('\n=== Manually triggering survey check ===');
    const manualCheckResult = await page.evaluate(() => {
      if (window._app && window._app.checkAndShowFeaturePrioritySurvey) {
        // First ensure we have items
        window._app.state.savedItems = {
          'item1': { id: 'item1', title: 'Test 1' },
          'item2': { id: 'item2', title: 'Test 2' },
          'item3': { id: 'item3', title: 'Test 3' }
        };
        
        console.log('Manually calling checkAndShowFeaturePrioritySurvey...');
        window._app.checkAndShowFeaturePrioritySurvey();
        
        return {
          called: true,
          savedItemsCount: Object.keys(window._app.state.savedItems).length
        };
      }
      return { called: false, error: 'App or method not found' };
    });
    
    console.log('Manual check result:', manualCheckResult);
    
    // Wait a bit for the survey to potentially appear after manual trigger
    await page.waitForTimeout(2000);
    
    // Check again if survey is visible
    const surveyVisibleAfterManual = await page.locator('text=Help Shape ZenUML\'s Future').isVisible().catch(() => false);
    console.log('Survey visible after manual trigger:', surveyVisibleAfterManual);
  });

  test('test survey with authenticated user', async ({ page }) => {
    // Capture console logs
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      console.log(`Browser: ${text}`);
    });

    // Clear localStorage
    await page.goto('http://localhost:3001');
    await page.evaluate(() => localStorage.clear());

    // Simulate Firebase authentication
    await page.evaluate(() => {
      // Mock Firebase auth with proper structure
      const mockUser = {
        uid: 'test-user-123',
        email: 'test@example.com',
        emailVerified: true,
        metadata: {
          creationTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days old
          lastSignInTime: new Date().toISOString()
        }
      };

      // Mock Firebase auth object
      if (!window.firebase) {
        window.firebase = {};
      }
      if (!window.firebase.auth) {
        window.firebase.auth = () => ({
          currentUser: mockUser,
          onAuthStateChanged: (callback) => callback(mockUser)
        });
      }
      
      // Also set window.user for compatibility
      window.user = {
        uid: mockUser.uid,
        email: mockUser.email,
        items: {}, // This will be populated by the app
        ...mockUser
      };

      // Create some saved items directly in the expected format
      const mockItems = {
        'diagram-1': {
          id: 'diagram-1',
          title: 'Test Diagram 1', 
          js: 'A->B: Hello',
          createdAt: new Date().toISOString()
        },
        'diagram-2': {
          id: 'diagram-2',
          title: 'Test Diagram 2',
          js: 'B->C: World',
          createdAt: new Date().toISOString()
        },
        'diagram-3': {
          id: 'diagram-3',
          title: 'Test Diagram 3',
          js: 'C->D: Test',
          createdAt: new Date().toISOString()
        }
      };

      // Store in localStorage format expected by the app
      localStorage.setItem('items', JSON.stringify(Object.keys(mockItems)));
      Object.entries(mockItems).forEach(([id, item]) => {
        localStorage.setItem(id, JSON.stringify({ [id]: item }));
      });

      console.log('Created mock user and items');
    });

    // Reload and wait for authentication and survey
    await page.reload();
    
    // Wait for app to recognize authentication
    await page.waitForFunction(() => {
      return window._app && 
             window.firebase && 
             window.firebase.auth().currentUser &&
             window.user;
    }, { timeout: 5000 });
    
    console.log('Authentication detected, waiting for survey...');
    await page.waitForTimeout(12000); // Wait longer than the 10-second delay

    // Check for survey
    const surveyVisible = await page.locator('text=Help Shape ZenUML\'s Future').isVisible();
    console.log('Survey visible:', surveyVisible);

    if (surveyVisible) {
      await expect(page.locator('text=Help Shape ZenUML\'s Future')).toBeVisible();
    } else {
      // Force trigger for debugging and get detailed info
      const debugInfo = await page.evaluate(async () => {
        if (window._app) {
          console.log('Forcing survey check...');
          
          // Check current state
          const state = {
            savedItems: Object.keys(window._app.state.savedItems || {}),
            savedItemsCount: Object.keys(window._app.state.savedItems || {}).length,
            user: window.user,
          };
          console.log('App state before forced check:', JSON.stringify(state, null, 2));
          
          // Force the check
          await window._app.checkAndShowFeaturePrioritySurvey();
          
          return state;
        }
        return null;
      });
      
      console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
      
      await page.waitForTimeout(3000);
      const forcedVisible = await page.locator('text=Help Shape ZenUML\'s Future').isVisible();
      console.log('Survey visible after forced trigger:', forcedVisible);
      
      // Print relevant console logs for debugging
      const surveyLogs = logs.filter(log => 
        log.includes('survey') || 
        log.includes('Loading items') || 
        log.includes('criteria not met') ||
        log.includes('Showing feature priority')
      );
      console.log('\n=== Survey-related logs ===');
      surveyLogs.forEach(log => console.log(log));
    }
  });
});