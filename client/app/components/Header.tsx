import { Leaf } from "lucide-react";

interface HeaderProps {
  co2Diverted: number;
}

export default function Header({ co2Diverted }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-emerald-500/20 rounded-xl">
          <Leaf className="w-6 h-6 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">EcoVision NYC</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <span className="text-sm font-medium">PC</span>
        </div>
      </div>
    </header>
  );
}