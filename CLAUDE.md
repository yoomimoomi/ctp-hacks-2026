# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A single-file classification backend (`scanner_prototype.py`) that classifies items against NYC
DSNY/311 curbside recycling rules (article KA-02013). It's a FastAPI app exposing `POST /classify`:
the frontend uploads an image (captured client-side, e.g. from a browser webcam), the image is sent
to Gemini 3.6 Flash for structured classification, and the result is returned as JSON in the HTTP
response (and also written to `classified_item.json` as a local debug artifact).

## Setup and running

```bash
pip install -r requirements.txt
```

Requires a `GEMINI_API_KEY` environment variable (checked at startup; the script exits with setup
instructions if unset):

```powershell
$env:GEMINI_API_KEY = "your-api-key-here"   # current PowerShell session
setx GEMINI_API_KEY "your-api-key-here"     # persist for new shells
```

Run the server:

```bash
uvicorn scanner_prototype:app --reload
```

or:

```bash
python scanner_prototype.py
```

Both serve on `http://localhost:8000`. Test the endpoint with:

```bash
curl -F "file=@some_image.jpg" http://localhost:8000/classify
```

Syntax-check without running (no API key needed):

```bash
python -m py_compile scanner_prototype.py
```

There is no test suite, linter, or build step configured in this repo.

## Architecture

Everything lives in `scanner_prototype.py`, structured in this order:

1. **Env check** — fails fast if `GEMINI_API_KEY` is missing.
2. **`NYCWasteClassification`** (Pydantic model) — the structured output schema Gemini is forced to
   return: `item_name`, `material_type`, `nyc_stream_category`, `bin_color`, `is_recyclable`,
   `preparation_instructions`, `nyc_rule_notes`, `estimated_weight_grams`, `estimated_co2_grams`.
   The weight and CO2 fields are rough LLM visual estimates (no scale, size reference, or lifecycle
   dataset is available from a single image), not real measurements — treat them as approximate.
   This is also the exact JSON shape returned by `POST /classify`.
3. **`SYSTEM_INSTRUCTION`** — encodes the actual NYC bin-routing rules (blue/green/brown/black/special
   disposal categories and their edge cases, e.g. plastic film and styrofoam are trash despite being
   plastic), plus guidance for the weight and CO2 estimates. This prompt *is* the business logic —
   changes to sorting rules go here, not in code.
4. **`classify_image()`** — sends a PIL image to `gemini-3.6-flash` with the schema + system
   instruction, adds a `captured_at` timestamp (from the local clock, not Gemini) to the output, and
   writes the result to `classified_item.json`. It lets exceptions propagate — the FastAPI endpoint
   is responsible for turning API/network/validation failures into an HTTP error response.
5. **FastAPI app (`app`)** — `POST /classify` accepts a multipart-uploaded image (`UploadFile`),
   decodes it with Pillow, calls `classify_image()`, and returns the result as JSON
   (`response_model=NYCWasteClassification`). Invalid image bytes → 400; classification failure →
   502. CORS is enabled for `http://localhost:3000` (the Next.js dev client).
