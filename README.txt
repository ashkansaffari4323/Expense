Forma Workday Expense Solution v84 - Project-Aware Budget Dropdown

Replace these files in the project root:
- server.js
- package.json
- src/xlsx.js

Budget dropdown values now show the project name first, for example:
Ashkan Sandbox | 1000 - Site Establishment
Holiday Park Upgrade | 1000 - Site Establishment

The parser accepts both the new project-prefixed labels and older labels without the project name. costApi.js is included as an unchanged reference file and does not need to replace src/cost.js.
