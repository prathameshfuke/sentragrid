'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import type { Alert } from '@/lib/api';

interface AlertTickerProps {
  alerts: Alert[];
}

export default function AlertTicker({ alerts }: AlertTickerProps) {
  const [visible, setVisible] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);

  useEffect(() => {
    // Show the most recent critical or warning alert
    const urgent = alerts.find(a => a.severity === 'critical' || a.severity === 'warning');
    if (urgent && urgent.id !== currentAlert?.id) {
      setCurrentAlert(urgent);
      setVisible(true);
    }
  }, [alerts, currentAlert?.id]);

  if (!visible || !currentAlert) return null;

  const isCritical = currentAlert.severity === 'critical';

  return (
    <div
      className={`
        fixed bottom-[56px] md:bottom-0 left-0 md:left-[72px] right-0 z-50
        animate-slide-in-up
        ${isCritical ? 'bg-alert-red-dim border-t-2 border-alert-red' : 'bg-amber-dim border-t-2 border-amber-warn'}
      `}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`status-tag ${isCritical ? 'status-tag-critical' : 'status-tag-warning'}`}
          >
            {currentAlert.severity}
          </span>
          <span className="font-mono text-xs text-bright-text truncate">
            {currentAlert.title}
          </span>
          {currentAlert.zone_name && (
            <span className="text-[10px] text-dim-text font-mono hidden md:block">
              — {currentAlert.zone_name}
            </span>
          )}
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-dim-text hover:text-bright-text text-xs font-mono ml-4 flex-shrink-0"
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}
