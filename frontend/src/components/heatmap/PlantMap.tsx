'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react';
import type { Zone, WorkerPosition, RiskLevel } from '@/lib/api';
import { getZones, getRiskLevels, getWorkerPositions, getZoneDetail, type ZoneDetail } from '@/lib/api';
import ZoneDetailPanel from './ZoneDetailPanel';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';

// Zone shapes for the SVG plant layout
const ZONE_SHAPES: Record<string, { path: string }> = {
  'zone-coke-oven': {
    path: 'M 50 40 L 230 40 L 230 160 L 50 160 Z',
  },
  'zone-byproduct': {
    path: 'M 270 30 L 430 30 L 430 130 L 270 130 Z',
  },
  'zone-gas-holder': {
    path: 'M 470 25 L 610 25 L 610 135 L 470 135 Z',
  },
  'zone-tank-farm': {
    path: 'M 40 200 L 210 200 L 210 310 L 40 310 Z',
  },
  'zone-workshop': {
    path: 'M 250 190 L 400 190 L 400 280 L 250 280 Z',
  },
  'zone-electrical': {
    path: 'M 440 180 L 570 180 L 570 270 L 440 270 Z',
  },
  'zone-control-room': {
    path: 'M 260 330 L 420 330 L 420 410 L 260 410 Z',
  },
  'zone-loading-bay': {
    path: 'M 460 320 L 600 320 L 600 410 L 460 410 Z',
  },
  'zone-water-treatment': {
    path: 'M 40 350 L 200 350 L 200 440 L 40 440 Z',
  },
  'zone-admin': {
    path: 'M 640 260 L 760 260 L 760 370 L 640 370 Z',
  },
};

const REFINERY_SHAPES: Record<string, { path: string }> = {
  'zone-coke-oven': {
    path: 'M 50 40 L 250 40 L 250 200 L 50 200 Z',
  },
  'zone-byproduct': {
    path: 'M 300 30 L 500 30 L 500 180 L 300 180 Z',
  },
  'zone-gas-holder': {
    path: 'M 550 25 L 750 25 L 750 180 L 550 180 Z',
  },
  'zone-tank-farm': {
    path: 'M 40 240 L 350 240 L 350 420 L 40 420 Z',
  },
  'zone-workshop': {
    path: 'M 400 220 L 750 220 L 750 420 L 400 420 Z',
  },
};

const REFINERY_NAMES: Record<string, string> = {
  'zone-coke-oven': 'Crude Distillation (CDU)',
  'zone-byproduct': 'Fluid Catalytic Cracker (FCCU)',
  'zone-gas-holder': 'Hydrogen Generation (HGU)',
  'zone-tank-farm': 'Refinery Tank Farm',
  'zone-workshop': 'Central Control Station',
};

// Zone label positions (center of each zone)
const ZONE_CENTERS: Record<string, { x: number; y: number }> = {
  'zone-coke-oven': { x: 140, y: 100 },
  'zone-byproduct': { x: 350, y: 80 },
  'zone-gas-holder': { x: 540, y: 80 },
  'zone-tank-farm': { x: 125, y: 255 },
  'zone-workshop': { x: 325, y: 235 },
  'zone-electrical': { x: 505, y: 225 },
  'zone-control-room': { x: 340, y: 370 },
  'zone-loading-bay': { x: 530, y: 365 },
  'zone-water-treatment': { x: 120, y: 395 },
  'zone-admin': { x: 700, y: 315 },
};

const REFINERY_CENTERS: Record<string, { x: number; y: number }> = {
  'zone-coke-oven': { x: 150, y: 120 },
  'zone-byproduct': { x: 400, y: 105 },
  'zone-gas-holder': { x: 650, y: 102 },
  'zone-tank-farm': { x: 195, y: 330 },
  'zone-workshop': { x: 575, y: 320 },
};

// Risk level → color mapping
const RISK_COLORS: Record<string, string> = {
  low: '#4DE8A0',
  medium: '#F5A623',
  high: '#F5A623',
  critical: '#E5484D',
};

// Risk level → pulse class
const RISK_PULSE: Record<string, string> = {
  low: 'zone-pulse-low',
  medium: 'zone-pulse-medium',
  high: 'zone-pulse-high',
  critical: 'zone-pulse-critical',
};

interface PlantMapProps {
  className?: string;
  onZoneSelect?: (zoneId: string) => void;
  profile?: 'steel' | 'petro';
}

