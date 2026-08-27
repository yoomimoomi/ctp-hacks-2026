import { BarChart3, Leaf, History, Trash2, Recycle } from "lucide-react";
import { DashboardStats as StatsType, HistoryLog } from "../types";

interface DashboardStatsProps {
  stats: StatsType;
  chartData: number[];
  recentHistory: HistoryLog[];
  onViewAll: () => void; 
}

export default function DashboardStats({ stats, chartData, recentHistory, onViewAll }: DashboardStatsProps) {
  return (
    <section className="lg:col-span-5 flex flex-col gap-6">
      
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* CO2 Diverted Card */}
        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Leaf className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">CO₂ Diverted</span>
          </div>
          <p className="text-3xl font-bold">{stats.co2Diverted} kg</p>
        </div>
        
        {/* Items Scanned Card */}
        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm font-medium">Items Scanned</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalScans}</p>
        </div>
      </div>

      {/* Carbon Footprint Saved Chart */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800">
        <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
          <Leaf className="w-5 h-5 text-emerald-500" />
          Carbon Footprint Saved
        </h3>
        
        <div className="flex items-end justify-between h-40 mb-4">
          {chartData.map((val, i) => (
            <div key={i} className="w-[12%] h-full bg-zinc-800 rounded-t-lg relative group">
              <div 
                className="absolute bottom-0 w-full bg-emerald-500 rounded-t-lg transition-all duration-500" 
                style={{ height: `${Math.min((val / 40) * 100, 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-zinc-500 mt-2">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span className="text-emerald-400 font-bold">Today</span>
        </div>
      </div>

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
          {/* Safe slice implementation to prevent undefined errors */}
          {(recentHistory || []).slice(0, 4).map((log) => (
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