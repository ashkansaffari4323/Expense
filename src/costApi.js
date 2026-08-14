const {apsGet,apsPost,apsPatch}=require("./apsClient");
const DATA="https://developer.api.autodesk.com/project/v1",COST="https://developer.api.autodesk.com/cost/v1";
function stripB(v){return String(v||"").replace(/^b\./,"")}
function isJwt(v){const t=String(v||"");return t.split(".").length===3&&t.length>100}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""))}
function getCostContainerId(a,b){const c=b||a;if(isJwt(c))throw new Error("Internal routing error: OAuth token was passed as containerId.");const id=stripB(c);if(!isUuid(id))throw new Error(`Invalid Cost containerId: ${id}. Expected UUID.`);return id}
async function getHubs(t){const d=await apsGet(t,`${DATA}/hubs`);return d.data||[]}
async function getProjects(t,hub){const d=await apsGet(t,`${DATA}/hubs/${encodeURIComponent(hub)}/projects`);return(d.data||[]).map(p=>({id:stripB(p.id),rawId:p.id,name:p.attributes?.name||p.name||p.id}))}
function costErr(label,id,e){return new Error(`${label} failed.\n\nCost containerId sent: ${id}\n\nEndpoint uses project ID as container ID with no b. prefix.\n\nAutodesk response:\n${e.message}`)}
async function getBudgets(t,id){id=getCostContainerId(id);try{const d=await apsGet(t,`${COST}/containers/${encodeURIComponent(id)}/budgets?limit=100&sort=name`);return d.results||d.data||[]}catch(e){throw costErr("Budgets",id,e)}}
async function getBudgetById(t,id,bid){id=getCostContainerId(id);try{return await apsGet(t,`${COST}/containers/${encodeURIComponent(id)}/budgets/${encodeURIComponent(bid)}`)}catch(e){throw costErr("Budget detail",id,e)}}
async function createExpense(t,id,p){id=getCostContainerId(id);try{return await apsPost(t,`${COST}/containers/${encodeURIComponent(id)}/expenses`,p)}catch(e){throw costErr("Create expense",id,e)}}
async function createExpenseItem(t,id,eid,p){id=getCostContainerId(id);try{return await apsPost(t,`${COST}/containers/${encodeURIComponent(id)}/expenses/${encodeURIComponent(eid)}/items`,p)}catch(e){throw costErr("Create expense item",id,e)}}
async function updateExpense(t,id,eid,p){id=getCostContainerId(id);try{return await apsPatch(t,`${COST}/containers/${encodeURIComponent(id)}/expenses/${encodeURIComponent(eid)}`,p)}catch(e){throw costErr("Update expense",id,e)}}
module.exports={stripB,getHubs,getProjects,getCostContainerId,getBudgets,getBudgetById,createExpense,createExpenseItem,updateExpense};
