const ExcelJS = require("exceljs");

const HEADERS = ["Supplier Company", "Invoice Number", "Reference Number", "Expense Name", "Expense Description", "Issue Date", "Received Date", "Payment Due Date", "Budget", "Expense Item Name", "Expense Item Description", "Quantity", "Unit", "Unit Price", "Amount", "Status"];
const REQUIRED = ["Supplier Company", "Invoice Number", "Budget", "Expense Item Name", "Quantity", "Unit", "Unit Price", "Amount"];
const norm = (v) => String(v || "").trim().toLowerCase();

function budgetLabel(b) { return `${b.code || "No Code"} - ${b.name || b.id} [${b.id}]`; }
function companyLabel(c) { return `${c.name || c.id} [${c.id}]`; }
function lookupBudget(budgets) {
  const map = new Map();
  for (const b of budgets || []) {
    map.set(norm(budgetLabel(b)), b); if (b.id) map.set(norm(b.id), b); if (b.code) map.set(norm(b.code), b); if (b.name) map.set(norm(b.name), b);
  }
  return map;
}
function lookupCompany(companies) {
  const map = new Map();
  for (const c of companies || []) {
    map.set(norm(companyLabel(c)), c); if (c.name) map.set(norm(c.name), c); if (c.id) map.set(norm(c.id), c); if (c.memberGroupId) map.set(norm(c.memberGroupId), c);
  }
  return map;
}
function cell(row, headerMap, name) {
  const idx = headerMap[norm(name)]; if (!idx) return "";
  const v = row.getCell(idx).value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object" && v.text) return String(v.text).trim();
  if (typeof v === "object" && v.result !== undefined) return String(v.result).trim();
  return String(v).trim();
}
function iso(v, name, rowNum) {
  if (!v) return ""; if (v instanceof Date) return v.toISOString();
  const t = String(v).trim(); if (!t) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t}T00:00:00.000Z`; if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t;
  const d = new Date(t); if (!Number.isNaN(d.getTime()) && /\d/.test(t)) return d.toISOString();
  throw new Error(`Invalid date row ${rowNum}, column ${name}: ${t}. Use YYYY-MM-DD.`);
}
function num(v, name, rowNum, def = 0) { if (v === "" || v === null || v === undefined) return def; const n = Number(v); if (Number.isNaN(n)) throw new Error(`Invalid number row ${rowNum}, column ${name}: ${v}.`); return n; }
function style(sheet) {
  sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: "A1", to: "P1" };
  [30,18,18,30,32,16,16,18,48,28,32,12,10,14,14,14].forEach((w, i) => sheet.getColumn(i + 1).width = w);
}

async function buildExpenseImportTemplate({ budgets = [], companies = [] } = {}) {
  const wb = new ExcelJS.Workbook(); wb.creator = "ACC Expense Importer";
  const sheet = wb.addWorksheet("Expenses"); sheet.addRow(HEADERS);
  const sampleCompany = companies[0] ? companyLabel(companies[0]) : "Type supplier name or select a company";
  const sampleBudget = budgets[0] ? budgetLabel(budgets[0]) : "Load project budgets first";
  sheet.addRow([sampleCompany, "INV-001", "INV-001", "ABC Electrical Pty Ltd - INV-001", "Progress claim", "2026-08-01", "2026-08-02", "2026-09-01", sampleBudget, "Labour and materials", "Labour and materials", 1, "ls", 5000, 5000, "draft"]);
  style(sheet); sheet.getColumn(6).numFmt = "yyyy-mm-dd"; sheet.getColumn(7).numFmt = "yyyy-mm-dd"; sheet.getColumn(8).numFmt = "yyyy-mm-dd";

  const budgetSheet = wb.addWorksheet("Budget Lookup"); budgetSheet.addRow(["Budget", "Budget ID", "Code", "Name"]);
  for (const b of budgets || []) budgetSheet.addRow([budgetLabel(b), b.id || "", b.code || "", b.name || ""]);
  budgetSheet.getRow(1).font = { bold: true }; budgetSheet.columns = [{ width: 60 }, { width: 40 }, { width: 20 }, { width: 40 }];

  const companySheet = wb.addWorksheet("Company Lookup"); companySheet.addRow(["Supplier Company", "Company ID", "Member Group ID", "Trade"]);
  for (const c of companies || []) companySheet.addRow([companyLabel(c), c.id || "", c.memberGroupId || "", c.trade || ""]);
  companySheet.getRow(1).font = { bold: true }; companySheet.columns = [{ width: 60 }, { width: 40 }, { width: 25 }, { width: 25 }];

  const lastBudgetRow = Math.max(2, budgets.length + 1);
  const lastCompanyRow = Math.max(2, companies.length + 1);
  for (let r = 2; r <= 501; r++) {
    sheet.getCell(`I${r}`).dataValidation = { type: "list", allowBlank: false, formulae: [`'Budget Lookup'!$A$2:$A$${lastBudgetRow}`], showErrorMessage: true, errorTitle: "Select budget", error: "Choose a budget from the dropdown." };
    if (companies.length) sheet.getCell(`A${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`'Company Lookup'!$A$2:$A$${lastCompanyRow}`], showErrorMessage: false };
  }
  return wb.xlsx.writeBuffer();
}

