Forma Workday Expense v102 - Working Rate-Safe Forward Queue

This version fixes both problems introduced after v98:
- No incomplete reserveItemPost function
- No 300-row, 16-minute browser/server request

Install:
1. Extract install-v102.cmd and apply-v102.js.
2. Copy both files into the Forma Expense project root.
3. Double-click install-v102.cmd.

Final design:
- Autodesk parent split remains 300 items
- Browser/server request size is 10 rows
- Two response-latency workers
- Expense Item POST starts are globally spaced by 3,200 ms
- Effective target is 18.75 item POST starts/minute, below the documented 20/minute endpoint limit
- Each short request returns approximately every 32 seconds, so progress updates regularly
- Temporary failures go to one global Pending queue
- Forward pass continues through all parents and selected projects
- After the forward pass, wait 30 seconds and retry confirmed-missing Pending items in 10-row requests
- Repeat until Pending is empty or Cancel is clicked
- Successful items are not resubmitted
- Duplicate verification remains based on deterministic externalId plus existing-item lookup
- Parent finalisation happens only after all expected items are confirmed
- Automatic login and Excel-template features remain unchanged

The installer builds changes in a temporary directory, syntax-validates every JavaScript file, and only then replaces project files. Timestamped backups are created.
