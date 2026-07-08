/**
 * Reddit Focus Filter — background service worker
 * Manages schedule evaluation, declarativeNetRequest rules, and action badge.
 */

const BLOCK_RULE_ID = 1;
const ALARM_NAME = 'checkSchedule';

const DEFAULTS = {
  enabled: false,
  startTime: '09:00',
  endTime: '17:00',
  mode: 'strict'
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await storageGet(Object.keys(DEFAULTS));
  const toSet = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (existing[key] === undefined) toSet[key] = value;
  }
  if (Object.keys(toSet).length) {
    await storageSet(toSet);
  }
  await ensureAlarm();
  await evaluateState();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  await evaluateState();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    evaluateState();
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'settingsUpdated' || request.action === 'evaluate') {
    evaluateState().then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  if (request.action === 'getStatus') {
    getStatus().then(sendResponse);
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    evaluateState();
  }
});

// Initial evaluation when the service worker wakes
ensureAlarm().then(evaluateState);

// ---------------------------------------------------------------------------
// Alarm
// ---------------------------------------------------------------------------

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }
}

// ---------------------------------------------------------------------------
// Schedule helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when current local time falls inside [start, end].
 * Supports overnight ranges (e.g. 22:00 → 06:00).
 */
function isWithinSchedule(start, end) {
  if (!start || !end) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  if ([startH, startM, endH, endM].some((n) => Number.isNaN(n))) return false;

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes === endMinutes) {
    // Same start/end = full day when filter is enabled
    return true;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Crosses midnight
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// ---------------------------------------------------------------------------
// State evaluation
// ---------------------------------------------------------------------------

async function evaluateState() {
  const settings = { ...DEFAULTS, ...(await storageGet(Object.keys(DEFAULTS))) };
  const within = settings.enabled && isWithinSchedule(settings.startTime, settings.endTime);
  const strictActive = within && settings.mode === 'strict';
  const readonlyActive = within && settings.mode === 'readonly';

  if (strictActive) {
    await enableStrictBlock();
  } else {
    await disableStrictBlock();
  }

  await updateBadge(settings, within, strictActive, readonlyActive);
  await storageSet({
    _active: within,
    _strictActive: strictActive,
    _readonlyActive: readonlyActive
  });
}

async function getStatus() {
  const settings = { ...DEFAULTS, ...(await storageGet(Object.keys(DEFAULTS))) };
  const within = settings.enabled && isWithinSchedule(settings.startTime, settings.endTime);
  return {
    ...settings,
    active: within,
    strictActive: within && settings.mode === 'strict',
    readonlyActive: within && settings.mode === 'readonly',
    scheduleLabel: `${formatTime12(settings.startTime)} – ${formatTime12(settings.endTime)}`
  };
}

// ---------------------------------------------------------------------------
// Declarative Net Request (strict block)
// ---------------------------------------------------------------------------

async function enableStrictBlock() {
  const rule = {
    id: BLOCK_RULE_ID,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: '/blocked.html' }
    },
    condition: {
      urlFilter: '||reddit.com',
      resourceTypes: ['main_frame']
    }
  };

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [BLOCK_RULE_ID],
      addRules: [rule]
    });
  } catch (err) {
    // Fallback to hard block if redirect is unavailable
    console.warn('Redirect rule failed, falling back to block:', err);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [BLOCK_RULE_ID],
      addRules: [{
        id: BLOCK_RULE_ID,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '||reddit.com',
          resourceTypes: ['main_frame', 'sub_frame']
        }
      }]
    });
  }
}

async function disableStrictBlock() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [BLOCK_RULE_ID]
  });
}

// ---------------------------------------------------------------------------
// Action badge
// ---------------------------------------------------------------------------

async function updateBadge(settings, within, strictActive, readonlyActive) {
  if (!settings.enabled) {
    await setBadge('', '#64748b');
    await chrome.action.setTitle({ title: 'Reddit Focus Filter — Off' });
    return;
  }

  if (strictActive) {
    await setBadge('ON', '#ef4444');
    await chrome.action.setTitle({
      title: `Strict block active until ${formatTime12(settings.endTime)}`
    });
  } else if (readonlyActive) {
    await setBadge('RO', '#f59e0b');
    await chrome.action.setTitle({
      title: `Read-only active until ${formatTime12(settings.endTime)}`
    });
  } else {
    await setBadge('…', '#6366f1');
    await chrome.action.setTitle({
      title: `Scheduled ${formatTime12(settings.startTime)} – ${formatTime12(settings.endTime)}`
    });
  }
}

async function setBadge(text, color) {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

// ---------------------------------------------------------------------------
// Storage helpers (promise-based)
// ---------------------------------------------------------------------------

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, resolve);
  });
}
