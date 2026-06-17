# ⏱️ AI Account Tracker — Cooldown Manager

A clean, modern, single-page web application to track multiple AI sub-accounts (such as Claude Pro, ChatGPT Plus, Gemini Advanced, etc.) and monitor their request/usage cooldown timers. It helps power users optimize their workflow and know exactly when each account is ready to use again.

---

## ✨ Features

- **Multi-Account Monitoring**: Track unlimited accounts, displaying names and email addresses.
- **Visual Cooldown States**: Clear visual cues for status changes:
  - `Ready to Use` (Green badge and checkmarks with a "Start Using" trigger)
  - `In Use` (Purple badge and "Active Session" status, indicating the account is currently active)
  - `Cooling Down` (Red badge with a live ticking countdown and expected ready time)
  - `No Timer Set` (Gray state ready to receive a timer)
- **Flexible Timers & Presets**: Set custom timers in Days, Hours, and Minutes, or use quick presets (e.g., `1h`, `2h`, `4h`, `4h 30m`, `5h`, `8h`, `1d`, `2d`, `3d`).
- **Inline Editing**: Double-click or click the edit icon to rename accounts or update emails directly.
- **Smart Filtering**: Quickly filter accounts by their status: *All*, *Ready*, *In Use*, or *Cooling Down*.
- **Aesthetic UI**: Smooth, dark-mode-first modern look with glassmorphic elements, vibrant glow gradients, micro-animations, and a manual light/dark mode theme selector.
- **System Notification Toasts**: Real-time alerts when a cooldown finishes or actions are performed.

---

## 💾 Hybrid Storage Architecture

To ensure data isn't lost when the browser window closes while maintaining standard privacy controls, the tracker uses a **3-Layer Storage System**:

1. **Layer 1: LocalStorage**: The primary instant-access cache for storing the account state locally in the browser session.
2. **Layer 2: OPFS (Origin Private File System)**: A secure, browser-managed directory that guarantees persistent storage even if LocalStorage is cleared.
3. **Layer 3: External JSON File Link**: Uses the modern **File System Access API** to save data to a user-defined file (such as `ai_accounts.json` in the root). When linked, changes auto-sync to your local disk, enabling backup and easy integration with external scripts.

---

## 🛠️ File Structure

The project consists of three core, vanilla web assets and local assets:
- `index.html` — The structural layout and template markup.
- `style.css` — The responsive styling, custom typography, animations, variables, and color schemes.
- `app.js` — Core application logic, event listeners, timer ticks, and multi-layer storage integrations.
- `fonts/` — Contains locally downloaded Inter font files (`.ttf`, weights 300 to 800) for complete offline support.

---

## 🚀 How to Run

No build step or server is required! Simply open the project folder and run:

1. Double-click or open `index.html` in any modern web browser.
2. Click **Link File** to link to an `ai_accounts.json` file in your workspace directory (e.g., root) so the application auto-saves your changes directly to the filesystem.

---

## 🌐 Browser Compatibility & UI Behavior

Depending on the browser you use, you will see a slightly different interface for managing files due to browser-specific security sandbox limits:

### Chromium-based Browsers (Chrome, Edge, Opera)
- **UI Element**: Shows **1 button** (`Link File` / `Saved ✓`).
- **Technical Detail**: Supports the **File System Access API**. When you click "Link File" and select or create your `ai_accounts.json` file once, the browser maintains a reference to that file. The app reads and auto-saves updates directly to that local file in the background on every change without needing repeated prompts.

### Non-Chromium Browsers (Firefox, Safari)
- **UI Elements**: Shows **2 buttons** (`Save File` & `Load File`).
- **Technical Detail**: These browsers do not support background file system linking. To keep your data synced:
  1. Use **Save File** (Export) to manually generate and download a fresh copy of `ai_accounts.json` to your local machine.
  2. Use **Load File** (Import) to select a saved `ai_accounts.json` file from your disk and load the data back into the app.

---

## 🔄 Recent Changes (Current Update Cycle)

The following changes and optimizations have been made in this update cycle:

- **Git Settings**: Added a `.gitignore` file to ensure the local storage file `ai_accounts.json` is ignored by Git, keeping local datasets private.
- **Available-Since Timestamps**: Updated the "Ready to Use" UI cards to show the exact timestamp when the account became ready (`Became available: <date time>`).
- **Text Readability Adjustments**:
  - In **Dark Mode**, the availability status text is styled in crisp white (`#ffffff`) for sharp readability against the dark background.
  - In **Light Mode**, the text uses a darker gray (`var(--text-secondary)`) to maintain clean contrast.
- **Firefox Startup Delay Fix**: Implemented a **500ms timeout** on the IndexedDB initialization check in `app.js`. If Firefox blocks or hangs on local IndexedDB access (a known issue when running from local protocols like `file:///`), the app will bypass it and fall back to LocalStorage instantly, avoiding a frozen blank screen.
- **Offline Local Fonts**: Downloaded the Inter font family (weights 300 to 800) locally into the `fonts/` directory and declared them via `@font-face` in `style.css`. Removed all remote Google Fonts HTTP link tags from `index.html`, allowing the app to render styled text instantly even in full offline environments.
- **Email Copy Option**: Added a copy icon to the right side of the account email address for quick one-click clipboard copying (automatically hidden during inline editing).
- **"In Use" Lifecycle State**: Added a new "In Use" state for accounts. When an account is available, a Play (Start Using) icon is displayed in the actions bar. Clicking it marks the account as active ("In Use" with purple styling). Once finished using it, clicking the Clock (Set Cooldown) icon opens the timer dialog to transition the account into a cooldown, optimizing usage workflows. Includes full support for stats counters and filter pills.
