// State Management
let state = {
  // Deal Parameters
  tokenPreMergerValue: 4860000,
  tiptonicPreMergerValue: 290000,
  cashInvestment: 500000,
  tokenWorkingCapitalDebt: 30000,
  
  // Cap Tables
  tokenCapTable: [
    { id: 't1', name: 'Daniel & Nadia', percentage: 80.0 },
    { id: 't2', name: 'Joseph McDonough', percentage: 20.0 }
  ],
  tiptonicCapTable: [
    { id: 'tp1', name: 'Ben', percentage: 10.0 },
    { id: 'tp2', name: 'Jay', percentage: 10.0 },
    { id: 'tp3', name: 'Christina & Jack', percentage: 65.0 },
    { id: 'tp4', name: 'Other', percentage: 15.0 }
  ],
  
  // Vesting Toggle: 'close' (At Close) or 'vested' (Fully Vested)
  vestingState: 'close',
  
  // Active Navigation Tab: 'studio' or 'versions'
  activeTab: 'studio'
};

// Constant for Ben & Jay target percentage of Tiptonic slice
const BEN_JAY_VESTED_TARGET = 40.0; // 40% of Tiptonic slice

// Local Cache for Versions List
let modelVersionsCache = [];
let isVersionsLoaded = false;

// DOM Elements
const elements = {
  // Tabs
  tabStudio: document.getElementById('tab-studio'),
  tabVersions: document.getElementById('tab-versions'),
  viewStudio: document.getElementById('view-studio'),
  viewVersions: document.getElementById('view-versions'),
  
  // Global Save
  btnSaveVersionHeader: document.getElementById('btn-save-version-header'),
  
  // Inputs
  inputTokenValue: document.getElementById('input-token-value'),
  inputTiptonicValue: document.getElementById('input-tiptonic-value'),
  inputCashInvestment: document.getElementById('input-cash-investment'),
  inputTokenDebt: document.getElementById('input-token-debt'),
  readonlyPostMergerValue: document.getElementById('readonly-post-merger-value'),
  
  // Tables
  tokenTableBody: document.getElementById('token-table-body'),
  tokenTableTotal: document.getElementById('token-table-total'),
  tiptonicTableBody: document.getElementById('tiptonic-table-body'),
  tiptonicTableTotal: document.getElementById('tiptonic-table-total'),
  proformaTableBody: document.getElementById('proforma-table-body'),
  proformaTableTotal: document.getElementById('proforma-table-total'),
  
  // Toggles
  toggleAtClose: document.getElementById('toggle-at-close'),
  toggleFullyVested: document.getElementById('toggle-fully-vested'),
  
  // Shareholder Modal
  addShareholderModal: document.getElementById('add-shareholder-modal'),
  modalCloseAdd: document.getElementById('modal-close-add'),
  modalCancelAdd: document.getElementById('modal-cancel-add'),
  btnAddTokenShareholder: document.getElementById('btn-add-token-shareholder'),
  btnAddTiptonicShareholder: document.getElementById('btn-add-tiptonic-shareholder'),
  formAddShareholder: document.getElementById('form-add-shareholder'),
  modalShareholderTitle: document.getElementById('modal-shareholder-title'),
  inputShareholderName: document.getElementById('input-shareholder-name'),
  inputShareholderPct: document.getElementById('input-shareholder-pct'),
  selectShareholderSource: document.getElementById('select-shareholder-source'),
  errorShareholderName: document.getElementById('error-shareholder-name'),
  errorShareholderPct: document.getElementById('error-shareholder-pct'),
  
  // Versions Panel
  versionsListContainer: document.getElementById('versions-list-container'),
  
  // Save Version Modal
  saveVersionModal: document.getElementById('save-version-modal'),
  modalCloseSave: document.getElementById('modal-close-save'),
  modalCancelSave: document.getElementById('modal-cancel-save'),
  formSaveVersion: document.getElementById('form-save-version'),
  inputVersionLabel: document.getElementById('input-version-label'),
  errorVersionLabel: document.getElementById('error-version-label'),
  
  // Toasts
  toastContainer: document.getElementById('toast-container')
};

// Target Table for Shareholder Modal ('token' or 'tiptonic')
let activeModalTableTarget = 'token';

