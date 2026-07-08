# Reddit Focus Filter

**Not right now, Reddit.**

A lightweight Manifest V3 browser extension that keeps Reddit from eating your focus hours. Schedule a window of time, then either **block the site entirely** or allow **read-only browsing** (no voting, posting, or commenting).

---

## Features

| Feature | Description |
|--------|-------------|
| **Strict block** | Navigating to Reddit redirects to a calm interstitial page until your schedule ends. |
| **Read-only mode** | Browse feeds and threads; voting, replies, composers, and submit flows are hidden. |
| **Time schedule** | Local start/end times. Supports overnight ranges (e.g. 22:00 → 06:00). Same start and end = all day. |
| **Live status** | Popup pill shows Off / Scheduled / Blocking / Read-only. Toolbar badge: `ON`, `RO`, or `…`. |
| **Cross-browser** | Works on Chrome, Edge, Brave, Opera, Vivaldi, and Firefox (MV3). |

---

## How it works

```
┌─────────────┐     storage + alarms      ┌──────────────────┐
│  Popup UI   │ ────────────────────────► │ Background SW    │
└─────────────┘                           │  evaluateState() │
                                          └────────┬─────────┘
                     ┌─────────────────────────────┼─────────────────────────────┐
                     ▼                             ▼                             ▼
            declarativeNetRequest          content script + CSS            action badge
            (strict → blocked.html)        (readonly on reddit.com)        ON / RO / …
```

1. **Settings** live in `chrome.storage.local` (`enabled`, `startTime`, `endTime`, `mode`).
2. The **background service worker** re-evaluates every minute via `chrome.alarms`, on startup/install, and whenever storage changes.
3. **Strict mode** adds a dynamic `declarativeNetRequest` rule that redirects main-frame navigations to `||reddit.com` into `blocked.html`.
4. **Read-only mode** injects `content.js` / `content.css` on `*://*.reddit.com/*`. A body class (`reddit-read-only`) hides interaction UI; a sticky banner reminds you the mode is on. Comment **trees stay visible** so you can still read.

### Schedule rules

- Times use the browser’s **local timezone**.
- Active from **start (inclusive)** until **end (exclusive)**.  
  Example: `09:00`–`17:00` is active at 9:00, free at 17:00.
- If start **>** end (e.g. `22:00`–`06:00`), the window wraps past midnight.
- If start **equals** end, the filter is treated as **all day** while enabled.

---

## Install (developer / unpacked)

### Chrome, Edge, Brave, Opera, Vivaldi

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, …).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repo’s root folder **or** `dist/chrome` / `dist/brave`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Pick `manifest.json` from the repo root **or** `dist/firefox`.

> Temporary add-ons in Firefox are removed when the browser restarts. For a permanent sideload, package as an `.xpi` or use a signed build.

### Store packaging (optional)

- **Chromium:** zip the root (or `dist/chrome`) without `.git`.
- **Firefox:** zip `dist/firefox` (includes `browser_specific_settings.gecko.id`).

---

## Usage

1. Click the **Focus Filter** toolbar icon.
2. Turn **Enable filter** on.
3. Set **Start** and **End** times for your focus window.
4. Choose a mode:
   - **Strict block** — no Reddit until the window ends.
   - **Read-only** — browse only; interactions stripped.
5. Click **Save settings**.

The status pill and toolbar badge update to reflect whether the filter is idle, blocking, or in read-only.

---

## Project layout

```
.
├── manifest.json          # MV3 manifest (source of truth)
├── background.js          # Schedule, DNR rules, badge
├── popup.html / .css / .js
├── content.js / content.css   # Read-only mode on Reddit
├── blocked.html / .css / .js  # Strict-mode interstitial
├── icons/                 # 16 / 32 / 48 / 128 px
├── dist/
│   ├── chrome/            # Chromium package (no gecko id)
│   ├── brave/             # Same as chrome
│   └── firefox/           # Includes gecko application id
├── GEMINI.md              # Original architecture notes
└── README.md
```

