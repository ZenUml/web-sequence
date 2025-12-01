import mixpanel from './services/mixpanel';

function log() {
  if (window.DEBUG) {
    console.log(Date.now(), ...arguments);
  }
}

// eslint-disable-next-line max-params
export function trackEvent(category, action, label, value) {
  if (window.DEBUG) {
    log('trackevent', category, action, label, value);
    return;
  }
  // Send to Mixpanel
  mixpanel.track({
    event: action,
    category,
    label,
    value,
  });
}

export function trackPageView(pageName = null) {
  if (window.DEBUG) {
    log('trackPageView', pageName);
    return;
  }
  mixpanel.track({
    event: 'pageView',
    category: 'navigation',
    label: pageName,
  });
}

export function trackGaSetField(fieldName, fieldValue) {
  // No-op - GA-specific function, not needed for Mixpanel
  if (window.DEBUG) {
    log('trackGaSetField (deprecated)', fieldName, fieldValue);
  }
}
