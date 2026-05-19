import './styles.css';
import { ReconDuckDb } from './duckdbClient';
import type { CompareRow, MappingState, SourceKind, TableProfile } from './types';

const db = new ReconDuckDb();

const state: {
  glFile?: File;
  subledgerFile?: File;
  glProfile?: TableProfile;
  subledgerProfile?: TableProfile;
  lastCompare?: CompareRow[];
} = {};

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">100% browser-based · No uploads · No stored data</p>
      <h1>ReconLite</h1>
      <p class="hero-copy">
        Upload a GL detail file and a subledger file, preview both datasets, then use DuckDB-WASM to summarize balances locally in your browser.
      </p>
      <div class="hero-actions">
        <a class="secondary-link" href="https://github.com/szubair22/CSVtoIntacctMapper" target="_blank" rel="noreferrer">Inspired by CSVtoIntacctMapper</a>
      </div>
    </section>

    <section class="card" id="privacyCard">
      <h2>Privacy model</h2>
      <p>Your files are read with the browser File API and loaded into DuckDB-WASM in memory. This draft does not use a backend, database server, analytics, localStorage, IndexedDB, or OPFS.</p>
    </section>

    <section class="card">
      <div class="section-header">
        <div>
          <h2>1. Upload CSV files</h2>
          <p>Start with CSV exports. Excel support can come later with SheetJS if needed.</p>
        </div>
        <button id="resetBtn" class="ghost" type="button">Reset</button>
      </div>

      <div class="upload-grid">
        <label class="drop-zone" id="glDropZone">
          <span class="label-title">GL detail CSV</span>
          <span class="label-copy" id="glFileName">Click or drag & drop your GL file</span>
          <input id="glFile" type="file" accept=".csv,text/csv" />
        </label>

        <label class="drop-zone" id="subledgerDropZone">
          <span class="label-title">Subledger CSV</span>
          <span class="label-copy" id="subledgerFileName">Click or drag & drop your subledger file</span>
          <input id="subledgerFile" type="file" accept=".csv,text/csv" />
        </label>
      </div>

      <div class="button-row">
        <button id="loadBtn" type="button" disabled>Load files into DuckDB</button>
        <button id="sampleBtn" type="button" class="ghost">Try with sample data</button>
        <span id="status" class="status">Choose both files to begin.</span>
      </div>
    </section>

    <section class="card hidden" id="previewSection">
      <h2>2. Preview loaded files</h2>
      <p>Showing the first five rows from each table after DuckDB parses the files.</p>

      <div class="tabs">
        <button class="tab active" data-tab="gl" type="button">GL preview</button>
        <button class="tab" data-tab="subledger" type="button">Subledger preview</button>
      </div>

      <div id="glPreview" class="table-wrap"></div>
      <div id="subledgerPreview" class="table-wrap hidden"></div>
    </section>

    <section class="card hidden" id="mappingSection">
      <h2>3. Select balance fields</h2>
      <p>Phase 1 only needs account and amount fields. This mirrors the mapper pattern: detect headers first, then let the user confirm mappings.</p>

      <div class="mapping-grid">
        <div>
          <h3>GL fields</h3>
          <label>Account column <select id="glAccountColumn"></select></label>
          <label>Amount column <select id="glAmountColumn"></select></label>
        </div>
        <div>
          <h3>Subledger fields</h3>
          <label>Account column <select id="subledgerAccountColumn"></select></label>
          <label>Amount column <select id="subledgerAmountColumn"></select></label>
        </div>
      </div>

      <label class="tolerance-row">
        <span>Match tolerance (USD)</span>
        <input id="toleranceInput" type="number" step="0.01" min="0" value="0.01" />
      </label>

      <div class="button-row">
        <button id="runSummaryBtn" type="button">Run balance summary</button>
        <span class="status" id="mappingStatus">Waiting for field selections.</span>
      </div>
    </section>

    <section class="card hidden" id="resultsSection">
      <h2>4. Balance summary</h2>
      <p>This is the Phase 1 proof point: both uploaded files are queried locally with SQL and summarized by account.</p>

      <h3>Source balances</h3>
      <div id="balanceResults" class="table-wrap"></div>

      <h3>GL vs subledger comparison</h3>
      <div id="unparsedWarning" class="warning-banner hidden"></div>
      <div id="reconVerdict" class="verdict"></div>
      <div id="compareResults" class="table-wrap"></div>
      <div class="button-row">
        <button id="downloadCompareBtn" type="button" class="ghost">Download comparison as CSV</button>
      </div>
    </section>
  </main>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`;

const els = {
  glFile: document.querySelector<HTMLInputElement>('#glFile')!,
  subledgerFile: document.querySelector<HTMLInputElement>('#subledgerFile')!,
  glDropZone: document.querySelector<HTMLLabelElement>('#glDropZone')!,
  subledgerDropZone: document.querySelector<HTMLLabelElement>('#subledgerDropZone')!,
  glFileName: document.querySelector<HTMLSpanElement>('#glFileName')!,
  subledgerFileName: document.querySelector<HTMLSpanElement>('#subledgerFileName')!,
  loadBtn: document.querySelector<HTMLButtonElement>('#loadBtn')!,
  sampleBtn: document.querySelector<HTMLButtonElement>('#sampleBtn')!,
  resetBtn: document.querySelector<HTMLButtonElement>('#resetBtn')!,
  status: document.querySelector<HTMLSpanElement>('#status')!,
  previewSection: document.querySelector<HTMLElement>('#previewSection')!,
  mappingSection: document.querySelector<HTMLElement>('#mappingSection')!,
  resultsSection: document.querySelector<HTMLElement>('#resultsSection')!,
  glPreview: document.querySelector<HTMLDivElement>('#glPreview')!,
  subledgerPreview: document.querySelector<HTMLDivElement>('#subledgerPreview')!,
  glAccountColumn: document.querySelector<HTMLSelectElement>('#glAccountColumn')!,
  glAmountColumn: document.querySelector<HTMLSelectElement>('#glAmountColumn')!,
  subledgerAccountColumn: document.querySelector<HTMLSelectElement>('#subledgerAccountColumn')!,
  subledgerAmountColumn: document.querySelector<HTMLSelectElement>('#subledgerAmountColumn')!,
  toleranceInput: document.querySelector<HTMLInputElement>('#toleranceInput')!,
  runSummaryBtn: document.querySelector<HTMLButtonElement>('#runSummaryBtn')!,
  mappingStatus: document.querySelector<HTMLSpanElement>('#mappingStatus')!,
  balanceResults: document.querySelector<HTMLDivElement>('#balanceResults')!,
  compareResults: document.querySelector<HTMLDivElement>('#compareResults')!,
  reconVerdict: document.querySelector<HTMLDivElement>('#reconVerdict')!,
  unparsedWarning: document.querySelector<HTMLDivElement>('#unparsedWarning')!,
  downloadCompareBtn: document.querySelector<HTMLButtonElement>('#downloadCompareBtn')!,
  toast: document.querySelector<HTMLDivElement>('#toast')!
};

setupDropZone(els.glDropZone, els.glFile, 'gl');
setupDropZone(els.subledgerDropZone, els.subledgerFile, 'subledger');
setupTabs();

els.loadBtn.addEventListener('click', loadFiles);
els.sampleBtn.addEventListener('click', loadSampleData);
els.runSummaryBtn.addEventListener('click', runBalanceSummary);
els.resetBtn.addEventListener('click', resetApp);
els.downloadCompareBtn.addEventListener('click', downloadCompareCsv);

function setupDropZone(zone: HTMLLabelElement, input: HTMLInputElement, source: SourceKind): void {
  ['dragenter', 'dragover'].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.remove('drag-over');
    });
  });

  zone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    setSelectedFile(source, file);
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    setSelectedFile(source, file);
  });
}

function setupTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('.tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      els.glPreview.classList.toggle('hidden', which !== 'gl');
      els.subledgerPreview.classList.toggle('hidden', which !== 'subledger');
    });
  });
}

function setSelectedFile(source: SourceKind, file: File): void {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showToast('Please choose a CSV file for this first draft.');
    return;
  }

  if (source === 'gl') {
    state.glFile = file;
    els.glDropZone.classList.add('has-file');
    els.glFileName.textContent = file.name;
  } else {
    state.subledgerFile = file;
    els.subledgerDropZone.classList.add('has-file');
    els.subledgerFileName.textContent = file.name;
  }

  const ready = Boolean(state.glFile && state.subledgerFile);
  els.loadBtn.disabled = !ready;
  els.status.textContent = ready ? 'Ready to load files locally.' : 'Choose both files to begin.';
}

async function loadFiles(): Promise<void> {
  if (!state.glFile || !state.subledgerFile) return;

  try {
    setBusy(els.loadBtn, true, 'Loading...');
    els.status.textContent = 'Initializing DuckDB-WASM and parsing files locally...';

    await db.reset();
    state.glProfile = await db.loadCsv('gl', state.glFile);
    state.subledgerProfile = await db.loadCsv('subledger', state.subledgerFile);

    els.glPreview.innerHTML = renderProfile(state.glProfile);
    els.subledgerPreview.innerHTML = renderProfile(state.subledgerProfile);

    buildFieldSelects(state.glProfile, state.subledgerProfile);
    reveal(els.previewSection);
    reveal(els.mappingSection);
    els.status.textContent = `Loaded ${state.glProfile.rowCount.toLocaleString()} GL rows and ${state.subledgerProfile.rowCount.toLocaleString()} subledger rows.`;
    showToast('Files loaded into DuckDB-WASM.');
  } catch (error) {
    console.error(error);
    els.status.textContent = 'File load failed. Check console for details.';
    showToast(error instanceof Error ? error.message : 'Unable to load files.');
  } finally {
    setBusy(els.loadBtn, false, 'Load files into DuckDB');
  }
}

async function runBalanceSummary(): Promise<void> {
  const mapping = getMappingState();

  if (!mapping.glAccountColumn || !mapping.glAmountColumn || !mapping.subledgerAccountColumn || !mapping.subledgerAmountColumn) {
    showToast('Select account and amount fields for both files.');
    return;
  }

  const toleranceRaw = Number.parseFloat(els.toleranceInput.value);
  const tolerance = Number.isFinite(toleranceRaw) && toleranceRaw >= 0 ? toleranceRaw : 0.01;

  try {
    setBusy(els.runSummaryBtn, true, 'Running...');
    els.mappingStatus.textContent = 'Running SQL balance summaries in the browser...';

    const balances = await db.buildBalanceSummary(mapping);
    const compare = await db.buildBalanceCompare(tolerance);

    state.lastCompare = compare;

    els.balanceResults.innerHTML = buildTable(balances);
    els.compareResults.innerHTML = buildTable(compare);
    markOutOfBalanceRows(els.compareResults);
    renderVerdict(compare, tolerance);
    renderUnparsedWarning(compare);
    reveal(els.resultsSection);
    els.mappingStatus.textContent = 'Balance summary complete.';
    showToast('Balance summary complete.');
  } catch (error) {
    console.error(error);
    els.mappingStatus.textContent = 'Summary failed. Check column selections and source data.';
    showToast(error instanceof Error ? error.message : 'Unable to run balance summary.');
  } finally {
    setBusy(els.runSummaryBtn, false, 'Run balance summary');
  }
}

function markOutOfBalanceRows(container: HTMLElement): void {
  const rows = container.querySelectorAll<HTMLTableRowElement>('tbody tr');
  rows.forEach((row) => {
    const cells = row.querySelectorAll<HTMLTableCellElement>('td');
    for (const cell of cells) {
      if (cell.textContent?.trim() === 'Out of balance') {
        row.dataset.status = 'out';
        return;
      }
    }
  });
}

function renderVerdict(rows: CompareRow[], tolerance: number): void {
  if (!rows.length) {
    els.reconVerdict.innerHTML = '';
    return;
  }
  const matched = rows.filter((r) => r.status === 'Matched').length;
  const total = rows.length;
  const variance = rows.reduce((acc, r) => acc + Math.abs(Number(r.difference) || 0), 0);
  const tolFmt = tolerance.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const varFmt = variance.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  els.reconVerdict.textContent =
    `${matched} of ${total} accounts matched within ${tolFmt}. Total absolute variance: ${varFmt}.`;
}

function renderUnparsedWarning(rows: CompareRow[]): void {
  const total = rows.reduce((acc, r) => acc + (Number(r.unparsed_rows) || 0), 0);
  if (total <= 0) {
    els.unparsedWarning.classList.add('hidden');
    els.unparsedWarning.textContent = '';
    return;
  }
  els.unparsedWarning.classList.remove('hidden');
  els.unparsedWarning.textContent =
    `WARNING: ${total} row${total === 1 ? '' : 's'} could not be parsed as amounts and ${total === 1 ? 'was' : 'were'} excluded. Check your amount column or source file.`;
}

async function loadSampleData(): Promise<void> {
  try {
    setBusy(els.sampleBtn, true, 'Loading sample...');
    const [glResp, subResp] = await Promise.all([
      fetch('./sample-data/gl_sample.csv'),
      fetch('./sample-data/subledger_sample.csv')
    ]);
    if (!glResp.ok || !subResp.ok) {
      throw new Error('Sample CSV files were not found. Did you run the build with sample-data in public/?');
    }
    const [glBlob, subBlob] = await Promise.all([glResp.blob(), subResp.blob()]);
    const glFile = new File([glBlob], 'gl_sample.csv', { type: 'text/csv' });
    const subFile = new File([subBlob], 'subledger_sample.csv', { type: 'text/csv' });
    setSelectedFile('gl', glFile);
    setSelectedFile('subledger', subFile);
    await loadFiles();
  } catch (error) {
    console.error(error);
    showToast(error instanceof Error ? error.message : 'Unable to load sample data.');
  } finally {
    setBusy(els.sampleBtn, false, 'Try with sample data');
  }
}

function downloadCompareCsv(): void {
  const rows = state.lastCompare;
  if (!rows || !rows.length) {
    showToast('Run a balance summary first.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines: string[] = [];
  lines.push(headers.map((h) => csvCell(h)).join(','));
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell((row as Record<string, unknown>)[h])).join(','));
  }
  const csv = lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `reconlite-comparison-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// RFC 4180 quoting with a formula-injection guard. Excel/Sheets evaluate any
