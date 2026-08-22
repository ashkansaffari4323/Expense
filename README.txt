Forma Workday Expense v95 - 250 Row Batches with 15-Second Wait

Install:
1. Extract install-v95.cmd and apply-v95.js.
2. Copy both files into the Forma Expense project root.
3. Double-click install-v95.cmd.

Settings:
- Autodesk parent maximum: 300 items
- Browser/server batch size: 250 rows
- A full parent is processed as 250 + 50
- Concurrent workers: 10
- Normal API request gap: 0 ms
- Wait between successful batches: 15 seconds
- Wait between successful parents in the same project: 15 seconds
- Wait between projects: 25 seconds
- Retry waits: 10, 20, 30 ... 250 seconds
- Maximum retries: 25
- Projects processed sequentially
- Maximum selected projects: 10
- Automatic Autodesk sign-in remains enabled
- Existing Excel template is not modified

Timestamped backups are created before the update.
