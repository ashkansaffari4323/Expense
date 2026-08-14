const { stripB } = require("./costApi");

let cachedToken = null;

async function getTwoLeggedToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.accessToken;

  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("APS_CLIENT_ID and APS_CLIENT_SECRET are required for company lookup.");

  const body = new URLSearchParams({ grant_type: "client_credentials", scope: process.env.APS_2LO_SCOPES || "account:read" });
  const response = await fetch("https://developer.api.autodesk.com/authentication/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64") },
    body
  });

  if (!response.ok) throw new Error(`2-legged token failed (${response.status}): ${await response.text()}`);
  const token = await response.json();
  cachedToken = { accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return cachedToken.accessToken;
}

async function getProjectCompanies(hubId, projectId) {
  const accountId = stripB(hubId);
  const cleanProjectId = stripB(projectId);
  const token = await getTwoLeggedToken();
  const companies = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `https://developer.api.autodesk.com/hq/v1/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(cleanProjectId)}/companies?limit=${limit}&offset=${offset}&sort=name`;
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (process.env.APS_ADMIN_REGION) headers.Region = process.env.APS_ADMIN_REGION;

    const response = await fetch(url, { method: "GET", headers });
    const text = await response.text();
    const body = text ? JSON.parse(text) : [];

    if (!response.ok) {
      const detail = typeof body === "string" ? body : JSON.stringify(body, null, 2);
      throw new Error(`Company lookup failed (${response.status}): ${detail}`);
    }

    companies.push(...body);
    if (!Array.isArray(body) || body.length < limit) break;
    offset += limit;
  }

  return companies.map((company) => ({
    id: company.id || "",
    name: company.name || company.id || "",
    memberGroupId: company.member_group_id || "",
    trade: company.trade || "",
    erpId: company.erp_id || ""
  })).sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { getTwoLeggedToken, getProjectCompanies };
