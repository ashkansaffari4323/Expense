# Forma Workday Expense Solution v59

## Budget-only supplier behaviour
- When Budget is selected and Purchase Order is blank, Supplier Company is not required in Excel.
- Preview shows `Not required` instead of `Missing supplier`.
- The row remains valid and can be created.
- Because Autodesk Expense POST technically requires a supplier field, the app sends the controlled fallback `supplierName: No Purchase Order` only for a budget-only expense with no supplier.
- When a Purchase Order is selected, the app still resolves its supplier automatically. If the selected Purchase Order has no supplier, Excel Supplier Company remains required as fallback.
- The downloaded template remains named `Workday Forma Excel Upload.xlsx`.
