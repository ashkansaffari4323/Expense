let lastCostRequest=null;
async function parse(r){const t=await r.text();if(!t)return null;try{return JSON.parse(t)}catch{return t}}
function err(m,u,r,b){return new Error(`APS ${m} ${u} failed (${r.status}): ${typeof b==="string"?b:JSON.stringify(b,null,2)}`)}
function headers(token,url,json=false){const h={Authorization:`Bearer ${token}`,Accept:"application/json"};if(json)h["Content-Type"]="application/json";if(process.env.APS_COST_REGION&&url.includes("developer.api.autodesk.com/cost/v1"))h.Region=process.env.APS_COST_REGION;return h}
function rec(m,u,h,b){if(!u.includes("developer.api.autodesk.com/cost/v1"))return;lastCostRequest={method:m,url:u,headers:{...h,Authorization:"Bearer [hidden]"},body:b,at:new Date().toISOString()};console.log("Cost API request",lastCostRequest)}
async function apsGet(token,u){const h=headers(token,u);rec("GET",u,h);const r=await fetch(u,{method:"GET",headers:h});const b=await parse(r);if(!r.ok)throw err("GET",u,r,b);return b}
async function apsPost(token,u,p){const h=headers(token,u,true);rec("POST",u,h,p||{});const r=await fetch(u,{method:"POST",headers:h,body:JSON.stringify(p||{})});const b=await parse(r);if(!r.ok)throw err("POST",u,r,b);return b}
async function apsPatch(token,u,p){const h=headers(token,u,true);rec("PATCH",u,h,p||{});const r=await fetch(u,{method:"PATCH",headers:h,body:JSON.stringify(p||{})});const b=await parse(r);if(!r.ok)throw err("PATCH",u,r,b);return b}
function getLastCostRequest(){return lastCostRequest}
module.exports={apsGet,apsPost,apsPatch,getLastCostRequest};
