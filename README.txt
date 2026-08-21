Forma Workday Expense Solution v76 - Four Concurrent Workers

Requested speed profile:
- Four concurrent Autodesk Expense Item workers
- Zero artificial delay between item requests
- Zero artificial delay between 20-item chunks
- Twenty items per short browser/server request
- Retry-After remains enabled for actual Autodesk 429 responses
- Six retries remain enabled for 429 and temporary 5xx errors
- Maximum 300 items per Autodesk parent
- Automatic Part parent splitting for Expense Names above 300 items
- Cancel button, progress, elapsed timer, report export, negative values, supplier/PO logic, and Paid/Approved finalisation retained

Target for 1,200 rows: approximately 4 to 7 minutes when Autodesk response time remains stable. A 429 Retry-After pause can increase total duration.
