'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react';
import {
  getPermits, getZones, evaluatePermit, issuePermit, overridePermit, closePermit,
  type Permit, type Zone, type PermitEvaluation,
} from '@/lib/api';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';

export default function PermitsPage() {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formZone, setFormZone] = useState('');
  const [formType, setFormType] = useState('hot_work');
  const [formOfficer, setFormOfficer] = useState('Safety Officer');
  const [evaluation, setEvaluation] = useState<PermitEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState('');
  const [issueMessage, setIssueMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const { permits: streamPermits } = useRealtimeStream();

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const [permitsRes, zonesRes] = await Promise.all([
        getPermits(params),
        getZones(),
      ]);
      setPermits(permitsRes.permits);
      setZones(zonesRes.zones);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch permits');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (streamPermits.length > 0) {
      fetchData();
    }
  }, [streamPermits.length, fetchData]);

  const handleEvaluate = async () => {
    if (!formZone) return;
    setEvaluating(true);
    setEvaluation(null);
    setIssueMessage('');
    try {
      const res = await evaluatePermit({
        zone_id: formZone,
        permit_type: formType,
        issued_by: formOfficer,
      });
      setEvaluation(res.evaluation);

      if (res.evaluation.approved) {
        // Auto-issue if approved
        const issueRes = await issuePermit({
          zone_id: formZone,
          permit_type: formType,
          issued_by: formOfficer,
        });
        if (issueRes.issued) {
          setIssueMessage('Permit issued.');
          setShowForm(false);
          setEvaluation(null);
          fetchData();
        }
      }
    } catch (e) {
      console.error('Evaluation failed:', e);
    } finally {
      setEvaluating(false);
    }
  };

  const handleOverride = async () => {
    if (overrideJustification.length < 10) return;
    try {
      const res = await overridePermit({
        zone_id: formZone,
        permit_type: formType,
        issued_by: formOfficer,
        justification: overrideJustification,
      });
      if (res.issued) {
        setIssueMessage(`Permit issued with override. ${res.message || ''}`);
        setShowForm(false);
        setShowOverrideModal(false);
        setEvaluation(null);
        setOverrideJustification('');
        fetchData();
      }
    } catch (e) {
      console.error('Override failed:', e);
    }
  };

  const handleClose = async (permitId: string) => {
    await closePermit(permitId);
    fetchData();
  };

  const getZoneName = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone?.name || zoneId;
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold tracking-wide">PERMIT MANAGEMENT</h1>
          <p className="text-xs text-dim-text font-mono mt-0.5">
            AI-verified permit-to-work system with conflict detection
          </p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEvaluation(null); setIssueMessage(''); }} className="btn btn-primary text-xs">
          {showForm ? 'Cancel' : 'Issue New Permit'}
        </button>
      </div>

      {/* Success message */}
      {issueMessage && (
        <div className="bg-phosphor-dim border border-phosphor/30 p-3 rounded-sm text-xs font-mono text-phosphor">
          {issueMessage}
        </div>
      )}

      {/* Issue Permit Form */}
      {error && (
        <div className="bg-amber-dim border border-amber-warn/30 p-3 rounded-sm text-xs font-mono text-amber-warn">
          {error}
        </div>
      )}

      {showForm && (
        <div className="panel p-4 space-y-3">
          <div className="panel-header -m-4 mb-3 mt-[-16px]">ISSUE NEW PERMIT</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest block mb-1">
                Zone
              </label>
              <select
                className="input"
                value={formZone}
                onChange={(e) => { setFormZone(e.target.value); setEvaluation(null); }}
              >
                <option value="">Select zone...</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest block mb-1">
                Permit Type
              </label>
              <select
                className="input"
                value={formType}
                onChange={(e) => { setFormType(e.target.value); setEvaluation(null); }}
              >
                <option value="hot_work">Hot Work</option>
                <option value="confined_space_entry">Confined Space Entry</option>
                <option value="electrical">Electrical</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest block mb-1">
                Issuing Officer
              </label>
              <input
                type="text"
                className="input"
                value={formOfficer}
                onChange={(e) => setFormOfficer(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleEvaluate}
            disabled={!formZone || evaluating}
            className="btn btn-primary text-xs"
          >
            {evaluating ? 'Evaluating...' : 'Evaluate & Issue Permit'}
          </button>

          {/* Evaluation Result */}
          {evaluation && !evaluation.approved && (
            <div className="bg-amber-dim border border-amber-warn/30 p-4 rounded-sm space-y-3">
              <div className="flex items-center gap-2">
                <span className={`status-tag status-tag-${evaluation.risk_level === 'critical' ? 'critical' : 'warning'}`}>
                  {evaluation.risk_level}
                </span>
                <span className="text-sm font-mono font-semibold text-amber-warn">
                  PERMIT BLOCKED
                </span>
              </div>

              {/* Conflicts */}
              <div>
                <div className="text-[10px] font-mono font-semibold text-dim-text uppercase mb-1">Conflicts Detected:</div>
                <ul className="space-y-1">
                  {evaluation.conflicts.map((conflict, i) => (
                    <li key={i} className="text-xs text-bright-text font-mono flex items-start gap-2">
                      <span className="text-amber-warn mt-0.5">▸</span>
                      {conflict}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendation */}
              <div className="bg-void border border-border p-3 rounded-sm">
                <div className="text-[10px] font-mono font-semibold text-dim-text uppercase mb-1">AI Recommendation:</div>
                <p className="text-xs text-bright-text leading-relaxed">{evaluation.recommendation}</p>
              </div>

              {/* Override */}
              {evaluation.override_allowed && (
                <div>
                  <button
                    onClick={() => setShowOverrideModal(true)}
                    className="btn btn-danger text-xs"
                  >
                    Override — Issue Anyway
                  </button>
                  <span className="text-[10px] text-dim-text font-mono ml-2">
                    Requires documented justification
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="panel w-full max-w-[500px] mx-4">
            <div className="panel-header flex items-center justify-between">
              <span>SAFETY OVERRIDE</span>
              <button onClick={() => setShowOverrideModal(false)} className="text-dim-text hover:text-bright-text">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-amber-dim border border-amber-warn/30 p-3 rounded-sm">
                <p className="text-xs text-amber-warn font-mono">
                  Override requires a documented reason. This will be recorded against your officer ID.
                </p>
              </div>
              <div>
                <label className="text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest block mb-1">
                  Justification (minimum 10 characters)
                </label>
                <textarea
                  className="input min-h-[80px]"
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  placeholder="Document why this override is necessary..."
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowOverrideModal(false)} className="btn text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleOverride}
                  disabled={overrideJustification.length < 10}
                  className="btn btn-danger text-xs"
                >
                  Confirm Override — Issue Permit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-mono text-dim-text uppercase mr-2">Status:</div>
        {(['all', 'active', 'closed'] as const).map((s) => (
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

      {/* Permits Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Type</th>
              <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Zone</th>
              <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Status</th>
              <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Issued By</th>
              <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Time</th>
              <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={6} className="p-4 text-center text-sm text-dim-text font-mono">Loading permits...</td></tr>
            ) : permits.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-sm text-dim-text font-mono">No permits found.</td></tr>
            ) : (
              permits.map((permit) => (
                <tr key={permit.id} className="hover:bg-steel-light/50 transition-colors">
                  <td className="p-3">
                    <span className="text-xs font-mono text-amber-warn">
                      {permit.permit_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-xs font-mono text-bright-text">
                    {permit.zone_name || getZoneName(permit.zone_id)}
                  </td>
                  <td className="p-3">
                    <span className={`status-tag ${permit.status === 'active' ? 'status-tag-warning' : 'status-tag-info'}`}>
                      {permit.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs font-mono text-dim-text">{permit.issued_by}</td>
                  <td className="p-3 text-[10px] font-mono text-dim-text">
                    {permit.issued_at ? new Date(permit.issued_at).toLocaleTimeString() : '—'}
                  </td>
                  <td className="p-3">
                    {permit.status === 'active' && (
                      <button
                        onClick={() => handleClose(permit.id)}
                        className="btn text-[10px] py-0.5 px-2"
                      >
                        Close
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Safety Decision & Compliance Audit Log */}
      <div className="panel mt-6">
        <div className="panel-header flex items-center justify-between">
          <span>SAFETY DECISION LOG (OISD / DGMS COMPLIANCE AUDIT TRAIL)</span>
          <span className="text-[9px] font-mono bg-amber-dim text-amber-warn border border-amber-warn/20 px-1.5 py-0.5 rounded-sm">
            AUDIT ACTIVE
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-steel/30">
                <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Timestamp</th>
                <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Permit Type</th>
                <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Zone</th>
                <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Authorized By</th>
                <th className="text-left text-[10px] font-mono font-semibold text-dim-text uppercase tracking-widest p-3">Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {permits.filter(p => p.override).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-xs text-dim-text font-mono">
                    No override events logged. Complete compliance maintained.
                  </td>
                </tr>
              ) : (
                permits.filter(p => p.override).map((permit) => (
                  <tr key={permit.id} className="hover:bg-steel-light/30 transition-colors">
                    <td className="p-3 text-[10px] font-mono text-dim-text">
                      {permit.override?.timestamp ? new Date(permit.override.timestamp).toLocaleTimeString() : '—'}
                    </td>
                    <td className="p-3 text-xs font-mono text-alert-red font-bold">
                      {permit.permit_type.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3 text-xs font-mono text-bright-text">
                      {permit.zone_name || getZoneName(permit.zone_id)}
                    </td>
                    <td className="p-3 text-xs font-mono text-bright-text">
                      {permit.override?.officer || permit.issued_by}
                    </td>
                    <td className="p-3 text-xs font-mono text-amber-warn max-w-[400px] break-words">
                      "{permit.override?.justification}"
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
