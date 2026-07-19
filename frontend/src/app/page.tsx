'use client';

import Link from 'next/link';

export default function PortalLandingPage() {
  return (
    <div className="max-w-[1200px] mx-auto py-8 md:py-16 px-4 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-[800px] mx-auto py-6">
        <div className="inline-block border border-phosphor/30 bg-phosphor-dim px-3 py-1 rounded-sm text-[10px] font-mono text-phosphor uppercase tracking-widest animate-pulse">
          Next-Generation SIMOPS Protection
        </div>
        <h1 className="text-3xl md:text-5xl font-mono font-bold tracking-tight text-bright-text leading-tight">
          AI-Powered Industrial Safety Intelligence for <span className="text-phosphor">Zero-Harm Operations</span>
        </h1>
        <p className="text-sm md:text-base text-dim-text font-mono max-w-[650px] mx-auto leading-relaxed">
          Fusing real-time IoT gas/temperature telemetry, active work permits, and worker geolocation databases into a unified, predictive risk prevention system.
        </p>

        {/* Start Console Button */}
        <div className="pt-6">
          <Link href="/dashboard" className="inline-block group relative">
            {/* Glowing border effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-phosphor to-emerald-500 rounded-sm blur opacity-60 group-hover:opacity-100 transition duration-300"></div>
            <button className="relative bg-steel border border-phosphor px-8 py-3.5 text-xs font-mono font-bold text-phosphor uppercase tracking-widest hover:bg-phosphor hover:text-void transition-all duration-300">
              Start Operations Console →
            </button>
          </Link>
        </div>
      </div>

      {/* Grid: Context & Challenge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
        {/* The Problem Context */}
        <div className="panel p-6 space-y-4">
          <div className="panel-header text-amber-warn border-amber-warn/20">PROBLEM CONTEXT</div>
          <div className="text-xs font-mono text-dim-text leading-relaxed space-y-3">
            <p>
              Heavy industrial operations continue to face catastrophic incidents due to siloed safety systems. In FY2023, over <strong className="text-bright-text">6,500 fatal workplace accidents</strong> were recorded in India.
            </p>
            <p className="bg-steel/30 p-3 border-l-2 border-amber-warn text-bright-text">
              <strong>The Silo Gap</strong>: During major process events, warning indicators from local pressure and gas sensors often exist, but because they reside in isolated databases (SCADA, manual shift logs, or physical work permits), control rooms cannot cross-reference the data in time to prevent explosions.
            </p>
            <p>
              According to a recent industry survey, over <strong className="text-bright-text">60% of large facilities</strong> rely on manual handovers to coordinate between disparate safety tools, creating critical latency gaps when coordinating response.
            </p>
          </div>
        </div>

        {/* The Platform Vision */}
        <div className="panel p-6 space-y-4">
          <div className="panel-header text-phosphor">THE PLATFORM CHALLENGE</div>
          <div className="text-xs font-mono text-dim-text leading-relaxed space-y-3">
            <p>
              SentraGrid bridges the coordination gap by introducing an **Autonomous Safety Intelligence Layer** that correlates and analyzes complex conditions.
            </p>
            <p className="bg-steel/30 p-3 border-l-2 border-phosphor text-bright-text">
              <strong>Compound Risk Assessment</strong>: Traditional systems alert when a single sensor crosses an absolute threshold. SentraGrid assesses **co-occurring hazards**—such as active hot work permits authorized near sub-threshold gas trends—to predict incidents up to 40 minutes in advance.
            </p>
            <p>
              By translating sensor telemetry, SCADA values, and operational metadata into a dynamic geospatial risk layer, the platform empowers officers with true situational awareness.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Solutions Pillars */}
      <div className="space-y-6">
        <div className="text-center font-mono">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-bright-text">Core Safety Intelligence Pillars</h2>
          <div className="w-12 h-0.5 bg-phosphor mx-auto mt-2"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="panel p-4 space-y-2">
            <div className="text-xs font-mono font-bold text-phosphor uppercase">1. Compound Risk Engine</div>
            <p className="text-[11px] font-mono text-dim-text leading-relaxed">
              Correlates multi-sensor telemetry, worker occupancy, and process trends to predict cumulative safety indexes before local alarms breach thresholds.
            </p>
          </div>

          <div className="panel p-4 space-y-2">
            <div className="text-xs font-mono font-bold text-phosphor uppercase">2. Geospatial Safety Heatmap</div>
            <p className="text-[11px] font-mono text-dim-text leading-relaxed">
              Superimposes dynamic risk rings over interactive plant layouts (Coke Oven, Gas Holder, Refining Units) utilizing realtime worker GPS coordinates.
            </p>
          </div>

          <div className="panel p-4 space-y-2">
            <div className="text-xs font-mono font-bold text-phosphor uppercase">3. Digital Permit Intelligence</div>
            <p className="text-[11px] font-mono text-dim-text leading-relaxed">
              Permit gate checks requested tasks (like welding) against live nearby atmospheres to block hazardous concurrent work permissions.
            </p>
          </div>

          <div className="panel p-4 space-y-2">
            <div className="text-xs font-mono font-bold text-phosphor uppercase">4. Pattern Q&A Agent (RAG)</div>
            <p className="text-[11px] font-mono text-dim-text leading-relaxed">
              A vector-search agent querying OISD regulatory guidelines and near-miss logs using natural language to extract historical prevention patterns.
            </p>
          </div>

          <div className="panel p-4 space-y-2">
            <div className="text-xs font-mono font-bold text-phosphor uppercase">5. Response Orchestration</div>
            <p className="text-[11px] font-mono text-dim-text leading-relaxed">
              Triggers plant-wide siren protocols, archives sensor evidence data, and auto-generates preliminary incident documentation.
            </p>
          </div>

          <div className="panel p-4 space-y-2">
            <div className="text-xs font-mono font-bold text-phosphor uppercase">6. Compliance Audit Layer</div>
            <p className="text-[11px] font-mono text-dim-text leading-relaxed">
              Continuously monitors standard permit logs and overrides against safety laws to guarantee 100% auditable documentation.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between font-mono text-[10px] text-dim-text">
        <div>SENTRAGRID PLATFORM v1.0.0 — ZERO HARM VISION</div>
        <div className="flex gap-4 mt-2 md:mt-0">
          <Link href="/dashboard" className="hover:text-phosphor">DASHBOARD</Link>
          <span>•</span>
          <Link href="/docs" className="hover:text-phosphor">SYSTEM DOCUMENTATION</Link>
        </div>
      </div>
    </div>
  );
}
