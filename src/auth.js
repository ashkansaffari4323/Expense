const crypto = require("crypto");
const BASE = "https://developer.api.autodesk.com/authentication/v2";
const COOKIE = "aps_auth";
function cfg(){const c=process.env.APS_CLIENT_ID,s=process.env.APS_CLIENT_SECRET,cb=process.env.APS_CALLBACK_URL,sc=process.env.APS_SCOPES||"data:read data:write account:read";if(!c||!s||!cb)throw new Error("Missing APS env values");return{c,s,cb,sc};}
function secret(){return process.env.SESSION_SECRET||"change-me";}
function sign(v){return crypto.createHmac("sha256",secret()).update(v).digest("base64url");}
function state(){const n=crypto.randomBytes(16).toString("hex");return `${n}.${sign(n)}`;}
function valid(st){const [n,s]=String(st||"").split(".");if(!n||!s)return false;try{return crypto.timingSafeEqual(Buffer.from(s),Buffer.from(sign(n)));}catch{return false;}}
function encrypt(v){const key=crypto.createHash("sha256").update(secret()).digest(),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);const data=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(v))),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url");}
function decrypt(v){try{const raw=Buffer.from(v||"","base64url"),iv=raw.subarray(0,12),tag=raw.subarray(12,28),data=raw.subarray(28),key=crypto.createHash("sha256").update(secret()).digest(),d=crypto.createDecipheriv("aes-256-gcm",key,iv);d.setAuthTag(tag);return JSON.parse(Buffer.concat([d.update(data),d.final()]).toString());}catch{return null;}}
function cookies(req){const out={};for(const p of String(req.headers.cookie||"").split(";")){const i=p.indexOf("=");if(i>-1)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim());}return out;}
function set(res,v){const secure=String(process.env.APS_CALLBACK_URL||"").startsWith("https://")?"; Secure":"";res.setHeader("Set-Cookie",`${COOKIE}=${encodeURIComponent(encrypt(v))}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=604800`);}
function clear(res){res.setHeader("Set-Cookie",`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);}
function get(req){return decrypt(cookies(req)[COOKIE]);}
function loginUrl(st){const{c,cb,sc}=cfg();return `${BASE}/authorize?`+new URLSearchParams({response_type:"code",client_id:c,redirect_uri:cb,scope:sc,state:st}).toString();}
async function exchange(code){const{c,s,cb}=cfg();const r=await fetch(`${BASE}/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:"Basic "+Buffer.from(`${c}:${s}`).toString("base64")},body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:cb})});if(!r.ok)throw new Error(await r.text());return r.json();}
async function refresh(rt){const{c,s,sc}=cfg();const r=await fetch(`${BASE}/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:"Basic "+Buffer.from(`${c}:${s}`).toString("base64")},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:rt,scope:sc})});if(!r.ok)throw new Error(await r.text());return r.json();}
async function ensure(req,res,next){let a=get(req);if(!a?.refresh_token)return res.status(401).json({error:"Not signed in"});if(Date.now()>a.expires_at-60000){try{const t=await refresh(a.refresh_token);a={access_token:t.access_token,refresh_token:t.refresh_token||a.refresh_token,expires_at:Date.now()+t.expires_in*1000};set(res,a);}catch{clear(res);return res.status(401).json({error:"Session expired"});}}req.aps=a;next();}
module.exports={state,valid,loginUrl,exchange,set,clear,get,ensure};
