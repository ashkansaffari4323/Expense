const fs=require('fs'),path=require('path');
const root=process.cwd();
const files={server:path.join(root,'server.js'),app:path.join(root,'public','app.js'),aps:path.join(root,'src','aps.js'),pkg:path.join(root,'package.json')};
for(const [name,file] of Object.entries(files))if(!fs.existsSync(file))throw Error(`Missing ${name}: ${file}`);
const stamp=Date.now();
for(const file of Object.values(files))fs.copyFileSync(file,`${file}.before-v92.${stamp}`);
let server=fs.readFileSync(files.server,'utf8');
let app=fs.readFileSync(files.app,'utf8');
// Server accepts one complete Autodesk parent batch, maximum 300 rows.
server=server.replace(/if\(rows\.length>100\)return r\.status\(400\)\.json\(\{error:'Maximum 100 items per chunk\.'\}\)/g,"if(rows.length>300)return r.status(400).json({error:'Maximum 300 items per batch.'})");
server=server.replace(/version:'v\d+',package:'1\.0\.\d+'/,"version:'v92',package:'1.0.92'");
// Browser submits each generated parent in one batch of up to 300 rows.
app=app.replace(/Math\.ceil\(p\.rows\.length\/100\)/g,'Math.ceil(p.rows.length/300)');
app=app.replace(/i\+=100/g,'i+=300');
app=app.replace(/slice\(i,i\+100\)/g,'slice(i,i+300)');
app=app.replace(/itemChunkSize:100/g,'itemChunkSize:300');
// Ensure all parents for one project stay together in the queue.
const sortPoint="$('create').disabled=true;";
if(!app.includes('v92ProjectOrder')){
  if(!app.includes(sortPoint))throw Error('Could not find parent queue insertion point in public/app.js');
  const sortCode="const v92ProjectOrder=new Map();parents.forEach(p=>{if(!v92ProjectOrder.has(p.projectId))v92ProjectOrder.set(p.projectId,v92ProjectOrder.size)});parents.sort((a,b)=>v92ProjectOrder.get(a.projectId)-v92ProjectOrder.get(b.projectId)||a.partNumber-b.partNumber);";
  app=app.replace(sortPoint,sortCode+sortPoint);
}
// Replace any earlier v90 project/parent wait block with v92 rules.
app=app.replace(/;const nextParent=parents\[parentDone\];if\(nextParent&&nextParent\.projectId!==parent\.projectId&&!importCancelled\)\{for\(let seconds=25;seconds>0;seconds--\)\{update\(`Project \$\{parent\.project\} complete\. Waiting \$\{seconds\} seconds before next project`\);await new Promise\(resolve=>setTimeout\(resolve,1000\)\)\}\}/g,'');
if(!app.includes('v92NextParent')){
  const needle='parentDone++;update(`Completed ${parent.parentName}`)}const elapsedMilliseconds=';
  if(!app.includes(needle))throw Error('Could not find parent completion point in public/app.js');
  const replacement="parentDone++;update(`Completed ${parent.parentName}`);const v92NextParent=parents[parentDone];if(v92NextParent&&!importCancelled){const v92Wait=v92NextParent.projectId===parent.projectId?10:25;for(let seconds=v92Wait;seconds>0;seconds--){update(v92NextParent.projectId===parent.projectId?`Parent complete. Waiting ${seconds} seconds before next 300-item parent`:`Project ${parent.project} complete. Waiting ${seconds} seconds before next project`);await new Promise(resolve=>setTimeout(resolve,1000))}}}const elapsedMilliseconds=";
  app=app.replace(needle,replacement);
}
// Exact aggressive normal speed plus linear rejection waits: 10,20,...100 seconds.
const aps=`const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let startGate=Promise.resolve(),nextStartAt=0,blockedUntil=0,adaptiveConcurrency=10,successStreak=0,retryCount=0;
const spacing=0;
async function reserveStart(){const slot=async()=>{const wait=Math.max(0,nextStartAt-Date.now(),blockedUntil-Date.now());if(wait)await sleep(wait);nextStartAt=Date.now()+spacing};const result=startGate.then(slot,slot);startGate=result.catch(()=>undefined);await result}
async function raw(method,token,url,payload,attempt=0){if(url.includes('/cost/v1/'))await reserveStart();const headers={Authorization:\`Bearer \${token}\`,Accept:'application/json'};if(payload!==undefined)headers['Content-Type']='application/json';if(process.env.APS_COST_REGION&&url.includes('/cost/v1/'))headers.Region=process.env.APS_COST_REGION;const response=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)}),text=await response.text();let body;try{body=text?JSON.parse(text):null}catch{body=text}if(response.ok){successStreak++;return body}const retryable=[429,500,502,503,504].includes(response.status);if(retryable&&attempt<10){retryCount++;if(response.status===429)successStreak=0;const waitSeconds=(attempt+1)*10;blockedUntil=Math.max(blockedUntil,Date.now()+waitSeconds*1000);await sleep(waitSeconds*1000);return raw(method,token,url,payload,attempt+1)}throw Error(\`APS \${method} \${url} failed (\${response.status}): \${typeof body==='string'?body:JSON.stringify(body,null,2)}\`)}
module.exports={get:(t,u)=>raw('GET',t,u),post:(t,u,p)=>raw('POST',t,u,p),patch:(t,u,p)=>raw('PATCH',t,u,p),getAdaptiveState:()=>({concurrency:adaptiveConcurrency,retryCount,blockedUntil})};
`;
fs.writeFileSync(files.aps,aps);
fs.writeFileSync(files.server,server);
fs.writeFileSync(files.app,app);
const pkg=JSON.parse(fs.readFileSync(files.pkg,'utf8'));pkg.version='1.0.92';fs.writeFileSync(files.pkg,JSON.stringify(pkg));
console.log('v92 applied.');
console.log('300 rows per parent batch, 10 workers, 0 ms normal gap.');
console.log('10 seconds between successful parents, 25 seconds between projects.');
console.log('Rejected calls retry after 10, 20, 30 ... 100 seconds.');
console.log('Backups use suffix:',`before-v92.${stamp}`);
