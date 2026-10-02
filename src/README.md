# AI Engineer Prep Console — source

The dashboard is one page assembled from numbered parts. Edit a part, run the build,
run the checker, publish.

```sh
sh src/build.sh          # assemble both outputs
node src/tools/check.js  # render every chart and view in a stubbed DOM
```

## Outputs

| File | What it is |
|---|---|
| `ai-prep-console.html` | **Offline build.** Own doctype/head, 22 IBM Plex woff2 faces inlined as data URIs, zero external resource loads. Double-click it. ~1.1 MB. |
| `src/build/artifact.html` | **Artifact build.** No doctype or `<head>` — claude.ai injects those plus a small reset. Fonts load from Google Fonts. This is the file that gets published. ~360 KB. |

Published at <https://claude.ai/artifact/3jqWWzrbnotxmWKbeA5BQZ>. Republish by passing
that URL; publishing without it creates a *duplicate* rather than updating.

The two copies keep **separate progress**. The published one syncs to your account via the
`db` capability; the offline one uses that browser's `localStorage` and cannot sync. Pick one
as your real tracker.

## Part order

Order matters — later parts read what earlier ones define.

| Part | Contents |
|---|---|
| `p01` | `<title>`, font links, the whole stylesheet and theme tokens |
| `p01b` | Extra CSS: flow diagrams, roadmap, flashcards, exercises, reading lists |
| `p02` | Page shell markup, helpers, theme toggle, the progress `Store` |
| `p03` | Chart toolkit — `lineChart`, `barsH`, `barsV`, `heat`, `fig`, tooltips |
| `p04` | DSA patterns and the problem list |
| `p05` | `TOPICS.ml`, `TOPICS.dl` |
| `p06` | `TOPICS.llm`, `TOPICS.aieng` |
| `p06b` | **Depth pack for LLM** — exercises and reading lists, patched onto `p06` |
| `p06f` | **Time series & AI track** — `TOPICS.ts`, 12 topics with body, drill and refs inline (no base part to patch) |
| `p07` | System design (HLD) and machine coding (LLD) |
| `p07b` | **Depth pack for HLD** — beginner primer, senior layer, exercise, reading list |
| `p07c` | **Depth pack for LLD** — same shape, tuned to the machine-coding round |
| `p07d` | **Classic product designs 1–5** — `CLASSICS`, written as 60-minute walkthroughs |
| `p07e` | **Classic product designs 6–10** — pushes onto `CLASSICS` |
| `p07f`–`p07h` | **Infrastructure building blocks** — `INFRA`, 11 primitives |
| `p07i` | **Machine coding, OOP classics** — 8 problems pushed onto `LLD` |
| `p07j` | **Machine coding, concurrency set** — 5 problems pushed onto `LLD` |
| `p08` | Question bank, roadmap, mock rounds, pillar definitions |
| `p08g` | **Time-series quick checks** — `QA_TS`, bank category `ts`, feeds mock round `m9` |
| `p09` | Static concept visualisations |
| `p10` | Interactive visualisations |
| `p10b` | Time-series figures: `tsAcf` (autocorrelation explorer), `tsBacktest` (split schemes) |
| `p11` | Views: overview, roadmap, DSA, topics, design, bank |
| `p12` | Flashcards, mock interview, search, router |
| `p13` | Event delegation and boot |
| `offline-head/mid/tail` | Document skeleton used only by the offline build |

To add a part, put it in `parts/` and add its name to `BODY` in `build.sh` in the right place.

## Adding a depth pack to another section

`p06b` is the template. It does not touch `p06` — it defines extras keyed by topic id and
merges them in, so the base content and the depth layer stay separately editable.

```js
const EXTRAS_ML = {
  ml2: {
    drill: `<b>Work it out</b>
      <p>…the question…</p>
      <details><summary>Answer</summary><p>…worked solution…</p></details>`,
    refs: [
      ["paper", "Title", "Author, year — why this one is worth your time.", "https://…"],
      ["video", "Title", "Length and what it covers.", "https://…"]
    ]
  }
};
Object.keys(EXTRAS_ML).forEach(id => {
  const t = TOPICS.ml.find(x => x.id === id);
  if (t) Object.assign(t, EXTRAS_ML[id]);
});
```

Ref kinds are `paper`, `post`, `video`, `docs`, `code`, `tool` — each gets its own colour
chip. The renderer (`refsHTML` in `p11`) and the CSS handle any section.

Packs exist for all four learning tracks: `p06b` llm, `p06c` ml, `p06d` dl, `p06e` aieng. The fifth track, time series (`p06f`), was written with its drills and refs inline.

## The system-design packs are a different shape

`p07b` and `p07c` patch `HLD` and `LLD`, and carry two extra fields the topic packs do not,
because a design case has to work for a beginner and a senior from the same page:

