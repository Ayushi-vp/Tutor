# ML track — lab notes (fix later)

Per the user (2026-09-28): focus on content; don't spend time testing labs. Log anything
to recheck here. Labs are NumPy-only (gpt_env has no scikit-learn). Run with
`/c/ra_projects/how-to-train-your-gpt/gpt_env/Scripts/python.exe` (Python 3.12.10).

| Topic | Lab status | Notes |
|---|---|---|
| ml1 | Tested, output matches text | — |
| ml2 | Tested, output matches text (table in body copied from the run) | Degree 9 intentionally omitted: some resamples explode (mentioned in lab text). |
| ml4 | NOT RUN | Expected: one step loss 0.234; raw x converges at lr 0.17, diverges at 0.19 (limit ≈ 0.18); centred x converges at lr 0.9 in 20 steps; momentum claim ("far fewer steps") unverified — may need rewording. |
| ml5 | NOT RUN | Expected: best constants MSE 292, MAE 120, Huber 127.5 (checked separately), pinball 0.9 value not pre-computed — confirm and put the exact number in the "What to look for" text. Brute-force grid of 35,001 points × list comprehension may be slow-ish (fine). Softmax/gradient numbers were verified separately. |
| ml6 | NOT RUN | Expected: part 1 weights ≈ (1.5, −0.7), b ≈ −1.0, mean p = rate; part 2 unpenalised w grows with steps; part 3 corrected mean ≈ true rate. lr=0.5 with 3000 steps on 20k rows — check convergence; the separation loss values quoted in the body (0.338/0.181/0.040/0.0034) were verified separately. |
| ml7 | NOT RUN | Expected: threshold rows match body table; AUC 0.875, AP 0.854 (both hand-computed); prevalence loop 0.941/0.64/0.139. `&amp;` in the pre block is HTML-escaped (renders as &). |
| ml8 | NOT RUN | Expected: plain vs weighted AUC nearly equal; weighted mean p ≫ true rate (~2%); corrected mean ≈ true rate; plain recall rises as threshold drops. Intercept −4.2 chosen to give "about 2%" positives — not verified; adjust if the rate is off. Correction formula is exact only for well-specified LR — corrected mean may be close, not equal. |
| ml9 | NOT RUN | Expected: "selection before CV" well above 0.5 (maybe 0.8–0.95), "inside CV" ≈ 0.5. Exact values unknown — body text avoids quoting them. |
| ml10 | NOT RUN | Expected: best split near x = 0; boosting val MSE flattens near 0.09 and "eventually creeps up" (claim unverified with stumps at lr 0.1 over 300 rounds — may not creep up; reword if not). Stump search is O(n) thresholds × 300 rounds — fine. |
| ml11 | NOT RUN | Expected: relative contrast shrinks with d; toy IVF recall rises with nprobe. Centroids are random data points (no k-means) — recall at nprobe=1 might be low; text claims "high recall while scanning a small fraction" — verify and adjust wording. `&amp;` in pre is HTML-escaped. |
| ml12 | NOT RUN | Expected: silhouette peaks at k=3 on blobs; ring shares ≈ 0.5. Silhouette uses an n×n distance matrix (300² fine). k-means++ `p=d2/d2.sum()` fails if d2 sums to 0 (duplicate points) — unlikely here. |
| ml13 | NOT RUN | Part 1 numbers hand-verified (eigen 1.5/0.5, recon error 1.0). Part 2: "first three components explain most variance" — confirm with 0.3 noise; Part 3 corrupted rows error ≫ normal — likely but unverified. |
| ml14 | NOT RUN | Parts 1–3 match hand-computed values (0.061, 0.0995, 0.261, 0.228). Part 4: accuracy drop and PSI size not pre-computed — the "one-feature model" thresholding at the median may show only a modest drop; confirm and tune the undercount range if the effect is too small to see. |
| ml15 | NOT RUN | Expected Platt a ≈ 0.4, b ≈ 0; ECE drops for both calibrators. PAV loop uses `del` inside a Python list over 15,000 points — O(n²) worst case, may be slow (seconds to a minute); if too slow, replace with a stack-based PAV. |
| ml16 | NOT RUN | Parts 1–3 numbers verified separately (82,236; z 2.54, p 0.011, CI [0.00057, 0.00443]; chi² 51.2). Part 4 is the same simulation used to verify the peeking figures (0.051/0.141/0.198/0.251 with seed 0) — should reproduce. |
| ml3 | Tested, output matches text (lasso table in body copied from the run) | Prostate case numbers come from a separate reproduction script (not the lab); LS 0.521 matches ESL Table 3.3. |
| ml17 | NOT RUN | Expected: true ATE 0.052; naive diff ≈ 0.26 (hand-computed from the generating probabilities, not from a run); stratum gaps ≈ 0.01 / 0.08; IPW ≈ 0.052; max weight 5. Effective-n value not pre-computed. `&` inside the pre block is written `&amp;` — renders as &. |
| ml18 | NOT RUN | Pegasos without a bias term (blobs symmetric about the origin). Claims to confirm: margin width shrinks and support-vector count falls as C grows; w direction ≈ (1.5, 1.0). With C=100, λ=1/40000 and η=1/(λt) the early steps are huge — results may be noisy; increase steps if so. Loss table (hinge/logistic) hand-verified. |
| ml19 | NOT RUN | KM column, exposure 68, λ 0.0735, median 9.4, log-rank O=3 E=2.16 V=1.21 χ²=0.58 all verified with a separate script (same data). Naive means 5.6 / 6.8 hand-checked. |
| ml20 | NOT RUN | TF-IDF numbers (d2 .632/.316, smoothed d3 .844/.536, cosine d1·d2 ≈ .365) and NB P(C)≈0.71 verified separately. Bigram NB on "app arrived broken" result not pre-computed. The "add 'not great app'" exercise outcome not pre-computed. |
| ml21 | NOT RUN | Negative-sampling step (loss 1.334 → 1.309, grad (−0.021, −0.352)), subsampling 0.0141, noise probs .839/.161, king analogy 0.996 verified separately. Doctor analogy: nurse ≈ 0.98 first, doctor ≈ 0.79 — verified by hand arithmetic, not by running the lab. The "shrink nurse's 2nd coordinate to 0.05" variant was checked: woman 0.867, doctor 0.787, nurse 0.781 (unexcluded). |
| ml22 | NOT RUN | Viterbi δ values, B-I-O path, 0.00216, P(x) ≈ 0.00257, share 0.84 verified separately; span F1 0.333 and token accuracy 0.625 checked by hand-tracing the `spans` helper. Closing exercise reworded during writing: flip to B B O happens when B→I < 0.06 (hand-derived; A rows then no longer sum to 1 — fine for the demo, mention if a reader asks). |
