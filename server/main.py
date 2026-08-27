"""
NYC Waste Classifier - FastAPI backend.

Routes:
    GET  /health           - liveness check
    GET  /opencv/version   - reports the OpenCV version in use
    POST /scan             - accepts an uploaded image (multipart/form-data,
                              field name "file"), classifies it via Gemini,
                              returns a NYCWasteClassification JSON object

Design change from scanner_prototype.py:
    The original script captured frames with cv2.VideoCapture(), drew a live
    cv2.imshow() window, and waited for a SPACE/'c' keypress inside that
    window. None of that works behind an HTTP request - a browser can't
    press a key inside a server-side OpenCV window. So capture now happens
    in the browser instead (webcam -> <video> -> <canvas> -> blob), and this
    backend does exactly one thing per request: take an already-captured
    image and classify it. classify_image() below is the same logic as the
    prototype, just called from a route handler instead of a background
    thread inside a GUI loop.

Run with:
    uvicorn main:app --reload --port 8000

Requires:
    GEMINI_API_KEY set in the environment.
"""

import io
import os
import sys

import cv2
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
        "Set it before running this server, e.g.:\n"
        '    export GEMINI_API_KEY="your-api-key-here"        (macOS/Linux)\n'
        '    $env:GEMINI_API_KEY = "your-api-key-here"         (PowerShell)'
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Schema - identical to the prototype, kept here so the response shape is
# stable and self-documenting via FastAPI's response_model.
# ---------------------------------------------------------------------------


class NYCWasteClassification(BaseModel):
    item_name: str
    material_type: str
    nyc_stream_category: str
    bin_color: str
    is_recyclable: bool
    preparation_instructions: list[str]
    nyc_rule_notes: str


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
rules. Respond only with data matching the required JSON schema.
"""

# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------

# NOTE: "gemini-3.6-flash" (used in the original prototype) does not appear
# to be a real model id - the current Flash line is "gemini-3-flash".
# Confirm the exact id your API key has access to in Google AI Studio and
# set GEMINI_MODEL accordingly before relying on this in production.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash")

client = genai.Client()

# ---------------------------------------------------------------------------
# Classification (same logic as scanner_prototype.py's classify_image,
# minus the "write to classified_item.json / print to stdout" side effects
# that only made sense for a local script)
# ---------------------------------------------------------------------------

CAPTURE_SIZE = 256


def classify_image(pil_image: Image.Image) -> NYCWasteClassification:
    """Send an image to Gemini and return a validated classification.

    Raises on failure instead of swallowing the error - the route handler
    below is responsible for turning that into an HTTP error response.
    """
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[pil_image],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=NYCWasteClassification,
        ),
    )

    result = response.parsed
    if result is None:
        result = NYCWasteClassification.model_validate_json(response.text)

    return result


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="NYC Waste Classifier API")

# Without this, the browser blocks every fetch() from the Next.js dev server
# (localhost:3000) with a CORS error before your code even runs.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/opencv/version")
def opencv_version():
    return {"opencv_version": cv2.__version__}


@app.post("/scan", response_model=NYCWasteClassification)
async def scan(file: UploadFile = File(...)):
    """Classify a single uploaded image.

    Expects multipart/form-data with an image file under the field name
    "file" - this is what a browser <canvas>.toBlob() capture, appended to
    a FormData object, produces by default.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    raw_bytes = await file.read()
    try:
        pil_image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode uploaded image.")

    pil_image = pil_image.resize((CAPTURE_SIZE, CAPTURE_SIZE))

    try:
        return classify_image(pil_image)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Classification failed: {exc}")