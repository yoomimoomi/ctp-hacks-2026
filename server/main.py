import os

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


#my code

# frontend endpoint
@app.get("/api/result")
def get_result() -> dict[str, str]:
    return {
        "material": "plastic",
        "description": "This is a recyclable plastic bottle.",
    }



# ---- PLACEHOLDER: swap this out once you know the real scanner call ----
async def call_scanner(image_bytes: bytes) -> ClassificationResult:
    """
    TEMPORARY placeholder standing in for the real scanner.
    Once you know how the scanner actually works, replace the body of
    this function only — nothing else in the file needs to change.
    """
    # fake "processing" so you can see the shape of a real async call
    return ClassificationResult(
        material="plastic",
        description="This is a recyclable plastic bottle. (placeholder result)",
    )
# --------------------------------------------------------------------


@app.post("/api/classify", response_model=ClassificationResult)
async def classify_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    image_bytes = await file.read()

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = await call_scanner(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Scanner failed: {exc}") from exc

    return result