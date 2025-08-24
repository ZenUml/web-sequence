import { useState, useEffect } from 'preact/hooks';
import { hasUserSubmittedSurvey, getUserProfileForSurvey } from '../services/surveyService.js';

/**
 * Hook to manage feature priority survey trigger logic
 * @param {Array} savedItems - User's saved diagrams
 * @param {Object} options - Configuration options
 */
export function useSurveyTrigger(savedItems = [], options = {}) {
  const {
    delayMs = 20000, // 20 seconds default
    minDiagrams = 2, // Minimum diagrams to trigger
    maxSessionTriggers = 1, // Max times to show per session
    enabled = true
  } = options;

  const [shouldShowSurvey, setShouldShowSurvey] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [sessionTriggerCount, setSessionTriggerCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    // Check if already submitted
    if (hasUserSubmittedSurvey()) {
      console.log('Survey already submitted, skipping trigger');
      return;
    }

    // Check session trigger limit
    if (sessionTriggerCount >= maxSessionTriggers) {
      console.log('Session trigger limit reached, skipping');
      return;
    }

    // Check if user has enough diagrams
    if (savedItems.length < minDiagrams) {
      console.log(`Not enough diagrams (${savedItems.length}/${minDiagrams}), skipping survey`);
      return;
    }

    // Get user profile
    const profile = getUserProfileForSurvey(savedItems);
    setUserProfile(profile);

    // Additional criteria for power users
    const shouldTrigger = (
      profile.hasMultipleDiagrams && 
      (profile.isPowerUser || profile.accountAge > 7) // Power user or account > 7 days old
    );

    if (!shouldTrigger) {
      console.log('User does not meet trigger criteria');
      return;
    }

    // Set up delay timer
    const timer = setTimeout(() => {
      console.log('Triggering feature priority survey');
      setShouldShowSurvey(true);
      setSessionTriggerCount(prev => prev + 1);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [savedItems.length, delayMs, minDiagrams, maxSessionTriggers, enabled, sessionTriggerCount]);

  const dismissSurvey = () => {
    setShouldShowSurvey(false);
  };

  const resetTrigger = () => {
    setSessionTriggerCount(0);
    setShouldShowSurvey(false);
  };

  return {
    shouldShowSurvey,
    userProfile,
    dismissSurvey,
    resetTrigger,
    sessionTriggerCount
  };
}

/**
 * Hook to track user activity for survey timing
 */
export function useUserActivityTracker() {
  const [isUserActive, setIsUserActive] = useState(true);
  const [timeSpentOnPage, setTimeSpentOnPage] = useState(0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());

  useEffect(() => {
    let interval;
    let activityTimeout;

    const updateActivity = () => {
      setIsUserActive(true);
      setLastActivityTime(Date.now());
      
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        setIsUserActive(false);
      }, 30000); // Consider inactive after 30 seconds
    };

    // Track various user interactions
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Track time spent on page
    const startTime = Date.now();
    interval = setInterval(() => {
      if (isUserActive) {
        setTimeSpentOnPage(Date.now() - startTime);
      }
    }, 1000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
      clearTimeout(activityTimeout);
    };
  }, [isUserActive]);

  return {
    isUserActive,
    timeSpentOnPage,
    lastActivityTime,
    hasBeenActiveForMinutes: (minutes) => timeSpentOnPage >= minutes * 60 * 1000
  };
}