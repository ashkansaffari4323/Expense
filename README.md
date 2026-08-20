# Forma Workday Expense Solution v48

Corrected full build:
- Removes false Budget / Purchase Order relationship errors.
- The `budgets-contracts:link` endpoint is not called because it changes configuration and does not retrieve links.
- Preview validates that Budget and optional Purchase Order each belong to the selected project.
- Autodesk expense item creation remains final validation.
- Modern landing page and fully modernised import workspace.
- Budget visible in preview, reliable selectable dropdowns, optional supplier, grouped line items, paid status flow.
