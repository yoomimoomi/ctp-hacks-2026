"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

// Mirrors NYCWasteClassification in the backend's main.py
type NYCWasteClassification = {
  item_name: string;
  material_type: string;
  nyc_stream_category: string;
  bin_color: string;
  is_recyclable: boolean;
  preparation_instructions: string[];
  nyc_rule_notes: string;
};

// Same fixed capture resolution and ROI size as the original
// scanner_prototype.py, so the crop math lines up 1:1 with a known frame.
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const ROI_SIZE = 400;

type ScanState = "idle" | "scanning" | "captured";

function getRoiBounds(frameWidth: number, frameHeight: number) {
  const x1 = Math.round(frameWidth / 2 - ROI_SIZE / 2);
  const y1 = Math.round(frameHeight / 2 - ROI_SIZE / 2);
  return { x1, y1, x2: x1 + ROI_SIZE, y2: y1 + ROI_SIZE };
}

const STATE_STYLES: Record<ScanState, { border: string; label: string }> = {
  idle: {
    border: "border-red-500",
    label: "Align item inside box, press Capture",
  },
  scanning: {
    border: "border-yellow-400",
    label: "Classifying...",
  },
  captured: {
    border: "border-green-500",
    label: "Captured!",
  },
};

export default function Home() {
  const [health, setHealth] = useState("Not checked");
  const [opencvVersion, setOpenCvVersion] = useState("Not checked");
  const [error, setError] = useState("");

  const [cameraReady, setCameraReady] = useState(false);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<NYCWasteClassification | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const endpointText = useMemo(() => API_BASE_URL, []);
  const roi = useMemo(() => getRoiBounds(VIDEO_WIDTH, VIDEO_HEIGHT), []);

  // Start the webcam once, on mount. Stop all tracks on unmount so the
  // camera light turns off when the user navigates away.
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not access the webcam.";
        setError(message);
      }
    }

    startCamera();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function checkBackend() {
    setError("");
    try {
      const [healthRes, opencvRes] = await Promise.all([
        fetch(`${API_BASE_URL}/health`),
        fetch(`${API_BASE_URL}/opencv/version`),
      ]);

      if (!healthRes.ok) {
        throw new Error("Health check failed.");
      }
      if (!opencvRes.ok) {
        throw new Error("OpenCV endpoint failed.");
      }

      const healthData: { status: string } = await healthRes.json();
      const opencvData: { opencv_version: string } = await opencvRes.json();
      setHealth(healthData.status);
      setOpenCvVersion(opencvData.opencv_version);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error while checking backend.";
      setError(message);
    }
  }

  // Draw the full video frame to an offscreen canvas at native resolution,
  // then crop out just the centered ROI_SIZE x ROI_SIZE region - the same
  // region get_roi_bounds() used to crop server-side in scanner_prototype.py.
  // Only that crop gets sent to the backend, not the whole frame.
  async function handleCapture() {
    setError("");
    setResult(null);

    const video = videoRef.current;
    const fullCanvas = canvasRef.current;
    if (!video || !fullCanvas) return;

    fullCanvas.width = video.videoWidth || VIDEO_WIDTH;
    fullCanvas.height = video.videoHeight || VIDEO_HEIGHT;
    const fullCtx = fullCanvas.getContext("2d");
    if (!fullCtx) {
      setError("Could not get a 2D canvas context.");
      return;
    }
    fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

    const { x1, y1 } = getRoiBounds(fullCanvas.width, fullCanvas.height);

    const roiCanvas = document.createElement("canvas");
    roiCanvas.width = ROI_SIZE;
    roiCanvas.height = ROI_SIZE;
    const roiCtx = roiCanvas.getContext("2d");
    if (!roiCtx) {
      setError("Could not get a 2D canvas context for the ROI crop.");
      return;
    }
    roiCtx.drawImage(
      fullCanvas,
      x1,
      y1,
      ROI_SIZE,
      ROI_SIZE, // source rect: the centered ROI in the full frame
      0,
      0,
      ROI_SIZE,
      ROI_SIZE // dest rect: fill the whole ROI canvas
    );

    const blob: Blob | null = await new Promise((resolve) =>
      roiCanvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (!blob) {
      setError("Could not capture a frame from the video.");
      return;
    }

    setScanState("scanning");
    try {
      const formData = new FormData();
      formData.append("file", blob, "capture.jpg");

      const response = await fetch(`${API_BASE_URL}/scan`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let detail = "Scan failed.";
        try {
          const errorData: { detail?: string } = await response.json();
          detail = errorData.detail ?? detail;
        } catch {
          // ignore parse failure, keep generic message
        }
        throw new Error(detail);
      }

      const data: NYCWasteClassification = await response.json();
      setResult(data);
      setScanState("captured");
      setTimeout(() => setScanState("idle"), 400); // mirrors the prototype's brief green flash
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error while scanning.";
      setError(message);
      setScanState("idle");
    }
  }

  const { border, label } = STATE_STYLES[scanState];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <section className="rounded-lg border p-4">
        <h1 className="text-2xl font-bold">NYC Waste Classifier</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Frontend is calling backend at <code>{endpointText}</code>
        </p>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Backend Status</h2>
        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white"
          type="button"
          onClick={checkBackend}
        >
          Check Backend
        </button>
        <p className="mt-3 text-sm">Health: {health}</p>
        <p className="text-sm">OpenCV: {opencvVersion}</p>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Scanner</h2>

        <div
          className="relative mt-3 overflow-hidden rounded border bg-black"
          style={{ width: VIDEO_WIDTH, maxWidth: "100%" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
            className="block w-full"
          />
          {/* Targeting box overlay, positioned to match getRoiBounds() exactly */}
          <div
            className={`pointer-events-none absolute border-[3px] ${border}`}
            style={{
              left: `${(roi.x1 / VIDEO_WIDTH) * 100}%`,
              top: `${(roi.y1 / VIDEO_HEIGHT) * 100}%`,
              width: `${(ROI_SIZE / VIDEO_WIDTH) * 100}%`,
              height: `${(ROI_SIZE / VIDEO_HEIGHT) * 100}%`,
            }}
          >
            <span
              className={`absolute -top-6 left-0 whitespace-nowrap text-xs font-medium ${
                scanState === "idle"
                  ? "text-red-500"
                  : scanState === "scanning"
                    ? "text-yellow-400"
                    : "text-green-500"
              }`}
            >
              {label}
            </span>
          </div>
        </div>

        {/* Hidden canvas used only to grab a still frame from the video */}
        <canvas ref={canvasRef} className="hidden" />

        <button
          className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          type="button"
          onClick={handleCapture}
          disabled={!cameraReady || scanState === "scanning"}
        >
          {scanState === "scanning" ? "Classifying..." : "Capture & Classify"}
        </button>

        {result ? (
          <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium">Item</dt>
            <dd>{result.item_name}</dd>

            <dt className="font-medium">Material</dt>
            <dd>{result.material_type}</dd>

            <dt className="font-medium">Stream</dt>
            <dd>{result.nyc_stream_category}</dd>

            <dt className="font-medium">Bin color</dt>
            <dd>{result.bin_color}</dd>

            <dt className="font-medium">Recyclable</dt>
            <dd>{result.is_recyclable ? "Yes" : "No"}</dd>

            <dt className="font-medium">Prep steps</dt>
            <dd>
              <ul className="list-disc pl-4">
                {result.preparation_instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </dd>

            <dt className="font-medium">Notes</dt>
            <dd>{result.nyc_rule_notes}</dd>
          </dl>
        ) : null}
      </section>

      {error ? (
        <section className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </section>
      ) : null}
    </main>
  );
}