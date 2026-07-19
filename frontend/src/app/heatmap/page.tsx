'use client';

import { useState } from 'react';
import PlantMap from '@/components/heatmap/PlantMap';

export default function HeatmapPage() {
  const [profile, setProfile] = useState<'steel' | 'petro'>('steel');

  return (
    <div className="h-[calc(100vh-80px)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="font-mono text-lg font-bold tracking-wide">LIVE SAFETY HEATMAP</h1>
          <p className="text-xs text-dim-text font-mono mt-0.5">
            Click any zone to inspect sensors, permits, workers, and alerts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-steel border border-border px-2 py-1 rounded-sm font-mono">
            <span className="text-[9px] text-dim-text uppercase font-semibold">Profile:</span>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as 'steel' | 'petro')}
              className="bg-void text-bright-text border-none text-[10px] font-mono px-1 rounded-sm outline-none cursor-pointer focus:ring-0"
            >
              <option value="steel">Visakhapatnam Steel Complex</option>
              <option value="petro">Jamnagar Petrochemical (Synthetic)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-phosphor live-dot" />
            <span className="text-[10px] font-mono text-dim-text">LIVE</span>
          </div>
        </div>
      </div>
      <div className="panel relative overflow-hidden" style={{ height: 'calc(100% - 50px)' }}>
        <PlantMap className="w-full h-full" profile={profile} />
      </div>
    </div>
  );
}
