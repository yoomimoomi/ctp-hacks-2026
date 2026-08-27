"""
NYC Waste Classifier - webcam scanner prototype.

Opens a webcam feed with a central 400x400 targeting box. Pressing SPACE/'c'
captures the ROI and sends it to Gemini 3.6 Flash for classification against
NYC DSNY / 311 recycling rules (KA-02013). The result is printed to stdout
and saved to classified_item.json.

Manual capture only for now; auto-capture on stillness will be added later.

Controls:
    SPACE or 'c' - capture
    'q'          - quit
"""

import io
import json
import os
import sys
import time

import cv2
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
rules. Respond only with data matching the required JSON schema.
"""

# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------

client = genai.Client()

# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------


def classify_image(pil_image: Image.Image) -> NYCWasteClassification | None:
    """Send a cropped ROI image to Gemini and return a validated classification.

    Returns None (and prints an error) instead of raising, so a network or
    API failure never crashes the live video loop.
    """
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
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

        payload = result.model_dump_json(indent=2)
        print("\n" + payload + "\n")

        with open("classified_item.json", "w", encoding="utf-8") as f:
            f.write(payload)

        return result

    except Exception as exc:  # noqa: BLE001 - deliberately broad to protect the video loop
        print(f"\n[ERROR] Classification failed: {exc}\n")
        return None


# ---------------------------------------------------------------------------
# Scanner loop
# ---------------------------------------------------------------------------

ROI_SIZE = 400

RED = (0, 0, 255)
GREEN = (0, 255, 0)


def get_roi_bounds(frame_width: int, frame_height: int) -> tuple[int, int, int, int]:
    x1 = frame_width // 2 - ROI_SIZE // 2
    y1 = frame_height // 2 - ROI_SIZE // 2
    x2 = x1 + ROI_SIZE
    y2 = y1 + ROI_SIZE
    return x1, y1, x2, y2


def main() -> None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: could not open webcam (device index 0).")
        sys.exit(1)

    flash_until = 0.0

    print("NYC Waste Classifier scanner running. Press SPACE/'c' to capture, 'q' to quit.")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("ERROR: failed to read frame from webcam.")
                break

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]
            x1, y1, x2, y2 = get_roi_bounds(w, h)
            roi = frame[y1:y2, x1:x2]

            now = time.time()

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            triggered = key == 32 or key == ord("c")

            if now < flash_until or triggered:
                box_color = GREEN
                label = "Captured!"
            else:
                box_color = RED
                label = "Align item inside box, press SPACE to capture"

            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 3)
            cv2.putText(
                frame, label, (x1, y1 - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, box_color, 2, cv2.LINE_AA,
            )

            cv2.imshow("NYC Waste Classifier", frame)

            if triggered:
                flash_until = time.time() + 0.4

                rgb_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_roi)
                classify_image(pil_image)

    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
