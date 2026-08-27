import { BarChart3, Leaf, History, Trash2, Recycle } from "lucide-react";
import { DashboardStats as StatsType, HistoryLog } from "../types";

interface DashboardStatsProps {
  stats: StatsType;
  chartData: number[];
  recentHistory: HistoryLog[];
  onViewAll: () => void; // New prop added
}

export default function DashboardStats({ stats, chartData, recentHistory, onViewAll }: DashboardStatsProps) {
  return (
    <section className="lg:col-span-5 flex flex-col gap-6">
      
      {/* ... [Keep Top Metrics and Chart code exactly the same] ... */}

      {/* Recent Logs Feed */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-zinc-400" />
            Recent Logs
          </h3>
          <button 
            onClick={onViewAll}
            className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            View All
          </button>
        </div>
        
        <div className="space-y-4 overflow-y-auto max-h-[300px]">
          {/* Slice the array to only show the first 4 items on the dashboard */}
          {recentHistory.slice(0, 4).map((log) => (
            <div key={log.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/50 hover:bg-zinc-800/50 transition-colors border border-zinc-800/30">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  log.category === 'Recycle' ? 'bg-blue-500/20 text-blue-400' : 
                  log.category === 'Compost' ? 'bg-amber-500/20 text-amber-400' : 
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  {log.category === 'Recycle' ? <Recycle className="w-4 h-4"/> : 
                   log.category === 'Compost' ? <Leaf className="w-4 h-4"/> : 
                   <Trash2 className="w-4 h-4"/>}
                </div>
                <div>
                  <p className="font-medium text-sm text-zinc-200">{log.item}</p>
                  <p className="text-xs text-zinc-500">{log.time}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${log.co2 !== "0.00" ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {log.co2 !== "0.00" ? `${log.co2} kg` : "0 kg"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}