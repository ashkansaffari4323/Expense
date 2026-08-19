# ACC Expense Full App v35
Version 1.0.35.

## Duplicate rule changed
The app now checks duplicates using **Workday Unique ID only**.

### Excel duplicate check
- If two Excel rows have the same `Workday Unique ID`, the later row is marked `Repeated in Excel` and skipped.
- Expense Name and Reference Number are no longer used to decide Excel duplicates.

### Existing Cost duplicate check
- The app checks existing ACC Cost expenses only where existing `referenceNumber` equals the Excel `Workday Unique ID`.
- Expense Name and Reference Number are no longer used for the existing-cost duplicate check.
- Skipped rows now return `matchedBy`, `matchedValue`, and existing expense details where available.

Keeps v34 wrapping/copyable API result UI and v33 approved-with-nested-item approval logic.
