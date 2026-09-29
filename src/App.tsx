import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { EmailDiscoveryView } from './components/EmailDiscoveryView';
import { LegalStrategyBuilder } from './components/LegalStrategyBuilder';
import { DocumentReproductionView } from './components/DocumentReproductionView';
import { GoogleSheetsLedgerView } from './components/GoogleSheetsLedgerView';
import { CalendarDeadlinesView } from './components/CalendarDeadlinesView';
import { AccountManagerModal } from './components/AccountManagerModal';
import { CreditEconomyModal } from './components/CreditEconomyModal';
import { 
  initAuth, 
  subscribeToAuthChanges 
} from './services/firebaseAuth';
import { 
  ConnectedAccount, 
  EmailMessage, 
  CaseMetadata, 
  LegalStrategyResult, 
  TimelineKeyDate 
} from './types';
import { SAMPLE_CASE_METADATA, SAMPLE_EMAILS } from './mock/sampleCaseData';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('discovery');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<ConnectedAccount | null>(null);

  // Core application state initialized with realistic dispute
  const [caseMeta, setCaseMeta] = useState<CaseMetadata>(SAMPLE_CASE_METADATA);
  const [emails, setEmails] = useState<EmailMessage[]>(SAMPLE_EMAILS);
  const [strategyResult, setStrategyResult] = useState<LegalStrategyResult | null>(null);
  const [deadlines, setDeadlines] = useState<TimelineKeyDate[]>([
    {
      date: '2025-10-12',
      significance: 'Countersigned SOW & Contract Assent ($45,000 fixed price)',
      exhibitRef: 'EXHIBIT A-001',
      syncedToCalendar: false,
    },
    {
      date: '2025-11-19',
      significance: 'Milestone 1 Approved & Wire Confirmed ($17,500)',
      exhibitRef: 'EXHIBIT A-003',
      syncedToCalendar: false,
    },
    {
      date: '2025-12-20',
      significance: 'Final Production Deployment & Acceptance Testing Clear',
      exhibitRef: 'EXHIBIT A-004',
      syncedToCalendar: false,
    },
    {
      date: '2026-01-04',
      significance: 'Final Invoice #VDS-118 Due Date ($27,500)',
      exhibitRef: 'EXHIBIT A-004',
      syncedToCalendar: false,
    },
    {
      date: '2026-01-28',
      significance: '10-Day Statutory Cure Period Expiration (Formal Default Date)',
      exhibitRef: 'EXHIBIT A-006',
      syncedToCalendar: false,
    },
    {
      date: '2026-04-15',
      significance: 'Statute of Limitations / Pleading Filing Target Cutoff',
      exhibitRef: 'LEGAL STATUTE',
      syncedToCalendar: false,
    },
  ]);

  // Modals
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);

  // Subscribe to Firebase Auth
  useEffect(() => {
    initAuth();
    const unsubscribe = subscribeToAuthChanges((accountList, active) => {
      setAccounts(accountList);
      setActiveAccount(active);
    });
    return () => unsubscribe();
  }, []);

  // Update deadlines when strategy is generated
  useEffect(() => {
    if (strategyResult && strategyResult.timelineKeyDates.length > 0) {
      setDeadlines(strategyResult.timelineKeyDates);
    }
  }, [strategyResult]);

  // Token calculations
  const totalRawTokens = emails.reduce((acc, m) => acc + (m.rawTokens || 0), 0);
  const totalCleanTokens = emails.reduce((acc, m) => acc + (m.cleanedTokens || 0), 0);
  const totalTokensSaved = Math.max(0, totalRawTokens - totalCleanTokens);
  const percentSaved = totalRawTokens > 0 
    ? ((totalTokensSaved / totalRawTokens) * 100).toFixed(1) 
    : '0';

  const selectedExhibitsCount = emails.filter(e => e.isSelected).length;

  const handleLoadSampleData = () => {
    setCaseMeta(SAMPLE_CASE_METADATA);
    setEmails(SAMPLE_EMAILS);
    setStrategyResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        accounts={accounts}
        activeAccount={activeAccount}
        onOpenAccountManager={() => setIsAccountManagerOpen(true)}
        onOpenCreditModal={() => setIsCreditModalOpen(true)}
        selectedExhibitsCount={selectedExhibitsCount}
        totalTokensSaved={totalTokensSaved}
        percentSaved={percentSaved}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'discovery' && (
          <EmailDiscoveryView
            emails={emails}
            setEmails={setEmails}
            accounts={accounts}
            activeAccount={activeAccount}
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
            onProceedToStrategy={() => setActiveTab('strategy')}
            onLoadSampleData={handleLoadSampleData}
          />
        )}

        {activeTab === 'strategy' && (
          <LegalStrategyBuilder
            caseMeta={caseMeta}
            setCaseMeta={setCaseMeta}
            emails={emails}
            strategyResult={strategyResult}
            setStrategyResult={setStrategyResult}
            onProceedToDocuments={() => setActiveTab('documents')}
            onProceedToCalendar={() => setActiveTab('calendar')}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentReproductionView
            caseMeta={caseMeta}
            emails={emails}
            strategyResult={strategyResult}
            activeAccount={activeAccount}
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
          />
        )}

        {activeTab === 'sheets' && (
          <GoogleSheetsLedgerView
            emails={emails}
            caseMeta={caseMeta}
            activeAccount={activeAccount}
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarDeadlinesView
            deadlines={deadlines}
            setDeadlines={setDeadlines}
            caseMeta={caseMeta}
            activeAccount={activeAccount}
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
            emails={emails}
            strategyResult={strategyResult}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Legal Strategy Suite • Multi-Account Google Workspace Evidentiary Engine</p>
          <div className="flex items-center gap-4 text-2xs text-slate-400">
            <span>Client-side token optimization</span>
            <span>•</span>
            <span>In-memory OAuth security</span>
            <span>•</span>
            <button 
              onClick={() => setIsCreditModalOpen(true)}
              className="text-emerald-400 hover:underline"
            >
              Zero-Waste Credit Policy
            </button>
          </div>
        </div>
      </footer>

      {/* Account Manager Modal */}
      <AccountManagerModal
        isOpen={isAccountManagerOpen}
        onClose={() => setIsAccountManagerOpen(false)}
        accounts={accounts}
        activeAccount={activeAccount}
        onAccountsUpdated={() => {
          // Trigger any re-sync if needed
        }}
      />

      {/* Credit Economy Modal */}
      <CreditEconomyModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        emails={emails}
      />
    </div>
  );
}
