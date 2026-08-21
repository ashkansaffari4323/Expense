const $ = (id) => document.getElementById(id);
const selected = new Set();
let projects = [];
let rows = [];
let lastImportResults = [];

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function setButtonState(button, state, label) {
  button.classList.remove('button-working', 'button-success', 'button-cleared');
  button.disabled = state === 'working';
  button.textContent = label;
  if (state === 'working') button.classList.add('button-working');
  if (state === 'success') button.classList.add('button-success');
  if (state === 'cleared') button.classList.add('button-cleared');
}

function setActionStatus(message = '', isError = false) {
  const status = $('previewActionStatus');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function renderProjects() {
  const query = $('search').value.toLowerCase();
  $('projects').innerHTML = projects
    .filter((project) => project.name.toLowerCase().includes(query))
    .map((project) => `<label class="project ${selected.has(project.id) ? 'selected' : ''}" title="${esc(project.name)}"><input type="checkbox" value="${esc(project.id)}" ${selected.has(project.id) ? 'checked' : ''}><span>${esc(project.name)}</span></label>`)
    .join('');
  document.querySelectorAll('.project input').forEach((checkbox) => {
    checkbox.onchange = () => {
      checkbox.checked ? selected.add(checkbox.value) : selected.delete(checkbox.value);
      renderProjects();
    };
  });
  $('count').textContent = `${selected.size} selected`;
}

function renderStats(summary = {}) {
  $('summary').innerHTML = [
    ['totalRows', 'Rows'], ['validRows', 'Valid'], ['ignoredRows', 'Ignored'],
    ['invalidRows', 'Invalid'], ['existingInCostRows', 'Existing'], ['rowsToCreate', 'To create']
  ].map(([key, label]) => `<div><b>${summary[key] || 0}</b>${label}</div>`).join('');
}

function errorReason(row) {
  if (row.existsInCost) return 'Expense Name already exists';
  if (!row.selectionValid) return row.selectionMessage || 'Invalid row';
  return '';
}

function renderPreviewErrors(allRows, ignoredRows = []) {
  const errorRows = allRows.filter((row) => Boolean(row.existsInCost) || row.selectionValid === false);
  const ignored = ignoredRows.map((item, index) => ({
    displayRowNumber: item.excelRowNumber || item.rowNumber || `Ignored ${index + 1}`,
    projectName: item.projectName || '', expenseName: item.expenseName || '',
    supplierDisplay: '', budgetName: item.budget || '', purchaseOrderName: item.purchaseOrder || '',
    itemName: item.itemName || '', amount: '', selectionValid: false,
    selectionMessage: item.reason || 'Ignored row'
  }));
  const visibleRows = [...errorRows, ...ignored];
  $('previewErrorCount').textContent = `${visibleRows.length} error${visibleRows.length === 1 ? '' : 's'}`;
  $('previewErrorCount').classList.toggle('has-errors', visibleRows.length > 0);
  if (!visibleRows.length) {
    $('rows').innerHTML = '<tr><td colspan="9" class="empty-preview">No invalid rows found. All valid rows are ready to create.</td></tr>';
    return;
  }
  $('rows').innerHTML = visibleRows.map((row) => `<tr class="${row.existsInCost ? 'existing' : 'invalid'}"><td>${esc(row.displayRowNumber)}</td><td>${esc(row.projectName)}</td><td>${esc(row.expenseName)}</td><td>${esc(row.supplierDisplay || row.supplierName || '')}${row.supplierSource === 'Purchase Order' ? ' (PO)' : ''}</td><td>${esc(row.budgetName || '')}</td><td>${esc(row.purchaseOrderName || '')}</td><td>${esc(row.itemName || '')}</td><td>${esc(row.amount)}</td><td class="reason-cell">${esc(errorReason(row))}</td></tr>`).join('');
}

function clearPreview() {
  rows = [];
  renderStats();
  $('rows').innerHTML = '<tr><td colspan="9" class="empty-preview">Preview cleared. Upload or select Preview to review another file.</td></tr>';
  $('previewErrorCount').textContent = '0 errors';
  $('previewErrorCount').classList.remove('has-errors');
}

async function init() {
  if (!(await api('/api/auth/status')).signedIn) return;
  $('landing').hidden = true;
  $('workspace').hidden = false;
  const hubs = await api('/api/hubs');
  $('hub').innerHTML = '<option value="">Select hub</option>' + hubs.map((hub) => `<option value="${esc(hub.id)}">${esc(hub.name)}</option>`).join('');
  renderStats();
}

$('signOut').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.reload(); };
$('hub').onchange = async () => { projects = await api(`/api/hubs/${encodeURIComponent($('hub').value)}/projects`); selected.clear(); renderProjects(); };
$('search').oninput = renderProjects;
$('load').onclick = () => {
  if (!selected.size) return setActionStatus('Select at least one project.', true);
  $('template').href = `/api/hubs/${encodeURIComponent($('hub').value)}/template?projectIds=${encodeURIComponent([...selected].join(','))}`;
  $('template').classList.remove('disabled');
  setActionStatus('Selected projects loaded.');
};
$('uploadFile').onclick = () => $('excelFile').click();
$('excelFile').onchange = () => {
  $('fileName').textContent = $('excelFile').files[0]?.name || 'No file selected';
  clearPreview();
  setActionStatus($('excelFile').files[0] ? 'Excel file selected. Click Preview.' : '');
};

