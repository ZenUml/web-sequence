import { test, expect } from '@playwright/test';

test.describe('Feature Priority Survey', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure fresh state
    await page.goto('http://localhost:3001');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show survey on first visit and prevent reappearance after submission', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3001');
    
    // Wait for the survey modal to appear
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).toBeVisible({ timeout: 10000 });
    
    // Verify survey contains expected features
    await expect(page.locator('text=Enhanced Sharing')).toBeVisible();
    await expect(page.locator('text=Project Management')).toBeVisible();
    await expect(page.locator('text=AI Assistance')).toBeVisible();
    
    // Verify drag & drop editing and enhanced editor are NOT present (removed)
    await expect(page.locator('text=Drag & Drop Editing')).not.toBeVisible();
    await expect(page.locator('text=Enhanced Code Editor')).not.toBeVisible();
    
    // Select "Enhanced Sharing" as most important
    await page.getByRole('button', { name: 'Mark Most Important' }).first().click();
    
    // Verify it appears in the "Most Important" section
    await expect(page.locator('text=Most Important to You').locator('..').locator('text=Enhanced Sharing')).toBeVisible();
    
    // Select "AI Assistance" as least important
    await page.getByRole('button', { name: 'Mark Least Important' }).last().click();
    
    // Verify it appears in the "Least Important" section
    await expect(page.locator('text=Least Important to You').locator('..').locator('text=AI Assistance')).toBeVisible();
    
    // Verify submit button is now enabled
    await expect(page.getByRole('button', { name: 'Submit Feedback' })).toBeEnabled();
    
    // Submit the survey
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    
    // Wait for success message or modal to close
    await expect(page.locator('text=Thank You for Your Feedback!')).toBeVisible({ timeout: 5000 });
    
    // Verify localStorage entry was created
    const surveyData = await page.evaluate(() => 
      localStorage.getItem('zenuml_feature_survey_submitted')
    );
    expect(surveyData).toBeTruthy();
    const parsed = JSON.parse(surveyData);
    expect(parsed.submitted).toBe(true);
    expect(parsed.timestamp).toBeGreaterThan(Date.now() - 60000); // Within last minute
    
    // Refresh the page to test prevention mechanism
    await page.reload();
    
    // Verify survey does NOT appear again
    await page.waitForTimeout(3000); // Wait for any potential survey to appear
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).not.toBeVisible();
    
    // Verify console shows the prevention message
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    await page.reload();
    await page.waitForTimeout(1000);
    expect(logs.some(log => log.includes('Feature priority survey already submitted, skipping'))).toBe(true);
  });

  test('should track survey dismissal when user closes without submitting', async ({ page }) => {
    // Set up console message tracking
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    
    // Navigate to the app
    await page.goto('http://localhost:3001');
    
    // Wait for the survey modal to appear
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).toBeVisible({ timeout: 10000 });
    
    // Select only most important (partial selection)
    await page.getByRole('button', { name: 'Mark Most Important' }).first().click();
    
    // Dismiss the survey using "Not Now" button
    await page.getByRole('button', { name: 'Not Now' }).click();
    
    // Verify modal is closed
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).not.toBeVisible();
    
    // Verify localStorage does NOT have submission entry (only dismissal tracking would be in analytics)
    const surveyData = await page.evaluate(() => 
      localStorage.getItem('zenuml_feature_survey_submitted')
    );
    expect(surveyData).toBeNull();
    
    // Refresh and verify survey appears again (since it wasn't submitted)
    await page.reload();
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).toBeVisible({ timeout: 10000 });
  });

  test('should properly handle mixpanel tracking events', async ({ page }) => {
    // Track network requests to /track endpoint
    const trackRequests = [];
    page.on('request', request => {
      if (request.url().includes('/track')) {
        trackRequests.push(request);
      }
    });

    // Navigate to the app
    await page.goto('http://localhost:3001');
    
    // Wait for the survey modal to appear
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).toBeVisible({ timeout: 10000 });
    
    // Complete survey submission
    await page.getByRole('button', { name: 'Mark Most Important' }).first().click();
    await page.getByRole('button', { name: 'Mark Least Important' }).last().click();
    await page.getByRole('button', { name: 'Submit Feedback' }).click();
    
    // Wait for submission to complete
    await expect(page.locator('text=Thank You for Your Feedback!')).toBeVisible({ timeout: 5000 });
    
    // Verify tracking requests were made
    await page.waitForTimeout(2000); // Allow time for async tracking
    expect(trackRequests.length).toBeGreaterThan(0);
    
    // Verify at least one request contains survey completion data
    const hasCompletionEvent = trackRequests.some(request => {
      try {
        const postData = request.postData();
        if (postData) {
          const data = JSON.parse(postData);
          return data.event === 'featurePrioritySurveyCompleted';
        }
      } catch (e) {
        // Ignore parsing errors
      }
      return false;
    });
    expect(hasCompletionEvent).toBe(true);
  });

  test('should prevent survey from showing when localStorage indicates previous submission within 30 days', async ({ page }) => {
    // Pre-populate localStorage with a recent submission
    await page.goto('http://localhost:3001');
    await page.evaluate(() => {
      localStorage.setItem('zenuml_feature_survey_submitted', JSON.stringify({
        submitted: true,
        timestamp: Date.now() - (10 * 24 * 60 * 60 * 1000) // 10 days ago
      }));
    });
    
    // Reload the page
    await page.reload();
    
    // Verify survey does NOT appear
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).not.toBeVisible();
  });

  test('should show survey again when localStorage indicates submission older than 30 days', async ({ page }) => {
    // Pre-populate localStorage with an old submission
    await page.goto('http://localhost:3001');
    await page.evaluate(() => {
      localStorage.setItem('zenuml_feature_survey_submitted', JSON.stringify({
        submitted: true,
        timestamp: Date.now() - (35 * 24 * 60 * 60 * 1000) // 35 days ago
      }));
    });
    
    // Reload the page
    await page.reload();
    
    // Verify survey DOES appear (since it's been over 30 days)
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).toBeVisible({ timeout: 10000 });
  });

  test('should handle partial selection states correctly', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3001');
    
    // Wait for the survey modal to appear
    await expect(page.locator('text=Help Shape ZenUML\'s Future')).toBeVisible({ timeout: 10000 });
    
    // Initially, submit button should be disabled
    await expect(page.getByRole('button', { name: 'Select Most & Least Important' })).toBeDisabled();
    
    // Select "Enhanced Sharing" as most important
    await page.locator('[data-feature-id="sharing"]').getByRole('button', { name: 'Mark Most Important' }).click();
    
    // Submit button should still be disabled (need both selections)
    await expect(page.getByRole('button', { name: 'Select Most & Least Important' })).toBeDisabled();
    
    // Select "Project Management" as least important (different feature)
    await page.locator('[data-feature-id="project-management"]').getByRole('button', { name: 'Mark Least Important' }).click();
    
    // Now submit button should be enabled
    await expect(page.getByRole('button', { name: 'Submit Feedback' })).toBeEnabled();
    
    // Verify both selections are shown in their respective zones
    await expect(page.locator('text=Most Important to You').locator('..').locator('text=Enhanced Sharing')).toBeVisible();
    await expect(page.locator('text=Least Important to You').locator('..').locator('text=Project Management')).toBeVisible();
  });
});