// cell starting with =, +, -, @, tab, or CR as a formula; prefix a single
// quote so the spreadsheet treats it as text.
function csvCell(value: unknown): string {
  let s: string;
  if (value === null || value === undefined) {
    s = '';
  } else if (typeof value === 'number') {
    s = Number.isFinite(value) ? String(value) : '';
  } else {
    s = String(value);
  }
  const first = s.charAt(0);
  if (first === '=' || first === '+' || first === '-' || first === '@' || first === '\t' || first === '\r') {
    s = `'${s}`;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildFieldSelects(gl: TableProfile, subledger: TableProfile): void {
  fillSelect(els.glAccountColumn, gl.columns, guessColumn(gl.columns, ['account', 'gl account', 'account no', 'account number', 'acct']));
  fillSelect(els.glAmountColumn, gl.columns, guessColumn(gl.columns, ['amount', 'debit', 'credit', 'net amount', 'transaction amount']));
  fillSelect(els.subledgerAccountColumn, subledger.columns, guessColumn(subledger.columns, ['account', 'gl account', 'account no', 'account number', 'acct']));
  fillSelect(els.subledgerAmountColumn, subledger.columns, guessColumn(subledger.columns, ['amount', 'balance', 'open balance', 'invoice amount', 'transaction amount']));
}

function fillSelect(select: HTMLSelectElement, columns: string[], selected = ''): void {
  select.innerHTML = '<option value="">— choose column —</option>';
  for (const column of columns) {
    const option = document.createElement('option');
    option.value = column;
    option.textContent = column;
    option.selected = column === selected;
    select.appendChild(option);
  }
}

function guessColumn(columns: string[], candidates: string[]): string {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedCandidates = candidates.map(normalize);

  for (const column of columns) {
    if (normalizedCandidates.includes(normalize(column))) return column;
  }

  for (const column of columns) {
    const normalizedColumn = normalize(column);
    if (normalizedCandidates.some((candidate) => normalizedColumn.includes(candidate) || candidate.includes(normalizedColumn))) {
      return column;
    }
  }

  return '';
}

function getMappingState(): MappingState {
  return {
    glAccountColumn: els.glAccountColumn.value,
    glAmountColumn: els.glAmountColumn.value,
    subledgerAccountColumn: els.subledgerAccountColumn.value,
    subledgerAmountColumn: els.subledgerAmountColumn.value
  };
}

function renderProfile(profile: TableProfile): string {
  return `
    <div class="profile-summary">
      <strong>${profile.source === 'gl' ? 'GL detail' : 'Subledger'}</strong>
      <span>${profile.rowCount.toLocaleString()} rows</span>
      <span>${profile.columns.length.toLocaleString()} columns</span>
    </div>
    ${buildTable(profile.previewRows)}
  `;
}

function buildTable(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '<p class="empty">No rows returned.</p>';

  const headers = Object.keys(rows[0]);
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${formatCell(row[header])}</td>`).join('')}</tr>`)
    .join('');

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return escapeHtml(value.toLocaleString(undefined, { maximumFractionDigits: 2 }));
  return escapeHtml(String(value));
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function reveal(element: HTMLElement): void {
  element.classList.remove('hidden');
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setBusy(button: HTMLButtonElement, isBusy: boolean, label: string): void {
  button.disabled = isBusy;
  button.textContent = label;
}

function showToast(message: string): void {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.setTimeout(() => els.toast.classList.remove('show'), 2500);
}

async function resetApp(): Promise<void> {
  await db.reset();
  state.glFile = undefined;
  state.subledgerFile = undefined;
  state.glProfile = undefined;
  state.subledgerProfile = undefined;
  state.lastCompare = undefined;

  els.glFile.value = '';
  els.subledgerFile.value = '';
  els.glFileName.textContent = 'Click or drag & drop your GL file';
  els.subledgerFileName.textContent = 'Click or drag & drop your subledger file';
  els.glDropZone.classList.remove('has-file');
  els.subledgerDropZone.classList.remove('has-file');
  els.loadBtn.disabled = true;
  els.status.textContent = 'Choose both files to begin.';
  els.previewSection.classList.add('hidden');
  els.mappingSection.classList.add('hidden');
  els.resultsSection.classList.add('hidden');
  els.glPreview.innerHTML = '';
  els.subledgerPreview.innerHTML = '';
  els.balanceResults.innerHTML = '';
  els.compareResults.innerHTML = '';
  els.reconVerdict.textContent = '';
  els.unparsedWarning.classList.add('hidden');
  els.unparsedWarning.textContent = '';
  showToast('Session cleared.');
}
