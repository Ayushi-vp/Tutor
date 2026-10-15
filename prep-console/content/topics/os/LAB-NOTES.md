# OS track — lab notes (fix later)

Labs were written but not run, per the standing instruction to focus on content. Labs assume
Linux or WSL with Python 3.12 (and gcc where noted). Log anything to recheck here.

| Topic | Lab status | Notes |
|---|---|---|
| os1 | NOT RUN | Expected: ~20,000 write calls to a terminal vs a few dozen to a file; getppid a few hundred ns per call including Python overhead. Under `strace -c` the stdout of the terminal run is the terminal itself — confirm Python line-buffers there. Voluntary switch increase with sleep(0.001) × 1000 should be ≈ 1000. |
| os2 | NOT RUN | Expected: child shows Z/<defunct> for 20 s then disappears, parent prints exit code 3; orphan PPID becomes 1 or a subreaper (WSL init / systemd --user). Thread demo should list 6 dirs under /proc/PID/task. |
| os3 | Simulator RUN (numbers verified) | FCFS/RR/SRTF figures in primer, body, lab and drill were checked with the lab simulator (RR rotation bug fixed). The lab itself was run only via exec of the code block, not as a saved file. |
| os4 | NOT RUN | C lab: expect plain < 40M and varying; atomic/spin/mutex = 40M. Relative timings (atomic fastest, spin vs mutex order) unverified — may differ by machine; mutex should show futex calls under strace. Spin mode with 4 threads on fewer than 4 vCPUs (small WSL VM) may be very slow. |
| os5 | NOT RUN | Expect 4000/4000 items; naive philosophers usually DEADLOCK (timing dependent — sleep(0.0001) may need increasing on some machines); ordered always finishes. Step 3 single-CV hang is nondeterministic. |
| os6 | Banker part RUN | Banker code executed: avail [3,3,2], order P1,P3,P4,P0,P2; P1 granted, P4 wait, P0 unsafe — matches text. Two-thread timeout deadlock part not run (expect both print False after ~2 s). |
| os7 | NOT RUN | TLB-reach lab: expect steps near L1 dTLB (~64-100 pages) and L2 TLB (~1.5-3k pages); exact ns values unknown and mixed with cache effects (text says so). With -O2 compiler should not elide loop because sum is printed. rand() % (i+1) fine for these sizes. |
| os8 | Simulator part RUN | replace.py functions executed: textbook FIFO/LRU/OPT and Belady numbers match text. Step 3 (/usr/bin/time -v bytearray 500 MB ≈ 120k minor faults) not run; THP may reduce the count. |
| os9 | NOT RUN | Lab fixed to use MAP_PRIVATE (Python mmap(-1) defaults to MAP_SHARED, which would not COW). Expect RSS +256 MiB after touching half; child Shared_* ≈ 256 MiB and Pss ≈ Rss/2 before writes; ~128 MiB moves to Private_Dirty after. Verify smaps_rollup field names and that Python interpreter pages do not obscure numbers. |
| os10 | NOT RUN | Step 2 relies on Python holding big.log open (50 MB) — df granularity may hide a 50 MB change on large disks; consider bigger file. fsync timing on WSL reflects the vhdx; numbers will vary. |
| os11 | NOT RUN | Expect poll time to grow ~linearly with fds, epoll flat. setrlimit to 20000 may fail if hard limit lower (code uses min). Python poll() builds a list, which adds per-fd cost — fine for the point. Edge-trigger step 3 described in prose only. |
| os12 | NOT RUN | Expect pipe a few GB/s, shared memory several times faster; payload uses os.urandom(1024)*N/1024 (fast to build). fork with SharedMemory object on macOS should work. kill -9 shows no message. PIPESTATUS 141 0 needs bash. |
| os13 | NOT RUN | Needs root. WSL2: cgroup v2 mount at /sys/fs/cgroup assumed; memory controller must be enabled in parent subtree_control (may need echo +memory +pids > /sys/fs/cgroup/cgroup.subtree_control). memory.swap.max may not exist if no swap accounting. memory.peak needs 5.19+. Fork loop message text unverified. |
| os14 | NOT RUN | Load script untested: two hashing threads under the GIL — os.urandom releases the GIL, so r may be ~2 not ~1; wording says "around 1-2". disk writer now capped at 256 MB via seek(0). perf on WSL needs special package. |
