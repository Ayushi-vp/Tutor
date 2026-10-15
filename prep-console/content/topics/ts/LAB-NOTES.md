# Time series & AI track — lab notes

All twelve labs were RUN (2026-10-08) with the existing gpt_env venv
(`C:\ra_projects\how-to-train-your-gpt\gpt_env`, Python 3.12, NumPy 2.5.3, pandas 3.0.6; no scipy,
statsmodels or sklearn). The "Output from a test run" blocks in each lab are the real outputs.
Fixed seeds are used throughout, so re-runs should reproduce them exactly on the same NumPy version.

| Topic | Runtime | Notes |
|---|---|---|
| ts1 | <1 s | Date-only kNN: random split MAE 4.26 vs time split 10.69. |
| ts2 | <1 s | pandas 2x12-MA classical decomposition; Fourier K=1..6. |
| ts3 | ~1 s | Granger-Newbold replication gives 66% (paper: 76% over 100 reps). |
| ts4 | ~25 s | Grid-searched SES/Holt/Damped loops are slow by design. |
| ts5 | <1 s | DM test assumes non-overlapping windows (step = H). |
| ts6 | ~6 s | Ridge stands in for gradient boosting (no tree library installed). |
| ts7 | ~1 s | Closed-form ridge; Linear == DLinear under exact fitting is intended. |
| ts8 | ~3 s | ACI uses a rolling 500-error window plus the alpha update. |
| ts9 | ~2 s | No model downloads; tiny synthetic-pretrained linear "foundation model". |
| ts10 | ~1 s | Point-adjust demo: F1 0.018 -> 0.845. |
| ts11 | <1 s | Mini CausalImpact interval ignores parameter uncertainty (stated). |
| ts12 | ~1 s | Needs PYTHONIOENCODING=utf-8 on Windows consoles for pandas printing. |
