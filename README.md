# ⏱️ AI Account Tracker — Cooldown Manager

A clean, modern, single-page web application to track multiple AI sub-accounts (such as Claude Pro, ChatGPT Plus, Gemini Advanced, etc.) and monitor their request/usage cooldown timers. It helps power users optimize their workflow and know exactly when each account is ready to use again.

---

## ✨ Features

- **Multi-Account Monitoring**: Track unlimited accounts, displaying names and email addresses.
- **Visual Cooldown States**: Clear visual cues for status changes:
  - `Ready to Use` (Green badge and checkmarks)
  - `Cooling Down` (Red badge with a live ticking countdown and expected ready time)
  - `No Timer Set` (Gray state ready to receive a timer)
- **Flexible Timers & Presets**: Set custom timers in Days, Hours, and Minutes, or use quick presets (e.g., `1h`, `2h`, `4h`, `4h 30m`, `5h`, `8h`, `1d`, `2d`, `3d`).
- **Inline Editing**: Double-click or click the edit icon to rename accounts or update emails directly.
- **Smart Filtering**: Quickly filter accounts by their status: *All*, *Ready*, or *Cooling Down*.
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

The project consists of three core, vanilla web assets:
- `index.html` — The structural layout and template markup.
- `style.css` — The responsive styling, custom typography, animations, variables, and color schemes.
- `app.js` — Core application logic, event listeners, timer ticks, and multi-layer storage integrations.

---

## 🚀 How to Run

No build step or server is required! Simply open the project folder and run:

1. Double-click or open `index.html` in any modern web browser.
2. Click **Link File** to link to an `ai_accounts.json` file in your workspace directory (e.g., root) so the application auto-saves your changes directly to the filesystem.