$('preview').onclick = async () => {
  const button = $('preview');
  if (!$('excelFile').files.length) return setActionStatus('Choose an Excel file first.', true);
  if (!selected.size) return setActionStatus('Select and load at least one project first.', true);
  setButtonState(button, 'working', 'Reading Excel...');
  setActionStatus('Validating rows and checking existing Expense Names...');
  try {
    const form = new FormData();
    form.append('file', $('excelFile').files[0]);
    form.append('projectIds', [...selected].join(','));
    const result = await api(`/api/hubs/${encodeURIComponent($('hub').value)}/preview`, { method: 'POST', body: form });
    rows = result.rows || [];
    renderStats(result.summary);
    renderPreviewErrors(rows, result.ignoredRows || []);
    setButtonState(button, 'success', 'Preview complete');
    setActionStatus(`Preview complete. Only invalid rows are displayed. ${(result.summary?.invalidRows || 0) + (result.summary?.existingInCostRows || 0) + (result.summary?.ignoredRows || 0)} row(s) require attention.`);
  } catch (error) {
    setButtonState(button, 'success', 'Preview failed');
    setActionStatus(error.message, true);
  } finally {
    setTimeout(() => setButtonState(button, 'idle', 'Preview'), 1400);
  }
};

$('clearPreview').onclick = () => {
  const button = $('clearPreview');
  setButtonState(button, 'working', 'Clearing...');
  setActionStatus('Clearing preview...');
  setTimeout(() => {
    clearPreview();
    setButtonState(button, 'cleared', 'Preview cleared');
    setActionStatus('Preview cleared.');
    setTimeout(() => setButtonState(button, 'idle', 'Clear preview'), 1200);
  }, 250);
};

