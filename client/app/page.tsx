"use client";

import React, { useState, useCallback } from "react";
import Header from "./components/Header";
import Scanner from "./components/Scanner";
import ScanResultCard from "./components/ScanResultCard";
import DashboardStats from "./components/DashboardStats";
import HistoryModal from "./components/HistoryModal"; 
import { VisionAPIResponse, ExtendedScanResult, HistoryLog, DashboardStats as StatsType } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type AnalyzeScanResponse = VisionAPIResponse & { model?: string };

export default function EcoDashboard() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ExtendedScanResult | null>(null);
  const [error, setError] = useState<string>("");
  
  // Add modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false); 

  const [stats, setStats] = useState<StatsType>({
    totalScans: 142,
    co2Diverted: 34.5,
    recycledItems: 110,
  });

  const [recentHistory, setRecentHistory] = useState<HistoryLog[]>([
    { id: 1, item: "Aluminum Can", category: "Recycle", co2: "+0.95", time: "10:32 AM" },
    { id: 2, item: "Banana Peel", category: "Compost", co2: "+0.15", time: "09:15 AM" },
  ]);

  const [chartData, setChartData] = useState<number[]>([4, 12, 8, 24, 16, 34.5]);

  const handleCapture = useCallback(async (imageSrc: string) => {
    setIsScanning(true);
    setError("");
    setScanResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/scan/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_base64: imageSrc,
          model: "gemini-1.5-flash",
        }),
      });

      if (!response.ok) {
        const errorData: { detail?: string } = await response.json();
        throw new Error(errorData.detail ?? "Scan request failed.");
      }

      const data: AnalyzeScanResponse = await response.json();

      const isRecycle = data.nyc_stream_category.toLowerCase().includes("recycl");
      const isCompost = data.nyc_stream_category.toLowerCase().includes("compost") || data.nyc_stream_category.toLowerCase().includes("organics");
      
      const uiCategory = isRecycle ? "Recycle" : isCompost ? "Compost" : "Trash";
      const co2Impact = isRecycle ? 0.85 : isCompost ? 0.35 : 0;

      setScanResult({ ...data, uiCategory, co2Saved: co2Impact });

      setStats(prev => ({
        totalScans: prev.totalScans + 1,
        co2Diverted: Number((prev.co2Diverted + co2Impact).toFixed(2)),
        recycledItems: isRecycle || isCompost ? prev.recycledItems + 1 : prev.recycledItems
      }));

      // Removed array truncation to store all items forever
      setRecentHistory(prev => [
        {
          id: Date.now(),
          item: data.item_name,
          category: uiCategory,
          co2: co2Impact > 0 ? `+${co2Impact.toFixed(2)}` : "0.00",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        },
        ...(prev || [])
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
        <section className="lg:col-span-7 flex flex-col gap-6">
          <Scanner isScanning={isScanning} onCapture={handleCapture} />
          {scanResult && <ScanResultCard scanResult={scanResult} />}
        </section>

        <DashboardStats 
          stats={stats} 
          chartData={chartData} 
          recentHistory={recentHistory} 
          onViewAll={() => setIsHistoryModalOpen(true)} // Open modal on click
        />
      </main>
      {error ? (
        <section className="max-w-7xl mx-auto mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
          {error}
        </section>
      ) : null}

      {/* Mount Modal at root layout tier */}
      <HistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
        history={recentHistory} 
      />

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