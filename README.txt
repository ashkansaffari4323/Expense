Forma Workday Expense v94 - 167 Row Batches

Install:
1. Extract install-v94.cmd and apply-v94.js.
2. Copy both files into the Forma Expense project root.
3. Double-click install-v94.cmd.

Settings:
- Autodesk parent maximum: 300 items
- Browser/server batch size: 167 rows
- A full 300-item parent is processed as 167 + 133
- Concurrent workers: 10
- Normal request gap: 0 ms
- Wait after a completed 300-item parent: 10 seconds
- Wait between projects: 25 seconds
- Retry waits: 10, 20, 30 ... 250 seconds
- Maximum retries: 25
- Projects processed sequentially
- Maximum selected projects remains 10
- Automatic Autodesk sign-in when no valid app session exists
- Existing Excel template file is not modified

Timestamped backups are created for server.js, public/app.js, src/aps.js, src/auth.js and package.json.
