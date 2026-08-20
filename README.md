# Forma Workday Expense Solution v58

## Template download performance fix
- Budget, Purchase Order, and Supplier requests now run in parallel.
- Company endpoint attempts run in parallel instead of one after another.
- Company lookups have a 2.5 second hard timeout, so an unavailable Admin API endpoint cannot leave the download spinning.
- Existing expenses are no longer loaded while generating the template. Duplicate checking still runs during Preview and immediately before Create.
- Supplier dropdown still uses project/account companies and Purchase Order supplier data when available.
- The template filename remains `Workday Forma Excel Upload.xlsx`.
