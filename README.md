# Forma Workday Expense Solution v45

- Budget and Purchase Order dropdowns are linked using Autodesk budget-contract relationships.
- Selecting a Budget restricts Purchase Order choices to linked contracts.
- Selecting a Purchase Order restricts Budget choices to linked budgets.
- Preview validates the relationship even if users paste data and bypass dropdowns.
- Invalid Budget / Purchase Order combinations are blocked from creation.
- If no relationship data is returned for a project, Purchase Order remains optional and preview does not falsely reject blank values.
