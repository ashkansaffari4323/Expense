Forma Workday Expense v96 - Resilient Failed-Item Queue

Install:
1. Extract install-v96.cmd and apply-v96.js.
2. Copy both into the Forma Expense project root.
3. Double-click install-v96.cmd.

Behavior:
- Maximum 300 items per Autodesk parent
- 300 rows submitted per parent batch
- 10 workers and 0 ms normal gap
- If an item fails temporarily, keep moving forward
- Successful items are removed from the queue
- Permanent validation/permission errors are reported and not endlessly retried
- After the forward pass, wait 30 seconds
- Retry only temporary failed items
- Repeat every 30 seconds until all temporary items succeed or Cancel is clicked
- Deterministic externalId values verify existing items before retry, reducing duplicate risk after a lost response
- Parent status finalises only after its item queue is empty and there are no permanent item errors
- Projects remain sequential
- Automatic Autodesk sign-in remains enabled
- Existing Excel template is not modified

Timestamped backups are created before the update.
