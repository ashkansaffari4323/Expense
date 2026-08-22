Forma Workday Expense v97 - Smart Adaptive Workers

Install:
1. Extract install-v97.cmd and apply-v97.js.
2. Copy both files into the Forma Expense project root after v96.
3. Double-click install-v97.cmd.

Smart worker method:
- Start with 6 workers
- Increase gradually after each 25 consecutive successful item calls: 6 to 8 to 10
- First 429 at 8-10 workers reduces concurrency to 5
- Another 429 at 5-7 workers reduces concurrency to 2
- Another 429 reduces concurrency to 1
- Recovery after successful calls follows 1 to 2 to 4 to 6 to 8 to 10
- All workers share a cooldown gate
- Uses Autodesk Retry-After when supplied; otherwise 30 seconds
- Temporary failures remain in the v96 pending queue
- Continue forward, then retry pending items every 30 seconds
- Successful items are not retried
- Duplicate verification from v96 remains active
- Cancel stops the retry loop
- Parent maximum remains 300 and projects remain sequential
- Automatic login and Excel-template features remain unchanged

Timestamped backups are created before modification.
