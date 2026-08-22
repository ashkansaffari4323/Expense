Forma Workday Expense v92

1. Extract install-v92.cmd and apply-v92.js.
2. Copy both files into the Forma Expense project root.
3. Double-click install-v92.cmd.

v92 behavior:
- One browser/server batch per generated parent, up to 300 rows
- 10 concurrent Autodesk item workers
- 0 ms normal API-call gap
- Complete one 300-item parent before starting the next
- Wait 10 seconds after a successful parent before the next parent
- Complete all parents for one project before the next project
- Wait 25 seconds between projects
- Retry rejected calls after 10, 20, 30, 40, 50, 60, 70, 80, 90 and 100 seconds
- Maximum 10 retry attempts
- Existing Excel template file is not changed
- Existing project selection and Hub Admin changes remain in place

The installer creates timestamped backups of server.js, public/app.js, src/aps.js and package.json.
