const fs=require('fs'),path=require('path');
const root=process.cwd(),serverPath=path.join(root,'server.js'),appPath=path.join(root,'public','app.js'),packagePath=path.join(root,'package.json');
for(const file of [serverPath,appPath,packagePath])if(!fs.existsSync(file))throw Error(`Missing ${file}`);
const stamp=Date.now();for(const file of [serverPath,appPath,packagePath])fs.copyFileSync(file,`${file}.before-v90.${stamp}`);
let server=fs.readFileSync(serverPath,'utf8'),app=fs.readFileSync(appPath,'utf8');
const oldRoute="app.get('/api/hubs/:hub/projects',auth.ensure,async(q,r)=>{try{r.json(await cost.projects(q.aps.access_token,q.params.hub))}catch(e){r.status(500).json({error:e.message})}});";
const newRoute="app.get('/api/hubs/:hub/projects',auth.ensure,async(q,r)=>{try{r.json(await allHubProjects(q.aps.access_token,q.params.hub))}catch(e){r.status(500).json({error:e.message})}});";
if(server.includes(oldRoute))server=server.replace(oldRoute,newRoute);
if(!server.includes('async function allHubProjects(')){
 const marker='let appTokenCache=null;';if(!server.includes(marker))throw Error('Hub Admin insertion point not found');
 const helper=`const stripAdminId=id=>String(id||'').replace(/^b\\./,'');
async function adminProjectPage(token,accountId,region,offset){const url=\`https://developer.api.autodesk.com/construction/admin/v1/accounts/\${encodeURIComponent(accountId)}/projects?limit=200&offset=\${offset}\`;const response=await fetch(url,{headers:{Authorization:\`Bearer \${token}\`,Accept:'application/json',Region:region}});if(!response.ok)throw Error(\`\${region}: \${response.status} \${await response.text()}\`);return response.json()}
async function adminProjects(token,hubId){const accountId=stripAdminId(hubId),preferred=String(process.env.APS_ADMIN_REGION||process.env.APS_COST_REGION||'AUS').toUpperCase(),regions=[...new Set([preferred,'AUS','US','EMEA'])];let lastError;for(const region of regions){try{const projects=[];let offset=0,total=1;while(offset<total){const data=await adminProjectPage(token,accountId,region,offset),rows=data.results||data.data||[];projects.push(...rows);const limit=Number(data.pagination?.limit||200);total=Number(data.pagination?.totalResults??(offset+rows.length));if(!rows.length)break;offset+=limit}return projects.map(p=>({id:stripAdminId(p.id||p.projectId),rawId:p.id||p.projectId,name:p.name||p.projectName||p.id,status:p.status||'',projectListSource:'hub-admin',adminRegion:region}))}catch(error){lastError=error}}throw lastError||Error('Hub Admin project list unavailable')}
async function allHubProjects(token,hubId){let member=[];try{member=await cost.projects(token,hubId)}catch{}let admin=[];try{admin=await adminProjects(token,hubId)}catch(error){if(!member.length)throw error;return member}const map=new Map(admin.map(p=>[stripAdminId(p.id),p]));for(const p of member){const id=stripAdminId(p.id),current=map.get(id);map.set(id,{...(current||{}),...p,id,projectListSource:current?'hub-admin+member':'member-access'})}return [...map.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')))}
`;
 server=server.replace(marker,helper+marker);
}
server=server.replace("all=await cost.projects(q.aps.access_token,q.params.hub),projects=all.filter","all=await allHubProjects(q.aps.access_token,q.params.hub),projects=all.filter");
server=server.replace(/version:'v\d+',package:'1\.0\.\d+'/,"version:'v90',package:'1.0.90'");
app=app.replace("if (!selected.size) return setActionStatus('Select at least one project.', true);", "if (!selected.size) return setActionStatus('Select at least one project.', true); if(selected.size>10)return setActionStatus('Select a maximum of 10 projects.',true);");
if(!app.includes('function ensureProjectSelectionControls')){
 const marker='function renderProjects() {';if(!app.includes(marker))throw Error('renderProjects not found');
 const helper=`function ensureProjectSelectionControls(){if($('projectSelectionActions'))return;const count=$('count');if(!count)return;const wrap=document.createElement('span');wrap.id='projectSelectionActions';wrap.style.cssText='display:inline-flex;gap:6px;margin-left:8px';wrap.innerHTML='<button type="button" id="selectAllProjects" style="padding:5px 8px;font-size:11px;width:auto">Select all</button><button type="button" id="clearAllProjects" style="padding:5px 8px;font-size:11px;width:auto">Clear all</button>';count.insertAdjacentElement('afterend',wrap);$('selectAllProjects').onclick=()=>{const query=$('search').value.toLowerCase(),visible=projects.filter(p=>p.name.toLowerCase().includes(query));if(visible.length>10)setActionStatus('Maximum 10 projects. The first 10 visible projects were selected.',true);selected.clear();visible.slice(0,10).forEach(p=>selected.add(p.id));renderProjects()};$('clearAllProjects').onclick=()=>{selected.clear();renderProjects()}}
`;
 app=app.replace(marker,helper+marker).replace("$('count').textContent = `${selected.size} selected`;", "$('count').textContent = `${selected.size} selected`; ensureProjectSelectionControls();");
}
if(!app.includes('Waiting ${seconds} seconds before next project')){
 const needle='parentDone++;update(`Completed ${parent.parentName}`)}const elapsedMilliseconds=';
 const replacement="parentDone++;update(`Completed ${parent.parentName}`);const nextParent=parents[parentDone];if(nextParent&&nextParent.projectId!==parent.projectId&&!importCancelled){for(let seconds=25;seconds>0;seconds--){update(`Project ${parent.project} complete. Waiting ${seconds} seconds before next project`);await new Promise(resolve=>setTimeout(resolve,1000))}}}const elapsedMilliseconds=";
 if(!app.includes(needle))throw Error('Project completion point not found');app=app.replace(needle,replacement);
}
fs.writeFileSync(serverPath,server);fs.writeFileSync(appPath,app);const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));pkg.version='1.0.90';fs.writeFileSync(packagePath,JSON.stringify(pkg));
console.log('v90 applied. Existing src/aps.js and src/xlsx.js were not changed.');
