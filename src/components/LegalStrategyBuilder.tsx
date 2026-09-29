import React, { useState } from 'react';
import { 
  Scale, 
  ShieldCheck, 
  AlertTriangle, 
  HelpCircle, 
  Calendar, 
  Zap, 
  ChevronRight, 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  RefreshCw, 
  Sparkles, 
  MessageSquare, 
  Send, 
  Sliders, 
  DollarSign,
  Download
} from 'lucide-react';
import { 
  EmailMessage, 
  CaseMetadata, 
  LegalStrategyResult, 
  BudgetMode,
  TimelineKeyDate
} from '../types';
import { generateLocalStrategy } from '../utils/creditOptimizer';
import { exportStrategyAndTimelinePdf } from '../utils/pdfExport';

interface LegalStrategyBuilderProps {
  caseMeta: CaseMetadata;
  setCaseMeta: React.Dispatch<React.SetStateAction<CaseMetadata>>;
  emails: EmailMessage[];
  strategyResult: LegalStrategyResult | null;
  setStrategyResult: React.Dispatch<React.SetStateAction<LegalStrategyResult | null>>;
  onProceedToDocuments: () => void;
  onProceedToCalendar: () => void;
}

const CAUSES_OF_ACTION = [
  'Breach of Written Contract & Account Stated',
  'Fraud & Intentional Misrepresentation',
  'Unjust Enrichment & Quantum Meruit',
  'Employment Wage & Hour / Retaliation Dispute',
  'Commercial Landlord-Tenant / Lease Default',
  'Copyright & Intellectual Property Misappropriation',
  'Defamation & Commercial Disparagement',
  'General Civil Breach of Duty',
];