// Formatting Helpers
function formatCurrency(val) {
  return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function parseCurrency(str) {
  const clean = str.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function formatPercentage(val) {
  return val.toFixed(1) + '%';
}

// Toast Alert Helper
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="btn-danger-link" onclick="this.parentElement.remove()" style="font-size: 1rem; font-weight: bold; margin-left: 8px;">&times;</button>
  `;
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Version Persistence Patterns
async function loadVersions() {
  try {
    const res = await fetch('/api/save-settings?key=modelVersions');
    if (res.ok) {
      const data = await res.json();
      modelVersionsCache = (data && typeof data.value === 'string' && data.value.length) ? JSON.parse(data.value) : [];
    } else {
      modelVersionsCache = [];
    }
  } catch (e) {
    console.error("Error loading versions", e);
    modelVersionsCache = [];
  }
  isVersionsLoaded = true;
  return modelVersionsCache;
}

async function saveVersions(list) {
  modelVersionsCache = list;
  try {
    const res = await fetch('/api/save-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'modelVersions', value: JSON.stringify(list) })
    });
    if (!res.ok) {
      throw new Error(`Failed to save. Status: ${res.status}`);
    }
  } catch (e) {
    console.error("Error saving versions list to KV", e);
    showToast("Failed to write versions to remote database.", "error");
  }
}

// Initialise App State
function init() {
  // Set up listeners for deal parameters
  setupNumericInput(elements.inputTokenValue, 'tokenPreMergerValue');
  setupNumericInput(elements.inputTiptonicValue, 'tiptonicPreMergerValue');
  setupNumericInput(elements.inputCashInvestment, 'cashInvestment');
  setupNumericInput(elements.inputTokenDebt, 'tokenWorkingCapitalDebt');
  
  // Navigation Tabs
  elements.tabStudio.addEventListener('click', () => switchTab('studio'));
  elements.tabVersions.addEventListener('click', () => switchTab('versions'));
  
  // Shareholder Modals
  elements.btnAddTokenShareholder.addEventListener('click', () => openAddShareholderModal('token'));
  elements.btnAddTiptonicShareholder.addEventListener('click', () => openAddShareholderModal('tiptonic'));
  elements.modalCloseAdd.addEventListener('click', closeAddShareholderModal);
  elements.modalCancelAdd.addEventListener('click', closeAddShareholderModal);
  elements.formAddShareholder.addEventListener('submit', handleAddShareholderSubmit);
  
  // Toggles
  elements.toggleAtClose.addEventListener('click', () => setVestingState('close'));
  elements.toggleFullyVested.addEventListener('click', () => setVestingState('vested'));
  
  // Save Action
  elements.btnSaveVersionHeader.addEventListener('click', openSaveVersionModal);
  elements.modalCloseSave.addEventListener('click', closeSaveVersionModal);
  elements.modalCancelSave.addEventListener('click', closeSaveVersionModal);
  elements.formSaveVersion.addEventListener('submit', handleSaveVersionSubmit);
  
  // Load local state cache if exists (fallback to default)
  try {
    const localState = localStorage.getItem('token_tiptonic_state');
    if (localState) {
      const parsed = JSON.parse(localState);
      // Validate structure before loading
      if (parsed.tokenCapTable && parsed.tiptonicCapTable) {
        state = { ...state, ...parsed };
      }
    }
  } catch (e) {
    console.warn("Could not load local state from cache.", e);
  }
  
  // Pre-load versions from Vercel KV in background
  loadVersions().then(() => {
    if (state.activeTab === 'versions') {
      renderVersions();
    }
  });

  // Perform initial render
  render();
}

function persistStateLocal() {
  try {
    localStorage.setItem('token_tiptonic_state', JSON.stringify(state));
  } catch (e) {}
}

// Navigation switcher
function switchTab(tabName) {
  state.activeTab = tabName;
  persistStateLocal();
  
  if (tabName === 'studio') {
    elements.tabStudio.classList.add('active');
    elements.tabVersions.classList.remove('active');
    elements.viewStudio.classList.add('active');
    elements.viewVersions.classList.remove('active');
  } else {
    elements.tabStudio.classList.remove('active');
    elements.tabVersions.classList.add('active');
    elements.viewStudio.classList.remove('active');
    elements.viewVersions.classList.add('active');
    renderVersions();
  }
}

// Numeric inputs comma format handling
function setupNumericInput(inputEl, stateKey) {
  // Initial value setting
  inputEl.value = formatCurrency(state[stateKey]);
  
  inputEl.addEventListener('focus', (e) => {
    // Strip commas for easy typing
    const val = parseCurrency(e.target.value);
    e.target.value = val === 0 ? '' : val.toString();
  });
  
  inputEl.addEventListener('blur', (e) => {
    commitValue(e.target);
  });
  
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      commitValue(e.target);
      e.target.blur();
    }
  });
  
  function commitValue(el) {
    const parsed = parseCurrency(el.value);
    state[stateKey] = parsed;
    el.value = formatCurrency(parsed);
    persistStateLocal();
    render();
  }
}

// Update vesting toggle
function setVestingState(vState) {
  state.vestingState = vState;
  persistStateLocal();
  
  if (vState === 'close') {
    elements.toggleAtClose.classList.add('active');
    elements.toggleFullyVested.classList.remove('active');
  } else {
    elements.toggleAtClose.classList.remove('active');
    elements.toggleFullyVested.classList.add('active');
  }
  
  render();
}

// Modal handling — Add Shareholder
function openAddShareholderModal(targetTable) {
  activeModalTableTarget = targetTable;
  elements.modalShareholderTitle.innerText = `Add ${targetTable === 'token' ? 'Token' : 'Tiptonic'} Shareholder`;
  
  // Clear inputs and errors
  elements.inputShareholderName.value = '';
  elements.inputShareholderPct.value = '';
  elements.errorShareholderName.style.display = 'none';
  elements.errorShareholderPct.style.display = 'none';
  
  // Build source dropdown dynamically based on names in target table
  const table = targetTable === 'token' ? state.tokenCapTable : state.tiptonicCapTable;
  elements.selectShareholderSource.innerHTML = '<option value="prorata">All holders (pro rata)</option>';
  
  table.forEach(holder => {
    elements.selectShareholderSource.innerHTML += `<option value="${holder.id}">Dilute ${holder.name} only</option>`;
  });
  
  elements.addShareholderModal.classList.add('active');
  elements.inputShareholderName.focus();
}

function closeAddShareholderModal() {
  elements.addShareholderModal.classList.remove('active');
}

function handleAddShareholderSubmit(e) {
  e.preventDefault();
  
  const name = elements.inputShareholderName.value.trim();
  const pctStr = elements.inputShareholderPct.value.trim();
  const pct = parseFloat(pctStr);
  const source = elements.selectShareholderSource.value;
  
  let valid = true;
  
  if (!name) {
    elements.errorShareholderName.innerText = "Name is required.";
    elements.errorShareholderName.style.display = 'block';
    valid = false;
  } else {
    elements.errorShareholderName.style.display = 'none';
  }
  
  if (isNaN(pct) || pct <= 0 || pct > 100) {
    elements.errorShareholderPct.innerText = "Please enter a valid percentage between 0 and 100.";
    elements.errorShareholderPct.style.display = 'block';
    valid = false;
  } else {
    elements.errorShareholderPct.style.display = 'none';
  }
  
  if (!valid) return;
  
  const table = activeModalTableTarget === 'token' ? state.tokenCapTable : state.tiptonicCapTable;
  
  // Validate if specific source has enough percentage
  if (source !== 'prorata') {
    const sourceHolder = table.find(h => h.id === source);
    if (!sourceHolder || sourceHolder.percentage < pct) {
      elements.errorShareholderPct.innerText = `Selected source shareholder only has ${sourceHolder ? sourceHolder.percentage.toFixed(1) : 0}% ownership. Cannot dilute them by ${pct.toFixed(1)}%.`;
      elements.errorShareholderPct.style.display = 'block';
      return;
    }
  }
  
  // Perform dilution scaling
  if (source === 'prorata') {
    // Pro rata: scale down all existing shareholders proportionally
    const scaleFactor = (100 - pct) / 100;
    table.forEach(h => {
      h.percentage = h.percentage * scaleFactor;
    });
  } else {
    // Specific holder dilution
    const sourceHolder = table.find(h => h.id === source);
    sourceHolder.percentage -= pct;
  }
  
  // Add new shareholder
  const newId = (activeModalTableTarget === 'token' ? 't_' : 'tp_') + Date.now();
  table.push({
    id: newId,
    name: name,
    percentage: pct
  });
  
  // Persist and render
  persistStateLocal();
  closeAddShareholderModal();
  render();
  showToast(`Successfully added shareholder "${name}".`);
}

// Delete shareholder
function deleteShareholder(tableTarget, id) {
  const table = tableTarget === 'token' ? state.tokenCapTable : state.tiptonicCapTable;
  const index = table.findIndex(h => h.id === id);
  if (index !== -1) {
    const name = table[index].name;
    table.splice(index, 1);
    
    // Pro-rata redistribution of the deleted shareholder's percent
    if (table.length > 0) {
      const sumRemaining = table.reduce((acc, h) => acc + h.percentage, 0);
      if (sumRemaining > 0) {
        const scaleFactor = 100.0 / sumRemaining;
        table.forEach(h => {
          h.percentage = h.percentage * scaleFactor;
        });
      } else {
        const equalPct = 100.0 / table.length;
        table.forEach(h => {
          h.percentage = equalPct;
        });
      }
    }
    
    persistStateLocal();
    render();
    showToast(`Removed shareholder "${name}". Remaining shares scaled pro rata to 100.0%.`);
  }
}

// Edit name directly on cell
function updateShareholderName(tableTarget, id, name) {
  const table = tableTarget === 'token' ? state.tokenCapTable : state.tiptonicCapTable;
  const holder = table.find(h => h.id === id);
  if (holder) {
    holder.name = name.trim();
    persistStateLocal();
    renderProforma(); // Pro forma rows labels might update
  }
}

// Edit percentage directly on cell
function updateShareholderPct(tableTarget, id, pctVal) {
  const table = tableTarget === 'token' ? state.tokenCapTable : state.tiptonicCapTable;
  const holder = table.find(h => h.id === id);
  if (holder) {
    const parsed = parseFloat(pctVal);
    holder.percentage = isNaN(parsed) ? 0 : parsed;
    persistStateLocal();
    render();
  }
}

// Modal handling — Save Version
function openSaveVersionModal() {
  elements.inputVersionLabel.value = '';
  elements.errorVersionLabel.style.display = 'none';
  elements.saveVersionModal.classList.add('active');
  elements.inputVersionLabel.focus();
}

function closeSaveVersionModal() {
  elements.saveVersionModal.classList.remove('active');
}

async function handleSaveVersionSubmit(e) {
  e.preventDefault();
  
  const label = elements.inputVersionLabel.value.trim();
  if (!label) {
    elements.errorVersionLabel.innerText = "Please enter a version label.";
    elements.errorVersionLabel.style.display = 'block';
    return;
  }
  elements.errorVersionLabel.style.display = 'none';
  
  // Close modal and show saving feedback
  closeSaveVersionModal();
  showToast("Saving version to Vercel KV...", "success");
  
  try {
    // Re-fetch modelVersions list from KV first to get latest
    const versions = await loadVersions();
    
    // Create new version object
    const newVersion = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      ts: new Date().toISOString(),
      label: label,
      type: 'manual',
      state: {
        tokenPreMergerValue: state.tokenPreMergerValue,
        tiptonicPreMergerValue: state.tiptonicPreMergerValue,
        cashInvestment: state.cashInvestment,
        tokenWorkingCapitalDebt: state.tokenWorkingCapitalDebt,
        tokenCapTable: JSON.parse(JSON.stringify(state.tokenCapTable)),
        tiptonicCapTable: JSON.parse(JSON.stringify(state.tiptonicCapTable)),
        vestingState: state.vestingState
      }
    };
    
    versions.push(newVersion);
    
    // Auto trim versions: keep all manual, and up to 25 auto (we only save manual anyway)
    const trimmed = versions.sort((a,b) => b.ts.localeCompare(a.ts));
    
    await saveVersions(trimmed);
    showToast(`Version "${label}" saved successfully.`);
  } catch (err) {
    console.error(err);
    showToast("Failed to save version to Vercel KV.", "error");
  }
}

// Load version state into model
function restoreVersion(versionId) {
  const version = modelVersionsCache.find(v => v.id === versionId);
  if (version && version.state) {
    const s = version.state;
    state.tokenPreMergerValue = s.tokenPreMergerValue;
    state.tiptonicPreMergerValue = s.tiptonicPreMergerValue;
    state.cashInvestment = s.cashInvestment;
    state.tokenWorkingCapitalDebt = s.tokenWorkingCapitalDebt;
    state.tokenCapTable = JSON.parse(JSON.stringify(s.tokenCapTable));
    state.tiptonicCapTable = JSON.parse(JSON.stringify(s.tiptonicCapTable));
    state.vestingState = s.vestingState || 'close';
    
    // Commit to inputs
    elements.inputTokenValue.value = formatCurrency(state.tokenPreMergerValue);
    elements.inputTiptonicValue.value = formatCurrency(state.tiptonicPreMergerValue);
    elements.inputCashInvestment.value = formatCurrency(state.cashInvestment);
    elements.inputTokenDebt.value = formatCurrency(state.tokenWorkingCapitalDebt);
    
    setVestingState(state.vestingState);
    persistStateLocal();
    render();
    
    switchTab('studio');
    showToast(`Restored version: "${version.label}"`);
  }
}

// Delete version snapshot
async function deleteVersion(versionId) {
  if (!confirm("Are you sure you want to delete this version?")) return;
  
  try {
    const list = modelVersionsCache.filter(v => v.id !== versionId);
    await saveVersions(list);
    renderVersions();
    showToast("Version deleted successfully.", "error");
  } catch (e) {
    showToast("Failed to delete version.", "error");
  }
}

// Render Logic
function render() {
  // Post-merger formula
  const tokenEquity = Math.max(0, state.tokenPreMergerValue - state.tokenWorkingCapitalDebt);
  const tiptonicEquity = state.tiptonicPreMergerValue;
  const postMergerValue = tokenEquity + tiptonicEquity + state.cashInvestment;
  
  elements.readonlyPostMergerValue.innerText = '$' + formatCurrency(postMergerValue);
  
  // Pre-merger Cap Tables
  renderPreMergerTable('token');
  renderPreMergerTable('tiptonic');
  
  // Pro Forma Table
  renderProforma();
}

function renderPreMergerTable(type) {
  const table = type === 'token' ? state.tokenCapTable : state.tiptonicCapTable;
  const bodyEl = type === 'token' ? elements.tokenTableBody : elements.tiptonicTableBody;
  const totalEl = type === 'token' ? elements.tokenTableTotal : elements.tiptonicTableTotal;
  
  bodyEl.innerHTML = '';
  
  let totalPct = 0;
  
  table.forEach(holder => {
    totalPct += holder.percentage;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <input type="text" class="cell-name-editable" value="${holder.name}" 
          onchange="updateShareholderName('${type}', '${holder.id}', this.value)">
      </td>
      <td>
        <input type="number" step="any" class="cell-percentage-editable" value="${holder.percentage.toFixed(1)}" 
          onchange="updateShareholderPct('${type}', '${holder.id}', this.value)">
      </td>
      <td class="cell-actions">
        <button class="btn-danger-link" onclick="deleteShareholder('${type}', '${holder.id}')" title="Delete Shareholder">&times;</button>
      </td>
    `;
    bodyEl.appendChild(row);
  });
  
  totalEl.innerText = formatPercentage(totalPct);
  
  // Green at exactly 100.0% (allowing small floats threshold), red otherwise
  const isValid = Math.abs(totalPct - 100.0) < 0.0001;
  if (isValid) {
    totalEl.className = 'footer-total-value total-valid';
  } else {
    totalEl.className = 'footer-total-value total-invalid';
  }
}

