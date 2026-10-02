---
name: topic-writer
description: Writes or rewrites Prep Console learning topics (prep-console/content/tracks/*.json — networking, engineering at scale, Python, SWE, LLMs, ML, GPU and the other tracks) as long, complete, beginner-to-expert lessons of 5,000+ words, with diagrams, glossary, hands-on lab, misconceptions and 10-15 interview questions. Use this whenever the user wants to expand, deepen, rewrite, improve, fill in or "make detailed" any topic or whole track in the prep console, says the content is too short, too high-level, jumps around or is not beginner-friendly, or asks to add a new topic — even if they don't name the skill.
---

# Topic writer

Turns a Prep Console topic into a complete lesson: someone who has never met the subject should be
able to read it top to bottom and come out able to explain it in a senior interview. Length is not a
problem — the owner explicitly wants 5,000+ words per topic when that is what complete understanding
takes. Gaps, jumps and unexplained jargon *are* the problem.

## Why the old content fell short (don't repeat it)

The existing topics are accurate but written as cheat sheets for people who already know the
material:
- A 200-word primer, then a body that switches straight to expert shorthand (`cwnd`, `2 × MSL`, `AIMD`,
  `P2C with peak EWMA`) with nothing in between.
- Terms used before the topic that teaches them (the "type a URL" topic leans on TLS, ALPN, QUIC,
  anycast — all taught later).
- Bullet lists of facts instead of explanations: *what* without *why* or *how*.
- "Senior-level points" that are name-drops ("RACK", "qlog", "RPKI") — useless to a learner and
  dangerous in an interview, where naming what you can't explain backfires.
- No diagrams, no "try it yourself", no misconceptions, no recap, only 3 interview questions.

The drills and references were good — keep and extend them.

## Workflow

Work one topic at a time; a whole track is just this loop repeated. Scripts are in
`.claude/skills/topic-writer/scripts/` (run from the repo root, `C:\ra_projects\Tutor`).

1. **Read the neighbourhood.** Read the existing topic, and list the titles/ids of the whole track
   (and skim adjacent tracks' titles) so you know what the reader has already been taught and what
   comes later. That decides the prerequisites and which forward references need an inline gloss.

2. **Export a source file** to write in — HTML is far easier to author than escaped JSON strings:
   `python .claude/skills/topic-writer/scripts/topic.py export <track> <id>`
   → `prep-console/content/topics/<track>/<id>.html`. It carries over the existing fields; rewrite
   them in place and add the new ones. Design-case families work the same way: `<track>` can be
   `classic`, `infra`, `hld`, `lld` or `mlc`, and `merge` then writes `content/designs/<family>.json`
   (`merge <source> --dry-run` shows the target without writing).

3. **Plan before writing** (in your head or a scratch note, not in the file):
   - The learning path: the 6-12 concepts in the order a beginner must meet them. Each concept may
     only depend on ones before it.
   - Every term the lesson will use → defined in the lesson, covered by a listed prerequisite, or
     glossed inline with a pointer to the topic that covers it.
   - 2-4 diagrams: what each one shows that prose can't (a sequence over time, a structure, a flow).
   - The misconceptions a beginner actually holds, and the questions interviewers actually ask.

4. **Verify facts that could be wrong.** Numbers, defaults, version-specific behaviour, RFC numbers,
   limits (e.g. Linux TIME_WAIT duration, AWS NAT idle timeout, default isolation levels). Check
   official docs/RFCs with WebSearch/WebFetch rather than trusting memory. For fast-moving AI topics,
   research current practice first — the `deep-research` skill is available for heavy cases. Check
   every reference URL resolves.

5. **Write** following `references/style.md` (voice, section-by-section guidance, diagram rules).
   Read it before your first topic in a session.

6. **Check and fix:** `python .claude/skills/topic-writer/scripts/topic.py check <source.html>`.
   Errors must be fixed. Warnings are judgment calls — the acronym list in particular: each should be
   defined on first use, in the glossary, or clearly taught by a prerequisite. Then re-read the whole
   lesson once as the beginner: wherever you would stop and think "wait, what's that?", fix it.

7. **Merge:** `python .claude/skills/topic-writer/scripts/topic.py merge <source.html>` writes the
   topic into `content/tracks/<track>.json` (the file the app loads). Keep the source file — it's the
   editing surface for future changes.

8. **Report** briefly: word count per section, what's new, anything you could not verify.

## Topic structure

The fields and their exact shapes are in `references/schema.md`. In reading order:

| Field | Purpose |
|---|---|
| `why` | The problem this exists to solve, told as a concrete story. No jargon yet. |
| `prereq` | Earlier topics to know first, each with a one-line refresher. |
| `primer` | The mental model: analogy, the big picture, the first diagram. |
| `body` | How it actually works, step by step, every term defined, worked traces, diagrams. |
| `deep` | Senior layer — each advanced point *explained*, never just named. |
| `prod` | In production: failure modes, tuning, observability, real incidents. |
| `myths` | Misconception → what's actually true, and why people get it wrong. |
| `lab` | Try it yourself: commands/code to run, and what to look for in the output. |
| `recap` | 5-10 sentences a reader should be able to say from memory. |
| `glossary` | Every term of art in the lesson, defined in plain words. |
| `drill` | 1-2 realistic scenarios with a worked answer (keep the good existing ones). |
| `qa` | 10-15 interview questions, E→M→H, model answers, likely follow-up. |
| `refs` | 4-8 sources, best first. |

The frontend must render these fields; if `why`, `prod`, `myths`, `lab`, `recap`, `glossary` or
`prereq` don't show up in the app, the ItemCard in `prep-console/frontend/src/components/Card.tsx`
needs updating — say so rather than silently leaving content invisible.
