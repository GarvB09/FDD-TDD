# Deployment

| Piece | Host | Why |
|---|---|---|
| React frontend (`frontend/`) | **Vercel** | Static build, no server needed |
| Express backend (`backend/`) | **Render** (Docker) | Needs a long-running server, writes files, runs headless Chromium for PDF export |
| AI service (`ai-service/`) | **Render** (Docker) | Python + PyTorch (embedding model) is far over Vercel's function size limit |

The backend and AI service **cannot** run as Vercel serverless functions: generation takes 1–3 minutes, PDF export needs Chromium, and the AI service ships PyTorch.

Deploy in this order, because each step needs the URL from the one before it.

## 1. AI service (Render)

1. Render dashboard → **New → Blueprint** → select this repo (it reads `render.yaml`). This creates both `fdd-ai-service` and `fdd-backend`.
2. On `fdd-ai-service`, set the env var **`GROQ_API_KEY`** (get one at console.groq.com).
3. Wait for the deploy, then check `https://<ai-service>.onrender.com/health` returns `{"status":"ok"}`.

## 2. Backend (Render)

On `fdd-backend` set:

- **`AI_SERVICE_URL`** = the AI service URL from step 1 (no trailing slash)
- **`FRONTEND_URL`** = your Vercel URL from step 3. Several origins can be comma-separated, e.g. `https://fdd-tdd.vercel.app,http://localhost:3000`. Leave it as a placeholder for now and come back.

Check `https://<backend>.onrender.com/health`.

## 3. Frontend (Vercel)

1. Vercel → **Add New → Project** → import this repo.
2. Set **Root Directory** to `frontend`. (Framework preset: Create React App, detected from `vercel.json`.)
3. Add env var **`REACT_APP_API_URL`** = `https://<backend>.onrender.com/api`
   - It is baked in at build time, so set it *before* the first deploy (or redeploy after changing it).
4. Deploy, then copy the Vercel URL into the backend's `FRONTEND_URL` on Render and let it redeploy. Without this, the browser blocks every API call (CORS).

## Free tier without a card (no Blueprint)

Blueprints require a card on file. To stay free, create the services by hand instead: **New → Web Service → connect this repo → Runtime: Docker → Instance type: Free**.

| Service | Root Directory | Dockerfile Path | Env vars |
|---|---|---|---|
| AI service | `ai-service` | `./Dockerfile.lite` | `GROQ_API_KEY` |
| Backend | `backend` | `./Dockerfile` | `AI_SERVICE_URL`, `FRONTEND_URL` |

`Dockerfile.lite` skips PyTorch so it fits in the free 512 MB. The only difference: document-chunk selection falls back to the start of the document, so very long FDDs may generate slightly less well.

### Simplest free setup: one Render service for both

The root `Dockerfile` runs the backend and the lite AI service in a single container. Create ONE Web Service: Runtime **Docker**, **Root Directory empty**, **Dockerfile Path `./Dockerfile`**, Instance **Free**. Env vars: `GROQ_API_KEY` and `FRONTEND_URL` (no `AI_SERVICE_URL` needed). Then `REACT_APP_API_URL` on Vercel is `https://<this-service>.onrender.com/api`. Memory is tight on 512 MB (PDF export launches Chromium), so if it restarts during PDF export, upgrade the instance.

## Things to know

- **Memory:** the AI service loads PyTorch plus the embedding model. Render's free 512 MB instance will likely run out of memory; use at least a 2 GB instance for `fdd-ai-service`.
- **Cold starts:** free Render services sleep after inactivity; the first request can take ~30–60 s.
- **Storage is ephemeral:** uploads and generated TDDs are saved to the container's disk and are wiped on every redeploy/restart. Fine for a demo; for real use, attach a Render persistent disk to the backend (mount at `/app/generated_tdd` and `/app/uploads`) or move storage to a database/S3.
- **No authentication:** anyone with the URL can upload documents and spend your Groq quota. Don't share the link publicly without adding auth.
- **Groq limits:** generation takes ~1–3 minutes and is subject to your Groq free-tier token limits. There is a 60-second cooldown between generations (`GENERATE_COOLDOWN_SECONDS`).

## Local development (unchanged)

```
ai-service:  uvicorn main:app --port 8000      (needs GROQ_API_KEY)
backend:     AI_SERVICE_URL=http://localhost:8000 node server.js
frontend:    REACT_APP_API_URL=http://localhost:3001/api npm start
```
