/**
 * Reddit Focus Filter — popup UI
 */

document.addEventListener('DOMContentLoaded', () => {
  const enableToggle = document.getElementById('enableToggle');
  const startTime = document.getElementById('startTime');
  const endTime = document.getElementById('endTime');
  const saveBtn = document.getElementById('saveBtn');
  const statusMessage = document.getElementById('statusMessage');
  const statusPill = document.getElementById('statusPill');
  const statusLabel = document.getElementById('statusLabel');
  const statusDetail = document.getElementById('statusDetail');

  let statusTimer = null;

  function showMessage(text, isError = false) {
    statusMessage.textContent = text;
    statusMessage.classList.toggle('error', isError);
    statusMessage.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusMessage.classList.remove('show');
    }, 2200);
  }

  function formatTime12(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  function isWithinSchedule(start, end) {
    if (!start || !end) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    if (startMinutes === endMinutes) return true;
    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  function updateStatusUI(settings) {
    const enabled = !!settings.enabled;
    const mode = settings.mode || 'strict';
    const start = settings.startTime || '09:00';
    const end = settings.endTime || '17:00';
    const within = enabled && isWithinSchedule(start, end);

    statusPill.classList.remove('status-off', 'status-scheduled', 'status-strict', 'status-readonly');

    if (!enabled) {
      statusPill.classList.add('status-off');
      statusLabel.textContent = 'Off';
      statusDetail.textContent = 'Filter is turned off. Reddit works normally.';
      return;
    }

    if (within && mode === 'strict') {
      statusPill.classList.add('status-strict');
      statusLabel.textContent = 'Blocking';
      statusDetail.textContent = `Strict block active until ${formatTime12(end)}.`;
    } else if (within && mode === 'readonly') {
      statusPill.classList.add('status-readonly');
      statusLabel.textContent = 'Read-only';
      statusDetail.textContent = `Read-only active until ${formatTime12(end)}.`;
    } else {
      statusPill.classList.add('status-scheduled');
      statusLabel.textContent = 'Scheduled';
      statusDetail.textContent = `Idle now. Active ${formatTime12(start)} – ${formatTime12(end)}.`;
    }
  }

  function loadSettings() {
    chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], (result) => {
      enableToggle.checked = result.enabled === true;
      if (result.startTime) startTime.value = result.startTime;
      if (result.endTime) endTime.value = result.endTime;
      if (result.mode) {
        const radio = document.querySelector(`input[name="mode"][value="${result.mode}"]`);
        if (radio) radio.checked = true;
      }
      updateStatusUI({
        enabled: enableToggle.checked,
        startTime: startTime.value,
        endTime: endTime.value,
        mode: document.querySelector('input[name="mode"]:checked')?.value || 'strict'
      });
    });
  }

  function collectSettings() {
    return {
      enabled: enableToggle.checked,
      startTime: startTime.value,
      endTime: endTime.value,
      mode: document.querySelector('input[name="mode"]:checked')?.value || 'strict'
    };
  }

  function saveSettings() {
    const settings = collectSettings();

    if (!settings.startTime || !settings.endTime) {
      showMessage('Please set both start and end times.', true);
      return;
    }

    saveBtn.disabled = true;
    chrome.storage.local.set(settings, () => {
      chrome.runtime.sendMessage({ action: 'settingsUpdated' }, () => {
        // Ignore lastError if SW is restarting
        void chrome.runtime.lastError;
        updateStatusUI(settings);
        showMessage('Settings saved');
        saveBtn.disabled = false;
      });
    });
  }

  // Live preview of status as user tweaks controls (before save)
  function previewStatus() {
    updateStatusUI(collectSettings());
  }

  enableToggle.addEventListener('change', previewStatus);
  startTime.addEventListener('change', previewStatus);
  endTime.addEventListener('change', previewStatus);
  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.addEventListener('change', previewStatus);
  });

  saveBtn.addEventListener('click', saveSettings);

  // Keyboard: Enter saves
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      saveSettings();
    }
  });

  loadSettings();

  // Refresh status every 30s while popup is open
  setInterval(() => {
    chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], updateStatusUI);
  }, 30_000);
});
