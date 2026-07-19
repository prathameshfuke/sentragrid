'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react';
import { getAlerts, acknowledgeAlert, resolveAlert, type Alert } from '@/lib/api';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { alerts: streamAlerts } = useRealtimeStream();

  const fetchAlerts = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.severity = filter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getAlerts(params);
      setAlerts(res.alerts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    if (streamAlerts.length > 0) {
      fetchAlerts();
    }
  }, [streamAlerts.length, fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert(alertId);
    fetchAlerts();
  };

  const handleResolve = async (alertId: string) => {
    await resolveAlert(alertId);
    fetchAlerts();
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold tracking-wide">ALERT MANAGEMENT</h1>
          <p className="text-xs text-dim-text font-mono mt-0.5">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''} total
            {criticalCount > 0 && <span className="text-alert-red"> · {criticalCount} critical</span>}
            {warningCount > 0 && <span className="text-amber-warn"> · {warningCount} warning</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[10px] font-mono text-dim-text uppercase mr-2">Severity:</div>
        {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] font-mono px-2 py-1 border rounded-sm transition-colors ${
              filter === f
                ? 'bg-phosphor-dim text-phosphor border-phosphor/30'
                : 'bg-steel text-dim-text border-border hover:border-border-hover'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-2" />
        <div className="text-[10px] font-mono text-dim-text uppercase mr-2">Status:</div>
        {(['all', 'open', 'acknowledged', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-[10px] font-mono px-2 py-1 border rounded-sm transition-colors ${
              statusFilter === s
                ? 'bg-phosphor-dim text-phosphor border-phosphor/30'
                : 'bg-steel text-dim-text border-border hover:border-border-hover'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="panel">
        <div className="panel-header">ALERTS</div>
        {error && (
          <div className="px-3 py-2 bg-amber-dim border-b border-amber-warn/30 text-[10px] font-mono text-amber-warn">
            {error}
          </div>
        )}
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-6 text-center text-sm text-dim-text font-mono">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="p-6 text-center text-sm text-dim-text font-mono">
              No open alerts. All zones nominal.
            </div>
          ) : (
            alerts.map((alert) => {
              const isExpanded = expandedId === alert.id;
              return (
                <div
                  key={alert.id}
                  className={`transition-colors ${isExpanded ? 'bg-steel-light' : 'hover:bg-steel-light/50'}`}
                >
                  {/* Alert Row */}
                  <div
                    className="p-3 cursor-pointer flex items-start gap-3"
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  >
                    <span className={`status-tag status-tag-${alert.severity} mt-0.5 flex-shrink-0`}>
                      {alert.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-bright-text">
                        {alert.title}
                      </div>
                      <div className="text-[10px] text-dim-text font-mono mt-0.5 flex items-center gap-3">
                        <span>{alert.zone_name || alert.zone_id}</span>
                        <span>·</span>
                        <span>{alert.status}</span>
                        <span>·</span>
                        <span>{new Date(alert.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <span className="text-dim-text text-xs">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {/* Explanation */}
                      <div className="bg-void border border-border p-3 rounded-sm">
                        <div className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest mb-1">
                          Analysis
                        </div>
                        <p className="text-xs text-bright-text leading-relaxed">
                          {alert.explanation}
                        </p>
                      </div>

                      {/* Special AI Predictive Risk Insight Panel */}
                      {alert.triggering_factors && (alert.triggering_factors.confidence_score !== undefined || alert.triggering_factors.prediction_lead_time_min !== undefined) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Predictive metrics */}
                          <div className="bg-void border border-border p-3 rounded-sm flex flex-col justify-between">
                            <div>
                              <div className="text-[10px] font-mono font-semibold text-phosphor uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <span className="live-dot w-1.5 h-1.5 bg-phosphor"></span>
                                AI PREDICTIVE RISK INSIGHT
                              </div>
                              <div className="space-y-2 mt-1">
                                <div className="flex justify-between items-center text-xs font-mono">
                                  <span className="text-dim-text">Predictive Confidence:</span>
                                  <span className="text-phosphor font-bold">{Math.round((alert.triggering_factors.confidence_score as number) * 100)}%</span>
                                </div>
                                <div className="w-full bg-steel h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-phosphor h-full rounded-full" 
                                    style={{ width: `${(alert.triggering_factors.confidence_score as number) * 100}%` }}
                                  />
                                </div>
                                <div className="flex justify-between items-center text-xs font-mono pt-1">
                                  <span className="text-dim-text">Est. Time to Incident:</span>
                                  <span className="text-alert-red font-bold font-mono">
                                    ~{alert.triggering_factors.prediction_lead_time_min as number} mins
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* False-Negative & Early Warning Analysis */}
                          <div className="bg-void border border-border p-3 rounded-sm">
                            <div className="text-[10px] font-mono font-semibold text-amber-warn uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <span className="live-dot w-1.5 h-1.5 bg-amber-warn"></span>
                              FALSE-NEGATIVE PREVENTION ANALYSIS
                            </div>
                            <div className="space-y-1.5 mt-1 text-xs font-mono">
                              <div className="flex justify-between items-center">
                                <span className="text-dim-text">Single-Sensor Thresholds:</span>
                                <span className={alert.triggering_factors.single_sensor_missed as boolean ? "text-alert-red font-bold" : "text-dim-text"}>
                                  {alert.triggering_factors.single_sensor_missed as boolean ? "❌ MISSED (Below Threshold)" : "⚠️ Alert Triggered"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-dim-text">SentraGrid Compound Engine:</span>
                                <span className="text-phosphor font-semibold">
                                  ✅ DETECTED (Compound Risk)
                                </span>
                              </div>
                              {alert.triggering_factors.lead_time_advantage_min !== undefined && (
                                <div className="flex justify-between items-center border-t border-border/50 pt-1.5 mt-1.5">
                                  <span className="text-dim-text">Lead-Time Advantage:</span>
                                  <span className="text-amber-warn font-bold">
                                    +{alert.triggering_factors.lead_time_advantage_min as number} mins early warning
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Triggering Factors */}
                      {alert.triggering_factors && Object.keys(alert.triggering_factors).filter(k => !['confidence_score', 'prediction_lead_time_min', 'single_sensor_missed', 'lead_time_advantage_min', 'compound_factors', 'factors_summary'].includes(k)).length > 0 && (
                        <div className="bg-void border border-border p-3 rounded-sm">
                          <div className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest mb-1">
                            Triggering Factors
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(alert.triggering_factors)
                              .filter(([key]) => !['confidence_score', 'prediction_lead_time_min', 'single_sensor_missed', 'lead_time_advantage_min', 'compound_factors', 'factors_summary'].includes(key))
                              .map(([key, value]) => (
                                <span key={key} className="bg-steel border border-border px-2 py-0.5 rounded-sm text-[10px] font-mono">
                                  <span className="text-dim-text">{key}:</span>{' '}
                                  <span className="text-amber-warn">{String(value)}</span>
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {alert.status === 'open' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert.id); }}
                            className="btn text-xs py-1"
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleResolve(alert.id); }}
                            className="btn btn-primary text-xs py-1"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                      {alert.status === 'acknowledged' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleResolve(alert.id); }}
                            className="btn btn-primary text-xs py-1"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
