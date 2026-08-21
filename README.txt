Forma Workday Expense Solution v78 - 100 Row Chunks

Corrected chunk structure:
- Up to 100 Excel rows per browser/server chunk
- Ten concurrent Autodesk item workers inside each chunk
- Zero artificial delay between item requests
- Zero artificial delay between chunks
- Ten retry attempts for 429 and temporary 5xx responses
- Autodesk Retry-After remains mandatory when supplied
- Maximum 300 items per Autodesk parent
- Automatic Part parent splitting above 300 items

For 1,050 rows under one logical Expense Name:
- Four Autodesk parent Parts: 300 + 300 + 300 + 150
- Eleven browser/server chunks total: 3 + 3 + 3 + 2
- Autodesk still receives one Expense Item POST for each row

Cancel, timer, progress, report export, negative values, supplier/PO logic, and Paid/Approved finalisation remain included.
