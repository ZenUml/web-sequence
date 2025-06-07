// Wait for DOM and scripts to be ready before initializing Paddle
function initializePaddle() {
  if (typeof window.Paddle !== 'undefined' && window.Paddle) {
    Paddle.Setup({ vendor: 39343 }); //eslint-disable-line
  } else {
    // Retry after a short delay if Paddle is not yet available
    setTimeout(initializePaddle, 200);
  }
}

// Use multiple methods to ensure initialization happens after everything is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePaddle);
} else {
  // DOM is already loaded
  initializePaddle();
}

// Also try on window load as a fallback
window.addEventListener('load', function() {
  if (typeof window.Paddle !== 'undefined' && !window.PaddleCompletedSetup) {
    initializePaddle();
  }
});
