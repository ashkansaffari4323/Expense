require("dotenv").config();
const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { buildAuthorizeUrl, exchangeCodeForToken, ensureValidToken } = require("./src/auth");
const { getLastCostRequest } = require("./src/apsClient");
const { getHubs, getProjects, getCostContainerId, getBudgets, getBudgetById, createExpense, createExpenseItem, updateExpense } = require("./src/costApi");
const { getProjectCompanies } = require("./src/adminApi");
const { buildExpenseImportTemplate, parseExpenseImportFile } = require("./src/templates");

const app = express(); const PORT = process.env.PORT || 4000; const upload = multer({ storage: multer.memoryStorage() });
app.use(express.json({ limit: "10mb" }));
app.use(session({ secret: process.env.SESSION_SECRET || "dev-secret", resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: "lax" } }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/api/version", (req, res) => res.json({ ok: true, version: "v25", design: "3LO Cost, project ID as container ID, Region AUS, project company dropdown via 2LO account:read" }));
app.get("/api/debug/last-cost-request", (req, res) => res.json({ ok: true, lastCostRequest: getLastCostRequest() }));
app.get("/api/auth/login", (req, res) => { const state = crypto.randomBytes(16).toString("hex"); req.session.oauthState = state; res.redirect(buildAuthorizeUrl(state)); });
app.get("/api/auth/callback", async (req, res) => { try { const { code, state, error, error_description } = req.query; if (error) return res.status(400).send(`Autodesk sign-in failed: ${error_description || error}`); if (!code || state !== req.session.oauthState) return res.status(400).send("Invalid OAuth callback"); const token = await exchangeCodeForToken(code); req.session.aps = { access_token: token.access_token, refresh_token: token.refresh_token, expires_at: Date.now() + token.expires_in * 1000 }; delete req.session.oauthState; res.redirect("/"); } catch (err) { res.status(500).send("OAuth callback failed"); } });
app.get("/api/auth/status", (req, res) => res.json({ signedIn: !!req.session.aps }));
app.post("/api/auth/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/hubs", ensureValidToken, async (req, res) => { try { const hubs = await getHubs(req.session.aps.access_token); res.json(hubs.map(h => ({ id: h.id, name: h.attributes?.name || h.name || h.id }))); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get("/api/hubs/:hubId/projects", ensureValidToken, async (req, res) => { try { res.json(await getProjects(req.session.aps.access_token, req.params.hubId)); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get("/api/hubs/:hubId/projects/:projectId/companies", ensureValidToken, async (req, res) => { try { res.json(await getProjectCompanies(req.params.hubId, req.params.projectId)); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get("/api/projects/:projectId/budgets", ensureValidToken, async (req, res) => { try { const containerId = getCostContainerId(req.params.projectId); const budgets = await getBudgets(req.session.aps.access_token, containerId); res.json({ containerId, budgets }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get("/api/projects/:projectId/budgets/:budgetId", ensureValidToken, async (req, res) => { try { const containerId = getCostContainerId(req.params.projectId); const budget = await getBudgetById(req.session.aps.access_token, containerId, req.params.budgetId); res.json({ containerId, budget }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get("/api/hubs/:hubId/projects/:projectId/templates/expense-import", ensureValidToken, async (req, res) => { try { const token = req.session.aps.access_token; const containerId = getCostContainerId(req.params.projectId); const [budgets, companies] = await Promise.all([getBudgets(token, containerId), getProjectCompanies(req.params.hubId, req.params.projectId).catch(() => [])]); const buffer = await buildExpenseImportTemplate({ budgets, companies }); res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", "attachment; filename=expense-import-template-with-budgets-companies.xlsx"); res.send(Buffer.from(buffer)); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post("/api/hubs/:hubId/projects/:projectId/import-excel", ensureValidToken, upload.single("file"), async (req, res) => { try { if (!req.file) return res.status(400).json({ error: "No Excel file uploaded" }); const token = req.session.aps.access_token; const containerId = getCostContainerId(req.params.projectId); const [budgets, companies] = await Promise.all([getBudgets(token, containerId), getProjectCompanies(req.params.hubId, req.params.projectId).catch(() => [])]); const rows = await parseExpenseImportFile(req.file.buffer, budgets, companies); res.json({ ok: true, containerId, rows }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post("/api/projects/:projectId/expenses", ensureValidToken, async (req, res) => {
  try {
    const token = req.session.aps.access_token;
    const containerId = getCostContainerId(req.params.projectId);
    const requestedStatus = String(req.body.status || "approved").toLowerCase();

    // Always create as draft first because many ACC Cost projects block direct non-draft creation
    // when expense approval workflows/reviews are configured.
    const expensePayload = {
      supplierName: req.body.supplierName || null,
      name: req.body.expenseName || req.body.name || "Imported Expense",
      referenceNumber: req.body.referenceNumber || req.body.invoiceNumber || "",
      description: req.body.description || "",
      type: req.body.type || "Invoice",
      status: "draft"
    };

    if (req.body.supplierCompanyUid) expensePayload.supplierCompanyUid = req.body.supplierCompanyUid;
    if (req.body.issuedAt) expensePayload.issuedAt = req.body.issuedAt;
    if (req.body.receivedAt) expensePayload.receivedAt = req.body.receivedAt;
    if (req.body.paymentDue) expensePayload.paymentDue = req.body.paymentDue;
    if (req.body.paidAt) expensePayload.paidAt = req.body.paidAt;

    const expense = await createExpense(token, containerId, expensePayload);

    let expenseItem = null;
    if (expense?.id && req.body.budgetId) {
      const amount = req.body.amount === undefined || req.body.amount === null || req.body.amount === "" ? 0 : Number(req.body.amount);
      expenseItem = await createExpenseItem(token, containerId, expense.id, {
        budgetId: req.body.budgetId,
        name: req.body.itemName || req.body.itemDescription || req.body.expenseName || "Imported Expense Item",
        description: req.body.itemDescription || req.body.description || "",
        scope: req.body.scope || "full",
        quantity: req.body.quantity || 1,
        unitPrice: req.body.unitPrice || amount,
        unit: req.body.unit || "ls",
        amount,
        exchangeRate: req.body.exchangeRate || 1
      });
    }

    let finalExpense = expense;
    let finalStatus = "draft";
    let approvalAttempt = null;

    // User-requested behaviour: try to approve automatically, but if workflow/review blocks it,
    // keep the created expense as draft instead of failing the whole row.
    if (["approved", "paid", "pending"].includes(requestedStatus) && expense?.id) {
      try {
        finalExpense = await updateExpense(token, containerId, expense.id, { status: requestedStatus });
        finalStatus = requestedStatus;
        approvalAttempt = { ok: true, requestedStatus, finalStatus };
      } catch (approvalError) {
        approvalAttempt = {
          ok: false,
          requestedStatus,
          finalStatus: "draft",
          fallback: "draft",
          message: "Autodesk blocked automatic status update, likely because an expense approval/review workflow is configured. Expense was kept as draft.",
          autodeskError: approvalError.message
        };
      }
    }

    res.json({
      ok: true,
      containerId,
      requestedStatus,
      finalStatus,
      expense: finalExpense,
      expenseItem,
      approvalAttempt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.patch("/api/projects/:projectId/expenses/:expenseId", ensureValidToken, async (req, res) => { try { const containerId = getCostContainerId(req.params.projectId); const expense = await updateExpense(req.session.aps.access_token, containerId, req.params.expenseId, req.body); res.json({ ok: true, expense }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.listen(PORT, () => console.log(`ACC Expense app v25 running on http://localhost:${PORT}`));
