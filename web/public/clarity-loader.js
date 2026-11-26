// Share and embed URLs can contain diagram source or a share token.
if (
  location.origin === 'https://app.zenuml.com' &&
  window.top === window &&
  location.pathname === '/' &&
  !location.search &&
  !location.hash &&
  navigator.globalPrivacyControl !== true &&
  navigator.doNotTrack !== '1' &&
  !window.clarity
) {
  const queue = [];
  window.clarity = (...args) => queue.push(args);
  window.clarity.q = queue;
  window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.clarity.ms/tag/ml3oonlmsx';
  document.head.append(script);
}
