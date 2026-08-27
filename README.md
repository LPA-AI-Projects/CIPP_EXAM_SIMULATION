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

## Persistence note

Session and learner data lives in `data.json` next to `server.js`.
Railway's filesystem survives restarts but is **wiped on a fresh
deploy** unless you attach a Volume mounted at `/app` (or wherever
the service runs). For a training exercise that's usually fine — you
reset between sessions anyway via the trainer dashboard's **Reset
Simulation** button. If you want scores to survive redeploys, add a
Volume in Railway's dashboard (Settings → Volumes) pointed at the
app's working directory.

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
