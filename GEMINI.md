# Project: Reddit Focus Filter

## Core Objective
A Chrome Extension (Manifest V3) designed to prevent context-switching and time-drain on Reddit during active development hours. 
* **Mode 1 (Strict Block):** Completely prevents access to reddit.com during defined schedules.
* **Mode 2 (Read-Only):** Allows browsing but prevents authenticated interactions (posting, commenting, upvoting).

## Architecture & Chrome APIs

### 1. Strict Blocking (`chrome.declarativeNetRequest`)
Manifest V3 removed the old `webRequest` blocking capabilities in favor of `declarativeNetRequest`. 
* **Mechanism:** We will define static JSON rule sets that block navigation to `*://*.reddit.com/*`. 
* **Dynamic Toggling:** The extension's background service worker will use `chrome.declarativeNetRequest.updateDynamicRules` to enable or disable these blocking rules based on the user's schedule.

### 2. Read-Only Mode (Content Scripts & CSS Injection)
Because Reddit is a complex Single Page Application (SPA) that uses GraphQL, simply blocking `POST` requests is fragile and can break the site entirely. The most reliable approach for Read-Only mode is UI manipulation.
* **Mechanism:** A Content Script injected into `*://*.reddit.com/*`.
* **Execution:** * Inject custom CSS to set `display: none !important;` on specific DOM elements (e.g., comment boxes, "Create Post" buttons, upvote arrows).
    * Use a `MutationObserver` in vanilla JavaScript to watch the DOM for changes, ensuring the posting UI remains hidden even as the user scrolls and the SPA loads new content dynamically.

### 3. State & Scheduling (`chrome.storage` & `chrome.alarms`)
* **Storage:** Use `chrome.storage.local` to persist the user's schedule parameters and the current mode toggle.
* **Timekeeping:** A background service worker will utilize `chrome.alarms` to trigger state checks. When an alarm fires, the worker checks the current time against the stored schedule and updates the `declarativeNetRequest` rules or messaging state accordingly.

## Development Roadmap
1.  **Skeleton:** Scaffold the `manifest.json` (V3) and basic popup UI for settings.
2.  **Phase 1 (The Wall):** Implement `declarativeNetRequest` rules to successfully block and unblock the domain manually via a toggle.
3.  **Phase 2 (The Clock):** Integrate `chrome.alarms` to automate the Phase 1 toggle based on time inputs.
4.  **Phase 3 (The Muzzle):** Map out the CSS selectors for Reddit's current UI and implement the Content Script for Read-Only mode.

## Known Risks & Edge Cases
* **Reddit UI Updates:** The CSS selectors for Read-Only mode will likely break if Reddit overhauls its UI. The selectors will need to be maintained.
* **Mobile Web/Old Reddit:** The extension needs to account for `old.reddit.com` and `sh.reddit.com` if the user utilizes those subdomains, as the DOM structures differ wildly.

## Cross-Browser & Mobile Porting Guide

### 1. Chromium-Based Desktop Browsers (Brave, Edge, Opera, Vivaldi)
* **Porting Effort:** Near zero.
* **Mechanism:** Because these browsers share the underlying Chromium engine with Google Chrome, your Manifest V3 extension will work out of the box. You do not need to alter your APIs or `manifest.json`.
* **Deployment:** Users can install it directly from the Chrome Web Store, or you can sideload the unpacked extension via their respective `://extensions` developer pages.

### 2. Firefox Desktop (Mozilla/Gecko)
* **Porting Effort:** Low to Medium.
* **Manifest Updates:** Firefox supports Manifest V3, but requires a specific ID to be defined in your `manifest.json` for background scripts and storage to function properly. You must add the `browser_specific_settings` key:
    ```json
    "browser_specific_settings": {
      "gecko": {
        "id": "reddit-focus-filter@yourdomain.com",
        "strict_min_version": "109.0"
      }
    }
    ```
* **API Considerations:** Firefox supports `chrome.declarativeNetRequest`, but it officially prefers the `browser.*` namespace over `chrome.*` (which returns Promises instead of using callbacks). While Firefox includes a wrapper that makes `chrome.*` work, implementing Mozilla's `webextension-polyfill` library is the gold standard for maintaining a single, clean codebase for both Chrome and Firefox.

### 3. Mobile Browsers (Android & iOS)
HOLD OFF ON MOBILE FOR NOW! Mobile porting is the highest hurdle due to strict mobile OS limitations on browser extensions.
