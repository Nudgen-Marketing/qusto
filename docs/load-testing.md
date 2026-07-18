# Reference load test

Run against an isolated 4-vCPU/8-GB deployment with production-equivalent PostgreSQL storage:

```bash
QUSTO_BASE_URL=https://load.qusto.example \
QUSTO_API_KEY=qsk_... \
k6 run scripts/load-test.js
```

The default scenario submits 100 single-event batches per second for 30 minutes. Record API p50/p95/p99, PostgreSQL CPU/IO, accepted versus unique event IDs, queue depth, worker drain time, and disk bytes per event. Acceptance requires no accepted-event loss or duplicates, ingestion p95 below 200 ms, policy evaluation p95 below 100 ms excluding network latency, and the worker backlog returning to zero. The script enforces the ingestion latency/error thresholds; SQL and monitoring evidence must be attached to the release record.
