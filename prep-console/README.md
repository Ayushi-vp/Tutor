# AI Engineer Prep Console

The interview-prep console as a real app: a **React** frontend, a **Flask** API, and a
**SQLite** file that keeps your progress. It replaces the single-file console in `../src/`
and carries over everything it had: 49 design cases, 116 DSA problems, 25 figures, flashcards
and mock rounds. It has 9 learning tracks (128 topics): the 5 AI tracks from the old console plus 4 Engineering
tracks for senior-engineer interviews (software engineering, Python, engineering at scale and
networking). Every topic and design case is layered for beginner-to-expert reading: a
"Start here" primer, the core body, and a "Going deeper" senior layer, then an exercise,
quick checks and sources.

## Run it

First time only:

```powershell
cd prep-console
python -m venv backend\.venv
backend\.venv\Scripts\pip install -r backend\requirements.txt
cd frontend; npm install; npm run build; cd ..
```

Then, every time:

```powershell
.\start.ps1          # builds if needed, then serves http://localhost:5000
```

Progress is written to `backend/prep.db`. Back it up from **Your data → Export**, or just copy the file.

### From your other devices (Tailscale)

The app listens on `127.0.0.1:5000` only, served by waitress. Remote access goes through
Tailscale, so it is reachable only by devices signed into the same tailnet — there is no login,
so do not expose it any other way.

```powershell
tailscale serve --bg --http=80 http://127.0.0.1:5000   # once; persists across reboots
tailscale serve status                                  # shows the tailnet URL
tailscale serve --http=80 off                           # stop sharing
```

Open `http://<machine>.<tailnet>.ts.net/` from a phone or laptop running Tailscale. The app itself
must be running (`.\start.ps1`) and this machine awake. Testing that URL from this machine hits the
local IIS on port 80 instead — test from another device.

### While developing

Two terminals, with hot reload on the UI:

```powershell
backend\.venv\Scripts\python backend\app.py        # API on :5000
cd frontend; npm run dev                           # UI on http://localhost:5173 (proxies /api)
```

## Layout

```
content/                 everything the app teaches — edit these, not code
  tracks/<track>.json      learning topics: body, figure, exercise, quick checks, sources
  designs/<family>.json    design cases: primer, body, senior layer, exercise, checks, sources
  dsa.json, patterns.json  problem list and the 21 patterns
  bank.json                hand-written bank questions (topic quick checks are added automatically)
  roadmap.json, rounds.json, views.json, meta.json
backend/
  app.py                   Flask routes; also serves frontend/dist
  db.py                    SQLite schema and queries
  tests/                   pytest
frontend/src/
  content.ts               loads content/, derives the bank and pillars, defines the sidebar
  store.tsx                progress state, synced to the API (falls back to the browser if it is down)
  views/                   one component per page
  components/              layout, cards, figure mounting
  legacy/viz.js            the hand-built SVG chart toolkit and figures, carried over unchanged
scripts/                   one-off migration from the old single-file build
```

## Common changes

**Edit or add a topic** — edit `content/tracks/<track>.json`. Optional `primer` (beginner layer)
and `deep` (senior layer) HTML fields render above and below the body. Each topic is
`{ id, t, tag, sum, body, viz?, drill?, qa?, refs? }`; `body` and `drill` are HTML.
`qa` rows are `[difficulty, question, answer]` and appear in the bank, flashcards and mock rounds too.
Ids must stay unique and stable — progress is keyed by them.

**Add a whole track** — write `content/tracks/<key>.json`, then run it through the link checker:
`python scripts/check_links.py tracks/<key>.json`. Then register it once with `python scripts/add_track.py`
(see its docstring). The script handles everything below for an Engineering track.
By hand: add an entry in `content/views.json`,
then in `frontend/src/content.ts` import it into `TRACKS`, give it a bank category in `TRACK_CAT`,
a pillar in `PILLARS` and a line in `NAV`. If its checks need a new bank category, add it to
`content/meta.json` `cats`, and add a mock round in `content/rounds.json` if you want one.

**Add a figure** — add `VIZ.<name> = { html(), init?(el) }` to `frontend/src/legacy/viz.js`
(or write a React component and render it from `ItemCard`), then set `"viz": "<name>"` on a topic.

**Add an API field** — table in `backend/db.py`, route in `backend/app.py`, a test in
`backend/tests/test_api.py`, and a mutation in `frontend/src/store.tsx`.

## Checks

```powershell
backend\.venv\Scripts\python -m pytest backend\tests    # API: 6 tests
cd frontend; npm test                                   # content integrity, every page, every figure: 66 tests
npm run typecheck
```

The content tests replace the old `check.js`: duplicate ids, malformed quick checks or sources,
missing figures, exercises without answers, designs without a primer or senior layer.

## Moving progress over from the old console

**Your data → Import** accepts the old console's saved state unchanged. Open the old page,
run `copy(localStorage.getItem("apc.progress.v1"))` in the browser console, paste into a
`.json` file and import it. Ids are identical, so everything lines up.
