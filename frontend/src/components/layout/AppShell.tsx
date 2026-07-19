'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AlertTicker from './AlertTicker';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { alerts, connected, simulatorStatus } = useRealtimeStream();

  return (
    <>
      <TopBar
        connected={connected}
        simulatorPhase={simulatorStatus?.phase_description}
        simulatorRunning={simulatorStatus?.running}
      />
      <Sidebar />
      <main className="md:ml-[72px] mt-[48px] min-h-[calc(100vh-104px)] md:min-h-[calc(100vh-48px)] p-3 md:p-4 pb-[64px] md:pb-4">
        {!connected && (
          <div className="bg-amber-dim border border-amber-warn/30 text-amber-warn px-4 py-2.5 mb-4 rounded-sm font-mono text-[11px] flex items-center gap-2.5 animate-pulse">
            <span className="live-dot w-2.5 h-2.5 bg-amber-warn shrink-0"></span>
            <span>
              <strong>API CONNECTION OFFLINE / COLD START</strong>: SentraGrid backend is waking up (Render free tier). Real-time telemetry, simulators, and intelligence agents will initialize shortly (30-50s).
            </span>
          </div>
        )}
        {children}
      </main>
      <AlertTicker alerts={alerts} />
    </>
  );
}
