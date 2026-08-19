let last=null;
async function parse(r){const t=await r.text();try{return t?JSON.parse(t):null;}catch{return t;}}
function headers(token,url,json=false){const h={Authorization:`Bearer ${token}`,Accept:"application/json"};if(json)h["Content-Type"]="application/json";if(process.env.APS_COST_REGION&&url.includes("/cost/v1/"))h.Region=process.env.APS_COST_REGION;return h;}
async function req(method,token,url,payload){const h=headers(token,url,!!payload);if(url.includes("/cost/v1/"))last={method,url,headers:{...h,Authorization:"Bearer [hidden]"},body:payload};const r=await fetch(url,{method,headers:h,body:payload?JSON.stringify(payload):undefined});const b=await parse(r);if(!r.ok)throw new Error(`APS ${method} ${url} failed (${r.status}): ${typeof b==="string"?b:JSON.stringify(b,null,2)}`);return b;}
module.exports={get:(t,u)=>req("GET",t,u),post:(t,u,p)=>req("POST",t,u,p),patch:(t,u,p)=>req("PATCH",t,u,p),last:()=>last};
