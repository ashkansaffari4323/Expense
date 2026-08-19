# ACC Expense Full App v41
Version 1.0.41.

## Changes
- Renamed visible Excel column from `Workday Unique ID` to `Reference Number`.
- Reference Number is no longer treated as a unique key and can be duplicated.
- Same Expense Name can repeat within the same Excel import and will create one parent with multiple line items.
- The only duplicate blocker is now: if the same Expense Name already exists in Forma/ACC Cost for that same project, the app will not create it.
- Existing-cost duplicate result shows `matchedBy: Expense Name`.
- Supplier auto-fill by same Expense Name remains.
- Status can still be `paid`, with draft -> approved -> paid flow.
- Amount remains calculated as Quantity * Unit Price.
