# Forma Workday Expense Solution v57

## Automatic Purchase Order supplier
- When a Purchase Order is selected, the app resolves supplier details from the selected Autodesk contract/PO.
- Purchase Order supplier takes priority over a manually entered Excel supplier.
- Preview shows `(PO)` next to supplier names resolved from Purchase Orders.
- Parent Expense POST includes supplierName and, when returned by Autodesk, supplierId and supplierCompanyUid.
- Excel Supplier Company dropdown remains available as fallback.
- If Purchase Orders under one parent resolve to different suppliers, Preview/Create blocks the group as conflicting.
- The downloaded template remains `Workday Forma Excel Upload.xlsx`.
