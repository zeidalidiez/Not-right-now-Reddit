const BLOCK_RULE_ID = 1;

chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], (result) => {
    if (result.enabled === undefined) {
      chrome.storage.local.set({
        enabled: false,
        startTime: '09:00',
        endTime: '17:00',
        mode: 'strict'
      });
    }
  });

  // Check every minute
  chrome.alarms.create('checkSchedule', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkSchedule') {
    evaluateState();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'settingsUpdated') {
    evaluateState();
  }
});

function evaluateState() {
  chrome.storage.local.get(['enabled', 'startTime', 'endTime', 'mode'], (settings) => {
    if (!settings.enabled) {
      disableStrictBlock();
      return;
    }

    const isWithin = isWithinSchedule(settings.startTime, settings.endTime);
    
    if (isWithin && settings.mode === 'strict') {
      enableStrictBlock();
    } else {
      disableStrictBlock();
    }
  });
}

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

function enableStrictBlock() {
  const rule = {
    id: BLOCK_RULE_ID,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: '||reddit.com',
      resourceTypes: ['main_frame', 'sub_frame']
    }
  };

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [BLOCK_RULE_ID],
    addRules: [rule]
  });
}

function disableStrictBlock() {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [BLOCK_RULE_ID]
  });
}

// Initial evaluation on load
evaluateState();
