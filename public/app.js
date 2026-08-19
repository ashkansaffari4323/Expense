const $=id=>document.getElementById(id);
const auth=$('auth'),app=$('app'),hub=$('hub'),projectsEl=$('projects'),load=$('load'),template=$('template'),file=$('file'),preview=$('preview'),createBtn=$('create'),err=$('err'),cardsEl=$('cards'),rowsEl=$('rows'),log=$('log'),projectSearch=$('projectSearch'),count=$('count'),selectVisible=$('selectVisible'),clearProjects=$('clearProjects'),clearLog=$('clearLog'),copyFullResult=$('copyFullResult'),resultCards=$('resultCards');
let allProjects=[],selected=[],parsed=[],lastApiResult=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function error(e){err.textContent=e;err.classList.remove('hidden');}
function clearErr(){err.classList.add('hidden');}
async function api(u,o){const r=await fetch(u,o);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Request failed ${r.status}`);return d;}
function selectedIds(){return[...projectsEl.querySelectorAll('input:checked')].slice(0,100).map(x=>x.value);}
function updateCount(){selected=selectedIds();count.textContent=`${selected.length} selected`;return selected;}
function renderProjects(){const q=projectSearch.value.trim().toLowerCase();const list=allProjects.filter(p=>!q||p.name.toLowerCase().includes(q));projectsEl.innerHTML=list.map(p=>`<label class="projectCard"><input type="checkbox" value="${esc(p.id)}" data-name="${esc(p.name)}"><span><span class="projectName">${esc(p.name)}</span><span class="projectId">${esc(p.id)}</span></span></label>`).join('')||'<div class="projectCard">No projects found</div>';projectsEl.querySelectorAll('input').forEach(cb=>cb.onchange=updateCount);updateCount();}
function showCards(s={}){cardsEl.innerHTML=[['Rows',s.totalRows],['Valid',s.validRows],['Repeat Excel',s.duplicateRows],['Exists Cost',s.existingInCostRows],['To Create',s.rowsToCreate],['Created',s.created]].map(x=>`<div class="card"><b>${x[1]||0}</b>${x[0]}</div>`).join('');}
function setLog(obj){lastApiResult=obj;log.value=typeof obj==='string'?obj:JSON.stringify(obj,null,2);}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{log.select();document.execCommand('copy');return false;}}
function renderResultCards(results=[]){
  if(!resultCards)return;
  resultCards.innerHTML=results.map((r,i)=>{
    const status=r.ok?(r.result?.skipped?'Skipped':(r.result?.finalStatus||'Created')):'Failed';
    const klass=!r.ok?'bad':(r.result?.skipped?'warn':'ok');
    const api=esc(JSON.stringify(r.result||{error:r.error},null,2));
    const row=esc(r.row??'');
    const project=esc(r.project||'');
    const short=esc(r.error||r.result?.matchedValue?`Matched ${r.result.matchedBy||'Workday Unique ID'}: ${r.result.matchedValue}`:(r.result?.approvalAttempt?.message||r.result?.approvalAttempt?.method||r.result?.pathUsed||''));
    return `<div class="resultCard"><div class="resultCardHeader"><div>Row <b>${row}</b></div><div class="resultMini" title="${project}">${project}</div><div><span class="badge ${klass}">${esc(status)}</span></div><button class="mini copyRow" type="button" data-result-index="${i}">Copy API</button></div>${short?`<div class="resultMini">${short}</div>`:''}<script type="application/json" id="api-result-${i}">${api}</script></div>`;
  }).join('');
  resultCards.querySelectorAll('[data-result-index]').forEach(btn=>{
    btn.onclick=()=>{
      const i=btn.getAttribute('data-result-index');
      const data=results[i]?.result||{error:results[i]?.error};
      copyText(JSON.stringify(data,null,2));
      btn.textContent='Copied';
      setTimeout(()=>btn.textContent='Copy API',1200);
    };
  });
}
async function init(){const s=await api('/api/auth/status');if(!s.signedIn)return;auth.innerHTML='<button class="btn" id="out">Sign out</button>';$('out').onclick=async()=>{await fetch('/api/auth/logout',{method:'POST'});location.reload();};app.classList.remove('hidden');const hs=await api('/api/hubs');hub.innerHTML='<option value="">Select hub</option>'+hs.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('');}
hub.onchange=async()=>{clearErr();projectsEl.innerHTML='<div class="projectCard">Loading projects...</div>';allProjects=await api(`/api/hubs/${encodeURIComponent(hub.value)}/projects`);renderProjects();};
projectSearch.oninput=renderProjects;
selectVisible.onclick=()=>{projectsEl.querySelectorAll('input').forEach(x=>x.checked=true);updateCount();};
clearProjects.onclick=()=>{projectsEl.querySelectorAll('input').forEach(x=>x.checked=false);updateCount();};
load.onclick=()=>{selected=updateCount();if(!selected.length)return error('Select at least one project.');template.href=`/api/hubs/${encodeURIComponent(hub.value)}/templates/multi?projectIds=${encodeURIComponent(selected.join(','))}`;template.classList.remove('disabled');setLog(`Selected ${selected.length} project(s). Download the template.`);resultCards.innerHTML='';};
async function read(){clearErr();selected=updateCount();if(!selected.length)throw new Error('Select at least one project first.');if(!file.files.length)throw new Error('Choose Excel file first.');const fd=new FormData();fd.append('file',file.files[0]);fd.append('projectIds',selected.join(','));const d=await api(`/api/hubs/${encodeURIComponent(hub.value)}/import-excel`,{method:'POST',body:fd});parsed=d.rows||[];showCards(d.summary);rowsEl.innerHTML=parsed.map(r=>`<tr class="${r.duplicateInExcel?'dup':r.existsInCost?'exists':''}"><td>${r.excelRowNumber}</td><td>${esc(r.projectName||'')}</td><td>${esc(r.workdayUniqueId)}</td><td>${esc(r.expenseName)}</td><td>${r.duplicateInExcel?'Repeated in Excel':r.existsInCost?`Already in Cost: ${esc(r.matchedValue||r.workdayUniqueId||'')}`:esc(r.status)}</td></tr>`).join('')||'<tr><td colspan="5">No rows found.</td></tr>';const previewResult={summary:d.summary,duplicates:d.duplicateRows,existing:d.existingDuplicates};setLog(previewResult);renderResultCards([]);}
preview.onclick=()=>read().catch(e=>error(e.message));
createBtn.onclick=async()=>{clearErr();if(!parsed.length)await read();let created=0,skipped=0,failed=0,approved=0,draft=0,results=[];for(const r of parsed){try{const x=await api(`/api/projects/${encodeURIComponent(r.projectId)}/expenses`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});if(x.created)created++;if(x.skipped)skipped++;if(x.finalStatus==='approved')approved++;if(x.finalStatus==='draft')draft++;results.push({row:r.excelRowNumber,project:r.projectName,ok:true,result:x});}catch(e){failed++;results.push({row:r.excelRowNumber,project:r.projectName,ok:false,error:e.message});}}
  const full={created,skipped,failed,approved,draft,results};
  showCards({totalRows:parsed.length,created});
  renderResultCards(results);
  setLog(full);
};
clearLog.onclick=()=>{setLog('No import run yet.');if(resultCards)resultCards.innerHTML='';};
copyFullResult.onclick=async()=>{await copyText(log.value);copyFullResult.textContent='Copied full API result';setTimeout(()=>copyFullResult.textContent='Copy full API result',1400);};
init().catch(e=>error(e.message));
