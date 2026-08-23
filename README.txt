Forma Workday Expense v103 - Stable v98-Style Forward Import

This release deliberately removes the broken v100-v102 scheduler and restores the v98-style method that created items.

Install:
1. Extract install-v103.cmd and apply-v103.js.
2. Copy both into the Forma Expense project root.
3. Double-click install-v103.cmd.

Behavior:
- Maximum 300 items per Autodesk parent
- One forward request per parent, up to 300 rows
- Ten item workers
- Zero artificial request gap
- No reserveItemPost function or scheduler dependency
- Temporary failures enter the global Pending queue
- If 298 of 300 succeed, only the missing 2 remain Pending and processing moves immediately to the next parent
- After every parent/project forward pass completes, wait 25 seconds and retry only Pending items
- Repeat until Pending is empty or Cancel is clicked
- Successful items are never resubmitted
- Deterministic externalId plus existing-item lookup provide duplicate protection
- Permanent validation/permission errors are reported and excluded from endless retries
- Automatic login and Excel-template features remain unchanged

The installer builds in a temporary folder, validates all JavaScript files and package.json, then creates timestamped backups and replaces project files.

Note: This restores the working fast method and can still encounter Autodesk 429 responses. Those responses are moved to Pending rather than stopping the forward pass.
