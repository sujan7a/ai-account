// ============================================================
// AI Account Tracker — App Logic
// ============================================================

(function () {
  'use strict';

  // ---- Constants ----
  const STORAGE_KEY = 'ai_account_tracker';
  const THEME_KEY   = 'ai_tracker_theme';
  const DB_NAME     = 'ai_tracker_fs';
  const DB_STORE    = 'handles';
  const OPFS_FILE   = 'ai_accounts.json';

  // ---- State ----
  let accounts         = loadFromLocalStorage();
  let currentFilter    = 'all';
  let cooldownTargetId = null;
  let opfsHandle       = null;   // invisible persistent storage (no permission needed)
  let extFileHandle    = null;   // visible file picked by user via "Link File"

  // ---- DOM ----
  const addForm          = document.getElementById('add-account-form');
  const nameInput        = document.getElementById('account-name');
  const emailInput       = document.getElementById('account-email');
  const accountsList     = document.getElementById('accounts-list');
  const emptyState       = document.getElementById('empty-state');
  const toggleIcon       = document.getElementById('toggle-icon');
  const toggleBtn        = document.getElementById('toggle-add-form');
  const themeToggle      = document.getElementById('theme-toggle');
  const btnLinkFile      = document.getElementById('btn-link-file');
  const fileLinkLabel    = document.getElementById('file-link-label');
  const btnImportFile    = document.getElementById('btn-import-file');
  const inputImportFile  = document.getElementById('input-import-file');
  const cooldownModal    = document.getElementById('cooldown-modal');
  const cooldownForm     = document.getElementById('cooldown-form');
  const modalAccountName = document.getElementById('modal-account-name');
  const cooldownDays     = document.getElementById('cooldown-days');
  const cooldownHours    = document.getElementById('cooldown-hours');
  const cooldownMinutes  = document.getElementById('cooldown-minutes');
  const btnCloseModal    = document.getElementById('btn-close-modal');
  const btnCancelModal   = document.getElementById('btn-cancel-modal');
  const filterBtns       = document.querySelectorAll('.pill[data-filter]');
  const statTotal        = document.querySelector('#stat-total .stat-value');
  const statReady        = document.querySelector('#stat-ready .stat-value');
  const statCooling      = document.querySelector('#stat-cooling .stat-value');

  // ============================================================
  // Theme
  // ============================================================
  function loadTheme() {
    if (localStorage.getItem(THEME_KEY) === 'light')
      document.documentElement.classList.add('light');
  }
  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
  }
  themeToggle.addEventListener('click', toggleTheme);
  loadTheme();

  // ============================================================
  // Layer 1 — localStorage  (fast, always available, may clear on close)
  // ============================================================
  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveToLocalStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts)); } catch(e) {}
  }

  // ============================================================
  // Layer 2 — OPFS (Origin Private File System)
  // No permission needed. Truly persistent. Hidden from file explorer.
  // Works in Chrome, Edge, Firefox 111+.
  // ============================================================
  async function initOPFS() {
    try {
      const root = await navigator.storage.getDirectory();
      opfsHandle = await root.getFileHandle(OPFS_FILE, { create: true });
      return true;
    } catch { return false; }
  }

  async function saveToOPFS() {
    if (!opfsHandle) return;
    try {
      const w = await opfsHandle.createWritable();
      await w.write(JSON.stringify(accounts, null, 2));
      await w.close();
    } catch(e) {}
  }

  async function loadFromOPFS() {
    if (!opfsHandle) return null;
    try {
      const file = await opfsHandle.getFile();
      const text = await file.text();
      return text.trim() ? JSON.parse(text) : null;
    } catch { return null; }
  }

  // ============================================================
  // Layer 3 — External visible file (user picks location once)
  // Saves a real ai_accounts.json you can see in File Explorer.
  // Requires one click per browser session (browser security).
  // ============================================================

  // IndexedDB — remember the file handle across sessions
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
      req.onsuccess  = e => resolve(e.target.result);
      req.onerror    = e => reject(e.target.error);
    });
  }

  async function storeExtHandle(handle) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(handle, 'extFile');
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  }

  async function getStoredExtHandle() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx  = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get('extFile');
      req.onsuccess = e => res(e.target.result || null);
      req.onerror   = e => rej(e.target.error);
    });
  }

  async function clearStoredExtHandle() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete('extFile');
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  }

  async function saveToExtFile() {
    if (!extFileHandle) return;
    const w = await extFileHandle.createWritable();
    await w.write(JSON.stringify(accounts, null, 2));
    await w.close();
  }

  async function loadFromExtFile() {
    if (!extFileHandle) return null;
    try {
      const file = await extFileHandle.getFile();
      const text = await file.text();
      return text.trim() ? JSON.parse(text) : null;
    } catch { return null; }
  }

  async function getExtFilePermission(handle) {
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
    return false;
  }

  // ---- File Link button UI ----
  function setLinkUI(state) {
    // state: 'none' | 'unlinked' | 'linked' | 'reconnect'
    btnLinkFile.classList.remove('linked', 'reconnect');
    btnLinkFile.style.pointerEvents = '';
    btnLinkFile.style.cursor = '';

    const svgs = {
      unlinked:  `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>`,
      linked:    `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <polyline points="9 13 11 15 15 11"/>`,
      reconnect: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="11" x2="12" y2="15"/>
                  <circle cx="12" cy="17" r="0.6" fill="currentColor"/>`,
    };
    const labels = {
      unlinked:  'Save File',
      linked:    'Saved ✓',
      reconnect: 'Reconnect',
    };
    const titles = {
      unlinked:  'Click to save data to a visible ai_accounts.json file you choose',
      linked:    'Auto-saving to your file. Click to change location.',
      reconnect: 'Click to reconnect and grant access to your saved file',
    };

    if (state === 'none') {
      btnLinkFile.style.display = 'none';
      return;
    } else {
      btnLinkFile.style.display = '';
    }

    btnLinkFile.querySelector('svg').innerHTML = svgs[state];
    fileLinkLabel.textContent  = labels[state];
    btnLinkFile.title          = titles[state];
    if (state !== 'unlinked') btnLinkFile.classList.add(state);
  }

  // ---- "Save to File" / "Reconnect" button clicked ----
  btnLinkFile.addEventListener('click', async () => {
    if (extFileHandle && btnLinkFile.classList.contains('reconnect')) {
      // --- Reconnect flow ---
      try {
        const granted = await getExtFilePermission(extFileHandle);
        if (!granted) {
          showToast('Permission denied — try "Save to File" to pick again', 'info');
          await clearStoredExtHandle();
          extFileHandle = null;
          setLinkUI('unlinked');
          return;
        }
        // Load from file if it has more data
        const fileData = await loadFromExtFile();
        if (fileData && Array.isArray(fileData) && fileData.length > accounts.length) {
          accounts = fileData;
          saveToLocalStorage();
          saveToOPFS().catch(() => {});
          render();
        } else {
          await saveToExtFile(); // push current data to file
        }
        setLinkUI('linked');
        showToast('File reconnected — auto-saving here now', 'success');
      } catch(e) {
        showToast('Could not reconnect: ' + e.message, 'info');
      }
      return;
    }

    // --- Link new file flow / Manual fallback save ---
    if (!('showSaveFilePicker' in window)) {
      try {
        const blob = new Blob([JSON.stringify(accounts, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai_accounts.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('File exported! Move the downloaded ai_accounts.json to your project folder.', 'success');
      } catch (err) {
        showToast('Export failed: ' + err.message, 'info');
      }
      return;
    }

    if (extFileHandle && btnLinkFile.classList.contains('linked')) {
      if (!confirm('Change the save file? Current data will be written to the new location.')) return;
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'ai_accounts.json',
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
      });
      extFileHandle = handle;
      await storeExtHandle(handle);
      await saveToExtFile();
      setLinkUI('linked');
      showToast('File saved! Auto-saves here on every change.', 'success');
    } catch(e) {
      if (e.name !== 'AbortError') showToast('Could not save file: ' + e.message, 'info');
    }
  });

  // ---- Fallback Import button handlers ----
  btnImportFile.addEventListener('click', () => {
    inputImportFile.click();
  });

  inputImportFile.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data)) {
          const looksValid = data.length === 0 || data.every(acc => acc && typeof acc === 'object' && 'name' in acc);
          if (looksValid) {
            accounts = data;
            saveAccounts();
            render();
            showToast(`Loaded ${data.length} accounts from file!`, 'success');
          } else {
            showToast('Invalid file format: accounts must have a name.', 'info');
          }
        } else {
          showToast('Invalid file format: root must be a JSON array.', 'info');
        }
      } catch (err) {
        showToast('Failed to parse JSON file: ' + err.message, 'info');
      }
      inputImportFile.value = '';
    };
    reader.readAsText(file);
  });

  // ============================================================
  // Master Save — writes to all available layers
  // ============================================================
  function saveAccounts() {
    saveToLocalStorage();
    saveToOPFS().catch(() => {});
    if (extFileHandle && btnLinkFile.classList.contains('linked')) {
      saveToExtFile().catch(e => console.warn('Ext file save failed:', e));
    }
  }

  // ============================================================
  // Helpers
  // ============================================================
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }
  function getInitials(name) {
    return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
  function getAccountState(acc) {
    if (!acc.availableAt) return 'idle';
    return Date.now() >= acc.availableAt ? 'ready' : 'cooling';
  }
  function getTimeParts(availableAt) {
    const diff = availableAt - Date.now();
    if (diff <= 0) return null;
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function formatDateTime(ts) {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ============================================================
  // Rendering
  // ============================================================
  function buildCountdownHTML(parts, state, availableAt) {
    if (state === 'ready') {
      return `
        <div class="account-countdown">
          <span class="countdown-badge ready"><span class="status-dot"></span>Ready to Use</span>
          <div class="countdown-digits">
            <span class="ready-big">✓ Available Now</span>
          </div>
        </div>`;
    }
    if (state === 'idle') {
      return `
        <div class="account-countdown">
          <span class="countdown-badge idle"><span class="status-dot"></span>No Timer Set</span>
          <div class="countdown-digits">
            <div class="digit-group">
              <span class="countdown-num" style="font-size:2rem;color:var(--text-muted)">— — —</span>
              <span class="digit-label">click ⏱ to set timer</span>
            </div>
          </div>
        </div>`;
    }
    // Cooling
    let d = '';
    if (parts.days > 0) {
      d += `<div class="digit-group"><span class="countdown-num">${parts.days}</span><span class="digit-label">day${parts.days !== 1 ? 's' : ''}</span></div><span class="digit-sep">:</span>`;
    }
    d += `
      <div class="digit-group"><span class="countdown-num">${pad(parts.hours)}</span><span class="digit-label">hr</span></div>
      <span class="digit-sep">:</span>
      <div class="digit-group"><span class="countdown-num">${pad(parts.minutes)}</span><span class="digit-label">min</span></div>
      <span class="digit-sep">:</span>
      <div class="digit-group"><span class="countdown-num">${pad(parts.seconds)}</span><span class="digit-label">sec</span></div>`;
    return `
      <div class="account-countdown">
        <span class="countdown-badge cooling"><span class="status-dot"></span>Cooling Down</span>
        <div class="countdown-digits" data-parts="true">${d}</div>
        <div class="ready-at-text">Ready at: ${formatDateTime(availableAt)}</div>
      </div>`;
  }

  function render() {
    const filtered = accounts.filter(acc => {
      const s = getAccountState(acc);
      if (currentFilter === 'ready')   return s === 'ready';
      if (currentFilter === 'cooling') return s === 'cooling';
      return true;
    });

    statTotal.textContent   = accounts.length;
    statReady.textContent   = accounts.filter(a => getAccountState(a) === 'ready').length;
    statCooling.textContent = accounts.filter(a => getAccountState(a) === 'cooling').length;

    if (filtered.length === 0) {
      accountsList.innerHTML = '';
      emptyState.classList.remove('hidden');
      emptyState.querySelector('h3').textContent =
        accounts.length > 0 ? 'No matching accounts' : 'No accounts yet';
      emptyState.querySelector('p').textContent =
        accounts.length > 0 ? 'Try changing the filter.' : 'Add your first AI sub-account above to start tracking.';
      return;
    }

    emptyState.classList.add('hidden');
    accountsList.innerHTML = filtered.map(acc => {
      const state = getAccountState(acc);
      const parts = acc.availableAt ? getTimeParts(acc.availableAt) : null;
      const countdownHTML = buildCountdownHTML(parts, state, acc.availableAt);
      const clearBtn = state === 'cooling' ? `
        <button class="btn-icon" onclick="app.clearTimer('${acc.id}')" title="Clear timer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6"/><path d="M2.5 12a10 10 0 0 1 17.37-6.63L21.5 8"/>
            <path d="M2.5 22v-6h6"/><path d="M21.5 12a10 10 0 0 1-17.37 6.63L2.5 16"/>
          </svg>
        </button>` : '';
      return `
        <div class="account-card ${state}" data-id="${acc.id}">
          <div class="account-card-top">
            <div class="account-avatar">${getInitials(acc.name)}</div>
            <div class="account-info">
              <div class="account-name">${escapeHtml(acc.name)}</div>
              <div class="account-email">${escapeHtml(acc.email)}</div>
            </div>
            <div class="account-actions">
              <button class="btn-icon" onclick="app.setCooldown('${acc.id}')" title="Set cooldown timer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
              ${clearBtn}
              <button class="btn-icon" onclick="app.editAccount('${acc.id}')" title="Edit account">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon danger" onclick="app.deleteAccount('${acc.id}')" title="Delete account">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          ${countdownHTML}
        </div>`;
    }).join('');
  }

  // ============================================================
  // Tick — per-second countdown update
  // ============================================================
  function tick() {
    let needsRender = false;
    accounts.forEach(acc => {
      if (acc.availableAt && Date.now() >= acc.availableAt) {
        const el = document.querySelector(`.account-card[data-id="${acc.id}"]`);
        if (el && !el.classList.contains('ready')) {
          needsRender = true;
          showToast(`${acc.name} is now ready to use!`, 'success');
        }
      }
    });
    if (needsRender) { render(); return; }

    document.querySelectorAll('.account-card.cooling').forEach(card => {
      const acc = accounts.find(a => a.id === card.dataset.id);
      if (!acc?.availableAt) return;
      const parts = getTimeParts(acc.availableAt);
      if (!parts) return;
      const el = card.querySelector('.countdown-digits[data-parts]');
      if (!el) return;
      let h = '';
      if (parts.days > 0) {
        h += `<div class="digit-group"><span class="countdown-num">${parts.days}</span><span class="digit-label">day${parts.days !== 1 ? 's' : ''}</span></div><span class="digit-sep">:</span>`;
      }
      h += `
        <div class="digit-group"><span class="countdown-num">${pad(parts.hours)}</span><span class="digit-label">hr</span></div>
        <span class="digit-sep">:</span>
        <div class="digit-group"><span class="countdown-num">${pad(parts.minutes)}</span><span class="digit-label">min</span></div>
        <span class="digit-sep">:</span>
        <div class="digit-group"><span class="countdown-num">${pad(parts.seconds)}</span><span class="digit-label">sec</span></div>`;
      el.innerHTML = h;
    });
  }

  // ============================================================
  // Event Handlers
  // ============================================================

  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const name  = nameInput.value.trim();
    const email = emailInput.value.trim();
    if (!name || !email) return;
    accounts.push({ id: generateId(), name, email, availableAt: null, createdAt: Date.now() });
    saveAccounts();
    render();
    addForm.reset();
    nameInput.focus();
    showToast(`${name} added`, 'info');
  });

  toggleBtn.addEventListener('click', () => {
    addForm.classList.toggle('hidden');
    toggleIcon.classList.toggle('collapsed');
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // Cooldown modal
  function openCooldownModal(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    cooldownTargetId = id;
    modalAccountName.textContent = acc.name;
    cooldownDays.value = cooldownHours.value = cooldownMinutes.value = 0;
    cooldownModal.classList.add('active');
    cooldownHours.focus();
  }
  function closeCooldownModal() {
    cooldownModal.classList.remove('active');
    cooldownTargetId = null;
  }

  btnCloseModal.addEventListener('click', closeCooldownModal);
  btnCancelModal.addEventListener('click', closeCooldownModal);
  cooldownModal.addEventListener('click', e => { if (e.target === cooldownModal) closeCooldownModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCooldownModal(); });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cooldownDays.value    = btn.dataset.days;
      cooldownHours.value   = btn.dataset.hours;
      cooldownMinutes.value = btn.dataset.minutes;
    });
  });

  cooldownForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!cooldownTargetId) return;
    const d = parseInt(cooldownDays.value)    || 0;
    const h = parseInt(cooldownHours.value)   || 0;
    const m = parseInt(cooldownMinutes.value) || 0;
    const ms = ((d * 24 + h) * 60 + m) * 60000;
    if (ms <= 0) { showToast('Please set a time greater than zero', 'info'); return; }
    const acc = accounts.find(a => a.id === cooldownTargetId);
    if (acc) {
      acc.availableAt = Date.now() + ms;
      saveAccounts();
      render();
      const label = [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
      showToast(`${acc.name} — cooldown: ${label}`, 'info');
    }
    closeCooldownModal();
  });

  // ============================================================
  // Public API (inline onclick)
  // ============================================================
  window.app = {
    setCooldown: openCooldownModal,

    clearTimer(id) {
      const acc = accounts.find(a => a.id === id);
      if (!acc) return;
      acc.availableAt = null;
      saveAccounts();
      render();
      showToast(`Timer cleared for ${acc.name}`, 'info');
    },

    editAccount(id) {
      const card = document.querySelector(`.account-card[data-id="${id}"]`);
      const acc  = accounts.find(a => a.id === id);
      if (!card || !acc) return;
      const nameEl  = card.querySelector('.account-name');
      const emailEl = card.querySelector('.account-email');
      const actions = card.querySelector('.account-actions');

      nameEl.innerHTML  = `<input class="inline-edit-input" id="edit-name-${id}" type="text" value="${escapeHtml(acc.name)}" placeholder="Account name" maxlength="60">`;
      emailEl.innerHTML = `<input class="inline-edit-input" id="edit-email-${id}" type="email" value="${escapeHtml(acc.email)}" placeholder="Email address" maxlength="120">`;

      card.querySelectorAll('.inline-edit-input').forEach(inp => {
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); app.saveEdit(id); }
          if (e.key === 'Escape') { e.preventDefault(); app.cancelEdit(); }
        });
      });

      actions.innerHTML = `
        <button class="btn-icon" style="border-color:rgba(52,211,153,0.4);color:var(--accent-green)"
          onclick="app.saveEdit('${id}')" title="Save">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <button class="btn-icon danger" onclick="app.cancelEdit()" title="Cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;

      document.getElementById(`edit-name-${id}`).focus();
      document.getElementById(`edit-name-${id}`).select();
    },

    saveEdit(id) {
      const nameEl  = document.getElementById(`edit-name-${id}`);
      const emailEl = document.getElementById(`edit-email-${id}`);
      if (!nameEl) return;
      const newName  = nameEl.value.trim();
      const newEmail = emailEl?.value.trim();
      if (!newName) {
        nameEl.style.borderColor = 'var(--accent-red)';
        nameEl.focus();
        showToast('Name cannot be empty', 'info');
        return;
      }
      const acc = accounts.find(a => a.id === id);
      if (acc) {
        acc.name  = newName;
        if (newEmail) acc.email = newEmail;
        saveAccounts();
        render();
        showToast(`${acc.name} updated`, 'info');
      }
    },

    cancelEdit() { render(); },

    deleteAccount(id) {
      const acc = accounts.find(a => a.id === id);
      if (!acc) return;
      if (!confirm(`Delete "${acc.name}"? This cannot be undone.`)) return;
      accounts = accounts.filter(a => a.id !== id);
      saveAccounts();
      render();
      showToast(`${acc.name} removed`, 'info');
    }
  };

  // ============================================================
  // Toast
  // ============================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : 'ℹ️';
    toast.innerHTML = `<span style="font-size:1.1rem;flex-shrink:0">${icon}</span>${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  // ============================================================
  // Init
  // ============================================================
  async function init() {
    render();
    setInterval(tick, 1000);
    setLinkUI('unlinked');

    // ---- Layer 2: OPFS (invisible but persistent) ----
    const opfsOK = await initOPFS();
    if (opfsOK) {
      const opfsData = await loadFromOPFS();
      if (opfsData && Array.isArray(opfsData) && opfsData.length >= accounts.length) {
        accounts = opfsData;
        saveToLocalStorage();
        render();
      } else {
        await saveToOPFS(); // seed OPFS from localStorage
      }
    }

    // ---- Layer 3: External visible file ----
    if (!('showSaveFilePicker' in window)) {
      btnImportFile.style.display = 'inline-flex';
      setLinkUI('unlinked');
      return;
    }

    try {
      const stored = await getStoredExtHandle();
      if (!stored) return; // no file previously linked

      extFileHandle = stored;
      const perm = await stored.queryPermission({ mode: 'readwrite' });

      if (perm === 'granted') {
        const fileData = await loadFromExtFile();
        if (fileData && Array.isArray(fileData) && fileData.length > accounts.length) {
          accounts = fileData;
          saveToLocalStorage();
          saveToOPFS().catch(() => {});
          render();
        } else {
          await saveToExtFile(); // push latest data to file
        }
        setLinkUI('linked');
      } else {
        // Browser needs a user gesture — show reconnect
        setLinkUI('reconnect');
        showToast('Click "Reconnect File" to access your saved file', 'info');
      }
    } catch(e) {
      console.warn('File init:', e);
      extFileHandle = null;
      setLinkUI('unlinked');
    }
  }

  init();

})();
