'use client';

import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="max-w-[1200px] mx-auto py-8 px-4 space-y-8 font-mono">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-wide text-bright-text">
          SYSTEM DOCUMENTATION & COMPLIANCE MATRIX
        </h1>
        <p className="text-xs text-dim-text mt-1">
          SentraGrid Core Architecture, AI Safety Engine, and OISD / Factory Act Regulatory Controls
        </p>
      </div>

      {/* Grid: Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-4">
          <div className="panel p-4 space-y-3">
            <div className="text-[10px] uppercase font-bold text-phosphor tracking-widest mb-1">
              Doc Sections
            </div>
            <a href="#architecture" className="block text-xs text-bright-text hover:text-phosphor transition-colors">
              ➔ 1. System Architecture
            </a>
            <a href="#risk-engine" className="block text-xs text-bright-text hover:text-phosphor transition-colors">
              ➔ 2. Compound Risk Analytics
            </a>
            <a href="#compliance" className="block text-xs text-bright-text hover:text-phosphor transition-colors">
              ➔ 3. OISD & Factory Act Compliance
            </a>
            <a href="#emergency" className="block text-xs text-bright-text hover:text-phosphor transition-colors">
              ➔ 4. Incident Response Protocol
            </a>
          </div>

          <div className="panel p-4 space-y-3">
            <div className="text-[10px] uppercase font-bold text-amber-warn tracking-widest mb-1">
              Safety Checklists
            </div>
            <div className="text-[11px] text-dim-text leading-relaxed">
              * OISD-105: Work Permit System checks<br/>
              * Section 37: Factory Act Ventilation checks<br/>
              * SIMOPS Buffer: 50m spatial safety matrices
            </div>
          </div>

          <Link href="/dashboard" className="block">
            <button className="w-full bg-phosphor-dim border border-phosphor/30 hover:border-phosphor py-2.5 text-xs text-phosphor font-bold uppercase tracking-widest transition-colors">
              Open Console Console
            </button>
          </Link>
        </div>

        {/* Doc Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Architecture */}
          <div id="architecture" className="panel p-6 space-y-4">
            <div className="panel-header text-phosphor text-sm">1. SYSTEM ARCHITECTURE</div>
            <div className="text-xs text-dim-text space-y-3 leading-relaxed">
              <p>
                SentraGrid relies on a distributed multi-agent system designed for low-latency streaming and high-accuracy hazard checks.
              </p>
              
              <div className="bg-void border border-border p-3 space-y-2 rounded-sm">
                <div className="text-[10px] text-bright-text font-bold uppercase">A. IoT Realtime Data Processor</div>
                <p className="text-[11px]">
                  Sensor inputs (toxic gases H₂S/CO, temperature, and pressure) are written directly to the database. These trigger immediate asynchronous evaluation events.
                </p>
              </div>

              <div className="bg-void border border-border p-3 space-y-2 rounded-sm">
                <div className="text-[10px] text-bright-text font-bold uppercase">B. Server-Sent Events (SSE) Broadcast</div>
                <p className="text-[11px]">
                  A high-throughput streaming pipeline pushes real-time telemetry, geolocation updates, and alert events to control room screens via HTML5 EventSource with low network overhead.
                </p>
              </div>

              <div className="bg-void border border-border p-3 space-y-2 rounded-sm">
                <div className="text-[10px] text-bright-text font-bold uppercase">C. Vector Retrieval & Q&A (RAG)</div>
                <p className="text-[11px]">
                  User safety queries are embedded using Hugging Face's `all-MiniLM-L6-v2` in the cloud. A Supabase `pgvector` RPC query (`match_incident_reports`) performs cosine similarity search. Llama 3.3 synthesizes technical answers citing regulatory sources.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Compound Risk Engine */}
          <div id="risk-engine" className="panel p-6 space-y-4">
            <div className="panel-header text-phosphor text-sm">2. COMPOUND RISK ENGINE & ANALYTICS</div>
            <div className="text-xs text-dim-text space-y-3 leading-relaxed">
              <p>
                Traditional safety systems utilize isolated sensors with static thresholds (e.g. alarming only if CO &gt; 25 ppm). SentraGrid solves the **"sub-threshold hazard"** problem.
              </p>
              <div className="bg-void border border-border p-4 rounded-sm space-y-3 text-[11px] leading-relaxed">
                <div className="font-bold text-bright-text uppercase">Compound Risk Calculation Algorithm:</div>
                <ul className="list-disc pl-4 space-y-2">
                  <li>
                    <strong>Telemetry Correlation</strong>: If multiple process values (e.g. gas level and temperature) trend upward simultaneously, a multiplicative risk score is computed.
                  </li>
                  <li>
                    <strong>Active Permit Conflicts</strong>: Active work permits inside a zone or adjacent to it multiply the baseline score by configured weights (e.g., Conflicting Hot Work + Confined Space Entry = 3.0x multiplier).
                  </li>
                  <li>
                    <strong>Worker Exposure</strong>: Risk score increases by `+2` for every worker present in an elevated-risk zone, reflecting increased exposure potential.
                  </li>
                  <li>
                    <strong>LLM Generation Cooldown</strong>: LLM calls are cached for 45s. Telemetry changes during the cooldown trigger a microsecond rule-based execution, preventing backend lag.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 3: Regulatory Compliance */}
          <div id="compliance" className="panel p-6 space-y-4">
            <div className="panel-header text-phosphor text-sm">3. OISD & FACTORY ACT COMPLIANCE MATRIX</div>
            <div className="text-xs text-dim-text space-y-3 leading-relaxed">
              <p>
                SentraGrid safety logic is mapped directly to Indian statutory regulations to maintain legal compliance and prevent undocumented safety overrides:
              </p>
              
              <table className="w-full border-collapse border border-border text-[11px]">
                <thead>
                  <tr className="bg-steel/50">
                    <th className="border border-border p-2 text-left">Statute</th>
                    <th className="border border-border p-2 text-left">Provision</th>
                    <th className="border border-border p-2 text-left">SentraGrid Automated Control</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border p-2 font-bold text-bright-text">OISD-105 Section 4.3</td>
                    <td className="border border-border p-2">Mandatory atmospheric testing before confined space entries.</td>
                    <td className="border border-border p-2">Permit Intelligence Agent blocks confined space entry permit unless H₂S and CO are within limits.</td>
                  </tr>
                  <tr className="bg-steel/20">
                    <td className="border border-border p-2 font-bold text-bright-text">OISD-105 Section 5.1</td>
                    <td className="border border-border p-2">Avoid simultaneous operations (SIMOPS) conflicts.</td>
                    <td className="border border-border p-2">Digital Permit Agent checks 50m adjacent zones for active ignition permits.</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-2 font-bold text-bright-text">Factory Act Sec 36</td>
                    <td className="border border-border p-2">Prevention of inhalation of gas/dust in confined spaces.</td>
                    <td className="border border-border p-2">Compound Risk Engine checks continuous gas trends and raises alerts to standby attendants.</td>
                  </tr>
                  <tr className="bg-steel/20">
                    <td className="border border-border p-2 font-bold text-bright-text">Factory Act Sec 41</td>
                    <td className="border border-border p-2">Maintenance of safety records and override approvals.</td>
                    <td className="border border-border p-2">Override compliance ledger logs justification, officer name, and timestamp.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Emergency Response */}
          <div id="emergency" className="panel p-6 space-y-4">
            <div className="panel-header text-phosphor text-sm">4. EMERGENCY RESPONSE PROTOCOL (FIRST 10 MINUTES)</div>
            <div className="text-xs text-dim-text space-y-3 leading-relaxed">
              <p>
                In a critical alert state, the Emergency Response Orchestrator immediately coordinates the response plan to save lives:
              </p>
              
              <div className="border-l-2 border-alert-red bg-alert-red/10 p-3 text-[11px] leading-relaxed text-bright-text">
                <strong>T=0s (Alert Confirmed)</strong>: Triggers plant evacuation alarms, pushes broadcast notification to worker wearable screens, and flags safety officers via active alerts.
              </div>
              
              <div className="border-l-2 border-amber-warn bg-amber-warn/10 p-3 text-[11px] leading-relaxed text-bright-text">
                <strong>T+60s (SCADA Evac Plan)</strong>: Dispatches structural air extractor valves to clear gas pockets, cuts off adjacent hot work power grids automatically, and provides digital routing guides.
              </div>

              <div className="border-l-2 border-phosphor bg-phosphor-dim p-3 text-[11px] leading-relaxed text-bright-text">
                <strong>T+5m (Incident Log Archive)</strong>: Locks all process records, SCADA sequences, permit audits, and worker telemetry in the DB for post-incident review.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
