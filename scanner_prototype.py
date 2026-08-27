"""
NYC Waste Classifier - classification backend.

A FastAPI app exposing POST /classify: accepts an uploaded image, sends it to
Gemini 3.6 Flash for structured classification against NYC DSNY / 311
recycling rules (KA-02013), and returns the classification as JSON for the
frontend to consume. The result is also written to classified_item.json.

Run with:
    uvicorn scanner_prototype:app --reload
or:
    python scanner_prototype.py
"""

import io
import os
import sys
from datetime import datetime

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Environment check
# ---------------------------------------------------------------------------

if not os.environ.get("GEMINI_API_KEY"):
    print(
        "ERROR: GEMINI_API_KEY environment variable is not set.\n"
        "Set it before running this script, e.g.:\n"
        "    setx GEMINI_API_KEY \"your-api-key-here\"   (Windows, new shells)\n"
        "    $env:GEMINI_API_KEY = \"your-api-key-here\" (PowerShell, current shell)"
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Pydantic schema
# ---------------------------------------------------------------------------


class NYCWasteClassification(BaseModel):
    item_name: str
    material_type: str
    nyc_stream_category: str
    bin_color: str
    is_recyclable: bool
    preparation_instructions: list[str]
    nyc_rule_notes: str
    estimated_weight_grams: float
    estimated_co2_grams: float
    captured_at: str


# ---------------------------------------------------------------------------
# Gemini system instruction (NYC DSNY / 311 rules, KA-02013)
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTION = """You are an official New York City Department of Sanitation (DSNY)
waste classification assistant, following the NYC 311 recycling guidelines
documented in article KA-02013.

Classify the item shown in the image into exactly one of these NYC curbside
collection streams, and be strict about the following routing rules:

- BLUE BIN ("Metal, Glass, Rigid Plastics, & Cartons"): rigid plastics
  (bottles, jugs, tubs, rigid containers), metal (cans, foil, empty aerosol
  cans), glass bottles/jars, and cartons (milk/juice cartons, aseptic
  containers).
- GREEN BIN ("Paper & Cardboard"): paper, newspaper, magazines, cardboard,
  and boxboard.
- BROWN BIN ("Curbside Composting"): food scraps, food-soiled paper, and
  other organic/compostable waste, where curbside composting applies.
- BLACK BIN / TRASH ("Trash / Non-Recyclable"): plastic film, plastic
  grocery/shopping bags, bubble wrap, styrofoam (expanded polystyrene) of
  any kind, squeeze pouches, and toothpaste tubes are NOT recyclable in NYC
  and must be classified as trash, even though they are made of plastic.
- SPECIAL DISPOSAL ("Special Disposal"): electronics, batteries, textiles,
  household chemicals, and other items requiring special drop-off or
  take-back programs rather than curbside pickup.

Always pick the single best-fitting category and bin color based on these
rules.

For estimated_weight_grams, give your best rough visual estimate of the
item's weight in grams based on its apparent size and material - there is no
scale or size reference in the frame, so treat this as approximate.

For estimated_co2_grams, give your best rough estimate of the item's carbon
footprint in grams of CO2-equivalent (embodied production plus disposal),
based on its material_type and your estimated_weight_grams - this is an
approximation for a rough per-item carbon footprint calculation, not a
citation of a specific lifecycle-assessment dataset.

For captured_at, put any placeholder string - it will be overwritten with
the actual capture timestamp and is not used from your response.

Respond only with data matching the required JSON schema.
"""

# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------

client = genai.Client()

# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------


def classify_image(pil_image: Image.Image) -> NYCWasteClassification:
    """Send an image to Gemini and return a validated classification.

    Raises on API/network/validation failure - the caller (the /classify
    endpoint) is responsible for turning that into an HTTP error response.
    """
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=[pil_image],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=NYCWasteClassification,
            # This is pure structured extraction, not reasoning - minimize
            # the model's internal thinking pass to cut round-trip latency.
            # thinking_budget=0 is rejected by gemini-3.6-flash (400), so
            # use the lowest supported thinking_level instead.
            thinking_config=types.ThinkingConfig(thinking_level="low"),
        ),
    )

    result = response.parsed
    if result is None:
        result = NYCWasteClassification.model_validate_json(response.text)

    # captured_at comes from the local clock, not Gemini's guess.
    result = result.model_copy(update={"captured_at": datetime.now().isoformat()})

    payload = result.model_dump_json(indent=2)
    print("\n" + payload + "\n")

    with open("classified_item.json", "w", encoding="utf-8") as f:
        f.write(payload)

    return result


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/classify", response_model=NYCWasteClassification)
async def classify(file: UploadFile = File(...)) -> NYCWasteClassification:
    data = await file.read()
    try:
        pil_image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    try:
        return classify_image(pil_image)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Classification failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
