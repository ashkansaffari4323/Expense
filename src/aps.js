const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let itemPostGate = Promise.resolve();
let nextItemPostAt = 0;
let blockedUntil = 0;
let retryCount = 0;
let lastRetryAfterSeconds = 0;

const ITEM_POST_SPACING_MS = 3200;

function isExpenseItemPost(method, url) {
  return method === 'POST' && /\/cost\/v1\/containers\/[^/]+\/expenses\/[^/]+\/items(?:\?|$)/.test(url);
}

async function reserveItemPost() {
  const reserve = async () => {
    const waitMs = Math.max(0, nextItemPostAt - Date.now(), blockedUntil - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    nextItemPostAt = Date.now() + ITEM_POST_SPACING_MS;
  };
  const current = itemPostGate.then(reserve, reserve);
  itemPostGate = current.catch(() => undefined);
  await current;
}

async function raw(method, token, url, payload) {
  if (isExpenseItemPost(method, url)) await reserveItemPost();

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (process.env.APS_COST_REGION && url.includes('/cost/v1/')) {
    headers.Region = process.env.APS_COST_REGION;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (response.ok) return body;

  if (response.status === 429) {
    retryCount++;
    const retryAfter = Number(response.headers.get('retry-after'));
    lastRetryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30;
    blockedUntil = Math.max(
      blockedUntil,
      Date.now() + Math.max(30, lastRetryAfterSeconds) * 1000
    );
  }

  throw Error(`APS ${method} ${url} failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body, null, 2)}`);
}

module.exports = {
  get: (token, url) => raw('GET', token, url),
  post: (token, url, payload) => raw('POST', token, url, payload),
  patch: (token, url, payload) => raw('PATCH', token, url, payload),
  getAdaptiveState: () => ({
    concurrency: 2,
    retryCount,
    blockedUntil,
    lastRetryAfterSeconds,
    itemPostSpacingMs: ITEM_POST_SPACING_MS,
    itemPostStartsPerMinute: 18.75
  })
};
