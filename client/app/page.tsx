"use client";

import { FormEvent, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function Home() {
  const [health, setHealth] = useState("Not checked");
  const [opencvVersion, setOpenCvVersion] = useState("Not checked");
  const [prompt, setPrompt] = useState("");
  const [geminiOutput, setGeminiOutput] = useState("");
  const [loadingGemini, setLoadingGemini] = useState(false);
  const [error, setError] = useState("");

  const endpointText = useMemo(() => API_BASE_URL, []);

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

  async function handleGeminiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setGeminiOutput("");

    if (!prompt.trim()) {
      setError("Please enter a prompt first.");
      return;
    }

    setLoadingGemini(true);

    try {
      const response = await fetch(`${API_BASE_URL}/gemini/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          model: "gemini-1.5-flash",
        }),
      });

      if (!response.ok) {
        const errorData: { detail?: string } = await response.json();
        throw new Error(errorData.detail ?? "Gemini request failed.");
      }

      const data: { response: string } = await response.json();
      setGeminiOutput(data.response || "(Empty response)");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error while calling Gemini.";
      setError(message);
    } finally {
      setLoadingGemini(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <section className="rounded-lg border p-4">
        <h1 className="text-2xl font-bold">Next.js + FastAPI Connection</h1>
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
        <h2 className="text-lg font-semibold">Gemini Prompt</h2>
        <form className="mt-3 flex flex-col gap-3" onSubmit={handleGeminiSubmit}>
          <textarea
            className="min-h-28 rounded border p-2"
            placeholder="Type a prompt for Gemini..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button
            className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-60"
            type="submit"
            disabled={loadingGemini}
          >
            {loadingGemini ? "Sending..." : "Send to Gemini"}
          </button>
        </form>
        <p className="mt-3 whitespace-pre-wrap text-sm">{geminiOutput}</p>
      </section>

      {error ? (
        <section className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </section>
      ) : null}
    </main>
  );
}
