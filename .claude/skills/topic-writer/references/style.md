# Writing style and section guide

## Who you are writing for

A capable engineer who is new to *this* subject, preparing for senior AI-engineer interviews. They
are smart and patient; they are not yet fluent. They should never need a second tab to understand a
sentence. By the end they should be able to (a) explain the idea to a friend, (b) trace it step by
step, (c) reason about trade-offs and failures, (d) survive three levels of interviewer follow-up.

## Voice

- Explain, don't list. Bullets are for genuinely parallel items (a set of options, a checklist). A
  mechanism, a cause and effect, or a trade-off is a paragraph.
- Always give the *why*: why the thing exists, why it's designed that way, why the alternative loses.
- Concrete before abstract: an example first, then the general rule. Use real numbers.
- Define every term the first time it appears, in the same sentence or the next: "the **congestion
  window** (cwnd) — the sender's own limit on how much unacknowledged data it lets itself have in
  flight". After that, use it freely.
- If a concept is taught in a later topic, give a 1-2 sentence working explanation right there and
  point ahead: "(TLS gets its own topic in net9 — for now, it's the step that encrypts the connection
  and proves the server is who it claims to be)".
- Build difficulty smoothly. Each paragraph should be a small step from the last. If you notice a
  jump, insert the missing step.
- Plain, direct sentences. No filler ("It's important to note that…", "In today's world…").

## Section by section

**why** (≥250 words) — Open with the problem, not the solution. A small story: what goes wrong
without this thing, who feels it. End with a one-paragraph preview of what the lesson covers.

**primer** (≥500) — The mental model. One strong analogy (and where the analogy breaks). The big
picture in a few moves, with the first diagram. A reader who stops here should have a correct, if
simplified, picture.

**body** (≥1,800; often 2,500-4,000) — The core. Walk the learning path in order, one `<h4>` per
concept. For each: what it is, how it works step by step, a worked trace with real values (a
packet-by-packet exchange, a request walking through components, a table evolving over time), and
what it costs or trades off. Put 1-2 diagrams here. Include short code/command snippets where they
make the idea concrete.

**deep** (≥700) — The senior layer. Every point gets a short paragraph that explains the mechanism
and why it matters, not a name. Rule of thumb: if you can't write three sentences about it, drop it.

**prod** (≥500) — What happens in real systems: characteristic failure modes and their symptoms,
the metrics and tools used to see them, the knobs people tune and when, one or two real incidents
or well-known war stories (cite them in refs if public).

**myths** (4-6) — Things a beginner (or a mid-level interviewee) genuinely believes. Reality should
explain why the myth is wrong, not just contradict it.

**lab** (≥250) — Something the reader can run on their own laptop in 5-20 minutes (Windows + WSL or
macOS/Linux; Python, curl, dig, ss, tcpdump/Wireshark, psql, docker, etc.). Numbered steps, the
exact commands, and — most important — *what to look for in the output and what it proves*.

**recap** (5-10) — Full sentences that together reconstruct the lesson.

**glossary** (10+) — Every term of art used, alphabetical, plain-language definitions.

**drill** — Keep a strong existing drill; improve its answer if it assumes knowledge the lesson
didn't teach. Add a second only if it exercises a different skill (diagnose vs design vs estimate).

**qa** (10-15) — Roughly 3-4 E, 5-6 M, 3-4 H. Questions an interviewer would really ask, including
"compare X and Y", "what happens when…", "how would you debug…", "design…". Model answers are what
a strong candidate would say out loud: direct first sentence, then the reasoning. Add a follow-up
for most M and H questions.

**refs** (4-8) — Best first. Prefer primary sources (RFCs, official docs, original papers) plus one
or two outstanding explainers. Every URL checked.

## Diagrams (inline SVG)

Diagrams are the biggest upgrade over the old content — a handshake, a packet's headers, a
replication flow or a cache-aside sequence is far clearer drawn. Aim for 2-4 per topic, each earning
its place by showing something prose can't (time sequence, structure, flow, state change).

Rules (enforced by `topic.py check` where possible):
- Wrap in `<figure>` with a `<figcaption>` that says what to notice, not just what it is.
- `viewBox` always; `width="100%"`; no fixed height. Design for ~640 wide; keep text ≥ 12px at that
  width and labels short so it still reads on a phone.
- Colours only through the app's theme variables, set in `style` (CSS `var()` does not work in SVG
  presentation attributes, and hex colours break dark mode):
  `style="fill:var(--surface-2);stroke:var(--line-2)"`. Text: `var(--ink)` / `var(--ink-2)` /
  `var(--muted)`. Emphasis: `var(--accent)`. Series: `var(--s1)`…`var(--s8)`. Good/bad:
  `var(--good)` / `var(--crit)`. Use `fill:none` explicitly on lines and paths.
- Font: `style="font-family:var(--sans);font-size:12px"`; `var(--mono)` for code/values.
- Arrowheads: define a `<marker>` in `<defs>` with a `style="fill:var(--ink-2)"` path; give marker
  ids a topic prefix (`net4-arrow`) so they don't collide with other topics on the same page.
- Add `role="img"` and an `aria-label` summarising the diagram.

Minimal sequence-diagram pattern:

```html
<figure>
<svg viewBox="0 0 640 220" width="100%" role="img" aria-label="Client and server exchange SYN, SYN-ACK, ACK">
  <defs><marker id="net4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink-2)"/></marker></defs>
  <g style="font-family:var(--sans);font-size:12px">
    <text x="120" y="20" text-anchor="middle" style="fill:var(--ink);font-weight:600">Client</text>
    <text x="520" y="20" text-anchor="middle" style="fill:var(--ink);font-weight:600">Server</text>
    <line x1="120" y1="30" x2="120" y2="210" style="stroke:var(--line-2);stroke-dasharray:4 4"/>
    <line x1="520" y1="30" x2="520" y2="210" style="stroke:var(--line-2);stroke-dasharray:4 4"/>
    <line x1="120" y1="50" x2="520" y2="90" marker-end="url(#net4-arrow)" style="stroke:var(--accent);stroke-width:1.5"/>
    <text x="320" y="62" text-anchor="middle" style="fill:var(--ink-2)">SYN  seq=1000</text>
  </g>
</svg>
<figcaption>Each arrow slopes downward because it takes time to cross the network: the vertical gap is one-way latency.</figcaption>
</figure>
```

## Tables

Use tables for real comparisons (TCP vs UDP vs QUIC; isolation level vs anomaly). Keep cells short.

## Self-review checklist (do this before merge)

- Read it as the beginner. Every "wait, what's that?" moment → fix.
- No term used before it is defined or covered by a prereq.
- No bullet list where a paragraph with reasoning belongs.
- Every deep/prod point explains a mechanism; no bare name-drops.
- Numbers and defaults verified; refs resolve.
- Diagrams render in both themes (only `var(--…)` colours) and read at phone width.
