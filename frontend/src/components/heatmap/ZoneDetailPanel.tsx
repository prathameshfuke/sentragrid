'use client';

import { addCustomReading, type ZoneDetail } from '@/lib/api';

interface ZoneDetailPanelProps {
  zoneDetail: ZoneDetail | null;
  loading: boolean;
  onClose: () => void;
}

const SENSOR_LABELS: Record<string, string> = {
  gas_h2s: 'H₂S',
  gas_co: 'CO',
  temperature: 'TEMP',
  pressure: 'PRESS',
};

export default function ZoneDetailPanel({ zoneDetail, loading, onClose }: ZoneDetailPanelProps) {
  return (
    <div className="absolute top-0 right-0 w-[340px] h-full bg-steel border-l border-border animate-slide-in-right overflow-y-auto">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <span>ZONE DETAIL</span>
        <button onClick={onClose} className="text-dim-text hover:text-bright-text text-sm">
          ✕
        </button>
      </div>

      {loading && !zoneDetail ? (
        <div className="p-4 text-dim-text text-sm font-mono">Loading zone data...</div>
      ) : !zoneDetail ? (
        <div className="p-4 text-dim-text text-sm font-mono">No data available.</div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Zone Name & Risk */}
          <div>
            <h3 className="font-mono text-sm font-bold text-bright-text">
              {zoneDetail.zone.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`status-tag status-tag-${zoneDetail.risk_level}`}>
                {zoneDetail.risk_level}
              </span>
              <span className="text-[10px] font-mono text-dim-text">
                Score: {Math.round(zoneDetail.risk_score)}
              </span>
            </div>
          </div>

          {/* Sensor Readings */}
          <div>
            <div className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest mb-2">
              Sensor Readings
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(zoneDetail.sensor_readings).map(([sensorType, reading]) => (
                <div key={sensorType} className="bg-void border border-border p-2 rounded-sm">
                  <div className="text-[9px] font-mono text-dim-text uppercase">
                    {SENSOR_LABELS[sensorType] || sensorType}
                  </div>
                  <div className="sensor-value text-lg text-bright-text">
                    {typeof reading.value === 'number' ? reading.value.toFixed(1) : reading.value}
                  </div>
                  <div className="text-[9px] font-mono text-dim-text">
                    {sensorType.includes('temp') ? '°C' : sensorType.includes('pressure') ? 'kPa' : 'ppm'}
                  </div>
                </div>
              ))}
            </div>
            {Object.keys(zoneDetail.sensor_readings).length === 0 && (
              <div className="text-xs text-dim-text font-mono">No active sensors.</div>
            )}
          </div>

          {/* DEMO: WHAT-IF RISK SIMULATOR */}
          <div className="bg-void border border-border p-3 rounded-sm space-y-3">
            <div className="text-[10px] font-mono font-semibold text-phosphor uppercase tracking-widest flex items-center gap-1.5">
              <span className="live-dot w-1.5 h-1.5 bg-phosphor animate-pulse"></span>
              WHAT-IF SIMULATOR
            </div>
            <p className="text-[10px] text-dim-text font-mono leading-relaxed">
              Drag sliders to override real-time telemetry and watch the risk engine calculate compound safety threats live.
            </p>
            <div className="space-y-3 pt-1">
              {Object.entries(zoneDetail.sensor_readings).map(([sensorType, reading]) => {
                const isGas = sensorType.includes('gas');
                const isTemp = sensorType.includes('temp');
                const min = 0;
                const max = isGas ? (sensorType.includes('h2s') ? 20 : 60) : isTemp ? 550 : 250;
                const step = isGas ? 0.5 : 5;
                const label = SENSOR_LABELS[sensorType] || sensorType;
                const unit = isTemp ? '°C' : sensorType.includes('pressure') ? 'kPa' : 'ppm';
                
                return (
                  <div key={sensorType} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-bright-text">{label}:</span>
                      <span className="text-phosphor font-bold">{reading.value.toFixed(1)} {unit}</span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      defaultValue={reading.value}
                      onMouseUp={async (e) => {
                        const val = parseFloat((e.target as HTMLInputElement).value);
                        try {
                          await addCustomReading(reading.sensor_id, val);
                        } catch (err) {
                          console.error('Failed to post custom reading:', err);
                        }
                      }}
                      onTouchEnd={async (e) => {
                        const val = parseFloat((e.target as HTMLInputElement).value);
                        try {
                          await addCustomReading(reading.sensor_id, val);
                        } catch (err) {
                          console.error('Failed to post custom reading:', err);
                        }
                      }}
                      className="w-full h-1 bg-steel rounded-lg appearance-none cursor-pointer accent-phosphor focus:outline-none"
                    />
                  </div>
                );
              })}
              {Object.keys(zoneDetail.sensor_readings).length === 0 && (
                <div className="text-[10px] text-dim-text font-mono">No sensors in this zone to simulate.</div>
              )}
            </div>
          </div>

          {/* Active Permits */}
          <div>
            <div className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest mb-2">
              Active Permits ({zoneDetail.active_permits.length})
            </div>
            {zoneDetail.active_permits.length === 0 ? (
              <div className="text-xs text-dim-text font-mono">No active permits.</div>
            ) : (
              <div className="space-y-1">
                {zoneDetail.active_permits.map((permit) => (
                  <div key={permit.id} className="bg-void border border-border p-2 rounded-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-amber-warn">
                        {permit.permit_type.replace(/_/g, ' ')}
                      </span>
                      <div className="text-[9px] text-dim-text font-mono">
                        by {permit.issued_by}
                      </div>
                    </div>
                    <span className="status-tag status-tag-warning text-[8px]">ACTIVE</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workers */}
          <div>
            <div className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest mb-2">
              Workers ({zoneDetail.workers.length})
            </div>
            {zoneDetail.workers.length === 0 ? (
              <div className="text-xs text-dim-text font-mono">No workers in zone.</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {zoneDetail.workers.map((w) => (
                  <span key={w.worker_id} className="bg-void border border-border px-2 py-0.5 rounded-sm text-[10px] font-mono text-phosphor">
                    {w.worker_name || w.worker_id}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Recent Alerts */}
          <div>
            <div className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest mb-2">
              Recent Alerts
            </div>
            {zoneDetail.recent_alerts.length === 0 ? (
              <div className="text-xs text-dim-text font-mono">No recent alerts. Zone nominal.</div>
            ) : (
              <div className="space-y-1">
                {zoneDetail.recent_alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="bg-void border border-border p-2 rounded-sm">
                    <div className="flex items-center gap-2">
                      <span className={`status-tag status-tag-${alert.severity} text-[8px]`}>
                        {alert.severity}
                      </span>
                      <span className="text-[10px] text-dim-text font-mono">
                        {alert.status}
                      </span>
                    </div>
                    <div className="text-xs text-bright-text mt-1 font-mono">
                      {alert.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
