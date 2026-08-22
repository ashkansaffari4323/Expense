1. Extract these two files.
2. Copy install-v90.cmd and apply-v90.js into the Forma Expense project root.
3. Double-click install-v90.cmd.

The installer updates server.js, public/app.js and package.json and creates timestamped backups.
It does not change src/aps.js or src/xlsx.js, so v78 timing and current Excel dropdown changes remain untouched.
