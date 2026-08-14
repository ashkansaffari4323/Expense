# ACC Expense Full App v22

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


## v22 UI improvements

- Narrower sidebar and wider working area.
- Budget table has fixed height with internal scrolling.
- Budget search added.
- Tables use compact row height and sticky headers.
- Import log has fixed height and Clear button.
- Main page has less whitespace and less page-level scrolling.


## v22 UI login fix

The sign-in control is now a direct link to `/api/auth/login`, so it does not depend on JavaScript click handling.

The page title is shortened to `ACC Expenses`, and visible version text has been removed from the header.
