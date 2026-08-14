# ACC Expense Full App v26

This version adds project company lookup and supplier dropdowns in the Excel template.

## Flow

1. Sign in with Autodesk 3-legged OAuth.
2. Select hub and project.
3. Load budgets.
4. Download Excel template.
5. Excel template includes:
   - Budget dropdown from ACC Cost budgets.
   - Supplier Company dropdown from project companies.
   - Quantity, Unit, Unit Price, Amount columns.
6. Fill Excel.
7. Upload Excel.
8. Click Create Expenses. Preview is optional.

## Important auth

Cost API calls use the 3-legged user token.

Project companies lookup uses a 2-legged app token with `account:read`, because ACC Admin company endpoints are app-only.

## .env

```env
PORT=4000
APS_CLIENT_ID=YOUR_CLIENT_ID
APS_CLIENT_SECRET=YOUR_CLIENT_SECRET
APS_CALLBACK_URL=http://localhost:4000/api/auth/callback
SESSION_SECRET=replace-with-a-long-random-string
APS_SCOPES=data:read data:write account:read
APS_COST_REGION=AUS
APS_2LO_SCOPES=account:read
```

## Version check

Open:

```text
http://localhost:4000/api/version
```


## v26 UI improvements

- Narrower sidebar and wider working area.
- Budget table has fixed height with internal scrolling.
- Budget search added.
- Tables use compact row height and sticky headers.
- Import log has fixed height and Clear button.
- Main page has less whitespace and less page-level scrolling.


## v26 UI login fix

The sign-in control is now a direct link to `/api/auth/login`, so it does not depend on JavaScript click handling.

The page title is shortened to `ACC Expenses`, and visible version text has been removed from the header.


## v26 UI budget selection cleanup

The sidebar Budget dropdown was removed because it did not control expense creation. In this workflow, the budget is selected inside the Excel template, one budget per row, using the live Budget dropdown in Excel.

Create Expenses uses the selected budget from each Excel row.


## v26 approval behaviour

The app now creates every expense as `draft`, creates its expense item, then tries to update the expense status to the status requested in Excel, such as `approved`.

If Autodesk blocks the status update because an expense approval/review workflow is configured, the row is reported as successful and the expense remains as `draft`. The response includes `approvalAttempt` so you can see whether auto-approval succeeded or fell back to draft.


## v26 invoice type and paid date

The Excel template now includes:

- `Type`, default `Invoice`
- `Paid Date`, sent to Autodesk as `paidAt`

When creating the expense, the app sends:

```json
{
  "type": "Invoice",
  "paidAt": "YYYY-MM-DDT00:00:00.000Z"
}
```

The app still creates as draft first, creates the item, then tries to approve automatically.


## v26 Vercel routing fix

This version adds `vercel.json` and exports the Express app from `server.js`, so Vercel routes `/api/auth/login`, `/api/auth/callback`, API endpoints, and the static app through the Express server.

Use this callback URL for the production Vercel domain:

```text
https://expense-seven-beta.vercel.app/api/auth/callback
```
