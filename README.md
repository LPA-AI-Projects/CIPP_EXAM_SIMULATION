# CIPP Exam Simulation — Learners Point

A live, timed CIPP practice exam with a learner login, a trainer-controlled
waiting room, and a real-time trainer dashboard. This is the standalone
(Node/Express) build of the app, ready to deploy on Railway.

## What's in this folder

```
server.js        Express server — serves the frontend and a small
                  key/value API that the app uses for live sync
package.json      Node dependencies (just Express) and the start script
Procfile          Tells Railway how to run the app
public/index.html The entire app — landing page, learner flow, exam
                  engine, results, and trainer dashboard
data.json         Created automatically at runtime — where session and
                  learner data is stored (not checked into git)
```

## Deploying on Railway

**Option A — from this folder directly (Railway CLI)**
1. Install the CLI if you don't have it: `npm i -g @railway/cli`
2. From this folder: `railway login`, then `railway init`, then `railway up`
3. Once deployed, run `railway domain` to get a public URL

**Option B — from GitHub**
1. Push this folder to a new GitHub repo
2. In Railway: New Project → Deploy from GitHub repo → select it
3. Railway auto-detects the Node app from `package.json` and runs
   `npm install` then `npm start` — no extra configuration needed
4. Once it's deployed, open Settings → Networking → Generate Domain to
   get a public URL

Either way, no environment variables are required to get it running.

## Persistence — Railway PostgreSQL (recommended)

Participant data (learner progress, session state, scores) is stored in
**PostgreSQL** when `DATABASE_URL` is set. Without it, the app falls
back to `data.json` for local development only.

### Step-by-step: add Railway PostgreSQL

1. **Open your Railway project**
   Go to [railway.app](https://railway.app) and open the project that
   deploys [CIPP_EXAM_SIMULATION](https://github.com/LPA-AI-Projects/CIPP_EXAM_SIMULATION).

2. **Add a PostgreSQL database**
   - Click **+ New** (or **Create**) in the project canvas
   - Choose **Database** → **PostgreSQL**
   - Railway creates a Postgres service and provisions a database

3. **Connect the database to your web app**
   - Click your **web app service** (the Node/Express one, not Postgres)
   - Open the **Variables** tab
   - Click **+ New Variable** → **Add Reference**
   - Select the PostgreSQL service → choose **`DATABASE_URL`**
   - Save — Railway will redeploy the web app automatically

4. **Wait for redeploy**
   - Open the web service **Deployments** tab
   - Wait until the latest deploy shows **Success**
   - Check **Deploy Logs** — you should see:
     `Using PostgreSQL for participant data`

5. **Verify it works**
   - Open your public URL + `/api/health`
   - You should see: `{"ok":true,"storage":"postgres"}`
   - Run a test session: have a learner join, then check the trainer
     dashboard — data now persists across redeploys and restarts

6. **Optional — browse stored data**
   - Click the **PostgreSQL** service in Railway
   - Open the **Data** tab (or connect with any Postgres client using
     the credentials from the **Connect** tab)
   - Participant rows live in the `kv_store` table:
     - `cipp:session-state` — current session (waiting / active)
     - `cipp:progress:<id>` — each learner's name, email, answers, scores

### What gets saved

| Key pattern | Contents |
|---|---|
| `cipp:session-state` | Session status, start time, session ID |
| `cipp:progress:*` | Per-learner progress, answers, scores, timestamps |

Data survives Railway redeploys. Use the trainer dashboard **Reset
Simulation** button to start a fresh session (clears progress keys and
rotates the session ID).

### Local development

Without `DATABASE_URL`, the app uses `data.json` automatically:

```
npm install
npm start
```

To test with Postgres locally, set `DATABASE_URL` to a local or cloud
Postgres connection string before running `npm start`.

## How it works

- The frontend is a single self-contained HTML file (no build step,
  no framework) — everything from the exam questions to the trainer
  dashboard lives in `public/index.html`.
- It talks to the backend through a small shim (`window.storage`) at
  the top of that file, which calls the API below instead of a
  browser database. That's the *only* backend-specific part of the
  frontend — the rest of the app logic is unchanged from the version
  built for Claude's own artifact environment.
- The API is deliberately tiny:
  - `GET /api/kv?prefix=...` — list keys
  - `GET /api/kv/:key` — read a value
  - `PUT /api/kv/:key` — write a value (body: `{"value": "..."}`)
  - `DELETE /api/kv/:key` — delete a value
- The trainer dashboard and every learner's waiting/exam screen poll
  this API every few seconds, which is what makes "Start Simulation"
  and "Reset Simulation" apply live across every open browser.

## Access

- **Learners** just enter their name and email — no account needed.
- **Trainers** use the access code `2468` on the same landing page.
  Change this in `public/index.html` (search for `'2468'`) before
  sharing the link publicly if you want a different code.

## Local development

```
npm install
npm start
```

Then open `http://localhost:3000`.
