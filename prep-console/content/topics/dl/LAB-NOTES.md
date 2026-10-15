# Deep learning track — lab notes

Doubts and unverified steps in the dl topic labs, to fix later.

## dl12 Graph neural networks (added 2026-10-10)
- The NumPy GCN script was not run as a lab. Its numbers (Â entries, ÂX, the ReLU output and the
  cosine column 0 / 0.764 / 0.945 / 0.996 / 1.000) come from a one-off script with the same graph,
  features and W, so they should match; confirm the printed formatting.
- The "Try" suggestion (residual `H = A_hat @ H + X` in a loop) is untested; with no normalisation the
  vector norms grow every step, so the cosine claim should be checked and the wording adjusted if needed.

## dl13 Self-supervised learning (added 2026-10-10)
- The InfoNCE script was run once with the gpt_env NumPy (seed 0). Quoted values: noise 1.0 loss 4.847
  at τ = 1 and 0.294 at τ = 0.1; hardest-negative share 0.005 at τ = 1 and 0.545 at τ = 0.02; collapsed
  encoder 5.545 = log 256. Other NumPy versions may differ slightly in the random draws.
- The "Try" suggestion (planting near-duplicate anchors as false negatives) has no code; untested.
