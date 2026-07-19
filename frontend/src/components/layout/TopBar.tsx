'use client';

import { useState, useEffect } from 'react';

interface TopBarProps {
  connected: boolean;
  simulatorPhase?: string;
  simulatorRunning?: boolean;
}

export default function TopBar({ connected, simulatorPhase, simulatorRunning }: TopBarProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-[48px] bg-steel border-b border-border flex items-center justify-between px-4 z-50">
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-phosphor live-dot' : 'bg-amber-warn'}`}
          />
          <span className="font-mono text-sm font-bold tracking-widest text-bright-text">
            SENTRAGRID
          </span>
        </div>
        {simulatorRunning && simulatorPhase && (
          <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-border">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-warn live-dot" />
            <span className="font-mono text-[11px] text-amber-warn truncate max-w-[300px]">
              {simulatorPhase}
            </span>
          </div>
        )}
      </div>

      {/* Right: Clock + Officer */}
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-dim-text tabular-nums">
          {time}
        </span>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-steel-light border border-border flex items-center justify-center">
            <span className="text-[10px] font-mono font-bold text-phosphor">SO</span>
          </div>
          <span className="text-xs text-dim-text hidden sm:block">Safety Officer</span>
        </div>
      </div>
    </header>
  );
}
