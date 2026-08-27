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
