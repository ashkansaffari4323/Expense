(()=>{
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money=n=>Number(n||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2});
const call=async(u,o)=>{const r=await fetch(u,o),t=await r.text();let d;try{d=JSON.parse(t)}catch{throw Error(t||'HTTP '+r.status)}if(!r.ok)throw Error(d.error||'HTTP '+r.status);return d};
let projects=[],sel=new Set(),loaded=[];
const status=(m,bad)=>{$('status').innerHTML=m;$('status').classList.toggle('bad',!!bad)};
const stats=(d={})=>{$('stats').innerHTML=[[d.total||0,'Rows'],[d.ready||0,'Ready'],[d.existing||0,'Existing'],[d.invalid||0,'Invalid'],['$'+money(d.totals?.value),'Value ex GST'],['$'+money(d.totals?.gst),'GST']].map(([n,l])=>`<div><b>${n}</b>${l}</div>`).join('')};
stats();

function render(){
  const q=$('search').value.toLowerCase(),list=projects.filter(p=>String(p.name).toLowerCase().includes(q));
  $('projects').innerHTML=list.length?list.map(p=>`<div class="proj${sel.has(p.id)?' on':''}" data-id="${esc(p.id)}"><span class="chk">${sel.has(p.id)?'&#10003;':''}</span><span>${esc(p.name)}</span></div>`).join(''):'<div class="muted">No projects found.</div>';
  $('projects').querySelectorAll('.proj').forEach(el=>el.onclick=()=>{const id=el.dataset.id;sel.has(id)?sel.delete(id):sel.add(id);render()});
  $('count').textContent=sel.size+' selected';
}
async function loadProjects(){
  $('projects').innerHTML='<div class="muted">Loading projects...</div>';sel.clear();loaded=[];$('template').disabled=true;
  projects=await call(`/api/hubs/${encodeURIComponent($('hub').value)}/projects`);render();
}
async function init(){
  const s=await call('/api/auth/status');if(!s.signedIn){location.replace('/api/auth/login');return}
  const hubs=await call('/api/hubs');
  $('hub').innerHTML=hubs.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('');
  if(hubs.length)await loadProjects();else $('projects').innerHTML='<div class="muted">No hubs available.</div>';
}
$('signOut').onclick=async()=>{await fetch('/api/auth/logout',{method:'POST'});location.href='/'};
$('hub').onchange=()=>loadProjects().catch(e=>status(esc(e.message),true));
$('search').oninput=render;
$('selAll').onclick=()=>{const q=$('search').value.toLowerCase();projects.filter(p=>String(p.name).toLowerCase().includes(q)).forEach(p=>sel.add(p.id));render()};
$('selNone').onclick=()=>{sel.clear();render()};
$('load').onclick=()=>{if(!sel.size)return status('Select at least one project.',true);loaded=projects.filter(p=>sel.has(p.id));$('template').disabled=false;status(`${loaded.length} project(s) loaded. Download the Excel template.`)};
$('template').onclick=async()=>{
  const b=$('template');b.disabled=true;b.textContent='Loading suppliers...';
  try{
    const r=await fetch('/api/contracts/template',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hubId:$('hub').value,projects:loaded.map(p=>({id:p.id,name:p.name}))})});
    if(!r.ok)throw Error(await r.text());
    const u=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=u;a.download='Forma Contracts Import.xlsx';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);
    status('Template downloaded. Fill it in, then upload it.');
  }catch(e){status(esc(e.message),true)}finally{b.disabled=false;b.textContent='Download Excel template'}
};
$('upload').onclick=()=>$('file').click();
$('file').onchange=()=>{const f=$('file').files[0];$('fileName').textContent=f?f.name:'No file selected';$('create').disabled=true;if(f)status('File selected. Click Preview.')};
$('preview').onclick=async()=>{
  const f=$('file').files[0];if(!f)return status('Upload a Contracts Excel file first.',true);
  const fd=new FormData();fd.append('file',f);$('preview').disabled=true;$('preview').textContent='Checking...';
  try{
    const d=await call('/api/contracts/preview',{method:'POST',body:fd});stats(d);
    $('errCount').textContent=d.invalid+' errors';$('errCount').classList.toggle('bad',d.invalid>0);
    $('rows').innerHTML=d.rows.length?d.rows.map(x=>{const st=x.errors.length?esc(x.errors.join('; ')):x.exists?'Already exists (skipped)':'Ready';const iss=x.issuedAt?new Date(x.issuedAt).toLocaleDateString('en-AU'):'';
      return `<tr class="${x.errors.length?'bad':x.exists?'warn':''}"><td>${x.row}</td><td>${esc(x.projectName)}</td><td>${esc(x.name)}</td><td>${esc(x.code)}</td><td>${esc(x.supplierName)}</td><td>${iss}</td><td class="num">${money(x.amount)}</td><td class="num">${x.applyGst?money(x.gst)+' ('+x.gstRate+'%)':'-'}</td><td class="num">${money(x.total)}</td><td>${st}</td></tr>`}).join(''):'<tr><td colspan="10" class="muted">No contract rows found.</td></tr>';
    $('create').disabled=!d.ready;
    status(d.ready?`${d.ready} contract(s) ready to create and approve.`:'No contracts are ready to create.',!d.ready);
  }catch(e){status(esc(e.message),true)}finally{$('preview').disabled=false;$('preview').textContent='Preview'}
};
$('clear').onclick=()=>{stats();$('errCount').textContent='0 errors';$('errCount').classList.remove('bad');$('rows').innerHTML='<tr><td colspan="10" class="muted">Upload an Excel file and select Preview.</td></tr>';$('create').disabled=true;status('Preview cleared.')};
$('clearLog').onclick=()=>$('log').value='No API result yet.';
$('create').onclick=async()=>{
  const f=$('file').files[0];if(!f)return;if(!confirm('Create and approve the ready contracts in Autodesk?'))return;
  const fd=new FormData();fd.append('file',f);$('create').disabled=true;$('create').textContent='Creating and approving...';
  try{const d=await call('/api/contracts/import',{method:'POST',body:fd});$('log').value=JSON.stringify(d,null,2);
    status(`Created ${d.created}, skipped ${d.skipped}, failed ${d.failed}${d.withWarnings?`, ${d.withWarnings} with warnings`:''}.`,d.failed>0||d.withWarnings>0)}
  catch(e){$('log').value=e.message;status(esc(e.message),true)}
  finally{$('create').textContent='Create and approve contracts'}
};
init().catch(e=>status(esc(e.message),true));
})();
