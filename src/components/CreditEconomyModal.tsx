import React from 'react';
import { Zap, ShieldCheck, Cpu, Database, Check, X, Sparkles, TrendingDown } from 'lucide-react';
import { EmailMessage } from '../types';

interface CreditEconomyModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: EmailMessage[];
}

export const CreditEconomyModal: React.FC<CreditEconomyModalProps> = ({
  isOpen,
  onClose,
  emails,
}) => {
  if (!isOpen) return null;

  const totalRawTokens = emails.reduce((acc, m) => acc + (m.rawTokens || 0), 0);
  const totalCleanTokens = emails.reduce((acc, m) => acc + (m.cleanedTokens || 0), 0);
  const totalSavedTokens = Math.max(0, totalRawTokens - totalCleanTokens);
  const percentSaved = totalRawTokens > 0 ? ((totalSavedTokens / totalRawTokens) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Zero-Waste Credit &amp; Token Economy</h2>
              <p className="text-xs text-slate-400">Deterministic local pre-processing saves up to 90% of your AI budget</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Live Meter Card */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-emerald-950/30 border border-indigo-500/20">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                Current Case Evidentiary Footprint
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <TrendingDown className="w-3.5 h-3.5" /> {percentSaved}% Tokens Saved Locally
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <div className="text-2xs text-slate-400 uppercase tracking-wider mb-1">Raw Ingested</div>
                <div className="text-lg font-bold font-mono text-slate-300">
                  {totalRawTokens.toLocaleString()}
                </div>
                <div className="text-2xs text-slate-500">Unfiltered tokens</div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <div className="text-2xs text-slate-400 uppercase tracking-wider mb-1">Cleaned Footprint</div>
                <div className="text-lg font-bold font-mono text-indigo-300">
                  {totalCleanTokens.toLocaleString()}
                </div>
                <div className="text-2xs text-indigo-400/80">Active sent tokens</div>
              </div>

              <div className="p-3 bg-emerald-950/40 rounded-lg border border-emerald-500/30">
                <div className="text-2xs text-emerald-300 uppercase tracking-wider mb-1">Credits Conserved</div>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {totalSavedTokens.toLocaleString()}
                </div>
                <div className="text-2xs text-emerald-400/80">Tokens preserved</div>
              </div>
            </div>
          </div>

          {/* Pillars */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              How Your Legal Budget is Protected
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-medium text-xs">
                  <Database className="w-4 h-4" />
                  <span>1. Local Boilerplate Stripping</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Removes repetitive email quote chains (`&gt; on Jan 14 wrote`), confidentiality disclaimers, CSS styles, and signatures in your browser before any prompt is assembled.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-medium text-xs">
                  <Cpu className="w-4 h-4" />
                  <span>2. Zero-AI Bates Stamping &amp; Entity Extractor</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dates, monetary damages, legal trigger words, and Bates stamps (`EXHIBIT A-001`) are processed via regex algorithms without calling Gemini or spending credits.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-medium text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>3. Parameterized Document Templates</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Standard court captions, notary verifications, demand notices, and evidence indices can be reproduced with 0 credits using local legal templates.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-medium text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>4. Granular Excerpt Ingestion</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Instead of dumping 500 emails into a bloated context window, only the specific checkmarked exhibits and relevant sentences are passed to the model.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
