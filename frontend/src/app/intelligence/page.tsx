'use client';

import { useState, useEffect, useRef } from 'react';
import { queryRAG, getSuggestedQuestions, type RAGResponse, type RAGSource } from '@/lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGSource[];
  timestamp: Date;
}

export default function IntelligencePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCounterRef = useRef(0);

  const nextMessageId = (prefix: string) => {
    messageCounterRef.current += 1;
    return `${prefix}-${messageCounterRef.current}`;
  };

  useEffect(() => {
    getSuggestedQuestions()
      .then((res) => setSuggestedQuestions(res.questions))
      .catch(() => {
        setSuggestedQuestions([
          'Have we had gas incidents in confined spaces before?',
          'What does OISD-105 say about simultaneous permits?',
          'Tell me about the Visakhapatnam coke oven incident',
        ]);
      });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: nextMessageId('user'),
      role: 'user',
      content: q,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res: RAGResponse = await queryRAG(q);
      const assistantMsg: ChatMessage = {
        id: nextMessageId('assistant'),
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setError(null);
    } catch {
      setError('Knowledge service unavailable or warming up. Please retry in a few seconds.');
      const errorMsg: ChatMessage = {
        id: nextMessageId('error'),
        role: 'assistant',
        content: 'Failed to query the knowledge base. Ensure the backend is running.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-3">
        <h1 className="font-mono text-lg font-bold tracking-wide">INCIDENT INTELLIGENCE</h1>
        <p className="text-xs text-dim-text font-mono mt-0.5">
          Query historical incidents, safety guidelines, and regulatory standards
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Chat Area */}
        <div className="lg:col-span-2 panel flex flex-col min-h-0">
          <div className="panel-header">RAG KNOWLEDGE BASE Q&A</div>
          {error && (
            <div className="px-3 py-2 bg-amber-dim border-b border-amber-warn/30 text-[10px] font-mono text-amber-warn">
              {error}
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-phosphor-dim border border-phosphor/30 rounded-sm flex items-center justify-center">
                    <svg className="w-8 h-8 text-phosphor" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                      <line x1="9" y1="21" x2="15" y2="21" />
                    </svg>
                  </div>
                  <p className="text-sm text-dim-text font-mono">
                    Ask a question about historical incidents, near-miss reports,
                  </p>
                  <p className="text-sm text-dim-text font-mono">
                    or safety guidelines (OISD, Factory Act, DGFASLI).
                  </p>
                </div>

                {/* Suggested Questions */}
                <div className="w-full max-w-[600px] space-y-2">
                  <div className="text-[10px] font-mono text-dim-text uppercase tracking-widest text-center">
                    Suggested Questions
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {suggestedQuestions.slice(0, 5).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(q)}
                        className="text-left bg-void border border-border p-3 rounded-sm text-xs font-mono text-bright-text hover:border-phosphor hover:text-phosphor transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-phosphor-dim border border-phosphor/20 px-4 py-2 rounded-sm'
                        : 'space-y-2'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-sm text-bright-text">{msg.content}</p>
                    ) : (
                      <>
                        <div className="bg-steel border border-border px-4 py-3 rounded-sm">
                          <p className="text-sm text-bright-text leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>

                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-mono text-dim-text uppercase tracking-widest">
                              Sources ({msg.sources.length})
                            </div>
                            {msg.sources.map((src, i) => (
                              <SourceCard key={i} source={src} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div className={`text-[9px] font-mono text-dim-text mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-steel border border-border px-4 py-3 rounded-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-phosphor animate-pulse" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-phosphor animate-pulse" style={{ animationDelay: '200ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-phosphor animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                    <span className="text-xs font-mono text-dim-text">Searching knowledge base...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input flex-1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about historical incidents, safety guidelines..."
                disabled={loading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="btn btn-primary text-xs flex-shrink-0"
              >
                Query
              </button>
            </div>
          </div>
        </div>

        {/* Case Study Sidebar */}
        <div className="panel flex flex-col overflow-y-auto">
          <div className="panel-header flex items-center justify-between border-b border-border p-3 flex-shrink-0">
            <span>HISTORICAL INCIDENT DEEP-DIVE</span>
            <span className="text-[8px] font-mono bg-alert-red-dim text-alert-red border border-alert-red/20 px-1.5 py-0.5 rounded-sm">
              PREVENTABLE
            </span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h3 className="font-mono text-xs font-bold text-bright-text">
                Visakhapatnam Steel Complex Gas Leak (2022)
              </h3>
              <p className="text-[10px] text-dim-text font-mono mt-0.5">
                Coke Oven Door Maintenance Exposure
              </p>
            </div>

            <div className="border-t border-border/50 pt-3 space-y-3">
              <div className="bg-void border border-border p-2.5 rounded-sm">
                <div className="text-[9px] font-mono font-semibold text-alert-red uppercase tracking-widest mb-1">
                  What Happened
                </div>
                <p className="text-[11px] text-dim-text leading-relaxed font-mono">
                  Aging seals broke during coke-oven door replacement under concurrent hot-work permits in the byproduct recovery section, causing a toxic compound leak of H₂S and CO. Two workers collapsed due to exposure.
                </p>
              </div>

              <div className="bg-void border border-border p-2.5 rounded-sm">
                <div className="text-[9px] font-mono font-semibold text-amber-warn uppercase tracking-widest mb-1">
                  Why Traditional Alarms Failed
                </div>
                <p className="text-[11px] text-dim-text leading-relaxed font-mono">
                  Individual gas levels remained at <span className="text-bright-text">7.5 ppm H₂S</span> (below 10 ppm alarm threshold) and <span className="text-bright-text">24 ppm CO</span> (below 25 ppm warning threshold). Since no single sensor breached its individual threshold, no alarm was triggered.
                </p>
              </div>

              <div className="bg-void border border-border p-2.5 rounded-sm">
                <div className="text-[9px] font-mono font-semibold text-phosphor uppercase tracking-widest mb-1">
                  SentraGrid Proactive Flag
                </div>
                <p className="text-[11px] text-dim-text leading-relaxed font-mono">
                  1. Multiplied risk by <span className="text-phosphor font-bold">3.0x</span> due to SIMOPS hot work permit in confined space. <br />
                  2. Analyzed H₂S rising trend (+10 points). <br />
                  3. Risk score hit <span className="text-alert-red font-bold">65 (Critical)</span>. <br />
                  4. **Advantage**: Flagged alert <span className="text-phosphor font-bold">35 mins before the leak</span>, suspending hot-work and ordering purging.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: RAGSource }) {
  const [expanded, setExpanded] = useState(false);

  const sourceColors: Record<string, string> = {
    near_miss_log: 'text-amber-warn border-amber-warn/30',
    oisd_guideline: 'text-phosphor border-phosphor/30',
    factory_act: 'text-bright-text border-border',
  };

  const sourceLabels: Record<string, string> = {
    near_miss_log: 'NEAR MISS',
    oisd_guideline: 'OISD',
    factory_act: 'FACTORY ACT',
  };

  return (
    <div className={`bg-void border rounded-sm ${sourceColors[source.source_type] || 'border-border'}`}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`status-tag text-[8px] ${
          source.source_type === 'near_miss_log' ? 'status-tag-warning' :
          source.source_type === 'oisd_guideline' ? 'status-tag-info' :
          'status-tag-low'
        }`}>
          {sourceLabels[source.source_type] || source.source_type}
        </span>
        <span className="text-[11px] font-mono text-bright-text truncate flex-1">
          {source.title}
        </span>
        <span className="text-dim-text text-[10px]">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="px-3 pb-2 border-t border-border/50">
          <p className="text-[11px] text-dim-text leading-relaxed mt-2">
            {source.content_snippet}
          </p>
        </div>
      )}
    </div>
  );
}
