const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let costQueue = Promise.resolve();
let nextCostRequestAt = 0;
const MIN_COST_SPACING_MS = Number(process.env.APS_COST_REQUEST_SPACING_MS || 2000);

async function scheduleCostRequest(task) {
  const run = async () => {
    const waitMs = Math.max(0, nextCostRequestAt - Date.now());
    if (waitMs) await sleep(waitMs);
    nextCostRequestAt = Date.now() + MIN_COST_SPACING_MS;
    return task();
  };
  const result = costQueue.then(run, run);
  costQueue = result.catch(() => undefined);
  return result;
}

async function rawRequest(method, token, url, payload, attempt = 0) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (process.env.APS_COST_REGION && url.includes('/cost/v1/')) headers.Region = process.env.APS_COST_REGION;
  const response = await fetch(url, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload) });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (response.ok) return body;
  const retryable = [429, 500, 502, 503, 504].includes(response.status);
  if (retryable && attempt < 6) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const fallbackSeconds = [10, 20, 40, 80, 120, 180][attempt] || 180;
    const delayMs = ((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : fallbackSeconds) + 5) * 1000;
    await sleep(delayMs);
    return rawRequest(method, token, url, payload, attempt + 1);
  }
  throw new Error(`APS ${method} ${url} failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body, null, 2)}`);
}

async function request(method, token, url, payload) {
  if (url.includes('/cost/v1/')) return scheduleCostRequest(() => rawRequest(method, token, url, payload));
  return rawRequest(method, token, url, payload);
}

module.exports = {
  get: (token, url) => request('GET', token, url),
  post: (token, url, payload) => request('POST', token, url, payload),
  patch: (token, url, payload) => request('PATCH', token, url, payload)
};
