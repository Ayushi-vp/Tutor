# AI Engineer Prep Console

The interview-prep console as a real app: a **React** frontend, a **Flask** API, and a
**SQLite** file that keeps your progress. It replaces the single-file console in `../src/`
and carries over everything it had, now with 72 design cases, 116 DSA problems, flashcards
and mock rounds. It has 12 learning tracks (159 topics): the AI tracks from the old console plus
Engineering tracks for senior-engineer interviews. It supports a small invited group: people sign in
with Google or GitHub, each person has their own progress, and admins manage the invite list. Every topic and design case is layered for beginner-to-expert reading: a
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

The first run creates `.env` from `.env.example` with a fresh `SECRET_KEY` and stops. Fill in
`ADMIN_EMAILS` (your own email) and either the OAuth keys below or `DEV_LOGIN=1` for a quick local
try, then run `.\start.ps1` again. Every setting is explained in `.env.example`.

Progress is written to `backend/prep.db`, one set of rows per person. Each person can export and
import their own data from **Account**. For the whole database, use the backup script (below).

### Accounts and invites

Only admins (`ADMIN_EMAILS`) and invited emails can sign in. Sign in as an admin, open **Admin**,
and add the emails of the people you want to let in. They sign in with a Google or GitHub account
that uses that email. Once someone has signed in, removing their invite does not lock them out;
disable the user in **Admin** instead (their progress is kept).

The first admin to sign in takes over any progress saved before accounts existed.

`DEV_LOGIN=1` shows a "sign in as any email" form. It works only for requests from this machine that did
not come through a proxy, so it is safe to leave on while developing, but keep it off on a shared host.

### Sign-in with Google and GitHub

Decide the public address first (`BASE_URL`, for example `https://mypc.tailnet-name.ts.net`), then
create one OAuth app per provider. The redirect URLs must match exactly.

**Google**: [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
OAuth consent screen (External; add your invited people as test users while the app is in testing) →
Credentials → Create credentials → OAuth client ID → Web application.
Authorized redirect URI: `<BASE_URL>/auth/callback/google`. Copy the client ID and secret into
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**GitHub**: [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps →
New OAuth App. Homepage URL: `<BASE_URL>`. Authorization callback URL: `<BASE_URL>/auth/callback/github`.
Generate a client secret and copy both into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

A provider whose keys are empty is hidden from the sign-in page. To also test sign-in locally, add
`http://localhost:5000/auth/callback/<provider>` as a second redirect URL (GitHub allows only one per app, so
create a separate dev app there).

### Sharing it from this PC (Tailscale Funnel)

The app listens on `127.0.0.1:5000` only. Tailscale Funnel gives it a public HTTPS address without
opening ports on your router:

1. In the Tailscale admin console, enable HTTPS certificates and Funnel for this machine
   (Access controls → add the `funnel` node attribute; the first `tailscale funnel` run links you there).
2. Run once (it persists across reboots):

   ```powershell
   tailscale funnel --bg 5000      # prints the https://<machine>.<tailnet>.ts.net URL
   tailscale funnel status
   tailscale funnel --https=443 off   # stop sharing
   ```

3. Put that URL in `.env` as `BASE_URL` (no trailing slash) and restart the app. An `https://` BASE_URL
   turns on secure cookies and trusts the proxy headers from Funnel automatically.

The app must be running and this PC awake. To keep it running without a terminal window:

```powershell
.\scripts\windows-task.ps1 -Install              # starts at sign-in, restarts if it crashes
.\scripts\windows-task.ps1 -Install -AtStartup   # starts at boot instead (run as admin)
.\scripts\windows-task.ps1 -Status
.\scripts\windows-task.ps1 -Restart              # after changing .env or pulling new code
.\scripts\windows-task.ps1 -Uninstall
```

This also schedules a nightly backup at 03:00. Logs go to `logs\app.log` and `logs\backup.log`.
If the app exits, the task starts it again after 10 seconds. Do not also run `.\start.ps1` in a terminal
while the task is installed: both need port 5000.

### Backups

```powershell
backend\.venv\Scripts\python backend\backup.py             # copies prep.db to backups\ (keeps 14)
backend\.venv\Scripts\python backend\backup.py --keep 30
```

It uses SQLite's online backup, so it is safe while the app is running. To restore, stop the app and
copy a backup over `backend\prep.db`. `backups\` is on the same disk; copy it somewhere else now and then.

### On a Linux server (Docker)

```bash
cd prep-console
cp .env.example .env    # fill it in: SECRET_KEY, BASE_URL, ADMIN_EMAILS, OAuth keys
docker compose up -d --build
```

The app listens on `127.0.0.1:5000` of the server and keeps its database in the `prep-data` volume.
For HTTPS, either run `tailscale funnel --bg 5000` on the server, or point a domain at it, set
`DOMAIN=` in `.env` and start the bundled Caddy with `docker compose --profile caddy up -d`.
Back up with `docker compose exec app python backend/backup.py` (lands in `/data/backups` in the volume).
The Docker files have not been tested on this Windows PC (Docker is not installed here); try them on the
server first.

To move from this PC to the server, stop the app here, copy `backend\prep.db` into the volume
(`docker compose cp prep.db app:/data/prep.db`, then
`docker compose exec -u root app chown prep:prep /data/prep.db` and `docker compose restart app`), and update `BASE_URL` and the OAuth
redirect URLs.

### While developing

Two terminals, with hot reload on the UI:

```powershell
backend\.venv\Scripts\python backend\app.py        # API on :5000
cd frontend; npm run dev                           # UI on http://localhost:5173 (proxies /api and /auth)
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
  auth.py                  Google/GitHub sign-in, sessions, invites, admin checks
  db.py                    SQLite schema and queries, per user
  backup.py                online copy of the database into backups/
  tests/                   pytest
frontend/src/
  content.ts               loads content/, derives the bank and pillars, defines the sidebar
  auth.tsx                 who is signed in; api.ts wraps fetch for the API
  store.tsx                progress state, synced to the API (falls back to the browser if it is down)
  views/                   one component per page
  components/              layout, cards, figure mounting
  legacy/viz.js            the hand-built SVG chart toolkit and figures, carried over unchanged
scripts/                   content helpers, the old-build migration, windows-task.ps1
Dockerfile, docker-compose.yml, Caddyfile   Linux server deployment
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
backend\.venv\Scripts\python -m pytest backend\tests    # API, accounts, backups: 27 tests
cd frontend; npm test                                   # content integrity, every page, every figure, sign-in: 88 tests
npm run typecheck
```

The content tests replace the old `check.js`: duplicate ids, malformed quick checks or sources,
missing figures, exercises without answers, designs without a primer or senior layer.

## Moving progress over from the old console

**Account → Import** accepts the old console's saved state unchanged. Open the old page,
run `copy(localStorage.getItem("apc.progress.v1"))` in the browser console, paste into a
`.json` file and import it. Ids are identical, so everything lines up.
