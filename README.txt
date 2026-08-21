Forma Workday Expense Solution v81 - Five Row Chunks

Requested chunk setting:
- Maximum 5 Excel rows per browser/server chunk
- Up to 5 active Autodesk item requests per chunk because each chunk contains only 5 rows
- Configured worker ceiling remains 10
- 10 retry attempts
- Exactly 3 seconds before every retry
- Zero artificial delay after successful requests
- Zero artificial delay between chunks
- Maximum 300 items per Autodesk parent
- Automatic Part splitting above 300 items
- Cancel, timer, progress, report export, negative values, supplier/PO logic, and Paid/Approved finalisation retained

For 1,050 rows, the app creates four Autodesk parent Parts and 210 browser/server chunks.
