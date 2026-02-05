# Deploy (MongoDB Atlas + Render + Vercel)

## 1) MongoDB Atlas
Create a free Atlas cluster and copy the **Drivers** connection string.

**Recommended URI format**
Use a URI that includes the database name and standard options:

`mongodb+srv://<USER>:<PASS>@<CLUSTER>.mongodb.net/patrol_db?retryWrites=true&w=majority`

## 2) Render (Backend - FastAPI)
Create a **Web Service** from this GitHub repo.

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Environment variables (Render)
- `MONGO_URL` = your Atlas URI
- `DB_NAME` = `patrol_db` (or your chosen DB name)

Optional (debug only):
- `MONGO_TLS_INSECURE` = `true` (ONLY if you are diagnosing TLS problems)

### Health check
Open: `/docs` on your Render URL to confirm the backend is live.

## 3) Vercel (Frontend - React)
Import the repo in Vercel.

- Root Directory: `frontend`
- Env var: `REACT_APP_BACKEND_URL` = your Render backend URL (e.g. `https://your-service.onrender.com`)
