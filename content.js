// Content script for Reddit Focus Filter

function isWithinSchedule(start, end) {
  if (!start || !end) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startH, startM] = start.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  
  const [endH, endM] = end.split(':').map(Number);
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Crosses midnight
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

function evaluateReadOnlyState() {
  chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], (settings) => {
    // If not enabled or not in readonly mode, remove the class
    if (!settings.enabled || settings.mode !== 'readonly') {
      document.body.classList.remove('reddit-read-only');
      return;
    }

    const isWithin = isWithinSchedule(settings.startTime, settings.endTime);
    
    if (isWithin) {
      document.body.classList.add('reddit-read-only');
      // Extra safety: observe for dynamically added elements and remove them if needed, 
      // but the CSS injected via manifest should handle most of it natively.
    } else {
      document.body.classList.remove('reddit-read-only');
    }
  });
}

// Initial evaluation
evaluateReadOnlyState();

// Re-evaluate when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    evaluateReadOnlyState();
  }
});

// Since time passes while the SPA is open, re-evaluate every minute
setInterval(evaluateReadOnlyState, 60000);

// We also use a MutationObserver just in case the body class gets removed by Reddit's SPA routing
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.attributeName === 'class' && mutation.target === document.body) {
      // Re-apply if it got stripped accidentally by client-side navigation
      chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], (settings) => {
        if (settings.enabled && settings.mode === 'readonly' && isWithinSchedule(settings.startTime, settings.endTime)) {
          if (!document.body.classList.contains('reddit-read-only')) {
            document.body.classList.add('reddit-read-only');
          }
        }
      });
    }
  }
});

// Wait for body to be available, then observe
const startObserving = setInterval(() => {
  if (document.body) {
    observer.observe(document.body, { attributes: true });
    clearInterval(startObserving);
  }
}, 100);
