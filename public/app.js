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
$('cancelCreate').onclick=()=>{if(!$('create').disabled)return;importCancelled=true;if(activeImportController)activeImportController.abort();$('cancelCreate').disabled=true;$('cancelCreate').textContent='Cancelling...';$('progressText').textContent='Cancelling import...';setActionStatus('Cancellation requested. The active request will stop where possible; already-created parents and items are kept.',true)};
$('create').onclick=async()=>{
  if($('create').disabled)return;
  importCancelled=false;activeImportController=null;$('cancelCreate').disabled=false;$('cancelCreate').textContent='Cancel';
  const valid=rows.filter(x=>x.selectionValid&&!x.existsInCost);
  if(!valid.length)return setActionStatus('No valid rows.',true);
  if(valid.length>1200)return setActionStatus('Maximum 1,200 valid rows.',true);
  const logical=new Map();
  for(const row of valid){const key=`${row.projectId}|${row.expenseName.toLowerCase()}`;if(!logical.has(key))logical.set(key,{projectId:row.projectId,project:row.projectName,originalExpenseName:row.expenseName,rows:[]});logical.get(key).rows.push(row)}
  const parents=[];
  for(const group of logical.values()){const totalParts=Math.ceil(group.rows.length/300);for(let i=0;i<group.rows.length;i+=300){const partNumber=Math.floor(i/300)+1;parents.push({...group,partNumber,totalParts,parentName:totalParts>1?`${group.originalExpenseName} - Part ${partNumber} of ${totalParts}`:group.originalExpenseName,rows:group.rows.slice(i,i+300)})}}
  $('create').disabled=true;$('create').textContent='Creating...';$('progressPanel').hidden=false;$('progressPanel').classList.remove('cancelled-status');lastImportResults=[];
  let done=0,imported=0,failed=0,unknown=0,parentDone=0,chunkNo=0,workers=5,retries=0;
  const total=valid.length,totalChunks=parents.reduce((n,p)=>n+Math.ceil(p.rows.length/5),0),started=Date.now();
  $('elapsedTime').textContent='00:00:00';if(importTimerId)clearInterval(importTimerId);importTimerId=setInterval(()=>{$('elapsedTime').textContent=formatElapsed(Date.now()-started)},1000);
  const update=text=>{const pct=Math.round(done/total*100);$('progressText').textContent=text;$('progressPercent').textContent=`${pct}%`;$('progressBar').style.width=`${pct}%`;$('progressDetail').textContent=`${done}/${total} rows | Parent ${Math.min(parentDone+1,parents.length)}/${parents.length} | Chunk ${chunkNo}/${totalChunks} | Workers ${workers} | API retries ${retries} | Imported ${imported} | Failed ${failed} | Unknown ${unknown}`};
  update('Starting reliable import...');
  for(const parent of parents){
    if(importCancelled)break;
    let begin;
    try{activeImportController=new AbortController();begin=await api(`/api/projects/${parent.projectId}/import/start`,{method:'POST',signal:activeImportController.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:parent.rows,parentName:parent.parentName})})}
    catch(error){if(importCancelled||error.name==='AbortError')break;failed+=parent.rows.length;done+=parent.rows.length;parentDone++;lastImportResults.push({ok:false,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,error:error.message});update(`Parent start failed: ${parent.parentName}`);continue}
    if(begin.skipped){done+=parent.rows.length;parentDone++;lastImportResults.push({ok:true,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,result:begin});update(`Skipped existing ${parent.parentName}`);continue}
    let parentFailed=false;
    for(let i=0;i<parent.rows.length;i+=5){
      if(importCancelled){parentFailed=true;break}
      const chunk=parent.rows.slice(i,i+5);chunkNo++;let pending=[...chunk],round=0;
      while(pending.length&&round<3&&!importCancelled){
        round++;update(`Creating ${parent.parentName} | retry round ${round}/3`);
        try{
          activeImportController=new AbortController();
          const result=await api(`/api/projects/${parent.projectId}/import/${begin.expenseId}/items`,{method:'POST',signal:activeImportController.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:pending})});
          workers=result.adaptiveState?.concurrency||workers;retries=result.adaptiveState?.retryCount||retries;
          const byRow=new Map(pending.map(row=>[Number(row.displayRowNumber),row])),next=[];
          for(const itemResult of result.results||[]){
            const source=byRow.get(Number(itemResult.excelRow));
            if(itemResult.ok){imported++;done++;lastImportResults.push({ok:true,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,rows:String(itemResult.excelRow),expenseId:begin.expenseId,result:{itemsCreated:1,items:[itemResult]}})}
            else if(source)next.push(source)
          }
          const returned=new Set((result.results||[]).map(x=>Number(x.excelRow)));
          for(const source of pending)if(!returned.has(Number(source.displayRowNumber)))next.push(source);
          pending=next;
        }catch(error){
          if(importCancelled||error.name==='AbortError'){parentFailed=true;break}
          // A lost browser response is ambiguous: Autodesk may have created some items. Do not blindly resubmit them.
          unknown+=pending.length;done+=pending.length;parentFailed=true;
          lastImportResults.push({ok:false,unknown:true,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,rows:pending.map(x=>x.displayRowNumber).join(','),expenseId:begin.expenseId,error:`Result unknown because the request connection failed: ${error.message}. Verify these rows in Autodesk before retrying.`});
          pending=[];
        }
      }
      if(pending.length){failed+=pending.length;done+=pending.length;parentFailed=true;for(const row of pending)lastImportResults.push({ok:false,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,rows:String(row.displayRowNumber),expenseId:begin.expenseId,error:'Item failed after 3 browser retry rounds.'})}
      update(parentFailed?'Chunk completed with issues':'Chunk complete');
    }
    const requested=String(parent.rows[0].status||'draft').toLowerCase();
    if(!parentFailed&&!importCancelled){try{activeImportController=new AbortController();const finalResult=await api(`/api/projects/${parent.projectId}/import/${begin.expenseId}/finalize`,{method:'POST',signal:activeImportController.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({status:requested})});lastImportResults.push({ok:true,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,expenseId:begin.expenseId,result:finalResult})}catch(error){lastImportResults.push({ok:false,project:parent.project,expenseName:parent.parentName,expenseId:begin.expenseId,error:`Items complete, status action required: ${error.message}`});setActionStatus(`Items created, but Autodesk blocked ${requested}. Check Forma workflow.`,true)}}
    parentDone++;update(`Completed ${parent.parentName}`);
  }
  const elapsedMilliseconds=Date.now()-started;if(importTimerId){clearInterval(importTimerId);importTimerId=null}$('elapsedTime').textContent=formatElapsed(elapsedMilliseconds);activeImportController=null;
  if(importCancelled){$('progressPanel').classList.add('cancelled-status');$('progressText').textContent='Import cancelled';setActionStatus(`Import cancelled after ${done} of ${total} rows. Already-created data was kept.`,true)}else{$('progressText').textContent=unknown||failed?'Import complete with issues':'Import complete';$('progressPercent').textContent='100%';$('progressBar').style.width='100%'}
  $('log').value=JSON.stringify({maximumItemsPerParent:300,itemChunkSize:5,initialWorkers:5,serverRetriesPerItem:3,serverRetryWaitSeconds:3,browserRetryRounds:3,networkFailuresAreUnknown:true,elapsedSeconds:Math.round(elapsedMilliseconds/1000),elapsedTime:formatElapsed(elapsedMilliseconds),imported,failed,unknown,retries,results:lastImportResults},null,2);
  $('create').disabled=false;$('create').textContent='Create expenses';$('cancelCreate').disabled=true;$('cancelCreate').textContent='Cancel';
};
$('exportReport').onclick=async()=>{const r=await fetch('/api/export-import-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results:lastImportResults})});if(!r.ok)return;const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='Workday Forma Import Report.xlsx';a.click();URL.revokeObjectURL(u)};

init().catch((error) => setActionStatus(error.message, true));
