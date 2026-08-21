Forma Workday Expense Solution v72 - Maximum Speed Profile

Five-times shorter fixed gaps than v71:
- Cost request-start spacing: 125ms to 25ms
- Pause between 10-item chunks: 250ms to 50ms
- Worker recovery after throttling: 5x faster
- Initial worker cap remains 4 to avoid uncontrolled request fan-out

Adaptive safety remains enabled:
- Autodesk 429 immediately reduces concurrency to one worker
- All Cost requests pause for Retry-After plus the safety buffer
- Six retries remain enabled for 429 and temporary 5xx responses
- Maximum 300 items per parent and automatic Part splitting remain enabled
- Ten items per short request, live progress, elapsed time, report export, negative values, and Paid/Approved finalisation remain enabled

Important: this is an aggressive profile. It may finish faster when Autodesk has capacity, but may trigger 429 sooner. When 429 occurs, Autodesk controls the final duration through Retry-After.
