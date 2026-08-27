# NYC Waste Classifier

A webcam-based scanner that classifies an item against NYC DSNY / 311 curbside
recycling rules (KA-02013) using Gemini. Point the camera at an item, capture
it, and get back which bin it belongs in, whether it's recyclable, and any
prep steps (rinse, empty, flatten, etc.).

## How it works

```
client (Next.js, browser webcam) → POST /scan → server (FastAPI) → Gemini → classification
```

The browser captures a frame from the webcam, crops it to the centered
targeting box, and uploads it to the backend. The backend forwards the image
to Gemini with a structured schema and NYC-specific classification rules, and
returns the parsed result to the frontend.

## Project structure

```
ctp-hacks-2026/
├── .venv/            # Python virtual environment (backend)
├── client/            # Next.js frontend
└── server/            # FastAPI backend
    ├── main.py
    └── requirements.txt
```

## Prerequisites

- Python 3.13 (via `.venv` — see note below on virtual environments)
- Node.js + npm
- A Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

> **Note on virtual environments:** this project has historically had two
> venvs floating around (`.venv` and an older `.venv-1`). **Use `.venv`** —
> it's the one with all backend dependencies installed and a current Python
> version. If commands below fail with `ModuleNotFoundError`, double check
> `.venv` is the one that's activated (your terminal prompt should show
> `(.venv)`).

## Backend setup

```bash
cd server
source ../.venv/bin/activate      # prompt should now show (.venv)
pip install -r requirements.txt
```

Set required environment variables **in the same terminal you'll run the
server from** (env vars don't carry across terminal tabs):

```bash
export GEMINI_API_KEY="your-api-key-here"
export GEMINI_MODEL="gemini-3.6-flash"    # see "Available models" below
```

Run the server:

```bash
uvicorn main:app --reload --port 8000
```

You should see `Application startup complete.` with no errors. Leave this
terminal running — it's a foreground process.

### Verifying the backend on its own

Before touching the frontend, confirm the backend works in isolation, from a
**second terminal tab**:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/opencv/version
curl -v -X POST http://127.0.0.1:8000/scan -F "file=@/path/to/any/image.jpg"
```

`/scan` should return classification JSON (`item_name`, `bin_color`,
`is_recyclable`, etc.). If it returns a `429 RESOURCE_EXHAUSTED` error, you've
hit the free-tier rate limit (20 requests/day per model as of writing) — wait
for the retry window in the error message, or temporarily switch
`GEMINI_MODEL` to a different model to keep testing.

## Frontend setup

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:3000**. Click "Check Backend" to confirm it can
reach the API, then allow camera access when prompted. Align an item inside
the red box and click "Capture & Classify."

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | server | Your Gemini API key. Required — the server exits immediately if unset. |
| `GEMINI_MODEL` | server | Model id to use for classification. Defaults to `gemini-3-flash` if unset — **override this**, see below. |
| `NEXT_PUBLIC_API_BASE_URL` | client | Backend URL. Defaults to `http://127.0.0.1:8000`, only needed if the backend runs elsewhere. |

### Available models

Run this to see every model your API key currently has access to:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
```

Look for one with `"generateContent"` in `supportedGenerationMethods`.
`gemini-3.6-flash` is confirmed working as of this writing; the code's
built-in default (`gemini-3-flash`) does **not** exist and will 404 — always
set `GEMINI_MODEL` explicitly rather than relying on the default.

## Common issues

- **`Could not import module "main"`** — you're running `uvicorn` from the
  wrong directory. It must be run from inside `server/`.
- **`GEMINI_API_KEY environment variable is not set`** — export it in the
  same terminal tab you're starting uvicorn from.
- **`ModuleNotFoundError: No module named 'cv2'`** — the wrong venv is
  active. Deactivate and re-activate `.venv` specifically.
- **`address already in use`** — a previous uvicorn process is still
  running. Find it with `lsof -i :8000` and stop it with `kill -9 <PID>`.
- **curl hangs / no response** — you probably ran curl in the same terminal
  tab as uvicorn, which is a foreground process and can't run both at once.
  Use two separate tabs.
- **`429 RESOURCE_EXHAUSTED`** — free-tier daily quota hit for that model.
  Wait for the reset window in the error, or switch models temporarily.

## Security note

Never commit `GEMINI_API_KEY` or paste it into chat tools, issue trackers,
or commit messages. If a key is ever exposed, revoke it immediately at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) and
generate a new one. Consider adding a `.env` file (git-ignored) with
`python-dotenv` for local development instead of exporting manually each
session.