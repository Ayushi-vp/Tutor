# Data engineering track — lab notes

Labs were written but NOT run during the track build (see memory "labs untested, log issues").
Python labs target 3.12 stdlib, or pandas + pyarrow + NumPy from
`C:\ra_projects\how-to-train-your-gpt\gpt_env` (pyarrow 25.0.1, pandas 3.0.6, NumPy 2.5.3 on 2026-10-08).
Spark / Flink / Airflow snippets are marked "Needs …" and were not executed.

| Topic | Status | Doubts to check in the fix pass |
|---|---|---|
| de1 | NOT RUN | SQLite triggers stand in for a WAL; check the AFTER DELETE trigger uses `OLD.id`, and that the reader writes `updated_at` explicitly (SQLite has no auto-update). Expected output (1 row vs 6 changelog rows) is from the hand trace. |
| de2 | NOT RUN as a lab | The byte counts in the body WERE measured with a one-off script (pyarrow 25.0.1, seed 7): CSV 56.3 MB, Parquet none/snappy/zstd 25.9/15.1/7.9 MB. The lab's own random data will differ by a few %. Check `pq.read_table(filters=...)` with timezone-aware timestamps — the filter bounds `t12`/`t13` must be `pa.scalar(..., type=pa.timestamp("ms", tz="UTC"))` or tz-aware datetimes, otherwise pyarrow may raise a type error. |
| de3 | NOT RUN | `write_dataset(..., partitioning=[...], partitioning_flavor="hive")` — check the argument name/behaviour on pyarrow 25 (may need `partitioning=ds.partitioning(schema, flavor="hive")`). File counts depend on `max_rows_per_file`/`max_rows_per_group` defaults; "7 files" assumes one file per partition. Skewed 1/rank draw must be normalised. |
| de4 | NOT RUN | Toy table format in stdlib. Check `open(path, "x")` raises FileExistsError on Windows as on POSIX (it should). Conflict check in step 5 is described loosely — the solution should define "conflict" as overlap between this commit's removed_files and files removed/added since base. |
| de5 | NOT RUN | Stdlib shuffle simulation. `hash()` of ints is deterministic, fine; pickle sizes are a proxy for bytes. Check the "user 0 = 1% of rows" arithmetic: 10,000 rows over 40 map partitions = 250 per partition -> 40 partial sums. The explain() text in the body is illustrative (abridged), not captured from Spark 4.2. |
| de6 | NOT RUN | Zipf via random.choices with 1/k weights; "key 1 ≈ 8%" from 1/H(100000)=1/12.09. hash(None) is constant per process but not 0 — the lab says nulls go "to one partition", fine. Salting count of extra rows assumes one small-side row per hot key. |
| de7 | NOT RUN | sqlite append-vs-overwrite lab; the Airflow 3 DAG in the body is NOT run (check `airflow.timetables.trigger.CronTriggerTimetable(interval=...)` signature and that context kwargs data_interval_start inject into @task functions in 3.3). |
| de8 | NOT RUN | Pure-Python apply of change events. Check the delete-tombstone logic in apply_guarded (store ("deleted", lsn)) and that the "try next" snapshot read event with lsn 15 is ignored after lsn 50. |
| de9 | NOT RUN | Pure-Python watermark simulator. The quoted outcomes (late % per delay, ~30 s latency at 30 s delay) are from the lateness mix by reasoning, not a run; the 4.9% 2–30 s bucket means a 5 s delay still leaves ~4% late. |
| de10 | NOT RUN | sqlite SCD2 via LEAD() window function (SQLite ≥3.25 has window functions; 3.12 ships 3.4x+). Purchase amounts and the "revenue by plan" contrast are by construction, not computed. |
| de11 | NOT RUN | stdlib DQ runner. Check: log-normal median ~30 via random.lognormvariate(math.log(30), 0.8); the range check max=10000 must indeed let 100×30 pass; MAD band with 6 weeks. Also verify dbt YAML `data_tests` + `arguments:` syntax against current dbt (1.10+) and ODCS v3.2 key names in the body example (marked "check the specification"). |
| de12 | NOT RUN (NumPy) | Byte-level tokens + EOS=256 in uint16; check np.memmap offsets per shard and that the permutation over (shard,row) positions resumes identically. Body numbers hand-checked: MinHash 14×8 at s=0.75 → 0.77, s=0.5 → 0.053; drill 192M clicks + 1.58B negatives. |
| de13 | NOT RUN | Cost calculator. Prices are list prices checked 2026-10-08 (BigQuery $6.25/TiB US; S3 $0.023/GB-mo first 50 TB, AWS price list pub. 2026-09-28; serverless Spark $0.06/DCU-h us-central1; n2-highmem-16 $1.048112/h first region on GCE general-purpose page — region assumed us-central1, not confirmed). Storage at flat $0.023 gives ~$2,530 vs tiered ~$2,470. |
