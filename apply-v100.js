const fs=require('fs'),path=require('path');
const root=process.cwd();
const files={server:path.join(root,'server.js'),app:path.join(root,'public','app.js'),aps:path.join(root,'src','aps.js'),cost:path.join(root,'src','cost.js'),pkg:path.join(root,'package.json')};
for(const [name,file] of Object.entries(files))if(!fs.existsSync(file))throw Error(`Missing ${name}: ${file}`);
const stamp=Date.now();
for(const file of Object.values(files))fs.copyFileSync(file,`${file}.before-v100.${stamp}`);
let server=fs.readFileSync(files.server,'utf8');
let app=fs.readFileSync(files.app,'utf8');
let cost=fs.readFileSync(files.cost,'utf8');
// Ensure duplicate-safe existing-item verification is available.
if(!cost.includes('expenseItems:')){
  const old="expenses:(t,p)=>list(t,p,'expenses'),createExpense:";
  const add="expenses:(t,p)=>list(t,p,'expenses'),expenseItems:async(t,p,e)=>{let out=[],o=0;p=pid(p);while(true){const d=await a.get(t,`${COST}/containers/${p}/expenses/${encodeURIComponent(e)}/items?limit=100&offset=${o}`),r=d.results||d.data||[];out.push(...r);if(r.length<100)break;o+=100}return out},createExpense:";
  if(!cost.includes(old))throw Error('Could not add expenseItems to src/cost.js. Install v96 first.');
  cost=cost.replace(old,add);
}
// Use two response-latency workers. The global APS scheduler controls actual start rate.
server=server.replace(/Math\.min\((?:10|require\('\.\/src\/aps'\)\.getAdaptiveState\(\)\.concurrency),queue\.length\)/g,'Math.min(2,queue.length)');
server=server.replace(/workers:10/g,'workers:2');
server=server.replace(/version:'v\d+',package:'1\.0\.\d+'/,"version:'v100',package:'1.0.100'");
// Pending queue retries every 30 seconds, not 10 or 25.
app=app.replace(/pendingRetryWaitSeconds:(?:10|25|30)/g,'pendingRetryWaitSeconds:30');
app=app.replace(/for\(let seconds=(?:10|25);seconds>0&&!importCancelled;seconds--\)/g,'for(let seconds=30;seconds>0&&!importCancelled;seconds--)');
app=app.replace(/Workers (?:10|\$\{workers\})/g,'Workers 2');
app=app.replace(/workers:(?:10|"adaptive 1-10")/g,'workers:2');
// Endpoint-specific scheduler: 19 starts/minute => 3200 ms minimum spacing.
// This applies only to POST expense-item creation. Other endpoints are not slowed by this limiter.
const aps=`const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let itemPostGate=Promise.resolve(),nextItemPostAt=0,blockedUntil=0,retryCount=0,lastRetryAfterSeconds=0;
const ITEM_POST_SPACING_MS=3200;
const isExpenseItemPost=(method,url)=>method==='POST'&&/\/cost\/v1\/containers\/[^/]+\/expenses\/[^/]+\/items(?:\\?|$)/.test(url);
async function reserveItemPost(){const slot=async()=>{const wait=Math.max(0,nextItemPostAt-Date.now(),blockedUntil-Date.now());if(wait)await sleep(wait);nextItemPostAt=Date.now()+ITEM_POST_SPACING_MS};const current=itemPostGate.then(slot,slot);itemPostGate=current.catch(()=>undefined);await current}
async function raw(method,token,url,payload){if(isExpenseItemPost(method,url))await reserveItemPost();const headers={Authorization:\`Bearer \${token}\`,Accept:'application/json'};if(payload!==undefined)headers['Content-Type']='application/json';if(process.env.APS_COST_REGION&&url.includes('/cost/v1/'))headers.Region=process.env.APS_COST_REGION;const response=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)}),text=await response.text();let body;try{body=text?JSON.parse(text):null}catch{body=text}if(response.ok)return body;if(response.status===429){retryCount++;const header=Number(response.headers.get('retry-after'));lastRetryAfterSeconds=Number.isFinite(header)&&header>0?header:30;blockedUntil=Math.max(blockedUntil,Date.now()+Math.max(30,lastRetryAfterSeconds)*1000)}throw Error(\`APS \${method} \${url} failed (\${response.status}): \${typeof body==='string'?body:JSON.stringify(body,null,2)}\`)}
module.exports={get:(t,u)=>raw('GET',t,u),post:(t,u,p)=>raw('POST',t,u,p),patch:(t,u,p)=>raw('PATCH',t,u,p),getAdaptiveState:()=>({concurrency:2,retryCount,blockedUntil,lastRetryAfterSeconds,itemPostSpacingMs:ITEM_POST_SPACING_MS,itemPostStartsPerMinute:18.75})};
`;
fs.writeFileSync(files.server,server);fs.writeFileSync(files.app,app);fs.writeFileSync(files.aps,aps);fs.writeFileSync(files.cost,cost);
const pkg=JSON.parse(fs.readFileSync(files.pkg,'utf8'));pkg.version='1.0.100';fs.writeFileSync(files.pkg,JSON.stringify(pkg));
console.log('v100 applied: Expense Item POST starts are globally spaced by 3200 ms.');
console.log('Two workers hide response latency; forward-first global pending queue remains active.');
console.log('Backups use suffix:',`before-v100.${stamp}`);
