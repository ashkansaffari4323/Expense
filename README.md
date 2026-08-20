# Forma Workday Expense Solution v60

## Mixed Purchase Order suppliers
- One Expense Name group may contain line items using different Budgets and different Purchase Orders.
- Different Purchase Order suppliers no longer trigger `Conflicting Purchase Order suppliers`.
- The parent Expense uses the first resolved Purchase Order supplier because Autodesk Expense has one supplier at parent level.
- Every sub-line item keeps its own selected Purchase Order `contractId` and Budget `budgetId`.
- The API result lists `purchaseOrderSuppliers` and `mixedPurchaseOrderSuppliersAllowed` for transparency.
- Budget-only rows still do not require a supplier in Excel.
- The template remains named `Workday Forma Excel Upload.xlsx`.
