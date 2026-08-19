const aps=require("./aps");
const DATA="https://developer.api.autodesk.com/project/v1";
const COST="https://developer.api.autodesk.com/cost/v1";
const stripB=v=>String(v||"").replace(/^b\./,"");
function pid(v){v=stripB(v);if(!/^[0-9a-f-]{36}$/i.test(v))throw new Error(`Invalid project/container id ${v}`);return v;}
async function hubs(t){const d=await aps.get(t,`${DATA}/hubs`);return d.data||[];}
async function projects(t,hub){const d=await aps.get(t,`${DATA}/hubs/${encodeURIComponent(hub)}/projects`);return(d.data||[]).map(p=>({id:stripB(p.id),rawId:p.id,name:p.attributes?.name||p.id})).sort((a,b)=>a.name.localeCompare(b.name));}
async function budgets(t,p){p=pid(p);const d=await aps.get(t,`${COST}/containers/${p}/budgets?limit=100&sort=name`);return d.results||d.data||[];}
async function expenses(t,p){p=pid(p);let out=[],off=0;while(true){const d=await aps.get(t,`${COST}/containers/${p}/expenses?limit=100&offset=${off}&sort=name`);const arr=d.results||d.data||[];out.push(...arr);if(arr.length<100)break;off+=100;}return out;}
async function createExpense(t,p,payload){return aps.post(t,`${COST}/containers/${pid(p)}/expenses`,payload);}
async function createItem(t,p,eid,payload){return aps.post(t,`${COST}/containers/${pid(p)}/expenses/${encodeURIComponent(eid)}/items`,payload);}
async function updateExpense(t,p,eid,payload){return aps.patch(t,`${COST}/containers/${pid(p)}/expenses/${encodeURIComponent(eid)}`,payload);}
module.exports={stripB,pid,hubs,projects,budgets,expenses,createExpense,createItem,updateExpense};
