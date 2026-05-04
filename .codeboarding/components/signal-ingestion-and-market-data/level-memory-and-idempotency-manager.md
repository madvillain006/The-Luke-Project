---
component_id: 3.4
component_name: Level Memory & Idempotency Manager
---

# Level Memory & Idempotency Manager

## Component Description

The final stage of the ingestion pipeline; it ensures data integrity by filtering duplicate signals via source IDs and persisting the structured levels into JSONL-based session memory.

---

## Source Files:

- `lib\market-data\result.js`
- `lib\slash-commands-ingest.js`

