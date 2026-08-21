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
$('create').onclick=async()=>{
  if($('create').disabled)return;
  const valid=rows.filter(x=>x.selectionValid&&!x.existsInCost);
  if(!valid.length)return setActionStatus('No valid rows.',true);
  if(valid.length>1200)return setActionStatus('Maximum 1,200 valid rows.',true);
  const logicalMap=new Map();
  for(const x of valid){const key=`${x.projectId}|${x.expenseName.toLowerCase()}`;if(!logicalMap.has(key))logicalMap.set(key,{projectId:x.projectId,project:x.projectName,originalExpenseName:x.expenseName,rows:[]});logicalMap.get(key).rows.push(x)}
  const parents=[];
  for(const logical of logicalMap.values()){
    const totalParts=Math.ceil(logical.rows.length/300);
    for(let i=0;i<logical.rows.length;i+=300){const partNumber=Math.floor(i/300)+1;parents.push({...logical,partNumber,totalParts,parentName:totalParts>1?`${logical.originalExpenseName} - Part ${partNumber} of ${totalParts}`:logical.originalExpenseName,rows:logical.rows.slice(i,i+300)})}
  }
  $('create').disabled=true;$('create').textContent='Creating...';$('progressPanel').hidden=false;lastImportResults=[];
  let done=0,imported=0,failed=0,skipped=0,parentDone=0;const total=valid.length,totalChunks=parents.reduce((n,p)=>n+Math.ceil(p.rows.length/10),0),started=Date.now();let chunkNo=0;
  const update=(text)=>{const pct=Math.round(done/total*100),rate=done/Math.max(1,(Date.now()-started)/1000),mins=rate?Math.max(1,Math.ceil((total-done)/rate/60)):null;$('progressText').textContent=text;$('progressPercent').textContent=`${pct}%`;$('progressBar').style.width=`${pct}%`;$('progressDetail').textContent=`${done}/${total} rows | Parent ${parentDone+1}/${parents.length} | Chunk ${chunkNo}/${totalChunks} | Imported ${imported} | Failed ${failed} | Skipped ${skipped}${mins?` | About ${mins} min remaining`:''}`};
  update('Starting split-parent import...');
  for(const parent of parents){let begin;update(`Creating ${parent.parentName}`);try{begin=await api(`/api/projects/${parent.projectId}/import/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:parent.rows,parentName:parent.parentName,partNumber:parent.partNumber,totalParts:parent.totalParts})})}catch(e){failed+=parent.rows.length;done+=parent.rows.length;parentDone++;lastImportResults.push({ok:false,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,rows:parent.rows.map(x=>x.displayRowNumber).join(','),error:e.message});update(`Failed ${parent.parentName}`);continue}
    if(begin.skipped){skipped+=parent.rows.length;done+=parent.rows.length;parentDone++;lastImportResults.push({ok:true,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,result:begin});update(`Skipped ${parent.parentName}`);continue}
    let parentFailed=false;
    for(let i=0;i<parent.rows.length;i+=10){const chunk=parent.rows.slice(i,i+10);chunkNo++;update(`Creating ${parent.parentName}`);try{const result=await api(`/api/projects/${parent.projectId}/import/${begin.expenseId}/items`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:chunk})});imported+=result.itemsCreated||chunk.length;lastImportResults.push({ok:true,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,rows:chunk.map(x=>x.displayRowNumber).join(','),expenseId:begin.expenseId,result})}catch(e){failed+=chunk.length;parentFailed=true;lastImportResults.push({ok:false,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,rows:chunk.map(x=>x.displayRowNumber).join(','),expenseId:begin.expenseId,error:e.message})}done+=chunk.length;update(parentFailed?'Chunk completed with errors':'Chunk complete')}
    const requested=String(parent.rows[0].status||'draft').toLowerCase();if(!parentFailed){update(`Finalising ${parent.parentName} as ${requested}`);try{const finalResult=await api(`/api/projects/${parent.projectId}/import/${begin.expenseId}/finalize`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:requested})});lastImportResults.push({ok:true,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,expenseId:begin.expenseId,result:finalResult});update(`${parent.parentName} status: ${finalResult.finalStatus}`)}catch(e){lastImportResults.push({ok:false,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,expenseId:begin.expenseId,error:`Items complete, status action required: ${e.message}`});setActionStatus(`Items created for ${parent.parentName}, but Autodesk blocked ${requested}. Check Forma workflow.`,true)}}else lastImportResults.push({ok:false,project:parent.project,expenseName:parent.parentName,originalExpenseName:parent.originalExpenseName,partNumber:parent.partNumber,totalParts:parent.totalParts,expenseId:begin.expenseId,error:'Parent remains Draft because one or more item chunks failed.'});
    parentDone++;update(`Completed ${parent.parentName}`)
  }
  $('progressText').textContent='Import complete';$('progressPercent').textContent='100%';$('progressBar').style.width='100%';$('progressDetail').textContent=`${done}/${total} rows | ${parents.length} parent expense(s) | Imported ${imported} | Failed ${failed} | Skipped ${skipped}`;
  $('log').value=JSON.stringify({maximumRows:1200,maximumItemsPerParent:300,itemChunkSize:10,costSpacingMs:130,parentExpensesCreated:parents.length,imported,failed,skipped,results:lastImportResults},null,2);$('create').disabled=false;$('create').textContent='Create expenses'
};
$('exportReport').onclick=async()=>{const r=await fetch('/api/export-import-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results:lastImportResults})});if(!r.ok)return;const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='Workday Forma Import Report.xlsx';a.click();URL.revokeObjectURL(u)};

init().catch((error) => setActionStatus(error.message, true));
