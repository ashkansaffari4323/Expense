Forma Workday Expense v98 - Global Pending Queue

Install order:
1. Install v96.
2. Install v97.
3. Extract install-v98.cmd and apply-v98.js into the project root.
4. Double-click install-v98.cmd.

Smart workflow:
- Process each parent forward once with adaptive workers.
- Example: if 298 of 300 succeed, queue only the missing 2 and immediately continue to the next 300-item parent.
- Continue through every parent and every selected project without waiting for individual pending items.
- After the full forward pass finishes, wait 25 seconds.
- Group pending rows by parent and retry only confirmed-missing rows.
- Repeat global pending rounds every 25 seconds until all temporary failures succeed or Cancel is clicked.
- Successful rows are never retried.
- Duplicate verification and deterministic identifiers from v96 remain active.
- Permanent validation and permission errors are reported, not retried forever.
- Parent status finalisation occurs after the global pending queue is empty and all expected items are confirmed.
- Adaptive worker control from v97 remains active.
- Automatic login and Excel-template features are unchanged.

Timestamped backups are created before modification.
