# DBMS track — lab notes

All labs were run on Python 3.12 (SQLite 3.49.1) in the session scratchpad before being embedded; db15 used NumPy from gpt_env.

| Topic | Status | Notes |
|---|---|---|
| db1-db14 | RUN | Outputs quoted in the lab text match the test run. Timings (db5, db6, db7, db12, db13) vary by machine; ratios should hold. |
| db10 | RUN (toy model) | Write counts come from a simplified model of PostgreSQL vs InnoDB, not a benchmark. |
| db12 | RUN | Pure-Python loops cannot show vectorised speedups, so the lab reports bytes read, not row-vs-column timings. |
| db14 | RUN | Only an insert trigger is provided; the "Try next" asks the reader to add the UPDATE trigger. |
| db15 | RUN (NumPy) | Synthetic clusters are deliberately hard (recall 0.18-0.83); real embeddings usually score higher. |
