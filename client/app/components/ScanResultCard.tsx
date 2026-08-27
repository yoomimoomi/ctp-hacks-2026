import { Leaf } from "lucide-react";
import { ExtendedScanResult } from "../types";

interface ScanResultCardProps {
  scanResult: ExtendedScanResult;
}

export default function ScanResultCard({ scanResult }: ScanResultCardProps) {
  return (
    <div className={`p-6 rounded-3xl bg-zinc-900 border relative overflow-hidden ${
      scanResult.uiCategory === 'Trash' ? 'border-zinc-700' : 'border-emerald-500/30'
    }`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 ${
        scanResult.uiCategory === 'Trash' ? 'bg-zinc-500/10' : 'bg-emerald-500/10'
      }`} />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <p className="text-sm text-zinc-400 font-medium mb-1">{scanResult.material_type}</p>
          <h2 className="text-2xl font-bold text-white">{scanResult.item_name}</h2>
        </div>
        <div className={`px-4 py-1.5 font-bold rounded-full text-sm border ${
          scanResult.uiCategory === 'Recycle' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
          scanResult.uiCategory === 'Compost' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' :
          'bg-zinc-700/50 border-zinc-600 text-zinc-300'
        }`}>
          Bin: {scanResult.bin_color}
        </div>
      </div>
      
      <div className="mb-6 relative z-10 space-y-3">
        <p className="text-zinc-300">{scanResult.preparation_instructions.join(" ")}</p>
        {scanResult.nyc_rule_notes && (
          <p className="text-sm text-zinc-500 italic bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
            {scanResult.nyc_rule_notes}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-950 p-3 rounded-xl w-fit relative z-10">
        <Leaf className={`w-4 h-4 ${scanResult.co2Saved > 0 ? 'text-emerald-400' : 'text-zinc-600'}`} />
        <span>
          CO₂ Saved: <span className="font-bold text-white">
            {scanResult.co2Saved > 0 ? `+${scanResult.co2Saved} kg` : "0 kg (Landfill)"}
          </span>
        </span>
      </div>
    </div>
  );
}