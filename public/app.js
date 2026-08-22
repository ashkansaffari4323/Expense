const $ = (id) => document.getElementById(id);
const selected = new Set();
let projects = [];
let rows = [];
let lastImportResults = [];
let importTimerId = null;
let importCancelled = false;
let activeImportController = null;
const formatElapsed = (milliseconds) => { const totalSeconds = Math.floor(milliseconds / 1000); const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':'); };

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

function ensureProjectSelectionControls(){if($('projectSelectionActions'))return;const count=$('count');if(!count)return;const wrap=document.createElement('span');wrap.id='projectSelectionActions';wrap.style.cssText='display:inline-flex;gap:6px;margin-left:8px';wrap.innerHTML='<button type="button" id="selectAllProjects" style="padding:5px 8px;font-size:11px;width:auto">Select all</button><button type="button" id="clearAllProjects" style="padding:5px 8px;font-size:11px;width:auto">Clear all</button>';count.insertAdjacentElement('afterend',wrap);$('selectAllProjects').onclick=()=>{const query=$('search').value.toLowerCase(),visible=projects.filter(p=>p.name.toLowerCase().includes(query));if(visible.length>10)setActionStatus('Maximum 10 projects. The first 10 visible projects were selected.',true);selected.clear();visible.slice(0,10).forEach(p=>selected.add(p.id));renderProjects()};$('clearAllProjects').onclick=()=>{selected.clear();renderProjects()}}
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
  $('count').textContent = `${selected.size} selected`; ensureProjectSelectionControls();
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
  if (!selected.size) return setActionStatus('Select at least one project.', true); if(selected.size>10)return setActionStatus('Select a maximum of 10 projects.',true);
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
$('cancelCreate').onclick=()=>{if(!$('create').disabled)return;importCancelled=true;if(activeImportController)activeImportController.abort();$('cancelCreate').disabled=true;$('cancelCreate').textContent='Cancelling...';$('progressText').textContent='Cancelling import...';setActionStatus('Cancellation requested. The active request will stop where possible; already-created parents and items are kept.',true)};
$('create').onclick=async()=>{if($('create').disabled)return;importCancelled=false;activeImportController=null;$('cancelCreate').disabled=false;$('cancelCreate').textContent='Cancel';const valid=rows.filter(x=>x.selectionValid&&!x.existsInCost);if(!valid.length)return setActionStatus('No valid rows.',true);if(valid.length>1200)return setActionStatus('Maximum 1,200 valid rows.',true);const logical=new Map();for(const row of valid){const key=`${row.projectId}|${row.expenseName.toLowerCase()}`;if(!logical.has(key))logical.set(key,{projectId:row.projectId,project:row.projectName,originalExpenseName:row.expenseName,rows:[]});logical.get(key).rows.push(row)}const parents=[];for(const group of logical.values()){const totalParts=Math.ceil(group.rows.length/300);for(let i=0;i<group.rows.length;i+=300){const partNumber=Math.floor(i/300)+1;parents.push({...group,partNumber,totalParts,parentName:totalParts>1?`${group.originalExpenseName} - Part ${partNumber} of ${totalParts}`:group.originalExpenseName,rows:group.rows.slice(i,i+300)})}}const projectOrder=new Map();parents.forEach(p=>{if(!projectOrder.has(p.projectId))projectOrder.set(p.projectId,projectOrder.size)});parents.sort((a,b)=>projectOrder.get(a.projectId)-projectOrder.get(b.projectId)||a.partNumber-b.partNumber);$('create').disabled=true;$('create').textContent='Creating...';$('progressPanel').hidden=false;lastImportResults=[];let done=0,imported=0,permanentFailed=0,parentDone=0,retryRound=0;const total=valid.length,started=Date.now(),pendingQueue=[],parentStates=[];$('elapsedTime').textContent='00:00:00';if(importTimerId)clearInterval(importTimerId);importTimerId=setInterval(()=>{$('elapsedTime').textContent=formatElapsed(Date.now()-started)},1000);const update=text=>{const pct=Math.round(done/total*100);$('progressText').textContent=text;$('progressPercent').textContent=`${pct}%`;$('progressBar').style.width=`${pct}%`;$('progressDetail').textContent=`${done}/${total} confirmed | Parent ${Math.min(parentDone+1,parents.length)}/${parents.length} | Workers 10 | Retry round ${retryRound} | Imported ${imported} | Pending ${pendingQueue.length} | Permanent ${permanentFailed}`};const waitTen=async()=>{for(let seconds=10;seconds>0&&!importCancelled;seconds--){update(`Forward pass finished. Retrying pending items in ${seconds} seconds`);await new Promise(resolve=>setTimeout(resolve,1000))}};const submit=async(state,items)=>{activeImportController=new AbortController();const result=await api(`/api/projects/${state.parent.projectId}/import/${state.expenseId}/items`,{method:'POST',signal:activeImportController.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:items})});const source=new Map(items.map(row=>[Number(row.displayRowNumber),row]));for(const item of result.results||[]){const row=source.get(Number(item.excelRow));if(item.ok){if(!state.completed.has(Number(item.excelRow))){state.completed.add(Number(item.excelRow));imported++;done++}lastImportResults.push({ok:true,project:state.parent.project,expenseName:state.parent.parentName,originalExpenseName:state.parent.originalExpenseName,partNumber:state.parent.partNumber,totalParts:state.parent.totalParts,rows:String(item.excelRow),expenseId:state.expenseId,result:{itemsCreated:1,items:[item]}})}else if(item.temporary&&row){pendingQueue.push({state,row})}else if(row&&!state.permanent.has(Number(item.excelRow))){state.permanent.add(Number(item.excelRow));permanentFailed++;done++;lastImportResults.push({ok:false,permanent:true,project:state.parent.project,expenseName:state.parent.parentName,rows:String(item.excelRow),expenseId:state.expenseId,error:item.error})}}const returned=new Set((result.results||[]).map(x=>Number(x.excelRow)));for(const row of items)if(!returned.has(Number(row.displayRowNumber)))pendingQueue.push({state,row})};update('Starting full-speed forward pass...');for(const parent of parents){if(importCancelled)break;let begin;try{activeImportController=new AbortController();begin=await api(`/api/projects/${parent.projectId}/import/start`,{method:'POST',signal:activeImportController.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:parent.rows,parentName:parent.parentName})})}catch(error){permanentFailed+=parent.rows.length;done+=parent.rows.length;parentDone++;lastImportResults.push({ok:false,project:parent.project,expenseName:parent.parentName,error:error.message});continue}if(begin.skipped){done+=parent.rows.length;parentDone++;continue}const state={parent,expenseId:begin.expenseId,completed:new Set(),permanent:new Set(),finalized:false};parentStates.push(state);update(`Processing all ${parent.rows.length} rows in ${parent.parentName}`);try{await submit(state,parent.rows)}catch(error){if(importCancelled||error.name==='AbortError')break;for(const row of parent.rows)pendingQueue.push({state,row});lastImportResults.push({ok:false,temporary:true,project:parent.project,expenseName:parent.parentName,rows:parent.rows.map(x=>x.displayRowNumber).join(','),expenseId:state.expenseId,error:`Forward request failed; queued for later: ${error.message}`})}parentDone++;update(`Forward pass complete for ${parent.parentName}; moving immediately to next parent`)}while(pendingQueue.length&&!importCancelled){retryRound++;await waitTen();if(importCancelled)break;const round=pendingQueue.splice(0),grouped=new Map();for(const entry of round){const key=entry.state.expenseId;if(!grouped.has(key))grouped.set(key,{state:entry.state,rows:new Map()});grouped.get(key).rows.set(Number(entry.row.displayRowNumber),entry.row)}for(const {state,rows:rowMap} of grouped.values()){if(importCancelled)break;const retryRows=[...rowMap.values()].filter(row=>!state.completed.has(Number(row.displayRowNumber))&&!state.permanent.has(Number(row.displayRowNumber)));if(!retryRows.length)continue;update(`Retrying ${retryRows.length} pending item(s) in ${state.parent.parentName}`);try{await submit(state,retryRows)}catch(error){if(importCancelled||error.name==='AbortError')break;for(const row of retryRows)pendingQueue.push({state,row});lastImportResults.push({ok:false,temporary:true,project:state.parent.project,expenseName:state.parent.parentName,rows:retryRows.map(x=>x.displayRowNumber).join(','),expenseId:state.expenseId,error:`Retry request failed; kept pending: ${error.message}`})}}}for(const state of parentStates){if(importCancelled)break;if(state.completed.size===state.parent.rows.length&&state.permanent.size===0&&!state.finalized){const requested=String(state.parent.rows[0].status||'draft').toLowerCase();try{activeImportController=new AbortController();const finalResult=await api(`/api/projects/${state.parent.projectId}/import/${state.expenseId}/finalize`,{method:'POST',signal:activeImportController.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({status:requested})});state.finalized=true;lastImportResults.push({ok:true,project:state.parent.project,expenseName:state.parent.parentName,expenseId:state.expenseId,result:finalResult})}catch(error){lastImportResults.push({ok:false,project:state.parent.project,expenseName:state.parent.parentName,expenseId:state.expenseId,error:`Items complete, status action required: ${error.message}`})}}}const elapsedMilliseconds=Date.now()-started;if(importTimerId){clearInterval(importTimerId);importTimerId=null}$('elapsedTime').textContent=formatElapsed(elapsedMilliseconds);activeImportController=null;if(importCancelled){$('progressText').textContent='Import cancelled';setActionStatus('Import cancelled. Confirmed successful items were kept.',true)}else{$('progressText').textContent=permanentFailed?'Import complete with permanent errors':'Import complete';$('progressPercent').textContent='100%';$('progressBar').style.width='100%'}$('log').value=JSON.stringify({version:'v99',maximumItemsPerParent:300,workers:10,normalGapMs:0,forwardFirst:true,pendingRetryWaitSeconds:10,retryRounds:'until complete or cancelled',duplicateProtection:'externalId verification',elapsedTime:formatElapsed(elapsedMilliseconds),imported,permanentFailed,results:lastImportResults},null,2);$('create').disabled=false;$('create').textContent='Create expenses';$('cancelCreate').disabled=true;$('cancelCreate').textContent='Cancel'};$('exportReport').onclick=async()=>{const r=await fetch('/api/export-import-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results:lastImportResults})});if(!r.ok)return;const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='Workday Forma Import Report.xlsx';a.click();URL.revokeObjectURL(u)};

init().catch((error) => setActionStatus(error.message, true));
