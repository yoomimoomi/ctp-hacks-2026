# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A single-file webcam prototype (`scanner_prototype.py`) that classifies items held up to a webcam
against NYC DSNY/311 curbside recycling rules (article KA-02013). It opens a live OpenCV video feed
with a central 400x400 targeting box; when an item is held steady in the box for 1.5s (or the user
presses SPACE/`c`), the cropped region is sent to Gemini 2.5 Flash for structured classification, and
the result is printed and written to `classified_item.json`.

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

Run the scanner (opens webcam device index 0):

```bash
python scanner_prototype.py
```

Controls: `SPACE` or `c` forces an immediate capture; `q` quits.

Syntax-check without running (no webcam/API key needed):

```bash
python -m py_compile scanner_prototype.py
```

There is no test suite, linter, or build step configured in this repo.

## Architecture

Everything lives in `scanner_prototype.py`, structured in this order:

1. **Env check** — fails fast if `GEMINI_API_KEY` is missing.
2. **`NYCWasteClassification`** (Pydantic model) — the structured output schema Gemini is forced to
   return: `item_name`, `material_type`, `nyc_stream_category`, `bin_color`, `is_recyclable`,
   `preparation_instructions`, `nyc_rule_notes`.
3. **`SYSTEM_INSTRUCTION`** — encodes the actual NYC bin-routing rules (blue/green/brown/black/special
   disposal categories and their edge cases, e.g. plastic film and styrofoam are trash despite being
   plastic). This prompt *is* the business logic — changes to sorting rules go here, not in code.
4. **`classify_image()`** — sends a PIL image to `gemini-2.5-flash` with the schema + system
   instruction, writes the result to `classified_item.json`, and deliberately catches all exceptions
   so an API/network failure never crashes the live video loop.
5. **Scanner loop (`main`)** — per-frame motion detection: converts the ROI to grayscale, blurs it,
   and diffs against the previous frame (`MOTION_SCORE_THRESHOLD = 8.0` mean abs pixel diff) to decide
   "still" vs "moving". A 1.5s still timer (`STILL_THRESHOLD_SECONDS`) or a manual keypress triggers
   capture. The box color (red/yellow/green) and on-screen label are purely a function of
   still/triggered/flash state — read this block together when changing UX/timing behavior.

Key constants to know before tuning behavior: `ROI_SIZE`, `STILL_THRESHOLD_SECONDS`,
`MOTION_SCORE_THRESHOLD`.
