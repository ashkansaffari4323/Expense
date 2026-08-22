const fs=require('fs'),path=require('path');
const root=process.cwd();
const files={server:path.join(root,'server.js'),app:path.join(root,'public','app.js'),aps:path.join(root,'src','aps.js'),pkg:path.join(root,'package.json')};
for(const [name,file] of Object.entries(files))if(!fs.existsSync(file))throw Error(`Missing ${name}: ${file}`);
const stamp=Date.now();
for(const file of Object.values(files))fs.copyFileSync(file,`${file}.before-v97.${stamp}`);
let server=fs.readFileSync(files.server,'utf8');
let app=fs.readFileSync(files.app,'utf8');
// The item endpoint uses the current adaptive worker count for every call/retry round.
server=server.replace(/const workers=Math\.min\(10,queue\.length\)/g,"const workers=Math.min(require('./src/aps').getAdaptiveState().concurrency,queue.length)");
server=server.replace(/version:'v\d+',package:'1\.0\.\d+'/,"version:'v97',package:'1.0.97'");
// Show the current adaptive workers returned by the server rather than a fixed 10.
app=app.replace("let done=0,imported=0,failed=0,parentDone=0,retryRound=0;", "let done=0,imported=0,failed=0,parentDone=0,retryRound=0,workers=6;");
app=app.replace(/\| Workers 10 \| Retry round/g,'| Workers ${workers} | Retry round');
app=app.replace("const source=new Map(current.map(row=>[Number(row.displayRowNumber),row]));", "workers=result.adaptiveState?.concurrency||workers;const source=new Map(current.map(row=>[Number(row.displayRowNumber),row]));");
app=app.replace(/workers:10/g,'workers:"adaptive 1-10"');
// Adaptive APS control: start 6, increase after 25 successes, reduce immediately on 429.
const aps=`const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let adaptiveConcurrency=6,successStreak=0,retryCount=0,blockedUntil=0,lastThrottleAt=0,lastRetryAfterSeconds=0;
const levels=[1,2,4,6,8,10];
async function waitForGate(){const wait=Math.max(0,blockedUntil-Date.now());if(wait)await sleep(wait)}
function increaseAfterSuccess(){successStreak++;if(successStreak<25)return;successStreak=0;const index=levels.indexOf(adaptiveConcurrency);if(index>=0&&index<levels.length-1)adaptiveConcurrency=levels[index+1]}
function reduceAfterThrottle(){successStreak=0;lastThrottleAt=Date.now();if(adaptiveConcurrency>=8)adaptiveConcurrency=5;else if(adaptiveConcurrency>=5)adaptiveConcurrency=2;else adaptiveConcurrency=1}
async function raw(method,token,url,payload){if(url.includes('/cost/v1/'))await waitForGate();const headers={Authorization:\`Bearer \${token}\`,Accept:'application/json'};if(payload!==undefined)headers['Content-Type']='application/json';if(process.env.APS_COST_REGION&&url.includes('/cost/v1/'))headers.Region=process.env.APS_COST_REGION;const response=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)}),text=await response.text();let body;try{body=text?JSON.parse(text):null}catch{body=text}if(response.ok){increaseAfterSuccess();return body}if(response.status===429){retryCount++;reduceAfterThrottle();const retryAfter=Number(response.headers.get('retry-after'));lastRetryAfterSeconds=Number.isFinite(retryAfter)&&retryAfter>0?retryAfter:30;blockedUntil=Math.max(blockedUntil,Date.now()+lastRetryAfterSeconds*1000)}throw Error(\`APS \${method} \${url} failed (\${response.status}): \${typeof body==='string'?body:JSON.stringify(body,null,2)}\`)}
module.exports={get:(t,u)=>raw('GET',t,u),post:(t,u,p)=>raw('POST',t,u,p),patch:(t,u,p)=>raw('PATCH',t,u,p),getAdaptiveState:()=>({concurrency:adaptiveConcurrency,retryCount,blockedUntil,lastThrottleAt,lastRetryAfterSeconds,successStreak})};
`;
fs.writeFileSync(files.server,server);fs.writeFileSync(files.app,app);fs.writeFileSync(files.aps,aps);
const pkg=JSON.parse(fs.readFileSync(files.pkg,'utf8'));pkg.version='1.0.97';fs.writeFileSync(files.pkg,JSON.stringify(pkg));
console.log('v97 applied. Smart workers start at 6 and scale from 1 to 10.');
console.log('Temporary failed items remain in the v96 pending queue and retry after 30 seconds.');
console.log('Backups use suffix:',`before-v97.${stamp}`);
