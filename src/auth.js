const APS_AUTH_BASE = "https://developer.api.autodesk.com/authentication/v2";

function getConfig() {
  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;
  const callbackUrl = process.env.APS_CALLBACK_URL;
  const scopes = process.env.APS_SCOPES || "data:read data:write account:read";
  const missing = [];
  if (!clientId) missing.push("APS_CLIENT_ID");
  if (!clientSecret) missing.push("APS_CLIENT_SECRET");
  if (!callbackUrl) missing.push("APS_CALLBACK_URL");
  if (missing.length) throw new Error(`Missing .env values: ${missing.join(", ")}`);
  return { clientId, clientSecret, callbackUrl, scopes };
}

function basicAuth(clientId, clientSecret) {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

function buildAuthorizeUrl(state) {
  const { clientId, callbackUrl, scopes } = getConfig();
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: callbackUrl, scope: scopes, state });
  return `${APS_AUTH_BASE}/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const { clientId, clientSecret, callbackUrl } = getConfig();
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl });
  const response = await fetch(`${APS_AUTH_BASE}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth(clientId, clientSecret) }, body });
  if (!response.ok) throw new Error(`Token exchange failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function refreshToken(refreshTokenValue) {
  const { clientId, clientSecret, scopes } = getConfig();
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshTokenValue, scope: scopes });
  const response = await fetch(`${APS_AUTH_BASE}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth(clientId, clientSecret) }, body });
  if (!response.ok) throw new Error(`Token refresh failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function ensureValidToken(req, res, next) {
  const aps = req.session.aps;
  if (!aps || !aps.refresh_token) return res.status(401).json({ error: "Not signed in to Autodesk" });
  if (Date.now() < aps.expires_at - 60000) return next();
  try {
    const fresh = await refreshToken(aps.refresh_token);
    req.session.aps = { access_token: fresh.access_token, refresh_token: fresh.refresh_token || aps.refresh_token, expires_at: Date.now() + fresh.expires_in * 1000 };
    next();
  } catch (err) {
    req.session.aps = null;
    res.status(401).json({ error: "Session expired, sign in again" });
  }
}

module.exports = { buildAuthorizeUrl, exchangeCodeForToken, refreshToken, ensureValidToken };