export default function PlantMap({ className = '', profile = 'steel' }: PlantMapProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [riskLevels, setRiskLevels] = useState<Record<string, RiskLevel>>({});
  const [workerPositions, setWorkerPositions] = useState<WorkerPosition[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoneDetail, setZoneDetail] = useState<ZoneDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { latestReading, workerPositions: streamWorkers, permits } = useRealtimeStream();

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [zonesRes, riskRes, workersRes] = await Promise.all([
        getZones(),
        getRiskLevels(),
        getWorkerPositions(),
      ]);
      setZones(zonesRes.zones);
      setRiskLevels(riskRes.risk_levels);
      setWorkerPositions(workersRes.positions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live map data');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (latestReading || streamWorkers.length > 0 || permits.length > 0) {
      fetchData();
    }
  }, [latestReading, streamWorkers.length, permits.length, fetchData]);

  // Fetch zone detail when selected
  useEffect(() => {
    if (!selectedZoneId) {
      setZoneDetail(null);
      return;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const detail = await getZoneDetail(selectedZoneId);
        if (!cancelled) {
          setZoneDetail(detail);
          setDetailLoading(false);
        }
      } catch {
        if (!cancelled) setDetailLoading(false);
      }
    };

    fetchDetail();
    const interval = setInterval(fetchDetail, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedZoneId]);

  // Count workers per zone
  const workersPerZone: Record<string, WorkerPosition[]> = {};
  for (const wp of workerPositions) {
    if (!workersPerZone[wp.zone_id]) workersPerZone[wp.zone_id] = [];
    workersPerZone[wp.zone_id].push(wp);
  }

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 800 470"
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >
        {/* Background */}
        <rect x="0" y="0" width="800" height="470" fill="#0B0E11" rx="2" />

        {/* Grid lines */}
        {Array.from({ length: 16 }, (_, i) => (
          <line
            key={`vg-${i}`}
            x1={i * 50}
            y1="0"
            x2={i * 50}
            y2="470"
            stroke="rgba(139,150,163,0.05)"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <line
            key={`hg-${i}`}
            x1="0"
            y1={i * 50}
            x2="800"
            y2={i * 50}
            stroke="rgba(139,150,163,0.05)"
            strokeWidth="0.5"
          />
        ))}

        {/* Connection lines between adjacent zones */}
        {profile === 'steel' && (
          <g stroke="rgba(139,150,163,0.12)" strokeWidth="1" strokeDasharray="4 4">
            <line x1="230" y1="100" x2="270" y2="80" />
            <line x1="430" y1="80" x2="470" y2="80" />
            <line x1="140" y1="160" x2="125" y2="200" />
            <line x1="210" y1="255" x2="250" y2="235" />
            <line x1="400" y1="235" x2="440" y2="225" />
            <line x1="325" y1="280" x2="340" y2="330" />
            <line x1="420" y1="370" x2="460" y2="365" />
            <line x1="200" y1="395" x2="260" y2="370" />
            <line x1="570" y1="225" x2="640" y2="290" />
            <line x1="600" y1="365" x2="640" y2="340" />
          </g>
        )}
        {profile === 'petro' && (
          <g stroke="rgba(139,150,163,0.12)" strokeWidth="1" strokeDasharray="4 4">
            <line x1="250" y1="120" x2="300" y2="105" />
            <line x1="500" y1="105" x2="550" y2="105" />
            <line x1="195" y1="330" x2="400" y2="320" />
            <line x1="150" y1="200" x2="195" y2="240" />
            <line x1="400" y1="180" x2="575" y2="220" />
          </g>
        )}

        {/* Zone shapes */}
        {zones
          .filter((zone) => profile === 'steel' || ['zone-coke-oven', 'zone-byproduct', 'zone-gas-holder', 'zone-tank-farm', 'zone-workshop'].includes(zone.id))
          .map((zone) => {
            const shapesMap = profile === 'steel' ? ZONE_SHAPES : REFINERY_SHAPES;
            const centersMap = profile === 'steel' ? ZONE_CENTERS : REFINERY_CENTERS;
            const nameOverride = profile === 'steel' ? zone.name : REFINERY_NAMES[zone.id];

            const shape = shapesMap[zone.id];
            if (!shape) return null;

            const risk = riskLevels[zone.id];
            const level = risk?.level || zone.risk_level || 'low';
            const color = RISK_COLORS[level] || RISK_COLORS.low;
            const pulseClass = RISK_PULSE[level] || RISK_PULSE.low;
            const isSelected = selectedZoneId === zone.id;
            const zoneWorkers = workersPerZone[zone.id] || [];
            const center = centersMap[zone.id];

            return (
              <g key={zone.id}>
                {/* Zone fill with pulse */}
                <path
                  d={shape.path}
                  fill={color}
                  fillOpacity={0.12}
                  stroke={color}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeOpacity={isSelected ? 1 : 0.5}
                  className={`${pulseClass} cursor-pointer transition-all`}
                  onClick={() => setSelectedZoneId(isSelected ? null : zone.id)}
                />

                {/* Zone glow effect for high/critical */}
                {(level === 'high' || level === 'critical') && (
                  <path
                    d={shape.path}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeOpacity={0.3}
                    className={pulseClass}
                    pointerEvents="none"
                  />
                )}

                {center && (
                  <>
                    {/* Zone name */}
                    <text
                      x={center.x}
                      y={center.y - 10}
                      textAnchor="middle"
                      className="cursor-pointer"
                      fill="#E8ECF0"
                      fontSize="10"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="600"
                      onClick={() => setSelectedZoneId(isSelected ? null : zone.id)}
                    >
                      {nameOverride}
                    </text>

                    {/* Risk indicator */}
                    <text
                      x={center.x}
                      y={center.y + 6}
                      textAnchor="middle"
                      fill={color}
                      fontSize="9"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="500"
                      opacity={0.8}
                    >
                      {level.toUpperCase()}{risk?.score ? ` (${Math.round(risk.score)})` : ''}
                    </text>

                    {/* Worker count */}
                    {zoneWorkers.length > 0 && (
                      <g>
                        <circle
                          cx={center.x + 50}
                          cy={center.y - 15}
                          r="8"
                          fill="rgba(77,232,160,0.2)"
                          stroke="#4DE8A0"
                          strokeWidth="0.5"
                        />
                        <text
                          x={center.x + 50}
                          y={center.y - 11}
                          textAnchor="middle"
                          fill="#4DE8A0"
                          fontSize="8"
                          fontFamily="'JetBrains Mono', monospace"
                          fontWeight="700"
                        >
                          {zoneWorkers.length}
                        </text>
                      </g>
                    )}

                    {/* Worker dots */}
                    {zoneWorkers.slice(0, 4).map((wp, i) => {
                      const angle = (i / Math.max(zoneWorkers.length, 1)) * Math.PI * 2;
                      const dotX = center.x + Math.cos(angle) * 25;
                      const dotY = center.y + 15 + Math.sin(angle) * 12;
                      return (
                        <g key={wp.worker_id}>
                          <circle
                            cx={dotX}
                            cy={dotY}
                            r="3"
                            fill="#4DE8A0"
                            opacity={0.7}
                          />
                          <circle
                            cx={dotX}
                            cy={dotY}
                            r="5"
                            fill="none"
                            stroke="#4DE8A0"
                            strokeWidth="0.5"
                            opacity={0.3}
                            className="zone-pulse-low"
                          />
                        </g>
                      );
                    })}
                  </>
                )}
              </g>
            );
          })}

        {/* Legend */}
        <g transform="translate(650, 420)">
          {[
            { label: 'LOW', color: '#4DE8A0' },
            { label: 'MED', color: '#F5A623' },
            { label: 'HIGH', color: '#E5484D' },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(${i * 48}, 0)`}>
              <rect x="0" y="0" width="8" height="8" fill={item.color} opacity={0.6} />
              <text x="12" y="7" fill="#8B96A3" fontSize="7" fontFamily="'JetBrains Mono', monospace">
                {item.label}
              </text>
            </g>
          ))}
          <g transform="translate(0, 16)">
            <circle cx="4" cy="4" r="3" fill="#4DE8A0" opacity={0.7} />
            <text x="12" y="7" fill="#8B96A3" fontSize="7" fontFamily="'JetBrains Mono', monospace">
              WORKER
            </text>
          </g>
        </g>

        {/* Title */}
        <text x="20" y="18" fill="#8B96A3" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600" letterSpacing="0.1em">
          PLANT LAYOUT — LIVE RISK OVERLAY
        </text>
      </svg>

      {/* Zone Detail Panel */}
      {selectedZoneId && (
        <ZoneDetailPanel
          zoneDetail={zoneDetail}
          loading={detailLoading}
          onClose={() => setSelectedZoneId(null)}
        />
      )}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 bg-amber-dim border border-amber-warn/40 p-2 text-[10px] font-mono text-amber-warn">
          {error}
        </div>
      )}
    </div>
  );
}