export const LegalStrategyBuilder: React.FC<LegalStrategyBuilderProps> = ({
  caseMeta,
  setCaseMeta,
  emails,
  strategyResult,
  setStrategyResult,
  onProceedToDocuments,
  onProceedToCalendar,
}) => {
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('eco');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Credit-conscious Q&A sub-state
  const [userQuestion, setUserQuestion] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [qaHistory, setQaHistory] = useState<{ question: string; answer: string; tokens?: any }[]>([]);

  const selectedExhibits = emails.filter(e => e.isSelected);

  // Export PDF function
  const handleExportPdf = () => {
    const strat = strategyResult || generateLocalStrategy(caseMeta, emails);
    exportStrategyAndTimelinePdf({
      caseMeta,
      strategyResult: strat,
      deadlines: strat.timelineKeyDates && strat.timelineKeyDates.length > 0 ? strat.timelineKeyDates : [],
      emails,
    });
  };

  // Compute token estimate before generating
  const totalCleanTokens = selectedExhibits.reduce((acc, e) => acc + e.cleanedTokens, 0);
  const estimatedInputTokens = totalCleanTokens + 250;
  const estimatedOutputTokens = 
    budgetMode === 'zero_local' ? 0 : 
    budgetMode === 'eco' ? 650 : 
    budgetMode === 'standard' ? 1400 : 2800;

  // Run Strategy Formulation
  const handleFormulateStrategy = async () => {
    setErrorMsg(null);
    setIsGenerating(true);

    try {
      if (budgetMode === 'zero_local') {
        // Zero AI credits: compute 100% locally
        const localStrategy = generateLocalStrategy(caseMeta, emails);
        setStrategyResult(localStrategy);
      } else {
        // Call server-side credit-conscious endpoint
        const payload = {
          causeOfAction: caseMeta.causeOfAction,
          caseDescription: caseMeta.summary,
          claimant: caseMeta.claimantName,
          opposingParty: caseMeta.opposingPartyName,
          jurisdiction: caseMeta.jurisdiction,
          budgetMode,
          exhibits: selectedExhibits.map(e => ({
            batesNumber: e.batesNumber,
            date: e.date,
            from: e.from,
            to: e.to,
            subject: e.subject,
            cleanedSnippet: e.cleanedBody.slice(0, 700),
          })),
        };

        const res = await fetch('/api/ai/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server error (${res.status})`);
        }

        const data = await res.json();
        if (data.strategy) {
          setStrategyResult({
            ...data.strategy,
            generatedAt: Date.now(),
            budgetMode,
            tokensUsed: data.usage ? {
              promptTokens: data.usage.promptTokensDetails?.totalTokens || data.usage.promptTokenCount || 0,
              completionTokens: data.usage.candidatesTokensDetails?.totalTokens || data.usage.candidatesTokenCount || 0,
              totalTokens: data.usage.totalTokenCount || 0,
            } : undefined,
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to formulate strategy:', err);
      setErrorMsg(err.message || 'Error formulating strategy. You can switch to Zero-Credit Local Mode.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Q&A
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuestion.trim()) return;

    setIsAnswering(true);
    try {
      const payload = {
        question: userQuestion,
        caseInfo: caseMeta,
        selectedExhibits: selectedExhibits.slice(0, 5).map(e => ({
          batesNumber: e.batesNumber,
          date: e.date,
          from: e.from,
          cleanedSnippet: e.cleanedBody.slice(0, 350),
        })),
      };

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await res.json();
      setQaHistory(prev => [
        ...prev,
        {
          question: userQuestion,
          answer: data.answer,
          tokens: data.usage,
        },
      ]);
      setUserQuestion('');
    } catch (err: any) {
      alert(err.message || 'Error answering legal question');
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Case Configuration & Budget Controls Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Legal Strategy &amp; Elements Matrix</h2>
              <p className="text-xs text-slate-400">
                Map documentary email proof to mandatory legal elements while strictly conserving AI tokens.
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <span className="text-xs text-slate-300 font-mono bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <strong className="text-indigo-400">{selectedExhibits.length}</strong> Exhibits Attached
            </span>
          </div>
        </div>

        {/* Case Metadata Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Claimant / Plaintiff Name</label>
            <input
              type="text"
              value={caseMeta.claimantName}
              onChange={e => setCaseMeta(prev => ({ ...prev, claimantName: e.target.value }))}
              placeholder="e.g. Dustin McElroy / Vanguard Systems"
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Opposing Party / Defendant</label>
            <input
              type="text"
              value={caseMeta.opposingPartyName}
              onChange={e => setCaseMeta(prev => ({ ...prev, opposingPartyName: e.target.value }))}
              placeholder="e.g. Apex Commerce Corp. (CEO Marcus Sterling)"
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Damages Demanded / In Dispute</label>
            <input
              type="text"
              value={caseMeta.demandedAmount}
              onChange={e => setCaseMeta(prev => ({ ...prev, demandedAmount: e.target.value }))}
              placeholder="e.g. $27,500.00 plus statutory interest"
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-slate-400 font-medium mb-1">Primary Cause of Action</label>
            <select
              value={caseMeta.causeOfAction}
              onChange={e => setCaseMeta(prev => ({ ...prev, causeOfAction: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-hidden focus:border-indigo-500 font-sans"
            >
              {CAUSES_OF_ACTION.map(coa => (
                <option key={coa} value={coa}>{coa}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Jurisdiction / Forum</label>
            <input
              type="text"
              value={caseMeta.jurisdiction}
              onChange={e => setCaseMeta(prev => ({ ...prev, jurisdiction: e.target.value }))}
              placeholder="e.g. State & Federal Commercial Courts"
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Credit Budget Selector Mode */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-200">AI Credit Budget Controller:</span>
            </div>
            <span className="text-2xs text-slate-400">
              Input: ~{estimatedInputTokens} tokens | Estimated Generation: ~{estimatedOutputTokens} tokens
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Zero Local */}
            <button
              type="button"
              onClick={() => setBudgetMode('zero_local')}
              className={`p-3 rounded-xl border text-left transition-all ${
                budgetMode === 'zero_local'
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-400">0 Credits</span>
                <span className="text-3xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Local</span>
              </div>
              <p className="text-2xs text-slate-400">Deterministic synthesis. In-browser matching.</p>
            </button>

            {/* Eco Mode */}
            <button
              type="button"
              onClick={() => setBudgetMode('eco')}
              className={`p-3 rounded-xl border text-left transition-all ${
                budgetMode === 'eco'
                  ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-indigo-300">Eco Flash</span>
                <span className="text-3xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">⚡ ~600 tokens</span>
              </div>
              <p className="text-2xs text-slate-400">Ultra-compact prompt. Sharp evidentiary bullets.</p>
            </button>

            {/* Standard Mode */}
            <button
              type="button"
              onClick={() => setBudgetMode('standard')}
              className={`p-3 rounded-xl border text-left transition-all ${
                budgetMode === 'standard'
                  ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200">Standard</span>
                <span className="text-3xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">~1,400 tokens</span>
              </div>
              <p className="text-2xs text-slate-400">Balanced doctrine, defenses &amp; discovery checklist.</p>
            </button>

            {/* Deep Counsel */}
            <button
              type="button"
              onClick={() => setBudgetMode('deep')}
              className={`p-3 rounded-xl border text-left transition-all ${
                budgetMode === 'deep'
                  ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-purple-300">Deep Trial</span>
                <span className="text-3xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">~2,800 tokens</span>
              </div>
              <p className="text-2xs text-slate-400">Exhaustive brief, burden of proof &amp; counter-theories.</p>
            </button>
          </div>

          {/* Formulate Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-2xs text-slate-400">
              {budgetMode === 'zero_local'
                ? '⚡ 100% Free: No LLM calls. Runs instantly in your browser.'
                : '🛡️ Local cleaner has already stripped disclaimers and reply trees to minimize prompt cost.'}
            </span>

            <button
              type="button"
              onClick={handleFormulateStrategy}
              disabled={isGenerating || selectedExhibits.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Formulating Strategy...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {strategyResult ? 'Re-Evaluate Strategy' : 'Formulate Legal Strategy'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Strategy Results Display */}
      {strategyResult && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Case Assessment &amp; Viability Summary
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all"
                  title="Export complete legal strategy and timeline brief as a publication-ready PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PDF Brief</span>
                </button>
                <span className={`text-2xs font-bold px-2.5 py-1 rounded-full border ${
                  strategyResult.settlementLeverage.rating === 'Strong'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  Settlement Leverage: {strategyResult.settlementLeverage.rating}
                </span>
                {strategyResult.tokensUsed && (
                  <span className="text-3xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    Tokens: {strategyResult.tokensUsed.totalTokens}
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              {strategyResult.executiveSummary}
            </p>

            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs space-y-1">
              <strong className="text-indigo-300">Recommended Pre-Trial Strategy:</strong>
              <p className="text-slate-300">{strategyResult.settlementLeverage.recommendedStrategy}</p>
            </div>
          </div>

          {/* Elements of Proof Table */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Elements of Proof Matrix ({caseMeta.causeOfAction})
                </h3>
                <p className="text-xs text-slate-400">
                  Documentary proof mapped to legal elements required to establish liability or defend claims.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {strategyResult.elementsOfProof.map((elem, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-2xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-100">{elem.element}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-2xs font-semibold px-2 py-0.5 rounded border ${
                          elem.status === 'Strong'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : elem.status === 'Moderate'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {elem.status} Evidence
                      </span>

                      {elem.supportingExhibits.length > 0 && (
                        <div className="flex items-center gap-1">
                          {elem.supportingExhibits.map(ex => (
                            <span key={ex} className="text-3xs font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                              {ex}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {elem.factualAnalysis}
                  </p>

                  {elem.gapsAndDiscovery && (
                    <div className="text-2xs text-amber-300/90 bg-amber-500/5 border border-amber-500/15 p-2 rounded-lg flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        <strong>Discovery Need / Potential Gap:</strong> {elem.gapsAndDiscovery}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Anticipated Affirmative Defenses */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Anticipated Affirmative Defenses &amp; Counter-Refutations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {strategyResult.anticipatedDefenses.map((def, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{def.defense}</span>
                    <span className={`text-3xs font-semibold px-2 py-0.5 rounded ${
                      def.likelihood === 'High' ? 'bg-rose-500/20 text-rose-300' :
                      def.likelihood === 'Medium' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {def.likelihood} Risk
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-emerald-400">Refutation:</strong> {def.counterRefutation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Items & Next Steps Bar */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/50 to-slate-900 border border-indigo-500/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Recommended Procedural Action Plan</h3>
                <p className="text-xs text-slate-400">Concrete steps to execute your pre-trial leverage</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PDF Brief</span>
                </button>
                <button
                  onClick={onProceedToCalendar}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Review Deadlines ({strategyResult.timelineKeyDates.length})</span>
                </button>
                <button
                  onClick={onProceedToDocuments}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Reproduce Legal Documents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <ul className="space-y-2 text-xs text-slate-300">
              {strategyResult.recommendedActionItems.map((act, i) => (
                <li key={i} className="flex items-start gap-2 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Credit-Conscious Legal Q&A Drawer */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200">
                  Credit-Conscious Legal Strategy Q&amp;A
                </h3>
              </div>
              <span className="text-2xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                ⚡ Minimal token query mode
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Ask targeted questions about your claims or how opposing counsel might respond. Only relevant exhibit excerpts are passed.
            </p>

            {/* Q&A History */}
            {qaHistory.length > 0 && (
              <div className="space-y-3 pt-2">
                {qaHistory.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                    <div className="font-semibold text-indigo-300 flex items-center gap-2">
                      <span>Q: {item.question}</span>
                    </div>
                    <div className="text-slate-300 leading-relaxed pl-3 border-l-2 border-indigo-500/40 whitespace-pre-wrap">
                      {item.answer}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Question Input */}
            <form onSubmit={handleAskQuestion} className="flex gap-2 pt-2">
              <input
                type="text"
                value={userQuestion}
                onChange={e => setUserQuestion(e.target.value)}
                placeholder="e.g. If they claim the scope changed orally, does our email record protect us?"
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-sans"
              />
              <button
                type="submit"
                disabled={isAnswering || !userQuestion.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                {isAnswering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Ask</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
