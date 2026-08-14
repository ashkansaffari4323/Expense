# ACC Expense Full App v28

Correct package version: `1.0.28`.

Includes:
- Vercel Express routing via `vercel.json`
- Stateless Autodesk OAuth state for Vercel serverless
- Encrypted HttpOnly token cookie
- ACC Cost budgets and expense creation
- Project company dropdown in Excel template
- Invoice Type and Paid Date from Excel
- Create as draft, then try to approve, fallback to draft if workflow blocks approval

Check deployment:

```text
https://expense-seven-beta.vercel.app/api/version
```

Expected:

```json
{"version":"v28","package":"1.0.28"}
```
