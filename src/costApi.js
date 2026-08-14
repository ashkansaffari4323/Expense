const { apsGet, apsPost, apsPatch } = require("./apsClient");

const DATA_MGMT_BASE = "https://developer.api.autodesk.com/project/v1";
const COST_BASE = "https://developer.api.autodesk.com/cost/v1";

function stripB(value) { return String(value || "").replace(/^b\./, ""); }
function looksLikeJwt(value) { const text = String(value || ""); return text.split(".").length === 3 && text.length > 100; }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "")); }
function getCostContainerId(firstArg, secondArg) {
  const candidate = secondArg || firstArg;
  if (looksLikeJwt(candidate)) throw new Error("Internal routing error: OAuth access token was passed as project/container ID.");
  const id = stripB(candidate);
  if (!isUuid(id)) throw new Error(`Invalid Cost containerId: ${id}. Expected UUID.`);
  return id;
}

async function getHubs(accessToken) {
  const data = await apsGet(accessToken, `${DATA_MGMT_BASE}/hubs`);
  return data.data || [];
}

async function getProjects(accessToken, hubId) {
  const data = await apsGet(accessToken, `${DATA_MGMT_BASE}/hubs/${encodeURIComponent(hubId)}/projects`);
  return (data.data || []).map((project) => ({ id: stripB(project.id), rawId: project.id, name: project.attributes?.name || project.name || project.id }));
}

function costError(label, containerId, err) {
  return new Error(`${label} failed.\n\nCost containerId sent: ${containerId}\n\nEndpoint uses project ID as container ID with no b. prefix.\n\nAutodesk response:\n${err.message}`);
}

async function getBudgets(accessToken, containerId) {
  const id = getCostContainerId(containerId);
  const url = `${COST_BASE}/containers/${encodeURIComponent(id)}/budgets?limit=100&sort=name`;
  try { const data = await apsGet(accessToken, url); return data.results || data.data || []; } catch (err) { throw costError("Budgets", id, err); }
}

async function getBudgetById(accessToken, containerId, budgetId) {
  const id = getCostContainerId(containerId);
  const url = `${COST_BASE}/containers/${encodeURIComponent(id)}/budgets/${encodeURIComponent(budgetId)}`;
  try { return await apsGet(accessToken, url); } catch (err) { throw costError("Budget detail", id, err); }
}

async function createExpense(accessToken, containerId, payload) {
  const id = getCostContainerId(containerId);
  const url = `${COST_BASE}/containers/${encodeURIComponent(id)}/expenses`;
  try { return await apsPost(accessToken, url, payload); } catch (err) { throw costError("Create expense", id, err); }
}

async function createExpenseItem(accessToken, containerId, expenseId, payload) {
  const id = getCostContainerId(containerId);
  const url = `${COST_BASE}/containers/${encodeURIComponent(id)}/expenses/${encodeURIComponent(expenseId)}/items`;
  try { return await apsPost(accessToken, url, payload); } catch (err) { throw costError("Create expense item", id, err); }
}

async function updateExpense(accessToken, containerId, expenseId, payload) {
  const id = getCostContainerId(containerId);
  const url = `${COST_BASE}/containers/${encodeURIComponent(id)}/expenses/${encodeURIComponent(expenseId)}`;
  try { return await apsPatch(accessToken, url, payload); } catch (err) { throw costError("Update expense", id, err); }
}

module.exports = { stripB, getHubs, getProjects, getCostContainerId, getBudgets, getBudgetById, createExpense, createExpenseItem, updateExpense };
