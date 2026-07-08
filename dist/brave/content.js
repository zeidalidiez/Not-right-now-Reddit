/**
 * Reddit Focus Filter — content script
 * Applies read-only mode on Reddit during scheduled hours.
 */

const BANNER_ID = 'rff-readonly-banner';

function isWithinSchedule(start, end) {
  if (!start || !end) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) return false;

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes === endMinutes) return true;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function whenBodyReady(callback) {
  if (document.body) {
    callback();
    return;
  }
  const observer = new MutationObserver(() => {
    if (document.body) {
      observer.disconnect();
      callback();
    }
  });
  observer.observe(document.documentElement, { childList: true });
}

function setReadOnly(active, endTime) {
  whenBodyReady(() => {
    if (active) {
      document.body.classList.add('reddit-read-only');
      showBanner(endTime);
    } else {
      document.body.classList.remove('reddit-read-only');
      hideBanner();
    }
  });
}

function showBanner(endTime) {
  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
      <span class="rff-banner-icon" aria-hidden="true">◎</span>
      <span class="rff-banner-text">
        <strong>Read-only mode</strong>
        <span class="rff-banner-detail"></span>
      </span>
      <button type="button" class="rff-banner-dismiss" aria-label="Dismiss banner">×</button>
    `;
    banner.querySelector('.rff-banner-dismiss').addEventListener('click', () => {
      banner.classList.add('rff-banner-hidden');
    });
    document.body.prepend(banner);
  }

  const detail = banner.querySelector('.rff-banner-detail');
  if (detail) {
    detail.textContent = endTime
      ? ` — interactions disabled until ${formatTime12(endTime)}`
      : ' — posting, voting & comments disabled';
  }
  banner.classList.remove('rff-banner-hidden');
}

function hideBanner() {
  const banner = document.getElementById(BANNER_ID);
  if (banner) banner.remove();
}

function evaluateReadOnlyState() {
  chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], (settings) => {
    const shouldApply =
      settings.enabled &&
      settings.mode === 'readonly' &&
      isWithinSchedule(settings.startTime, settings.endTime);

    setReadOnly(shouldApply, settings.endTime);
  });
}

// Run as early as possible
evaluateReadOnlyState();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    evaluateReadOnlyState();
  }
});

// Re-check every minute while the tab stays open
setInterval(evaluateReadOnlyState, 60_000);

// Re-apply class if Reddit's SPA strips it during client-side navigation
whenBodyReady(() => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' && mutation.target === document.body) {
        chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], (settings) => {
          const shouldApply =
            settings.enabled &&
            settings.mode === 'readonly' &&
            isWithinSchedule(settings.startTime, settings.endTime);

          if (shouldApply && !document.body.classList.contains('reddit-read-only')) {
            document.body.classList.add('reddit-read-only');
            showBanner(settings.endTime);
          }
        });
      }
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
});
