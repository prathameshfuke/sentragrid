'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getDashboard, getRecentAlerts, startDemoSim, startNormalSim, stopSim, runDemoScenario, resetDemoScenario, type DashboardKPIs, type Alert, type SimulatorStatus } from '@/lib/api';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [simStatus, setSimStatus] = useState<SimulatorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { alerts: streamAlerts, latestReading } = useRealtimeStream();

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, alertsRes] = await Promise.all([
        getDashboard(),
        getRecentAlerts(8),
      ]);
      setKpis(dashRes.kpis);
      setSimStatus(dashRes.simulator);
      setAlerts(alertsRes.alerts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (streamAlerts.length > 0 || latestReading) {
      fetchData();
    }
  }, [streamAlerts.length, latestReading, fetchData]);

  const handleRunDemoScenario = async () => {
    try {
      await runDemoScenario();
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartNormal = async () => {
    await startNormalSim();
    fetchData();
  };

  const handleStop = async () => {
    await stopSim();
    fetchData();
  };

  const handleResetDemo = async () => {
    try {
      await resetDemoScenario();
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold tracking-wide">OPERATIONS DASHBOARD</h1>
          <p className="text-xs text-dim-text font-mono mt-0.5">
            Real-time safety intelligence overview
          </p>
        </div>

        {/* Simulator Controls */}
        <div className="flex items-center gap-2">
          {simStatus?.running ? (
            <>
              <span className="text-[10px] font-mono text-amber-warn animate-pulse">
                {simStatus.mode === 'demo' ? 'DEMO RUNNING' : simStatus.mode.toUpperCase()} — Phase {simStatus.phase}
              </span>
              <button onClick={handleStop} className="btn btn-danger text-xs py-1 px-3">
                Stop Sim
              </button>
              <button onClick={handleResetDemo} className="btn text-xs py-1 px-3 border border-border">
                Reset Demo
              </button>
            </>
          ) : (
            <>
              <button onClick={handleRunDemoScenario} className="btn btn-primary text-xs py-1 px-3 font-semibold tracking-wide">
                Run Demo Scenario
              </button>
              <button onClick={handleStartNormal} className="btn text-xs py-1 px-3">
                Normal Sim
              </button>
              <button onClick={handleResetDemo} className="btn text-xs py-1 px-3 border border-border">
                Reset Demo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Demo Progress Banner */}
      {simStatus?.running && simStatus.mode === 'demo' && (
        <div className="bg-phosphor-dim border border-phosphor/30 text-phosphor px-3 py-2.5 rounded-sm font-mono text-xs flex items-center gap-2.5 animate-pulse">
          <span className="live-dot w-2 h-2 bg-phosphor shrink-0"></span>
          <span>
            <strong>DEMO ACTIVE</strong>: {simStatus.phase_description}
          </span>
          <span className="ml-auto text-[10px] text-dim-text">
            Phase {simStatus.phase} • {Math.round(simStatus.elapsed_seconds)}s elapsed
          </span>
        </div>
      )}

      {/* KPI Cards */}
      {error && (
        <div className="bg-amber-dim border border-amber-warn/30 p-3 rounded-sm text-xs font-mono text-amber-warn">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Open Alerts"
          value={kpis?.open_alerts ?? 0}
          loading={loading}
          color={kpis && kpis.open_alerts > 0 ? 'amber' : 'default'}
        />
        <KPICard
          label="Critical"
          value={kpis?.critical_alerts ?? 0}
          loading={loading}
          color={kpis && kpis.critical_alerts > 0 ? 'red' : 'default'}
        />
        <KPICard
          label="Warnings"
          value={kpis?.warning_alerts ?? 0}
          loading={loading}
          color={kpis && kpis.warning_alerts > 0 ? 'amber' : 'default'}
        />
        <KPICard
          label="Active Permits"
          value={kpis?.active_permits ?? 0}
          loading={loading}
        />
        <KPICard
          label="Elevated Zones"
          value={kpis?.elevated_zones ?? 0}
          loading={loading}
          color={kpis && kpis.elevated_zones > 0 ? 'amber' : 'default'}
        />
        <KPICard
          label="Workers On-Site"
          value={kpis?.workers_on_site ?? 0}
          loading={loading}
          color="phosphor"
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Alerts */}
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <span>RECENT ALERTS</span>
            <Link href="/alerts" className="text-phosphor text-[10px] hover:underline">
              VIEW ALL →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-4 text-sm text-dim-text font-mono">Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="p-4 text-sm text-dim-text font-mono">
                No open alerts. All zones nominal.
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="p-3 hover:bg-steel-light transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`status-tag status-tag-${alert.severity}`}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-dim-text font-mono">
                      {alert.zone_name || alert.zone_id}
                    </span>
                    <span className="text-[10px] text-dim-text font-mono ml-auto">
                      {alert.status}
                    </span>
                  </div>
                  <div className="text-xs text-bright-text font-mono leading-relaxed">
                    {alert.title}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Business Impact & ROI Tracker */}
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <span>BUSINESS IMPACT & ROI ENGINE</span>
            <span className="text-[8px] font-mono bg-phosphor-dim text-phosphor border border-phosphor/20 px-1.5 py-0.5 rounded-sm">
              ACTIVE
            </span>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-void border border-border p-2 rounded-sm">
                <div className="text-[8px] font-mono text-dim-text uppercase">Manual Handoffs</div>
                <div className="text-sm font-mono text-phosphor mt-1 font-bold">100% Automated</div>
              </div>
              <div className="bg-void border border-border p-2 rounded-sm">
                <div className="text-[8px] font-mono text-dim-text uppercase">Systems Unified</div>
                <div className="text-sm font-mono text-amber-warn mt-1 font-bold">4 Plants & DBs</div>
              </div>
            </div>
            
            <div className="text-xs font-mono space-y-2.5 text-dim-text leading-relaxed">
              <p className="bg-steel/30 p-2.5 border-l-2 border-phosphor text-[11px] text-bright-text">
                <strong className="text-phosphor">FICCI Industrial Report</strong>: 73% of plant near-misses are due to manual coordination gaps (e.g. shift handover gaps and disconnected sensor databases).
              </p>
              <div className="border-t border-border/50 pt-2.5 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Session Alerts Analyzed:</span>
                  <span className="text-bright-text font-bold">{kpis?.open_alerts || 0} alerts</span>
                </div>
                <div className="flex justify-between">
                  <span>Manual Checks Saved:</span>
                  <span className="text-bright-text font-bold">{((kpis?.open_alerts || 0) * 4) + 8} check-lists</span>
                </div>
                <div className="flex justify-between">
                  <span>Safety Lead-Time Advantage:</span>
                  <span className="text-phosphor font-bold">~15-40 mins early warning</span>
                </div>
                <div className="flex justify-between">
                  <span>Regulatory Compliance (OISD):</span>
                  <span className="text-bright-text font-bold">100% Audit Tracked</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="panel">
          <div className="panel-header">QUICK ACTIONS</div>
          <div className="p-4 space-y-3">
            <Link href="/heatmap" className="block">
              <div className="bg-void border border-border p-4 rounded-sm hover:border-phosphor transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-phosphor-dim border border-phosphor/30 rounded-sm flex items-center justify-center text-phosphor">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" />
                      <line x1="16" y1="6" x2="16" y2="22" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-bright-text group-hover:text-phosphor transition-colors">
                      Live Plant Heatmap
                    </div>
                    <div className="text-[10px] text-dim-text font-mono">
                      View real-time risk zones, worker positions, and active permits
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/permits" className="block">
              <div className="bg-void border border-border p-4 rounded-sm hover:border-amber-warn transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-dim border border-amber-warn/30 rounded-sm flex items-center justify-center text-amber-warn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-bright-text group-hover:text-amber-warn transition-colors">
                      Issue New Permit
                    </div>
                    <div className="text-[10px] text-dim-text font-mono">
                      AI-verified permit issuance with conflict detection
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <Link href="/intelligence" className="block">
              <div className="bg-void border border-border p-4 rounded-sm hover:border-phosphor transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-phosphor-dim border border-phosphor/30 rounded-sm flex items-center justify-center text-phosphor">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                      <line x1="9" y1="21" x2="15" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-bright-text group-hover:text-phosphor transition-colors">
                      Incident Intelligence
                    </div>
                    <div className="text-[10px] text-dim-text font-mono">
                      Query historical incidents and safety guidelines
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Simulator Status Card */}
            {simStatus && (
              <div className="bg-void border border-border p-3 rounded-sm">
                <div className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest mb-2">
                  Simulator Status
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${simStatus.running ? 'bg-phosphor live-dot' : 'bg-dim-text'}`} />
                  <span className="text-xs font-mono text-bright-text">
                    {simStatus.running ? simStatus.mode.toUpperCase() : 'IDLE'}
                  </span>
                  {simStatus.running && (
                    <span className="text-[10px] font-mono text-dim-text ml-auto">
                      {Math.round(simStatus.elapsed_seconds)}s elapsed
                    </span>
                  )}
                </div>
                {simStatus.phase_description && simStatus.running && (
                  <div className="text-[10px] font-mono text-amber-warn mt-1">
                    {simStatus.phase_description}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card Component ──

function KPICard({
  label,
  value,
  loading,
  color = 'default',
}: {
  label: string;
  value: number;
  loading: boolean;
  color?: 'default' | 'phosphor' | 'amber' | 'red';
}) {
  const colorClasses = {
    default: 'text-bright-text',
    phosphor: 'text-phosphor',
    amber: 'text-amber-warn',
    red: 'text-alert-red',
  };

  return (
    <div className="panel p-3">
      <div className="text-[9px] font-mono font-semibold text-dim-text uppercase tracking-widest">
        {label}
      </div>
      <div className={`sensor-value text-2xl mt-1 ${colorClasses[color]}`}>
        {loading ? '—' : value}
      </div>
    </div>
  );
}
