import os
import base64
import json

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Server API", version="1.0.0")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GeminiPromptRequest(BaseModel):
    prompt: str
    model: str = "gemini-1.5-flash"


class ScanAnalyzeRequest(BaseModel):
    image_base64: str
    model: str = "gemini-1.5-flash"


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/opencv/version")
def opencv_version() -> dict[str, str]:
    return {"opencv_version": cv2.__version__}


@app.post("/gemini/prompt")
def gemini_prompt(payload: GeminiPromptRequest) -> dict[str, str]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not set. Add it to your environment or .env file.",
        )

    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=payload.model,
            contents=payload.prompt,
        )
        text = response.text or ""
        return {"response": text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gemini request failed: {exc}") from exc


def _extract_data_url(image_base64: str) -> tuple[str, str]:
    if "," in image_base64:
        header, data = image_base64.split(",", 1)
        mime_type = "image/jpeg"
        if header.startswith("data:") and ";base64" in header:
            mime_type = header[5:].split(";base64", 1)[0] or mime_type
        return mime_type, data
    return "image/jpeg", image_base64


@app.post("/scan/analyze")
def scan_analyze(payload: ScanAnalyzeRequest) -> dict[str, str | bool]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not set. Add it to your environment or .env file.",
        )

    try:
        mime_type, image_data = _extract_data_url(payload.image_base64)
        base64.b64decode(image_data, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image payload: {exc}") from exc

    classification_prompt = """
You are a strict NYC sanitation classifier.
Given an item image, return ONLY valid JSON with this schema:
{
  "item_name": string,
  "material_type": string,
  "nyc_stream_category": string,
  "bin_color": string,
  "is_recyclable": boolean,
  "preparation_instructions": string[],
  "nyc_rule_notes": string
}

Rules:
- Use one category label in nyc_stream_category: "Recycle", "Compost", or "Trash".
- Use these bin colors exactly: "Blue", "Brown", or "Black".
- preparation_instructions must be concise and actionable.
- If uncertain, default to Trash/Black with clear note.
- Return JSON only. No markdown fences.
""".strip()

    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=payload.model,
            contents=[
                {
                    "text": classification_prompt,
                },
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": image_data,
                    }
                },
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gemini scan request failed: {exc}") from exc

    text = (response.text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()

    try:
        parsed = json.loads(text)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not parse Gemini scan JSON response: {exc}. Raw output: {text[:300]}",
        ) from exc

    required_keys = {
        "item_name",
        "material_type",
        "nyc_stream_category",
        "bin_color",
        "is_recyclable",
        "preparation_instructions",
        "nyc_rule_notes",
    }
    missing = required_keys.difference(parsed.keys())
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini response missing required keys: {sorted(missing)}",
        )

    return {
        "item_name": str(parsed["item_name"]),
        "material_type": str(parsed["material_type"]),
        "nyc_stream_category": str(parsed["nyc_stream_category"]),
        "bin_color": str(parsed["bin_color"]),
        "is_recyclable": bool(parsed["is_recyclable"]),
        "preparation_instructions": [
            str(instruction) for instruction in parsed["preparation_instructions"]
        ],
        "nyc_rule_notes": str(parsed["nyc_rule_notes"]),
    }
