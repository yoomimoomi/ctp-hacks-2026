"use client";

import React, { useRef } from "react";
import Webcam from "react-webcam";
import { RefreshCw } from "lucide-react";

interface ScannerProps {
  isScanning: boolean;
  onCapture: (imageSrc: string) => void;
}

export default function Scanner({ isScanning, onCapture }: ScannerProps) {
  const webcamRef = useRef<Webcam>(null);

  const handleScanClick = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  };

  return (
    <div className="relative rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden aspect-video flex flex-col items-center justify-center">
      
      {/* @ts-ignore: react-webcam class types are incompatible with React 19 */}
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "environment" }}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {isScanning && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400/50 shadow-[0_0_40px_10px_rgba(52,211,153,0.3)] animate-[scan_2s_ease-in-out_infinite]" />
          <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
          <p className="text-emerald-400 font-medium animate-pulse">Analyzing object...</p>
        </div>
      )}
      <button 
        onClick={handleScanClick}
        disabled={isScanning}
        className="absolute bottom-6 z-20 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-full transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isScanning ? "Scanning..." : "Identify Object"}
      </button>
    </div>
  );
}