$('clearApi').onclick = () => { $('log').value = 'No API result yet.'; };
$('create').onclick = async () => {
  if ($('create').disabled) return;
  const valid = rows.filter((row) => row.selectionValid && !row.existsInCost);
  if (!valid.length) return setActionStatus('There are no valid rows to create.', true);
  if (valid.length > 1200) return setActionStatus('Maximum 1,200 valid rows.', true);
  const map = new Map();
  for (const row of valid) {
    const key = `${row.projectId}|${row.expenseName.toLowerCase()}`;
    if (!map.has(key)) map.set(key, { projectId: row.projectId, project: row.projectName, expenseName: row.expenseName, rows: [] });
    map.get(key).rows.push(row);
  }
  const groups = [...map.values()];
  $('create').disabled = true;
  $('create').textContent = 'Creating...';
  $('progressPanel').hidden = false;
  lastImportResults = [];
  let completed = 0, imported = 0, failed = 0, skipped = 0;
  const total = valid.length, started = Date.now();
  const update = (text, chunk, chunks) => {
    const pct = Math.round(completed / total * 100), elapsed = Math.max(1, (Date.now() - started) / 1000), rate = completed / elapsed, remain = rate ? Math.ceil((total - completed) / rate / 60) : null;
    $('progressText').textContent = text;
    $('progressPercent').textContent = `${pct}%`;
    $('progressBar').style.width = `${pct}%`;
    $('progressDetail').textContent = `${completed}/${total} rows | Chunk ${chunk}/${chunks} | Imported ${imported} | Failed ${failed} | Skipped ${skipped}${remain === null ? '' : ` | About ${Math.max(1, remain)} min remaining`}`;
  };
  const totalChunks = groups.reduce((n, g) => n + Math.ceil(g.rows.length / 10), 0);
  let chunkNumber = 0;
  update('Starting import...', 0, totalChunks);
  for (const group of groups) {
    let startResult;
    try {
      startResult = await api(`/api/projects/${group.projectId}/import/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: group.rows }) });
    } catch (error) {
      failed += group.rows.length; completed += group.rows.length;
      lastImportResults.push({ ok: false, project: group.project, expenseName: group.expenseName, rows: group.rows.map(r => r.displayRowNumber).join(','), error: error.message });
      update(`Failed ${group.expenseName}`, chunkNumber, totalChunks); continue;
    }
    if (startResult.skipped) {
      skipped += group.rows.length; completed += group.rows.length;
      lastImportResults.push({ ok: true, project: group.project, expenseName: group.expenseName, rows: group.rows.map(r => r.displayRowNumber).join(','), result: startResult });
      update(`Skipped ${group.expenseName}`, chunkNumber, totalChunks); continue;
    }
    const expenseId = startResult.expenseId, chunks = [];
    for (let i = 0; i < group.rows.length; i += 10) chunks.push(group.rows.slice(i, i + 10));
    let groupFailed = false;
    for (let i = 0; i < chunks.length; i++) {
      chunkNumber++;
      update(`Creating ${group.expenseName}`, chunkNumber, totalChunks);
      try {
        const result = await api(`/api/projects/${group.projectId}/import/${expenseId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: chunks[i] }) });
        imported += result.itemsCreated || chunks[i].length;
        completed += chunks[i].length;
        lastImportResults.push({ ok: true, project: group.project, expenseName: group.expenseName, rows: chunks[i].map(r => r.displayRowNumber).join(','), result: { ...result, expense: startResult.expense } });
      } catch (error) {
        failed += chunks[i].length; completed += chunks[i].length; groupFailed = true;
        lastImportResults.push({ ok: false, project: group.project, expenseName: group.expenseName, rows: chunks[i].map(r => r.displayRowNumber).join(','), error: error.message, expenseId });
      }
      update(groupFailed ? `Chunk completed with errors` : `Chunk complete`, chunkNumber, totalChunks);
    }
    if (!groupFailed) {
      try { await api(`/api/projects/${group.projectId}/import/${expenseId}/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: group.rows[0].status || 'draft' }) }); }
      catch (error) { lastImportResults.push({ ok: false, project: group.project, expenseName: group.expenseName, rows: '', error: `Finalize failed: ${error.message}`, expenseId }); }
    }
  }
  update('Import complete', totalChunks, totalChunks);
  $('log').value = JSON.stringify({ maximumRows: 1200, itemChunkSize: 10, costSpacingMs: 650, imported, failed, skipped, results: lastImportResults }, null, 2);
  $('create').disabled = false;
  $('create').textContent = 'Create expenses';
};
$('exportReport').onclick=async()=>{if(!lastImportResults.length)return setActionStatus('Run Create before exporting.',true);const r=await fetch('/api/export-import-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results:lastImportResults})});if(!r.ok)return setActionStatus('Report export failed.',true);const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Workday Forma Import Report.xlsx';a.click();URL.revokeObjectURL(url)};

init().catch((error) => setActionStatus(error.message, true));
