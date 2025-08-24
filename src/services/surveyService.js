import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';

const COLLECTION_NAME = 'feature_surveys';

/**
 * Save user's survey response to Firestore
 * @param {Object} responseData - Survey response data
 * @param {Array} responseData.priorities - Array of feature IDs in priority order
 * @param {Object} responseData.userProfile - User profile information
 * @param {number} responseData.timestamp - Response timestamp
 */
export async function saveSurveyResponse(responseData) {
  try {
    const db = firebase.firestore();
    const user = firebase.auth().currentUser;
    
    const surveyData = {
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || null,
      priorities: responseData.priorities,
      userProfile: {
        diagramCount: responseData.userProfile?.diagramCount || 0,
        accountAge: responseData.userProfile?.accountAge || null,
        isAuthenticated: !!user,
        ...responseData.userProfile
      },
      timestamp: responseData.timestamp,
      version: '1.0' // For future schema changes
    };

    // Save to Firestore
    await db.collection(COLLECTION_NAME).add(surveyData);
    
    // Also save to localStorage as backup
    const localKey = 'zenuml_feature_survey_submitted';
    localStorage.setItem(localKey, JSON.stringify({
      timestamp: responseData.timestamp,
      submitted: true
    }));

    console.log('Survey response saved successfully');
    return true;
    
  } catch (error) {
    console.error('Error saving survey response:', error);
    
    // Fallback to localStorage if Firestore fails
    try {
      const fallbackKey = 'zenuml_feature_survey_fallback';
      const existingFallbacks = JSON.parse(localStorage.getItem(fallbackKey) || '[]');
      existingFallbacks.push(responseData);
      localStorage.setItem(fallbackKey, JSON.stringify(existingFallbacks));
      console.log('Survey response saved to localStorage as fallback');
    } catch (localError) {
      console.error('Failed to save to localStorage fallback:', localError);
    }
    
    throw error;
  }
}

/**
 * Check if user has already submitted the survey
 */
export function hasUserSubmittedSurvey() {
  try {
    const localData = localStorage.getItem('zenuml_feature_survey_submitted');
    if (localData) {
      const data = JSON.parse(localData);
      // Check if submitted in last 30 days to avoid repeat surveys
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      return data.submitted && data.timestamp > thirtyDaysAgo;
    }
    return false;
  } catch (error) {
    console.error('Error checking survey submission status:', error);
    return false;
  }
}

/**
 * Get user profile information for the survey
 * @param {Array} savedItems - User's saved diagrams
 */
export function getUserProfileForSurvey(savedItems = []) {
  try {
    const user = firebase.auth().currentUser;
    const accountCreatedAt = user?.metadata?.creationTime;
    
    let accountAge = null;
    if (accountCreatedAt) {
      const createdDate = new Date(accountCreatedAt);
      accountAge = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      diagramCount: savedItems.length,
      accountAge,
      isAuthenticated: !!user,
      hasMultipleDiagrams: savedItems.length > 1,
      isPowerUser: savedItems.length >= 5,
      userAgent: navigator.userAgent,
      language: navigator.language
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return {
      diagramCount: 0,
      accountAge: null,
      isAuthenticated: false,
      hasMultipleDiagrams: false,
      isPowerUser: false
    };
  }
}

/**
 * Sync fallback data to Firestore when connection is restored
 */
export async function syncFallbackSurveys() {
  try {
    const fallbackKey = 'zenuml_feature_survey_fallback';
    const fallbackData = JSON.parse(localStorage.getItem(fallbackKey) || '[]');
    
    if (fallbackData.length === 0) return;

    const db = firebase.firestore();
    const batch = db.batch();
    
    fallbackData.forEach((surveyData) => {
      const docRef = db.collection(COLLECTION_NAME).doc();
      batch.set(docRef, {
        ...surveyData,
        syncedFromFallback: true,
        syncedAt: Date.now()
      });
    });

    await batch.commit();
    localStorage.removeItem(fallbackKey);
    console.log(`Synced ${fallbackData.length} fallback surveys to Firestore`);
    
  } catch (error) {
    console.error('Error syncing fallback surveys:', error);
  }
}