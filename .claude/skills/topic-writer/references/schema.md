# Topic schema

One object per topic in `prep-console/content/tracks/<track>.json`. In the source file
(`content/topics/<track>/<id>.html`) the structured fields live in the `<script id="meta">` JSON block
and the HTML fields in `<section data-field="...">` blocks.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable, e.g. `net4`. Never change an existing id — progress is stored against it. |
| `t` | string | Title. |
| `tag` | string | Short group label shown on the card (e.g. `Transport`). |
| `sum` | string | One-sentence summary under the title (≤ 200 chars). Plain text. |
| `prereq` | `[id, refresher][]` | Topic ids from any track + one plain-text sentence recalling what the reader needs from it. Empty/omitted for true foundations. |
| `why` | HTML | |
| `primer` | HTML | |
| `body` | HTML | |
| `deep` | HTML | |
| `prod` | HTML | |
| `myths` | `[myth, reality][]` | Plain text or light inline HTML (`<code>`, `<strong>`). |
| `lab` | HTML | |
| `recap` | `string[]` | Each a full sentence. |
| `glossary` | `[term, definition][]` | Alphabetical. Definition in 1-2 plain sentences, no undefined jargon. |
| `viz` | string | Optional key of a legacy hand-built figure (`frontend/src/legacy/viz.js`). Keep if present. |
| `drill` | HTML | Starts with `<b>Label</b>`, then the scenario, then `<details><summary>Answer</summary>…</details>`. |
| `qa` | `[level, q, a]` or `[level, q, a, followup]` | level ∈ `E`, `M`, `H`. Answer: plain text, 2-6 sentences. Follow-up: the question the interviewer asks next, plus a 1-3 sentence answer, as one string ("Follow-up: … — …"). |
| `refs` | `[kind, title, note, url][]` | kind ∈ `docs`, `paper`, `post`, `code`, `tool`, `video`, `book`. https only. |

## HTML allowed in HTML fields

`<h4>` for headings (not h1-h3), `<p>`, `<ul>/<ol>/<li>`, `<strong>`, `<em>`, `<code>`, `<pre>`,
`<table>` (with `<thead>`), `<details>/<summary>`, `<figure>` + `<svg>` + `<figcaption>`, `<a href>`.
No `<script>`, no `<style>`, no `<section>` (the source parser splits on it), no class-dependent
layout the app doesn't define. Inside `<pre>`, escape `<`, `>` and `&`.
