# Reasoning track — lab notes

rs1–rs8 labs were tested when written (2026-10-01). rs9–rs11 were added in the content-gap pass
(2026-10-09); their scripts were run once in the scratchpad and injected verbatim with inject_lab.py.

| Topic | Lab status | Notes |
|---|---|---|
| rs9 | RUN (stdlib, 2026-10-09) | Curve: easy peaks 0.954 @2K, hard 0.667 @16K, whole mix 0.811 @8K (random sample of 2,000 problems, seed 0); Kimi reward [0.5, 0.318, -0.045, -0.5]; DAPO soft overlong 0 / 0 / -0.395 / -1 / -1. The derailment model is invented for illustration. |
| rs10 | RUN (stdlib, 2026-10-09) | 1,000 rollouts, seed 3: rewarded 743, hacks 121 (16.3%); static rules P 27.6% R 66.9%; held-out gap P 84.0% R 100%; OR 34.9%/100%; AND 90.0%/66.9%; rules miss exit_hidden 10, lookup_table 15, eq_lambda 15. The "set hidden_pass True for eq_override" variation in What-to-look-for was NOT run. |
| rs11 | RUN (stdlib + subprocess, 2026-10-09) | naive: honest 1, wrong 0, exit_zero 1, eq_override 1, special_case 1, infinite 0 (3 s timeout); hardened: only honest passes. Step 2 (shadowing `list`) returns 1.0 — the intended teaching point. Importing rs11_lab also prints the table (module runs on import); fine for a lab. Uses `python -I` in a temp dir; takes ~15 s on Windows because of process start-up. |
