# Forma Workday Expense Solution v50

- Supplier Company is normalised across every row in the same Project + Expense Name group.
- Supplier may be entered on any one row in the group; Preview propagates it to all sibling rows.
- The parent expense always receives supplierName.
- Autodesk Expense Item does not have a supplierName field, so every sub-line item receives `description: Supplier: <name>` and the API result includes supplierName for each item.
- Preview now displays Supplier as its own column.
- Includes Clear Preview, Clear API, modern upload button, Budget, Purchase Order, and grouped line-item features.
