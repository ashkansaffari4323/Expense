# ACC Expense Full App v29

Correct package version: `1.0.29`.

Adds:
- Excel row summary: total rows, valid rows, duplicate rows, rows already in Cost, rows to create, created/skipped/failed results.
- Duplicate Excel validation by Expense Name.
- Existing Cost duplicate protection by Expense Name or Reference Number.
- Duplicate rows are reported and skipped instead of loaded again.
- Existing Cost expenses are reported and skipped instead of loaded again.

Check deployment:

```text
https://expense-seven-beta.vercel.app/api/version
```

Expected response includes:

```json
{"version":"v29","package":"1.0.29"}
```
