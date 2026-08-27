"use client";

import React, { useState, useCallback } from "react";
import Header from "./components/Header";
import Scanner from "./components/Scanner";
import ScanResultCard from "./components/ScanResultCard";
import DashboardStats from "./components/DashboardStats";
import { VisionAPIResponse, ExtendedScanResult, HistoryLog, DashboardStats as StatsType } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export default function EcoDashboard() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ExtendedScanResult | null>(null);
  const [error, setError] = useState<string>("");

  const [stats, setStats] = useState<StatsType>({
    totalScans: 142,
    co2Diverted: 34.5,
    recycledItems: 110,
  });

  const [recentHistory, setRecentHistory] = useState<HistoryLog[]>([
    { id: 1, item: "Aluminum Can", category: "Recycle", co2: "+0.95", time: "2 mins ago" },
    { id: 2, item: "Banana Peel", category: "Compost", co2: "+0.15", time: "1 hour ago" },
  ]);

  const [chartData, setChartData] = useState<number[]>([4, 12, 8, 24, 16, 34.5]);

  const handleCapture = useCallback(async (imageSrc: string) => {
    setIsScanning(true);
    setError("");
    setScanResult(null);

    try {
      const blob = await dataUrlToBlob(imageSrc);
      const formData = new FormData();
      formData.append("file", blob, "snapshot.jpg");

      const response = await fetch(`${API_BASE_URL}/classify`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData: { detail?: string } = await response.json();
        throw new Error(errorData.detail ?? "Scan request failed.");
      }

      const data: VisionAPIResponse = await response.json();

      const category = data.nyc_stream_category.toLowerCase();
      const isCompost = category.includes("compost") || category.includes("organics");
      const isRecycle = !isCompost && data.is_recyclable;

      const uiCategory = isCompost ? "Compost" : isRecycle ? "Recycle" : "Trash";
      const co2Impact = uiCategory === "Trash" ? 0 : Number((data.estimated_co2_grams / 1000).toFixed(2));

      setScanResult({
        ...data,
        uiCategory,
        co2Saved: co2Impact
      });

      setStats(prev => ({
        totalScans: prev.totalScans + 1,
        co2Diverted: Number((prev.co2Diverted + co2Impact).toFixed(2)),
        recycledItems: isRecycle || isCompost ? prev.recycledItems + 1 : prev.recycledItems
      }));

      setRecentHistory(prev => [
        {
          id: Date.now(),
          item: data.item_name,
          category: uiCategory,
          co2: co2Impact > 0 ? `+${co2Impact.toFixed(2)}` : "0.00",
          time: "Just now"
        },
        ...prev.slice(0, 4)
      ]);

      setChartData(prev => {
        const newData = [...prev];
        newData[newData.length - 1] = Number((newData[newData.length - 1] + co2Impact).toFixed(2));
        return newData;
      });

    } catch (error) {
      console.error("Scan failed:", error);
      setError(error instanceof Error ? error.message : "Unknown scan error.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
      <Header co2Diverted={stats.co2Diverted} />

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <Scanner isScanning={isScanning} onCapture={handleCapture} />
          {scanResult && <ScanResultCard scanResult={scanResult} />}
        </section>

        {/* RIGHT COLUMN */}
        <DashboardStats 
          stats={stats} 
          chartData={chartData} 
          recentHistory={recentHistory} 
        />
      </main>
      {error ? (
        <section className="max-w-7xl mx-auto mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
          {error}
        </section>
      ) : null}

      {/* Global styles for the scanner line animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(300px); }
          100% { transform: translateY(0); }
        }
      `}} />
    </div>
  );
}