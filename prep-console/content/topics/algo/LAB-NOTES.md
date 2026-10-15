# DSA patterns — lab notes (fix later)

Labs were written but not run, per the standing instruction to focus on content.
All are Python 3.12 standard library. Log anything to recheck here.

| Topic | Lab status | Notes |
|---|---|---|
| al1 | NOT RUN | Two Sum stress test. Expect "all 20000 random tests agree"; after moving `seen.add(x)` above the check, expect a mismatch like `[3] 6` quickly. |
| al2 | NOT RUN | Timing ratios. Expect list membership ratio ≈ 4, set ≈ 2. Text says `pop_front_list` may look near-linear at 5k/10k because memmove is fast, and suggests 100k/200k — confirm. Timings noisy on Windows; may need repeats. |
| al3 | NOT RUN | Prefix+hash vs brute assert should never fire. Text claims the simple `window` is wrong on "many" cases even for non-negative input (zeros give multiple valid starts, e.g. [0,0], k=0 → window 2, brute 3) and more with negatives — confirm the counts look like that. |
| al4 | NOT RUN | Longest consecutive: three variants should agree on small inputs; on one shuffled run of 20,000 the unchecked version does ~2×10⁸ lookups — could take 10–30 s in CPython; if too slow, reduce to 10,000. |
| al5 | NOT RUN | 3Sum vs brute (set of sorted tuples from combinations). Expect pass; removing either duplicate-skip line should fail fast. |
| al6 | NOT RUN | Longest-substring and exactly-k (atMost difference) vs brute. Breaking the `last[ch] >= left` guard should fail on 'abba'-like strings; removing `del cnt[...]` should fail. |
| al7 | NOT RUN | first_true vs bisect_left/right and Koko BS vs linear. lo=mid mutation should hang (Ctrl+C); lower bound 0 should raise ZeroDivisionError. |
| al8 | NOT RUN | Histogram and sum-of-subarray-minimums vs brute (values 0..4). Last line should report many wrong inputs when both sides are non-strict. |
| al9 | NOT RUN | reverse + Floyd cycle_start on random lists with random tail links (incl. self-loop). Expect pass. |
| al10 | NOT RUN | Two-heap median vs statistics.median; size-k heap vs sorted() timing on 2M floats — text hedges that C-level sort may be competitive; record which wins. |
| al11 | NOT RUN | merge vs covered integer points; rooms sweep (half-open) vs brute over t in 0..24. Flipping event order to (t,-d) should cause mismatches on touching meetings. |
| al12 | NOT RUN | Coin greedy vs DP for three coin systems (expect US none wrong; [1,3,4] wrong from 6; [1,7,10] wrong incl. 14) and Jump Game II greedy vs BFS. |
| al13 | NOT RUN | Subsets II / Permutations II vs itertools; 8-queens should print 92 and ~2,057 nodes (claimed 'a couple of thousand'). Uses default-arg sets that are never mutated. |
| al14 | NOT RUN | Random trees: one-pass diameter vs BFS-from-every-node brute; bound-based BST validation vs strictly increasing in-order. |
| al15 | NOT RUN | Dict trie ("$" end key) vs list search/startswith over alphabet abc; 8-bit XOR trie vs brute. |
| al16 | NOT RUN | BFS distances vs repeated relaxation; 3-state cycle detection vs 'some permutation puts all edges forward' (n ≤ 6). Two-state mutation should report false cycles. |
| al17 | NOT RUN | Multi-source BFS vs Manhattan brute (no walls); 0-1 BFS vs Dijkstra on random non-square 0/1 grids. Swapping appendleft/append should break it. |
| al18 | NOT RUN | Kahn and DFS topo on random DAGs from hidden permutations; adding a reverse edge must make both return None. Removing out[::-1] should fail validity. |
| al19 | NOT RUN | DSU counts vs BFS on random graphs; height experiment on 100k chain unions for three heuristic settings — no-heuristic height sampling may take seconds; reduce n if slow. |
| al20 | NOT RUN | Dijkstra = Bellman-Ford = Floyd rows on random non-negative graphs. Negative example: strict Dijkstra should give A=2,C=3; lazy and Bellman-Ford A=1,C=2. |
| al21 | NOT RUN | Plain fib calls for n=25 should be 242,785 (text says about 240,000); memo currsize 26. Coin DP vs exhaustive; LIS tails vs all subsequences. |
| al22 | NOT RUN | Rolling-row edit distance vs memoised recursion; downwards knapsack vs subset brute force; upwards loop should disagree on most of 500 inputs (claim 'most' unverified). |
| al23 | NOT RUN | Burst balloons DP vs all orders; cooldown machine vs memoised search; distinct-digit reference 738 for N=1000 (hand-computed: 9+81+648). |
| al24 | NOT RUN | get_sum vs a+b incl. negatives; Single Number II/III with negatives; range AND vs loop; needs Python 3.10+ for bit_count. Removing MASK should hang on get_sum(-1,1). |
| al25 | NOT RUN | Fast power / nCr tables / gcd vs built-ins; shuffle frequencies for [1,2,3] over 60k runs: Fisher-Yates ≈0.17 each, naive three ≈0.19 and three ≈0.15 (5/27, 4/27). |
| al26 | PARTLY CHECKED | KMP/Z vs str.find on random ab strings. Verified separately that the while→if mutation fails random tests (e.g. pattern 'bbbba'). lps('abcabcabc') claim [0,0,0,1,2,3,4,5,6]. |
| al27 | NOT RUN | Fenwick sums and iterative min segment tree vs list under 60k random update/query pairs; prefix(l)→prefix(l+1) mutation should fail. |
| al28 | NOT RUN | Model-based fuzz: LRUCache vs SlowLRU, RandomizedSet vs set + pos invariant. Lab requires pasting the body's classes into the file. Mutations listed should be caught quickly. |
