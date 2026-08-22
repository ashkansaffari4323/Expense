Forma Workday Expense v99 - Fast Forward and Global Pending Queue

Install:
1. Extract install-v99.cmd and apply-v99.js.
2. Copy both into the Forma Expense project root.
3. Double-click install-v99.cmd.

Exact method:
- Only fixed structural split is Autodesk's 300-item parent limit.
- Each parent sends all expected rows in one request with 10 workers.
- Normal API request gap is 0 ms.
- No successful batch wait and no parent wait during the forward pass.
- If 298 of 300 succeed, only the missing 2 enter Pending.
- Immediately continue to the next 300-item parent and then every selected project.
- After all forward parents finish, wait 10 seconds.
- Retry only pending items, grouped by their parent.
- Repeat every 10 seconds until the temporary pending queue is empty or Cancel is clicked.
- Confirmed successes are never retried.
- Deterministic externalId values and existing-item lookup reduce duplicate risk after lost responses.
- Permanent validation and permission errors are reported and excluded from endless retries.
- Parent status finalises only after all expected items are confirmed.
- Automatic login and the current Excel template remain unchanged.

Timestamped backups are created before modification.