async function parseExpenseImportFile(buffer, budgets = [], companies = []) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet("Expenses"); if (!sheet) throw new Error("Wrong Excel file. Expected sheet named Expenses.");
  const headerMap = {}; sheet.getRow(1).eachCell((c, i) => { if (norm(c.value)) headerMap[norm(c.value)] = i; });
  const missing = REQUIRED.filter((h) => !headerMap[norm(h)]); if (missing.length) throw new Error(`Wrong Excel file. Missing columns: ${missing.join(", ")}. Download the latest template.`);
  const bMap = lookupBudget(budgets); const cMap = lookupCompany(companies); const rows = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const supplierText = cell(row, headerMap, "Supplier Company");
    const company = cMap.get(norm(supplierText));
    const supplierName = company?.name || supplierText.replace(/\s*\[[^\]]+\]\s*$/, "");
    const invoiceNumber = cell(row, headerMap, "Invoice Number");
    const budgetText = cell(row, headerMap, "Budget");
    const budget = bMap.get(norm(budgetText));
    const itemName = cell(row, headerMap, "Expense Item Name");
    const quantity = num(cell(row, headerMap, "Quantity"), "Quantity", rowNum, 1);
    const unit = cell(row, headerMap, "Unit") || "ls";
    const unitPrice = num(cell(row, headerMap, "Unit Price"), "Unit Price", rowNum, 0);
    const amountText = cell(row, headerMap, "Amount");
    const amount = amountText === "" ? quantity * unitPrice : num(amountText, "Amount", rowNum, quantity * unitPrice);
    if (!supplierName && !invoiceNumber && !itemName && amount === 0) return;
    if (!budget) throw new Error(`Budget not recognised in row ${rowNum}: ${budgetText}. Use the Budget dropdown.`);
    rows.push({
      supplierName,
      supplierCompanyUid: company?.id || undefined,
      invoiceNumber,
      referenceNumber: cell(row, headerMap, "Reference Number") || invoiceNumber,
      expenseName: cell(row, headerMap, "Expense Name") || (supplierName && invoiceNumber ? `${supplierName} - ${invoiceNumber}` : supplierName || invoiceNumber || "Imported Expense"),
      description: cell(row, headerMap, "Expense Description"),
      issuedAt: iso(cell(row, headerMap, "Issue Date"), "Issue Date", rowNum),
      receivedAt: iso(cell(row, headerMap, "Received Date"), "Received Date", rowNum),
      paymentDue: iso(cell(row, headerMap, "Payment Due Date"), "Payment Due Date", rowNum),
      budgetId: budget.id,
      budgetCode: budget.code || "",
      budgetName: budget.name || "",
      itemName,
      itemDescription: cell(row, headerMap, "Expense Item Description") || itemName,
      quantity,
      unit,
      unitPrice,
      amount,
      status: cell(row, headerMap, "Status") || "draft"
    });
  });
  return rows;
}

module.exports = { buildExpenseImportTemplate, parseExpenseImportFile };
