# Classic design cases — lab notes (fix later)

Labs for cd11–cd14 were written but not run, per the standing instruction to focus on content.
All are Python 3.12 standard library. Log anything to recheck here.

| Case | Lab status | Notes |
|---|---|---|
| cd11 | NOT RUN | Point quadtree, 200k points (150k Gaussian city + 50k uniform). Expect `same=True` for all three queries. Build time in pure Python may be several seconds (recursive re-insert on split); if slow, reduce point count. Text claims "a few thousand points checked" for the dense 0.5 km query and "a few hundred" for the rural 5 km query — unverified orders of magnitude. Points exactly on W are clamped to W−1e-9; a degenerate split guard stops at width 1e-6. |
| cd12 | Trace part SIMULATED | The four-algorithm trace was run in a scratch simulator while writing: 9 / 8 / 8 / 11 allowed, matching the table and figure (token bucket needed a 1e-9 float tolerance, kept in the lab). The thread race block was not run: expect naive to allow ~50 (all threads read 90 before any write) and atomic exactly 10. |
| cd13 | NOT RUN | Pure arithmetic. Expected: derivatives+WebP 544 KB/photo ≈ 19.9 PB/yr; with originals ≈ 129 PB/yr; WebP 80% share → 114 KB/view, ~5.7 PB/day. Check f-string formatting of the boolean columns (`{keep!s:5}`). |
| cd14 | NOT RUN | Toy judge. On Linux/macOS expect: Accepted, WA t1, TLE t1, RE t1, MLE t1 (MemoryError under RLIMIT_AS 256 MB), Accepted (token checker). Doubts: (1) RLIMIT_AS=256 MB could stop the Python interpreter itself starting on some systems — if every submission shows RE, raise MEM_LIMIT or switch to RLIMIT_DATA; (2) on native Windows the memory case prints "1" and is reported as WA, as the text says; (3) the slow case relies on the 2 s wall timeout firing before the 3 s RLIMIT_CPU. |
| cd15 | RUN (2026-10-10) | Price-time engine on 20 events, run while writing: trades match deep dive A (#9: 300+100 @ 100.50, 50 @ 101.00; #10: 400+50 @ 100.00), #18 takes #5 before #17 at 99.50, replay identical. Steps 2-3 (q[-1], floats, FOK, timing) not run. |
| cd16 | RUN (2026-10-10) | sqlite3 + 200 threads, 50 units: naive gave 200 orders with 40 left (oversold 150, lost updates); atomic gave exactly 50. ~10 s on Windows with WAL; without WAL and 400 threads it took ~30 s. Exact naive numbers vary per run. Steps 2-4 (no sleep, optimistic, sharded rows) not run. |
| cd17 | RUN (2026-10-10) | Skip list with spans: 100k inserts ~1.3 s, 9 levels, 1,000 rank checks match bisect on the sorted list; histogram rank error mean 3.3 / max 16 places (seed 7). Steps 2-3 (link counting, Pareto scores, quantile edges) not run. |
| cd18 | RUN (2026-10-10) | Fan-out simulation (3,000 viewers, 400 msg/s, cap 10/s): sampled 2.4% of naive, 9.6 msg/s per viewer, 200 ms frames cut writes to ~41% of deliveries; reactions 15,000 in → 60,000 summaries. Steps 2-4 not run. Emoji in print may need PYTHONIOENCODING=utf-8 on a Windows console. |
