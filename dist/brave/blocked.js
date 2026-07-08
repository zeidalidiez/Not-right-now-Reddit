/**
 * Blocked interstitial page shown when Strict mode is active.
 */

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

chrome.storage.local.get(['endTime', 'startTime', 'mode'], (settings) => {
  const meta = document.getElementById('meta');
  const message = document.getElementById('message');

  if (settings.endTime) {
    meta.hidden = false;
    meta.textContent = `Focus window ends at ${formatTime12(settings.endTime)}`;
    message.textContent =
      'Reddit is blocked during your focus hours. Take a breath — it will still be there later.';
  }
});

document.getElementById('openSettings').addEventListener('click', () => {
  // Opening the action popup programmatically is restricted;
  // focus the extension action as a best-effort cue.
  if (chrome.action?.openPopup) {
    chrome.action.openPopup().catch(() => {
      document.getElementById('openSettings').textContent = 'Use the toolbar icon';
    });
  } else {
    document.getElementById('openSettings').textContent = 'Use the toolbar icon';
  }
});
