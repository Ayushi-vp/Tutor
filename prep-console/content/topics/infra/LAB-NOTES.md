# Infra design cases — lab notes (fix later)

Labs for in12–in13 were written but not run, per the standing instruction to focus on content.
Python 3.12 standard library. Log anything to recheck here.

| Case | Lab status | Notes |
|---|---|---|
| in12 | NOT RUN | Mini tracer. Services run via `contextvars.Context().run(...)` to simulate a process boundary, so the extract-from-traceparent path is exercised. Expect a 6-span tree (root, 2 client calls, 2 server spans, card-network). The "break it" step (un-entered client span) should make payment's subtree disappear. Sampling sim: head keeps ~1,000 traces with ~1% of errors; tail keeps all ~100 errors plus slow (>500 ms) traces — the slow count is only part of the 1% "slow" group because lognormal×8 has median ~437 ms; wording in step 4 is approximate. |
| in13 | NOT RUN | Expect least: N2 65.6, N3 31.2 (text says 31.3 — float formatting of 31.25), most: N2 34.4, N3 68.8. Reconcile: 3 pods at tick 0 (least-allocated may put them on N2/N3/N4? N4 is tainted so no — expect N2, N2/N3 depending on scores as capacity changes), heal at tick 2, node loss at tick 4. Check that `schedule` never returns None during the run. |
| in14 | RUN (2026-10-10) | Snowflake encode/decode reproduces 2108890285471109125 (dc 3, worker 17, seq 5); 8 threads × 50k ids all unique; backwards clock: 3 ms step reuses ms 1001 with seq 1, 52 ms step refused. SQLite WITHOUT ROWID, 200k inserts: uuid4 ~12 s vs uuid7 ~3.3 s on Windows; page counts nearly equal (1,288 vs 1,300) — the text says so. Steps 3-4 (1M rows, shared worker id) not run. |