function renderProforma() {
  // Merger Arithmetic
  const tokenEquity = Math.max(0, state.tokenPreMergerValue - state.tokenWorkingCapitalDebt);
  const tiptonicEquity = state.tiptonicPreMergerValue;
  const postMoney = tokenEquity + tiptonicEquity + state.cashInvestment;
  
  const tokenShare = postMoney > 0 ? tokenEquity / postMoney : 0;
  const tiptonicSlice = postMoney > 0 ? tiptonicEquity / postMoney : 0;
  const newmoneySlice = postMoney > 0 ? state.cashInvestment / postMoney : 0;
  
  elements.proformaTableBody.innerHTML = '';
  
  let rowIdx = 1;
  let totalProformaPct = 0;
  
  // 1 & 2. Token side: Daniel & Nadia + Joseph McDonough + any other token side shareholders
  state.tokenCapTable.forEach(holder => {
    const pfPct = (holder.percentage / 100) * tokenShare * 100;
    totalProformaPct += pfPct;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="display: flex; flex-direction: column;">
          <span class="cell-name">${holder.name}</span>
          <span class="table-subtitle" style="margin-top: 2px;">Token Table Shareholder (${holder.percentage.toFixed(1)}%)</span>
        </div>
      </td>
      <td class="cell-percentage">${formatPercentage(pfPct)}</td>
    `;
    elements.proformaTableBody.appendChild(row);
  });
  
  // 3 & 4. Tiptonic Earn-in: Ben and Jay
  const benHolder = state.tiptonicCapTable.find(h => h.name.toLowerCase() === 'ben') || { percentage: 10.0 };
  const jayHolder = state.tiptonicCapTable.find(h => h.name.toLowerCase() === 'jay') || { percentage: 10.0 };
  
  let benProformaPct = 0;
  let jayProformaPct = 0;
  
  if (state.vestingState === 'close') {
    // At Close: translates at Tiptonic table %
    benProformaPct = (benHolder.percentage / 100) * tiptonicSlice * 100;
    jayProformaPct = (jayHolder.percentage / 100) * tiptonicSlice * 100;
  } else {
    // Fully Vested: 40% of Tiptonic slice each
    benProformaPct = (BEN_JAY_VESTED_TARGET / 100) * tiptonicSlice * 100;
    jayProformaPct = (BEN_JAY_VESTED_TARGET / 100) * tiptonicSlice * 100;
  }
  
  totalProformaPct += benProformaPct;
  totalProformaPct += jayProformaPct;
  
  // Add Ben Row
  const benRow = document.createElement('tr');
  benRow.innerHTML = `
    <td>
      <div style="display: flex; flex-direction: column;">
        <span class="cell-name">Ben</span>
        <span class="table-subtitle" style="margin-top: 2px;">Tiptonic Earn-in (Fully Vested target: 40% of Tiptonic slice)</span>
      </div>
    </td>
    <td class="cell-percentage">${formatPercentage(benProformaPct)}</td>
  `;
  elements.proformaTableBody.appendChild(benRow);
  
  // Add Jay Row
  const jayRow = document.createElement('tr');
  jayRow.innerHTML = `
    <td>
      <div style="display: flex; flex-direction: column;">
        <span class="cell-name">Jay</span>
        <span class="table-subtitle" style="margin-top: 2px;">Tiptonic Earn-in (Fully Vested target: 40% of Tiptonic slice)</span>
      </div>
    </td>
    <td class="cell-percentage">${formatPercentage(jayProformaPct)}</td>
  `;
  elements.proformaTableBody.appendChild(jayRow);
  
  // 5. Residual Tiptonic Equity line
  const benShareTiptonicScale = (benHolder.percentage / 100);
  const jayShareTiptonicScale = (jayHolder.percentage / 100);
  
  let residualTiptonicPct = 0;
  if (state.vestingState === 'close') {
    // Remaining = slice - ben - jay (derived from table percentages)
    residualTiptonicPct = (tiptonicSlice - (benProformaPct / 100) - (jayProformaPct / 100)) * 100;
  } else {
    // Remaining = slice - (2 * 40%) = 20% of Tiptonic slice
    residualTiptonicPct = (tiptonicSlice - (benProformaPct / 100) - (jayProformaPct / 100)) * 100;
  }
  
  // Guard against negative (shouldn't happen with default inputs but good math check)
  residualTiptonicPct = Math.max(0, residualTiptonicPct);
  totalProformaPct += residualTiptonicPct;
  
  // Find names of other Tiptonic shareholders to build dynamic label
  const nonEarnInHolders = state.tiptonicCapTable.filter(h => h.name.toLowerCase() !== 'ben' && h.name.toLowerCase() !== 'jay');
  let residualLabel = 'Christina & Jack + Other';
  if (nonEarnInHolders.length > 0) {
    residualLabel = nonEarnInHolders.map(h => h.name).join(' & ');
  }
  
  const residualRow = document.createElement('tr');
  residualRow.innerHTML = `
    <td>
      <div style="display: flex; flex-direction: column;">
        <span class="cell-name">${residualLabel}</span>
        <span class="table-subtitle" style="margin-top: 2px;">Remaining Legacy Tiptonic Equity (Residual)</span>
      </div>
    </td>
    <td class="cell-percentage">${formatPercentage(residualTiptonicPct)}</td>
  `;
  elements.proformaTableBody.appendChild(residualRow);
  
  // 6. Cash Investment line (goes to Jack & Christina)
  const cashPct = newmoneySlice * 100;
  totalProformaPct += cashPct;
  
  const cashRow = document.createElement('tr');
  cashRow.innerHTML = `
    <td>
      <div style="display: flex; flex-direction: column;">
        <span class="cell-name">Jack & Christina (Cash Investment)</span>
        <span class="table-subtitle" style="margin-top: 2px;">New Money Cash Investment Share</span>
      </div>
    </td>
    <td class="cell-percentage">${formatPercentage(cashPct)}</td>
  `;
  elements.proformaTableBody.appendChild(cashRow);
  
  // Render total
  elements.proformaTableTotal.innerText = formatPercentage(totalProformaPct);
  
  // Pro forma must always sum to 100% (within tolerance)
  const isValid = Math.abs(totalProformaPct - 100.0) < 0.0001;
  if (isValid) {
    elements.proformaTableTotal.className = 'footer-total-value total-valid';
  } else {
    elements.proformaTableTotal.className = 'footer-total-value total-invalid';
  }
}

// Render Saved Versions List
async function renderVersions() {
  elements.versionsListContainer.innerHTML = '<div style="color: var(--muted); text-align: center; padding: 24px;">Loading saved versions...</div>';
  
  try {
    const list = isVersionsLoaded ? modelVersionsCache : await loadVersions();
    
    elements.versionsListContainer.innerHTML = '';
    
    if (list.length === 0) {
      elements.versionsListContainer.innerHTML = `
        <div class="empty-state">
          No saved versions found in database. Close this panel and click "Save Version" to snapshot your model.
        </div>
      `;
      return;
    }
    
    list.forEach(v => {
      const card = document.createElement('div');
      card.className = 'version-card';
      
      const dt = new Date(v.ts);
      const formattedDate = dt.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });
      
      card.innerHTML = `
        <div class="version-info">
          <div class="version-label">${v.label}</div>
          <div class="version-meta">${formattedDate} &bull; ID: ${v.id}</div>
        </div>
        <div class="version-actions">
          <button class="btn btn-secondary" onclick="restoreVersion('${v.id}')">Restore</button>
          <button class="btn btn-secondary" style="color: var(--red); border-color: rgba(224,92,92,0.3);" onclick="deleteVersion('${v.id}')">Delete</button>
        </div>
      `;
      
      elements.versionsListContainer.appendChild(card);
    });
  } catch (err) {
    elements.versionsListContainer.innerHTML = `
      <div class="empty-state" style="color: var(--red); border-color: rgba(224,92,92,0.3);">
        Error loading versions: ${err.message}
      </div>
    `;
  }
}

// Run Initialisation on Page Load
document.addEventListener('DOMContentLoaded', init);

// Toggle Light / Dark Mode
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  let next = 'light';
  
  if (current === 'dark') {
    html.removeAttribute('data-theme');
    next = 'light';
    showToast("Switched to Light Mode");
  } else {
    html.setAttribute('data-theme', 'dark');
    next = 'dark';
    showToast("Switched to Dark Mode");
  }
  
  try {
    localStorage.setItem('token_tiptonic_theme', next);
  } catch(e) {}
}