| Field | Renders as | What goes in it |
|---|---|---|
| `primer` | Tinted box **above** the body | Plain language. What the system is, the vocabulary defined, the naive approach and why it fails, one mental model. No jargon that is not defined in place. |
| `body` | The existing prose (in `p07`) | Unchanged — the working answer. |
| `deep` | Ruled section **below** the body | The senior layer: what separates a staff answer, the failure nobody designs for, the follow-up they will ask. |
| `drill` | Exercise box | Sizing arithmetic (HLD) or a trace/debug/review exercise (LLD). |
| `qa` / `refs` | As for topics | From `p08d` and the pack itself. |

`check.js` fails the build if any design is missing a `primer` or a `deep`, so the layering
stays complete as cases are added.

`p07d`/`p07e` hold `CLASSICS` — the ten "design X" product cases (URL shortener, chat, feed,
video, ride-hailing, file sync, ticketing, collaborative editor, payments, crawler). Same
fields, plus a `clock()` strip at the top of each `body` marking the minute budget per phase:

```js
${clock([["Scope","0–5"],["Numbers","5–12"],["API & data","12–20"],
         ["Architecture","20–30"],["Deep dive","30–46"],["Scale & failure","46–56"],["Close","56–60"]])}
```

They render through the same `viewDesign`, under the `classic` view.

`p07f`–`p07h` hold `INFRA` — the primitives the product designs assume exist (message queue,
key-value store, cache, notification service, job scheduler, metrics, object storage,
coordination service, stream counting, experimentation, typeahead), under the `infra` view.

`p07i` and `p07j` append to `LLD` rather than defining a new array, so machine coding is one
list of 20: the original 7, eight OOP classics (elevator, Splitwise, vending machine, board
game, KV with TTL, logging, text editor, calendar) and five concurrency problems (blocking
queue, thread pool, connection pool, read-write lock, deadlock-free transfer).

## Quick checks

`p08b` and `p08c` hold `QA_PACK`, keyed by topic id, three `[difficulty, question, answer]`
rows per topic; `p08d` holds `QA_DESIGN` (HLD/LLD), `p08e` holds `QA_CLASSIC` and `p08f`
holds `QA_INFRA` (building blocks + the new machine-coding problems), four rows per case. They must load
**after** `p08`, because the wiring at the end of each pushes every row into `BANK` as well
as attaching it to the topic or design:

```js
QA_PACK.ml2 = [
  ["M", "Does the bias-variance decomposition hold for classification?", "Not as clean algebra…"]
];
```

One authoring pass therefore feeds four surfaces — the topic page's Quick checks block, the
question bank, the flashcard decks and the mock-interview draws. Bank rows generated this way
carry `src`/`srcView`/`srcTitle` so the bank can link back to the topic they came from.

Ids are `qa-<topicId>-<n>`; `check.js` fails the build on a duplicate tracked id, a duplicate
bank id or a malformed row, so collisions surface immediately.

Design checks land in the `sys` (HLD, classics) and `code` (LLD) bank categories, which is what
lets the **AI system design**, **Classic system design**, **Infrastructure design** and
**Machine coding** mock rounds draw real follow-ups alongside the case title rather than
showing one prompt and nothing else.

Eight mock rounds now exist (`m1`–`m8`); note `m6` Behavioural is last in the array but is
declared after `m7`/`m8` in `p08`, so add new rounds *before* it to keep the ordering sane.

**Check the links before shipping.** Two of the first 93 were wrong from memory alone.

```sh
sh src/tools/check-links.sh        # every part
sh src/tools/check-links.sh p06b   # one part
```

A `403` is usually bot-blocking, not a dead link — open it in a browser before removing it.
`000` means the request never completed; `dl.acm.org`, `rsync.samba.org` and `martinfowler.com`
all refuse or hang from here, so prefer a mirror you can actually verify over a canonical URL
you cannot. The extractor only matches a **fully quoted** `"https://…"` token, so example URLs
written inside prose or `<code>` are ignored.

## Conventions worth keeping

- **Charts** use theme tokens (`var(--s1)`…`var(--s8)`) only, never literal colours, so both
  themes work. The eight-slot categorical palette was validated for colour-blind separation
  against this page's own surfaces; re-run a validator if you change it.
- Every data chart ships a legend (2+ series), a hover tooltip, keyboard-focusable marks and
  a **Show values** table. Three light-mode series colours sit below 3:1 contrast, so that
  table is an accessibility requirement, not a nicety.
- **Tooltips** split header from body on `~|~`. Do not use a raw control character — HTML
  attributes drop it.
- Tracked items need a **unique id** (`allIds()`); `check.js` fails the build on duplicates.
- Toggle visibility with `el.hidden`, never `style.display`.
- The offline build must stay self-contained — `build.sh` warns if a stylesheet, script,
  image or CSS `url()` ever points off-machine. Reading-list links are content and are fine.
