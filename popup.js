document.addEventListener('DOMContentLoaded', () => {
  const enableToggle = document.getElementById('enableToggle');
  const startTime = document.getElementById('startTime');
  const endTime = document.getElementById('endTime');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const saveBtn = document.getElementById('saveBtn');
  const statusMessage = document.getElementById('statusMessage');

  // Load existing settings
  chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], (result) => {
    if (result.enabled !== undefined) enableToggle.checked = result.enabled;
    if (result.startTime) startTime.value = result.startTime;
    if (result.endTime) endTime.value = result.endTime;
    if (result.mode) {
      document.querySelector(`input[name="mode"][value="${result.mode}"]`).checked = true;
    }
  });

  saveBtn.addEventListener('click', () => {
    const enabled = enableToggle.checked;
    const start = startTime.value;
    const end = endTime.value;
    const mode = document.querySelector('input[name="mode"]:checked').value;

    chrome.storage.local.set({
      enabled: enabled,
      startTime: start,
      endTime: end,
      mode: mode
    }, () => {
      statusMessage.textContent = 'Settings saved!';
      statusMessage.classList.add('show');
      setTimeout(() => {
        statusMessage.classList.remove('show');
      }, 2000);

      // Notify background script to re-evaluate alarms and rules
      chrome.runtime.sendMessage({ action: 'settingsUpdated' });
    });
  });
});
