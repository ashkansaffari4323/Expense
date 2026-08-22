const fs=require('fs'),path=require('path');
const root=process.cwd();
const files={server:path.join(root,'server.js'),app:path.join(root,'public','app.js'),aps:path.join(root,'src','aps.js'),auth:path.join(root,'src','auth.js'),pkg:path.join(root,'package.json')};
for(const [name,file] of Object.entries(files))if(!fs.existsSync(file))throw Error(`Missing ${name}: ${file}`);
const stamp=Date.now();
for(const file of Object.values(files))fs.copyFileSync(file,`${file}.before-v94.${stamp}`);
let server=fs.readFileSync(files.server,'utf8');
let app=fs.readFileSync(files.app,'utf8');
let auth=fs.readFileSync(files.auth,'utf8');
// Parent remains maximum 300, browser/server item batch becomes 167.
server=server.replace(/if\(rows\.length>(?:100|167|300)\)return r\.status\(400\)\.json\(\{error:'Maximum (?:100 items per chunk|167 items per batch|300 items per batch)\.'\}\)/g,"if(rows.length>167)return r.status(400).json({error:'Maximum 167 items per batch.'})");
server=server.replace(/version:'v\d+',package:'1\.0\.\d+'/,"version:'v94',package:'1.0.94'");
app=app.replace(/Math\.ceil\(p\.rows\.length\/(?:100|167|300)\)/g,'Math.ceil(p.rows.length/167)');
app=app.replace(/i\+=(?:100|167|300)/g,'i+=167');
app=app.replace(/slice\(i,i\+(?:100|167|300)\)/g,'slice(i,i+167)');
app=app.replace(/itemChunkSize:(?:100|167|300)/g,'itemChunkSize:167');
// Keep project parents sequential and grouped.
const sortPoint="$('create').disabled=true;";
if(!app.includes('v94ProjectOrder')){
  if(!app.includes(sortPoint))throw Error('Parent queue insertion point not found');
  const code="const v94ProjectOrder=new Map();parents.forEach(p=>{if(!v94ProjectOrder.has(p.projectId))v94ProjectOrder.set(p.projectId,v94ProjectOrder.size)});parents.sort((a,b)=>v94ProjectOrder.get(a.projectId)-v94ProjectOrder.get(b.projectId)||a.partNumber-b.partNumber);";
  app=app.replace(sortPoint,code+sortPoint);
}
// Remove earlier parent/project wait blocks and apply v94 waits.
app=app.replace(/;const v9[23]NextParent=parents\[parentDone\];if\(v9[23]NextParent&&!importCancelled\)\{const v9[23]Wait=v9[23]NextParent\.projectId===parent\.projectId\?10:25;for\(let seconds=v9[23]Wait;seconds>0;seconds--\)\{update\(v9[23]NextParent\.projectId===parent\.projectId\?`Parent complete\. Waiting \$\{seconds\} seconds before next 300-item parent`:`Project \$\{parent\.project\} complete\. Waiting \$\{seconds\} seconds before next project`\);await new Promise\(resolve=>setTimeout\(resolve,1000\)\)\}\}/g,'');
if(!app.includes('v94NextParent')){
  const needle='parentDone++;update(`Completed ${parent.parentName}`)}const elapsedMilliseconds=';
  if(!app.includes(needle))throw Error('Parent completion point not found');
  app=app.replace(needle,"parentDone++;update(`Completed ${parent.parentName}`);const v94NextParent=parents[parentDone];if(v94NextParent&&!importCancelled){const v94Wait=v94NextParent.projectId===parent.projectId?10:25;for(let seconds=v94Wait;seconds>0;seconds--){update(v94NextParent.projectId===parent.projectId?`Parent complete. Waiting ${seconds} seconds before next 300-item parent`:`Project ${parent.project} complete. Waiting ${seconds} seconds before next project`);await new Promise(resolve=>setTimeout(resolve,1000))}}}const elapsedMilliseconds=");
}
// Automatic login if no valid app session.
app=app.replace("async function init() { if (!(await api('/api/auth/status')).signedIn) return;", "async function init() { const authStatus=await api('/api/auth/status');if(!authStatus.signedIn){location.replace('/api/auth/login');return;}");
// Keep normal Autodesk remembered-account flow.
auth=auth.replace(/loginUrl:s=>\{const c=cfg\(\);return`\$\{BASE\}\/authorize\?`\+new URLSearchParams\(\{response_type:'code',client_id:c\.clientId,redirect_uri:c\.callback,scope:c\.scopes,state:s(?:,prompt:'[^']+')?\}\)\}/,"loginUrl:s=>{const c=cfg();return`${BASE}/authorize?`+new URLSearchParams({response_type:'code',client_id:c.clientId,redirect_uri:c.callback,scope:c.scopes,state:s})}");
// 10 workers, zero normal gap, 25 linear retries: 10 through 250 seconds.
const aps=`const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let startGate=Promise.resolve(),nextStartAt=0,blockedUntil=0,adaptiveConcurrency=10,successStreak=0,retryCount=0;
const spacing=0;
async function reserveStart(){const slot=async()=>{const wait=Math.max(0,nextStartAt-Date.now(),blockedUntil-Date.now());if(wait)await sleep(wait);nextStartAt=Date.now()+spacing};const result=startGate.then(slot,slot);startGate=result.catch(()=>undefined);await result}
async function raw(method,token,url,payload,attempt=0){if(url.includes('/cost/v1/'))await reserveStart();const headers={Authorization:\`Bearer \${token}\`,Accept:'application/json'};if(payload!==undefined)headers['Content-Type']='application/json';if(process.env.APS_COST_REGION&&url.includes('/cost/v1/'))headers.Region=process.env.APS_COST_REGION;const response=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)}),text=await response.text();let body;try{body=text?JSON.parse(text):null}catch{body=text}if(response.ok){successStreak++;return body}const retryable=[429,500,502,503,504].includes(response.status);if(retryable&&attempt<25){retryCount++;if(response.status===429)successStreak=0;const waitSeconds=(attempt+1)*10;blockedUntil=Math.max(blockedUntil,Date.now()+waitSeconds*1000);await sleep(waitSeconds*1000);return raw(method,token,url,payload,attempt+1)}throw Error(\`APS \${method} \${url} failed (\${response.status}): \${typeof body==='string'?body:JSON.stringify(body,null,2)}\`)}
module.exports={get:(t,u)=>raw('GET',t,u),post:(t,u,p)=>raw('POST',t,u,p),patch:(t,u,p)=>raw('PATCH',t,u,p),getAdaptiveState:()=>({concurrency:adaptiveConcurrency,retryCount,blockedUntil})};
`;
fs.writeFileSync(files.server,server);fs.writeFileSync(files.app,app);fs.writeFileSync(files.aps,aps);fs.writeFileSync(files.auth,auth);
const pkg=JSON.parse(fs.readFileSync(files.pkg,'utf8'));pkg.version='1.0.94';fs.writeFileSync(files.pkg,JSON.stringify(pkg));
console.log('v94 applied: 167 rows per browser/server batch.');
console.log('Parent maximum remains 300. A full parent is sent as 167 + 133.');
console.log('25 retries with waits of 10, 20 ... 250 seconds.');
console.log('Backups use suffix:',`before-v94.${stamp}`);
