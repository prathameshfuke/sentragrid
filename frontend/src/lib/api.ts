/**
 * SentraGrid — API Client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const REQUEST_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createApiErrorMessage(status?: number): string {
  if (status === 502 || status === 503 || status === 504) {
    return 'Backend is warming up. Retrying automatically…';
  }
  if (!status) {
    return 'Backend is unreachable. It may be waking up. Retry in a few seconds.';
  }
  return `API error: ${status}`;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (
    typeof window !== 'undefined' &&
    !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) &&
    /localhost|127\.0\.0\.1/.test(API_BASE)
  ) {
    throw new Error('Frontend is configured with localhost API URL in production. Set NEXT_PUBLIC_API_BASE_URL to your live backend URL.');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(createApiErrorMessage(res.status));
      }

      return res.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown API error';
      lastError = new Error(message);
      if (attempt < MAX_RETRIES) {
        await sleep(900 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error('API request failed');
}

// ── Zones & Sensors ──

export async function getZones() {
  return apiFetch<{ zones: Zone[] }>('/api/zones');
}

export async function getZoneDetail(zoneId: string) {
  return apiFetch<ZoneDetail>(`/api/zones/${zoneId}`);
}

export async function getRiskLevels() {
  return apiFetch<{ risk_levels: Record<string, RiskLevel> }>('/api/risk/levels');
}

export async function getWorkerPositions() {
  return apiFetch<{ positions: WorkerPosition[] }>('/api/workers/positions');
}

export async function getSensorHistory(sensorId: string) {
  return apiFetch<{ sensor_id: string; history: SensorReading[] }>(`/api/sensors/${sensorId}/history`);
}

// ── Alerts ──

export async function getAlerts(params?: { status?: string; severity?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.severity) query.set('severity', params.severity);
  const qs = query.toString();
  return apiFetch<{ alerts: Alert[] }>(`/api/alerts${qs ? '?' + qs : ''}`);
}

export async function getOpenAlerts() {
  return apiFetch<{ alerts: Alert[]; counts: AlertCounts }>('/api/alerts/open');
}

export async function getRecentAlerts(limit = 10) {
  return apiFetch<{ alerts: Alert[] }>(`/api/alerts/recent?limit=${limit}`);
}

export async function acknowledgeAlert(alertId: string) {
  return apiFetch<{ alert: Alert }>(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' });
}

export async function resolveAlert(alertId: string) {
  return apiFetch<{ alert: Alert }>(`/api/alerts/${alertId}/resolve`, { method: 'POST' });
}

// ── Permits ──

export async function getPermits(params?: { status?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return apiFetch<{ permits: Permit[] }>(`/api/permits${qs ? '?' + qs : ''}`);
}

export async function evaluatePermit(data: PermitRequest) {
  return apiFetch<{ evaluation: PermitEvaluation }>('/api/permits/evaluate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function issuePermit(data: PermitRequest) {
  return apiFetch<{ issued: boolean; permit?: Permit; evaluation?: PermitEvaluation; message?: string }>('/api/permits/issue', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function overridePermit(data: PermitRequest & { justification: string }) {
  return apiFetch<{ issued: boolean; permit?: Permit; override_logged?: boolean; message?: string }>('/api/permits/override', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function closePermit(permitId: string) {
  return apiFetch<{ permit: Permit }>(`/api/permits/${permitId}/close`, { method: 'POST' });
}

// ── RAG ──

export async function queryRAG(question: string) {
  return apiFetch<RAGResponse>('/api/rag/query', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export async function getSuggestedQuestions() {
  return apiFetch<{ questions: string[] }>('/api/rag/suggested-questions');
}

// ── What-If Simulator ──

export async function addCustomReading(sensorId: string, value: number) {
  return apiFetch<{ status: string; reading: SensorReading }>('/api/sensors/reading', {
    method: 'POST',
    body: JSON.stringify({ sensor_id: sensorId, value }),
  });
}

// ── Simulator ──

export async function getDashboard() {
  return apiFetch<{ kpis: DashboardKPIs; simulator: SimulatorStatus }>('/api/simulator/dashboard');
}

export async function getSimulatorStatus() {
  return apiFetch<SimulatorStatus>('/api/simulator/status');
}

export async function startNormalSim() {
  return apiFetch<{ message: string; status: SimulatorStatus }>('/api/simulator/start-normal', { method: 'POST' });
}

export async function startDemoSim() {
  return apiFetch<{ message: string; status: SimulatorStatus }>('/api/simulator/start-demo', { method: 'POST' });
}

export async function stopSim() {
  return apiFetch<{ message: string; status: SimulatorStatus }>('/api/simulator/stop', { method: 'POST' });
}

export function createEventSource(): EventSource {
  return new EventSource(`${API_BASE}/api/simulator/stream`);
}

// ── Types ──

export interface Zone {
  id: string;
  name: string;
  zone_type: string;
  x_coord: number;
  y_coord: number;
  width: number;
  height: number;
  baseline_risk_level: string;
  risk_level?: string;
  risk_score?: number;
}

export interface RiskLevel {
  level: string;
  score: number;
  factors_count: number;
}

export interface SensorReading {
  id: number;
  sensor_id: string;
  value: number;
  recorded_at: string;
  zone_id?: string;
  sensor_type?: string;
}

export interface Alert {
  id: string;
  zone_id: string;
  severity: string;
  title: string;
  explanation: string;
  triggering_factors: Record<string, unknown>;
  status: string;
  created_at: string;
  zone_name?: string;
}

export interface AlertCounts {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export interface Permit {
  id: string;
  zone_id: string;
  permit_type: string;
  status: string;
  issued_by: string;
  issued_at: string;
  valid_until: string;
  zone_name?: string;
  override?: {
    justification: string;
    officer: string;
    timestamp: string;
  };
}

export interface PermitRequest {
  zone_id: string;
  permit_type: string;
  issued_by?: string;
}

export interface PermitEvaluation {
  approved: boolean;
  conflicts: string[];
  recommendation: string;
  override_allowed: boolean;
  risk_level: string;
}

export interface WorkerPosition {
  id: number;
  worker_id: string;
  zone_id: string;
  recorded_at: string;
  worker_name?: string;
}

export interface ZoneDetail {
  zone: Zone;
  risk_level: string;
  risk_score: number;
  sensor_readings: Record<string, SensorReading>;
  all_readings: SensorReading[];
  active_permits: Permit[];
  workers: WorkerPosition[];
  recent_alerts: Alert[];
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
}

export interface RAGSource {
  title: string;
  content_snippet: string;
  source_type: string;
  similarity?: number;
}

export interface DashboardKPIs {
  open_alerts: number;
  critical_alerts: number;
  warning_alerts: number;
  active_permits: number;
  elevated_zones: number;
  workers_on_site: number;
}

export interface SimulatorStatus {
  running: boolean;
  mode: string;
  phase: number;
  phase_description: string;
  elapsed_seconds: number;
}
