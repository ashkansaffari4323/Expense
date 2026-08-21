Forma Workday Expense Solution v83 - Smart Retry

- 20 rows per browser/server chunk
- 5 workers initially
- On Autodesk 429, all workers share the cooldown and concurrency reduces to 2
- Uses Autodesk Retry-After when supplied; otherwise waits 5 seconds
- Returns to 5 workers after 20 successful item requests
- 10 retry attempts per failed item
- Item-level results: successful rows are retained and only failed rows are reported
- Progress no longer displays the About remaining-time estimate
- Maximum 300 items per Autodesk parent with automatic Part splitting
- Cancel, elapsed timer, report export, negative values, supplier/PO logic, and Paid/Approved finalisation retained
