Forma Workday Expense v100 - Endpoint Rate-Safe Import

Install on top of v96 or v99:
1. Extract install-v100.cmd and apply-v100.js.
2. Copy both files into the Forma Expense project root.
3. Double-click install-v100.cmd.

Best settings for the documented Expense Item POST limit:
- Autodesk parent maximum: 300 items
- Forward-first global pending queue retained
- Expense Item POST starts: one every 3,200 ms
- Sustainable start rate: 18.75 requests/minute, below the documented 20/minute endpoint limit
- Workers: 2, to hide response latency without allowing request bursts
- Other Cost API endpoints are not slowed by the item limiter
- If 429 occurs, all item starts share one cooldown gate
- Cooldown: maximum of 30 seconds or Autodesk Retry-After
- Temporary failures go to Pending and processing continues forward
- After every parent/project forward pass, retry only confirmed-missing Pending items
- Pending rounds: every 30 seconds until complete or Cancel
- Successful items are never resubmitted
- Deterministic externalId and existing-item lookup reduce duplicate risk
- Automatic login and current Excel template are unchanged

Expected endpoint-limited creation time:
- 300 items: approximately 16 minutes
- 1,200 items: approximately 64 minutes

Timestamped backups are created before modification.
