let lastCostRequest = null;

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

function errorFor(method, url, response, body) {
  const detail = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  return new Error(`APS ${method} ${url} failed (${response.status}): ${detail}`);
}

function headers(accessToken, url, json = false) {
  const h = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  if (process.env.APS_COST_REGION && url.includes("developer.api.autodesk.com/cost/v1")) {
    h.Region = process.env.APS_COST_REGION;
  }
  return h;
}

function recordCostRequest(method, url, requestHeaders, body) {
  if (!url.includes("developer.api.autodesk.com/cost/v1")) return;
  lastCostRequest = {
    method,
    url,
    headers: { ...requestHeaders, Authorization: "Bearer [hidden]" },
    body: body || undefined,
    at: new Date().toISOString()
  };
  console.log("Cost API request", lastCostRequest);
}

async function apsGet(accessToken, url) {
  const requestHeaders = headers(accessToken, url);
  recordCostRequest("GET", url, requestHeaders);
  const response = await fetch(url, { method: "GET", headers: requestHeaders });
  const body = await parseResponse(response);
  if (!response.ok) throw errorFor("GET", url, response, body);
  return body;
}

async function apsPost(accessToken, url, payload) {
  const requestHeaders = headers(accessToken, url, true);
  recordCostRequest("POST", url, requestHeaders, payload || {});
  const response = await fetch(url, { method: "POST", headers: requestHeaders, body: JSON.stringify(payload || {}) });
  const body = await parseResponse(response);
  if (!response.ok) throw errorFor("POST", url, response, body);
  return body;
}

async function apsPatch(accessToken, url, payload) {
  const requestHeaders = headers(accessToken, url, true);
  recordCostRequest("PATCH", url, requestHeaders, payload || {});
  const response = await fetch(url, { method: "PATCH", headers: requestHeaders, body: JSON.stringify(payload || {}) });
  const body = await parseResponse(response);
  if (!response.ok) throw errorFor("PATCH", url, response, body);
  return body;
}

function getLastCostRequest() { return lastCostRequest; }

module.exports = { apsGet, apsPost, apsPatch, getLastCostRequest };