There is no build step for day-to-day work: edit root files, then reload the unpacked extension. After larger changes, refresh `dist/*` by copying the root assets (see below).

---

## Dist packages

`dist/chrome` and `dist/brave` use the same files as the root, **without** `browser_specific_settings`.

`dist/firefox` keeps the Gecko extension id required for storage/alarms in Firefox.

To resync after editing the root (PowerShell):

```powershell
$files = @(
  'background.js','content.js','content.css',
  'popup.html','popup.css','popup.js',
  'blocked.html','blocked.css','blocked.js'
)
foreach ($target in 'chrome','brave','firefox') {
  foreach ($f in $files) { Copy-Item $f "dist\$target\$f" -Force }
  Copy-Item -Recurse icons "dist\$target\icons" -Force
}
# Chromium manifests: no gecko block
# Firefox manifest: keep browser_specific_settings (maintained separately or generated)
```

---

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Persist schedule and mode. |
| `alarms` | Re-check the schedule every minute (service workers sleep). |
| `declarativeNetRequest` | Redirect/block Reddit in strict mode (MV3-friendly). |
| Host `*://*.reddit.com/*` | Content scripts + network rules for Reddit only. |

No analytics, no remote code, no account data.

---

## Modes in detail

### Strict block

- Uses a **dynamic DNR rule** (id `1`) with `redirect` to `/blocked.html`.
- Falls back to a hard `block` action if redirect registration fails.
- Only `main_frame` is redirected so subresources aren’t needlessly rewritten.
- The blocked page shows when focus ends and points you at the toolbar settings.

### Read-only

- CSS targets composers, vote controls, reply/submit UI across:
  - Modern Reddit (`shreddit-*`, faceplate trackers, …)
  - “New” Reddit (`data-click-id`, Draft.js, …)
  - Old Reddit (`.arrow`, `.usertext-edit`, …)
- **Does not hide comment threads** — you can still *read*.
- A dismissible top banner indicates the mode and end time.
- A `MutationObserver` re-applies the body class if client-side navigation strips it.
- A 60s interval re-evaluates the schedule while a tab stays open.

> Reddit changes its DOM often. If a control reappears, update selectors in `content.css`.

---

## Known limitations

- **UI churn:** Read-only selectors can break when Reddit ships a redesign.
- **Service worker sleep:** Evaluation is alarm-driven (~1 min). Edge transitions can lag by up to a minute after the clock flips.
- **Other sites:** Only `*.reddit.com` is in scope (not third-party Reddit embeds elsewhere).
- **Mobile:** Browser extension APIs on mobile Safari/Chrome are limited; this project targets **desktop** first.
- **Strict vs. open tabs:** Tabs already open when strict mode engages may still show content until reload/navigation; new navigations are redirected.

---

## Development notes

- **Manifest V3** only (`service_worker` background).
- Prefer `async`/`await` with small storage helpers in the background script.
- Popup uses **system fonts** (no remote font CDN — works offline and under extension CSP).
- Internal keys `_active`, `_strictActive`, `_readonlyActive` are written for debugging; the popup computes status live as well.

### Manual test checklist

1. Install unpacked → defaults: disabled, 09:00–17:00, strict.
2. Enable, set a window that includes *now*, save → badge `ON`, Reddit → blocked page.
3. Switch to read-only, save → badge `RO`, Reddit loads with banner, no vote/reply UI.
4. Set window outside *now* → badge `…`, Reddit normal.
5. Disable → badge clear, Reddit normal.
6. Overnight window and equal start/end (all-day) behave as documented.

---

## Version

**1.1.0** — Status UI & badge, blocked interstitial, read-only banner, schedule edge fixes (exclusive end, all-day, overnight), alarm on startup, icons, docs.

---

## License

Use and modify freely for personal or team focus tooling. No warranty — if you really need to post, you know where the toggle is.
