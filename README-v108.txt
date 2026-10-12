v108 - Contracts on its own page

Extract into C:\Users\Saffa\Forma Expense and replace:
  server.js, package.json, public\index.html, public\app.js
New files: public\contracts.html, public\contracts.css, public\contracts.js
Keep src\*, public\style.css, vercel.json, .env.

Contracts tab opens /contracts.html. Expenses tab returns to /.
Template columns: Project, Contract Name, Contract Number, Supplier (name dropdown per project),
Description, Issued Date, Committed Amount (ex GST), Apply GST, GST %, GST Amount, Total incl GST.
External ID removed; duplicates are matched by Contract Number per project.
Create: contract (Issued Date sent as awardedAt) -> try to attach project GST tax code -> status Approved.
GST result is reported per row in the API result.
