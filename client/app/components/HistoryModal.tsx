import React from "react";
import { X, Recycle, Leaf, Trash2, History } from "lucide-react";
import { HistoryLog } from "../types";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryLog[];
}

export default function HistoryModal({ isOpen, onClose, history }: HistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-500" />
            Full Scan History
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {(!history || history.length === 0) ? (
            <p className="text-center text-zinc-500 py-8">No items scanned yet.</p>
          ) : (
            history.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    log.category === 'Recycle' ? 'bg-blue-500/20 text-blue-400' : 
                    log.category === 'Compost' ? 'bg-amber-500/20 text-amber-400' : 
                    'bg-zinc-800 text-zinc-400'
                  }`}>
                    {log.category === 'Recycle' ? <Recycle className="w-5 h-5"/> : 
                     log.category === 'Compost' ? <Leaf className="w-5 h-5"/> : 
                     <Trash2 className="w-5 h-5"/>}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-200">{log.item}</p>
                    <p className="text-sm text-zinc-500">{log.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${log.co2 !== "0.00" ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {log.co2 !== "0.00" ? `${log.co2} kg CO₂` : "0 kg CO₂"}
                  </span>
                  <p className="text-xs text-zinc-500 mt-0.5">{log.category}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}