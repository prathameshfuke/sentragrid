'use client';
/* eslint-disable react-hooks/immutability */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createEventSource, type Alert, type SensorReading, type WorkerPosition, type Permit, type SimulatorStatus } from '@/lib/api';

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

export function useRealtimeStream() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [workerPositions, setWorkerPositions] = useState<Map<string, WorkerPosition>>(new Map());
  const [permits, setPermits] = useState<Permit[]>([]);
  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    try {
      const es = createEventSource();
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (event) => {
        try {
          const parsed: SSEEvent = JSON.parse(event.data);

          switch (parsed.type) {
            case 'alerts': {
              const alert = parsed.data as unknown as Alert;
              setAlerts(prev => [alert, ...prev].slice(0, 50));
              break;
            }
            case 'sensor_readings': {
              const reading = parsed.data as unknown as SensorReading;
              setLatestReading(reading);
              break;
            }
            case 'worker_positions': {
              const pos = parsed.data as unknown as WorkerPosition;
              setWorkerPositions(prev => {
                const next = new Map(prev);
                next.set(pos.worker_id, pos);
                return next;
              });
              break;
            }
            case 'permits': {
              const permit = parsed.data as unknown as Permit;
              setPermits(prev => [permit, ...prev].slice(0, 20));
              break;
            }
            case 'keepalive': {
              const ka = parsed.data as { simulator?: SimulatorStatus };
              if (ka.simulator) {
                setSimulatorStatus(ka.simulator);
              }
              break;
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        // Reconnect after 3s
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch {
      setConnected(false);
      reconnectTimeout.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) esRef.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return {
    alerts,
    latestReading,
    workerPositions: Array.from(workerPositions.values()),
    permits,
    simulatorStatus,
    connected,
  };
}
